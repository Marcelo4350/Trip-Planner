"""Geocoding using the free OpenStreetMap Nominatim API.

Nominatim has a usage policy (1 req/s, descriptive User-Agent required). We keep
requests light (one per address) and cache in-process for repeats.
"""
from __future__ import annotations

import threading
import time
from typing import Optional, Tuple

import requests
from django.conf import settings


_CACHE: dict[str, dict] = {}
_LOCK = threading.Lock()
_LAST_CALL = [0.0]


def _rate_limit() -> None:
    # Nominatim asks for <= 1 request per second.
    with _LOCK:
        elapsed = time.time() - _LAST_CALL[0]
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        _LAST_CALL[0] = time.time()


class GeocodingError(Exception):
    pass


def geocode(query: str) -> dict:
    """Return {lat, lon, display_name} for a free-form address string."""
    if not query or not query.strip():
        raise GeocodingError("Empty query")

    key = query.strip().lower()
    if key in _CACHE:
        return _CACHE[key]

    _rate_limit()
    url = f"{settings.NOMINATIM_BASE_URL}/search"
    params = {"q": query, "format": "json", "limit": 1, "addressdetails": 0}
    headers = {"User-Agent": settings.USER_AGENT, "Accept-Language": "en"}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise GeocodingError(f"Geocoding request failed: {e}") from e

    results = resp.json()
    if not results:
        raise GeocodingError(f"No geocoding results for '{query}'")

    r = results[0]
    out = {
        "lat": float(r["lat"]),
        "lon": float(r["lon"]),
        "display_name": r.get("display_name", query),
    }
    _CACHE[key] = out
    return out
