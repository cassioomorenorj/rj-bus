#!/usr/bin/env python3
"""Convert an official GTFS ZIP to small planned route/stop indexes.

Usage: python3 update_gtfs.py /path/to/gtfs.zip /path/to/output

This script uses only Python's standard library. It does not download data,
infer arrivals, filter to today's operating services, or claim a stop sequence.
Each route's stopIds is the union of its scheduled trip stop references.
"""

import argparse
import csv
import io
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

SOURCE = "https://dados.mobilidade.rio/gtfs/schedule"


def gtfs_date(value):
    """Return a declared GTFS date in ISO format without inferring a date."""
    if not value:
        return None
    return datetime.strptime(value, "%Y%m%d").date().isoformat()


def is_road_bus(route_type):
    # Standard bus/trolleybus plus extended coach, bus, and trolleybus types.
    return route_type in (3, 11) or 200 <= route_type <= 299 or 700 <= route_type <= 899


def unique_rows(rows, key, label):
    result = {}
    for row in rows:
        identifier = row.get(key, "").strip()
        if not identifier:
            raise ValueError(f"{label}: empty {key}")
        if identifier in result:
            raise ValueError(f"{label}: duplicate {key}: {identifier}")
        result[identifier] = row
    return result


def convert(zip_path, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    with ZipFile(zip_path) as archive:
        available = set(archive.namelist())

        def rows(name, optional=False):
            if name not in available:
                if optional:
                    return
                raise ValueError(f"Required GTFS table missing: {name}")
            with archive.open(name) as source:
                yield from csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig", newline=""))

        agencies = unique_rows(rows("agency.txt"), "agency_id", "agency.txt")
        all_routes = unique_rows(rows("routes.txt"), "route_id", "routes.txt")
        raw_stops = unique_rows(rows("stops.txt"), "stop_id", "stops.txt")
        all_trips = unique_rows(rows("trips.txt"), "trip_id", "trips.txt")
        feed_info = list(rows("feed_info.txt", optional=True))
        if len(feed_info) > 1:
            raise ValueError("feed_info.txt: more than one feed metadata record")
        declared_feed = feed_info[0] if feed_info else {}
        calendar = list(rows("calendar.txt", optional=True))
        calendar_dates = list(rows("calendar_dates.txt", optional=True))

        selected_routes = {}
        route_types = Counter()
        for route_id, row in all_routes.items():
            route_type = int(row["route_type"])
            route_types[str(route_type)] += 1
            if not is_road_bus(route_type):
                continue
            agency_id = row.get("agency_id", "")
            if agency_id not in agencies:
                raise ValueError(f"Route {route_id}: unknown agency_id {agency_id}")
            selected_routes[route_id] = {
                "id": route_id,
                "number": row.get("route_short_name", ""),
                "name": row.get("route_long_name", ""),
                "agency": agencies[agency_id]["agency_name"],
            }

        coordinates = {}
        for stop_id, row in raw_stops.items():
            try:
                lat, lon = float(row["stop_lat"]), float(row["stop_lon"])
            except (ValueError, KeyError) as exc:
                raise ValueError(f"Stop {stop_id}: invalid or missing coordinates") from exc
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"Stop {stop_id}: coordinates outside WGS84 bounds")
            if lat == 0 and lon == 0:
                raise ValueError(f"Stop {stop_id}: zero coordinates")
            coordinates[stop_id] = (lat, lon)

        directions = defaultdict(lambda: defaultdict(set))
        trip_routes = {}
        included_trips = 0
        for trip_id, row in all_trips.items():
            route_id = row["route_id"]
            if route_id not in all_routes:
                raise ValueError(f"Trip {trip_id}: unknown route_id {route_id}")
            trip_routes[trip_id] = route_id
            if route_id not in selected_routes:
                continue
            included_trips += 1
            direction = row.get("direction_id", "")
            if direction not in ("", "0", "1"):
                raise ValueError(f"Trip {trip_id}: invalid direction_id {direction}")
            headsign = row.get("trip_headsign", "").strip()
            if direction:
                # Multiple declared headsigns are retained, not guessed as ida/volta.
                directions[route_id][direction].add(headsign)

        route_stops = defaultdict(set)
        stop_routes = defaultdict(set)
        stop_time_count = 0
        included_stop_time_count = 0
        for row in rows("stop_times.txt"):
            stop_time_count += 1
            trip_id, stop_id = row["trip_id"], row["stop_id"]
            if trip_id not in trip_routes:
                raise ValueError(f"stop_times.txt: unknown trip_id {trip_id}")
            if stop_id not in raw_stops:
                raise ValueError(f"stop_times.txt: unknown stop_id {stop_id}")
            route_id = trip_routes[trip_id]
            if route_id in selected_routes:
                included_stop_time_count += 1
                route_stops[route_id].add(stop_id)
                stop_routes[stop_id].add(route_id)

        routes = []
        for route_id, row in selected_routes.items():
            if not route_stops[route_id]:
                raise ValueError(f"Route {route_id}: no referenced scheduled stops")
            routes.append({
                **row,
                "stopIds": sorted(route_stops[route_id]),
                "directions": [
                    {"id": direction, "label": " / ".join(sorted(label for label in labels if label))}
                    for direction, labels in sorted(directions[route_id].items())
                ],
            })
        routes.sort(key=lambda row: (row["number"], row["id"]))

        stops = []
        for stop_id in sorted(stop_routes):
            lat, lon = coordinates[stop_id]
            stops.append({
                "id": stop_id,
                "name": raw_stops[stop_id].get("stop_name", ""),
                "lat": lat,
                "lon": lon,
                "routeIds": sorted(stop_routes[stop_id]),
            })

        route_ids = {route["id"] for route in routes}
        stop_ids = {stop["id"] for stop in stops}
        if len(route_ids) != len(routes) or len(stop_ids) != len(stops):
            raise ValueError("Duplicate output IDs")
        for route in routes:
            for stop_id in route["stopIds"]:
                if stop_id not in stop_ids or route["id"] not in stop_routes[stop_id]:
                    raise ValueError("Broken route-to-stop referential integrity")
        for stop in stops:
            for route_id in stop["routeIds"]:
                if route_id not in route_ids or stop["id"] not in route_stops[route_id]:
                    raise ValueError("Broken stop-to-route referential integrity")

        common = {"source": SOURCE, "generatedAt": generated_at}
        route_document = {
            **common,
            "feed": {
                "publisher": declared_feed.get("feed_publisher_name") or None,
                "startDate": gtfs_date(declared_feed.get("feed_start_date")),
                "endDate": gtfs_date(declared_feed.get("feed_end_date")),
            },
            "routes": routes,
        }
        stop_document = {**common, "stops": stops}
        for name, document in (("routes.json", route_document), ("stops.json", stop_document)):
            payload = json.dumps(document, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
            (output_dir / name).write_text(payload, encoding="utf-8")

        calendar_starts = [gtfs_date(row["start_date"]) for row in calendar if row.get("start_date")]
        calendar_ends = [gtfs_date(row["end_date"]) for row in calendar if row.get("end_date")]
        exception_dates = [gtfs_date(row["date"]) for row in calendar_dates if row.get("date")]
        report = {
            **common,
            "scope": "Planned published GTFS routes and their union of scheduled stops. No current-service filtering, stop order, real-time operation, or arrival predictions are implied.",
            "feed": route_document["feed"],
            "declaredFeedVersion": declared_feed.get("feed_version") or None,
            "calendarCoverage": {
                "startDate": min(calendar_starts) if calendar_starts else None,
                "endDate": max(calendar_ends) if calendar_ends else None,
                "exceptionStartDate": min(exception_dates) if exception_dates else None,
                "exceptionEndDate": max(exception_dates) if exception_dates else None,
            },
            "sourceCounts": {
                "routes": len(all_routes), "stops": len(raw_stops), "trips": len(all_trips),
                "stopTimes": stop_time_count, "agencies": len(agencies),
            },
            "outputCounts": {
                "routes": len(routes), "stops": len(stops), "tripsJoined": included_trips,
                "stopTimesJoined": included_stop_time_count,
                "routeStopPairs": sum(len(route["stopIds"]) for route in routes),
                "unreferencedStopsExcluded": len(raw_stops) - len(stops),
            },
            "routeTypeCounts": dict(sorted(route_types.items())),
            "includedRouteTypes": sorted({all_routes[route["id"]]["route_type"] for route in routes}),
            "referencedStopTypeCounts": dict(Counter(raw_stops[stop["id"]].get("location_type", "") for stop in stops)),
            "coordinateBounds": {
                "minLatitude": min(stop["lat"] for stop in stops),
                "maxLatitude": max(stop["lat"] for stop in stops),
                "minLongitude": min(stop["lon"] for stop in stops),
                "maxLongitude": max(stop["lon"] for stop in stops),
            },
            "validation": {"duplicateIds": 0, "invalidCoordinates": 0, "brokenReferences": 0},
            "fileBytes": {name: (output_dir / name).stat().st_size for name in ("routes.json", "stops.json")},
            "line355": [
                {key: value for key, value in route.items() if key != "stopIds"} | {"stopCount": len(route["stopIds"])}
                for route in routes if route["number"] == "355"
            ],
        }
        (output_dir / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("output_dir", type=Path)
    arguments = parser.parse_args()
    print(json.dumps(convert(arguments.zip_path, arguments.output_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
