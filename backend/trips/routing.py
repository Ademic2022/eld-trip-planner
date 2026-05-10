import time
import requests
from django.conf import settings

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"
HEADERS = {"User-Agent": "ELDTripPlanner/1.0"}
METERS_PER_MILE = 1609.34


def geocode_location(address: str) -> dict:
    resp = requests.get(
        NOMINATIM_URL,
        params={"q": address, "format": "json", "limit": 1},
        headers=HEADERS,
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise ValueError(f"Could not geocode: {address!r}")
    r = results[0]
    time.sleep(1)  # Nominatim rate limit: 1 req/sec
    return {
        "lat": float(r["lat"]),
        "lng": float(r["lon"]),
        "display_name": r["display_name"],
    }


def get_ors_route(waypoints: list) -> dict:
    """
    waypoints: list of dicts with 'lat' and 'lng' keys.
    Returns dict with polyline (list of {lat, lng}), total_miles,
    total_duration_hours, and segments (list of {miles, duration_hours}).
    """
    api_key = settings.ORS_API_KEY
    if not api_key:
        raise ValueError("ORS_API_KEY not configured")

    # ORS uses [longitude, latitude] order (GeoJSON)
    coordinates = [[wp["lng"], wp["lat"]] for wp in waypoints]

    resp = requests.post(
        ORS_URL,
        json={"coordinates": coordinates, "instructions": False},
        headers={**HEADERS, "Authorization": api_key, "Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    feature = data["features"][0]
    props = feature["properties"]
    summary = props["summary"]

    # Extract polyline — GeoJSON geometry coordinates are [lng, lat]
    coords = feature["geometry"]["coordinates"]
    polyline = [{"lat": c[1], "lng": c[0]} for c in coords]

    total_miles = summary["distance"] / METERS_PER_MILE
    total_duration_hours = summary["duration"] / 3600.0

    # Per-segment breakdown (one segment per waypoint pair)
    segments = []
    for seg in props.get("segments", []):
        segments.append({
            "miles": seg["distance"] / METERS_PER_MILE,
            "duration_hours": seg["duration"] / 3600.0,
        })

    return {
        "polyline": polyline,
        "total_miles": total_miles,
        "total_duration_hours": total_duration_hours,
        "segments": segments,
    }
