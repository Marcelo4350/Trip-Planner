"""Smoke test for the HOS simulator.

Run with:  python test_sim.py
"""
import os
import sys
import django
from datetime import datetime, timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "eld_project.settings")
django.setup()

from trips.services.hos_simulator import (
    HosSimulator,
    Segment,
    split_events_into_days,
)


def run(label, segments, start, cycle_used):
    sim = HosSimulator(
        segments=segments,
        start_time=start,
        current_cycle_used_hours=cycle_used,
        start_label=segments[0].start_label,
        start_coord=segments[0].start_coord,
    )
    events = sim.run()
    print(f"\n=== {label} ===")
    for e in events:
        print(
            f"{e['status']:22} {e['start'][:16]} -> {e['end'][11:16]} "
            f"{e['duration_hours']:5.2f}h  miles={e['miles']:6.1f}  {e['note']}"
        )
    print(f"final cycle hours: {sim.state.cycle_used_h:.2f}")
    days = split_events_into_days(events, start)
    print(f"days: {len(days)}")
    for d in days:
        print(f"  {d['date']} miles={d['total_miles']}  totals={d['totals_hours']}")
    return events, days


def main():
    # Long-haul: Chicago -> Dallas -> Miami (~2235 mi), cycle almost maxed
    s1 = Segment(
        name="Chicago -> Dallas",
        start_label="Chicago, IL",
        end_label="Dallas, TX",
        start_coord=[-87.6298, 41.8781],
        end_coord=[-96.7970, 32.7767],
        distance_miles=925.0,
        duration_hours=14.5,
        polyline=[[-87.6298, 41.8781], [-96.7970, 32.7767]],
        on_duty_on_arrival_h=1.0,
        on_arrival_note="Pickup",
    )
    s2 = Segment(
        name="Dallas -> Miami",
        start_label="Dallas, TX",
        end_label="Miami, FL",
        start_coord=[-96.7970, 32.7767],
        end_coord=[-80.1918, 25.7617],
        distance_miles=1310.0,
        duration_hours=19.2,
        polyline=[[-96.7970, 32.7767], [-80.1918, 25.7617]],
        on_duty_on_arrival_h=1.0,
        on_arrival_note="Dropoff",
    )
    run("Long haul", [s1, s2], datetime(2026, 4, 23, 6, 0, tzinfo=timezone.utc), 20.0)

    # Short: 60-mile local run
    s = Segment(
        name="Short",
        start_label="A",
        end_label="B",
        start_coord=[-87.0, 41.0],
        end_coord=[-86.0, 41.0],
        distance_miles=60.0,
        duration_hours=1.1,
        polyline=[[-87.0, 41.0], [-86.0, 41.0]],
        on_duty_on_arrival_h=1.0,
    )
    s2 = Segment(
        name="Short2",
        start_label="B",
        end_label="C",
        start_coord=[-86.0, 41.0],
        end_coord=[-85.0, 41.0],
        distance_miles=60.0,
        duration_hours=1.1,
        polyline=[[-86.0, 41.0], [-85.0, 41.0]],
        on_duty_on_arrival_h=1.0,
    )
    run("Short haul", [s, s2], datetime(2026, 4, 23, 6, 0, tzinfo=timezone.utc), 0.0)


if __name__ == "__main__":
    main()
