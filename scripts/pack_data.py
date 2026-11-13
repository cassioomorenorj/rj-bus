"""Compact the validated route/stop output without losing GTFS identifiers."""
import json
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
routes = json.loads((source / "routes.json").read_text())
stops = json.loads((source / "stops.json").read_text())
indexes = {r["id"]: i for i, r in enumerate(routes["routes"])}
data = {key: routes[key] for key in ("source", "generatedAt", "feed")}
data["schemaVersion"] = 1
data["routes"] = [{k: v for k, v in r.items() if k != "stopIds"} for r in routes["routes"]]
data["stops"] = [[s["id"], s["name"], s["lat"], s["lon"], [indexes[i] for i in s["routeIds"]]] for s in stops["stops"]]
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"{len(data['routes'])} linhas, {len(data['stops'])} pontos; {target.stat().st_size} bytes")
