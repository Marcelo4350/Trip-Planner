"""Routing via OpenRouteService (free tier).

Returns distance (meters), duration (seconds), and geometry (GeoJSON LineString).
"""

from __future__ import annotations

import logging
import time
from typing import Iterable, Tuple

import requests
from django.conf import settings
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import RequestException, Timeout

logger = logging.getLogger(__name__)


class RoutingError(Exception):
    pass


ORS_TIMEOUT_SECONDS = 30
ORS_MAX_RETRIES = 2


def route(coordinates: Iterable[Tuple[float, float]]) -> dict:
    """
    coordinates: iterable of (lon, lat) tuples in order of travel.
    Returns: {distance_meters, duration_seconds, geometry (GeoJSON LineString), legs}
    """
    coords = list(coordinates)
    if len(coords) < 2:
        raise RoutingError("Need at least 2 coordinates to build a route")

    if not settings.ORS_API_KEY:
        raise RoutingError("ORS_API_KEY is not configured")

    url = f"{settings.ORS_BASE_URL}/v2/directions/driving-hgv/geojson"
    headers = {
        "Authorization": settings.ORS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json, application/geo+json",
        "User-Agent": settings.USER_AGENT,
    }
    body = {
        "coordinates": [[lon, lat] for lon, lat in coords],
        "instructions": False,
    }

    last_exc: Exception | None = None
    resp = None
    for attempt in range(ORS_MAX_RETRIES + 1):
        try:
            resp = requests.post(
                url, json=body, headers=headers, timeout=ORS_TIMEOUT_SECONDS
            )
            resp.raise_for_status()
            break
        except (Timeout, RequestsConnectionError) as e:
            last_exc = e
            if attempt < ORS_MAX_RETRIES:
                backoff = 2 ** attempt
                logger.warning(
                    "ORS attempt %d/%d failed (%s). Retrying in %ds...",
                    attempt + 1, ORS_MAX_RETRIES + 1, e, backoff,
                )
                time.sleep(backoff)
                continue
            raise RoutingError(
                f"ORS unreachable after {ORS_MAX_RETRIES + 1} attempts: {e}"
            ) from e
        except RequestException as e:
            raise RoutingError(f"ORS request failed: {e}") from e

    data = resp.json()
    features = data.get("features") or []
    if not features:
        raise RoutingError(f"ORS returned no route: {data}")

    feature = features[0]
    props = feature.get("properties", {})
    summary = props.get("summary", {})
    segments = props.get("segments", [])

    legs = [
        {
            "distance_meters": seg.get("distance", 0),
            "duration_seconds": seg.get("duration", 0),
        }
        for seg in segments
    ]

    return {
        "distance_meters": summary.get("distance", 0),
        "duration_seconds": summary.get("duration", 0),
        "geometry": feature.get("geometry"),  # GeoJSON LineString {type, coordinates}
        "legs": legs,
    }
