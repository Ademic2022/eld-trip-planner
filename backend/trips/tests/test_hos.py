from datetime import datetime, timedelta, timezone
from django.test import TestCase
from trips.hos_engine import (
    plan_trip, group_events_by_day, ELDEvent,
    DRIVING, ON_DUTY_ND, OFF_DUTY, SLEEPER,
    MAX_DRIVING_HRS, DUTY_WINDOW_HRS,
    FUEL_INTERVAL_MI, SPEED_MPH, STOP_FUEL, STOP_BREAK, STOP_REST,
)


def _loc(name, lat, lng):
    return {"lat": lat, "lng": lng, "display_name": name}


def _route(seg0, seg1):
    total = seg0 + seg1
    return {
        "total_miles": total,
        "total_duration_hours": total / SPEED_MPH,
        "polyline": [],
        "segments": [
            {"miles": seg0, "duration_hours": seg0 / SPEED_MPH},
            {"miles": seg1, "duration_hours": seg1 / SPEED_MPH},
        ],
    }


class ShortTripTest(TestCase):
    """~460-mile Chicago→Indy→Nashville fits in a single driving day."""

    def setUp(self):
        self.result = plan_trip(
            _loc("Chicago, IL", 41.8781, -87.6298),
            _loc("Indianapolis, IN", 39.7684, -86.1581),
            _loc("Nashville, TN", 36.1627, -86.7816),
            _route(181, 278),
            cycle_hours_used=0.0,
        )

    def test_events_exist(self):
        self.assertTrue(len(self.result["events"]) > 0)

    def test_stops_include_pickup_and_dropoff(self):
        types = [s.stop_type for s in self.result["stops"]]
        self.assertIn("PICKUP", types)
        self.assertIn("DROPOFF", types)

    def test_no_rest_stop_needed(self):
        types = [s.stop_type for s in self.result["stops"]]
        self.assertNotIn("OVERNIGHT_REST", types)

    def test_daily_log_hours_sum_correctly(self):
        logs = group_events_by_day(self.result["events"])
        self.assertTrue(len(logs) >= 1)
        for log in logs:
            total = (log["totalOffDuty"] + log["totalSleeperBerth"] +
                     log["totalDriving"] + log["totalOnDuty"])
            self.assertLessEqual(total, 24.05)

    def test_no_day_exceeds_11hr_driving(self):
        logs = group_events_by_day(self.result["events"])
        for log in logs:
            self.assertLessEqual(log["totalDriving"], MAX_DRIVING_HRS + 0.01)


class BreakTriggerTest(TestCase):
    """Segment > 440 miles (8 hrs at 55 mph) must trigger a 30-min break."""

    def test_break_inserted_after_8hr_driving(self):
        result = plan_trip(
            _loc("Chicago, IL", 41.8781, -87.6298),
            _loc("Memphis, TN", 35.1495, -90.0490),
            _loc("Houston, TX", 29.7604, -95.3698),
            _route(530, 570),
            cycle_hours_used=0.0,
        )
        types = [s.stop_type for s in result["stops"]]
        self.assertIn(STOP_BREAK, types)


class FuelStopTest(TestCase):
    """Driving segment > 1,000 miles must insert a fuel stop."""

    def test_fuel_stop_generated(self):
        result = plan_trip(
            _loc("Seattle, WA", 47.6062, -122.3321),
            _loc("San Francisco, CA", 37.7749, -122.4194),
            _loc("Los Angeles, CA", 34.0522, -118.2437),
            _route(808, 381),
            cycle_hours_used=0.0,
        )
        types = [s.stop_type for s in result["stops"]]
        self.assertIn(STOP_FUEL, types)


class LongTripTest(TestCase):
    """2,800-mile trip needs multiple rest stops and multiple daily logs."""

    def setUp(self):
        self.result = plan_trip(
            _loc("Seattle, WA", 47.6062, -122.3321),
            _loc("Chicago, IL", 41.8781, -87.6298),
            _loc("New York, NY", 40.7128, -74.0060),
            _route(2065, 790),
            cycle_hours_used=0.0,
        )

    def test_rest_stop_generated(self):
        types = [s.stop_type for s in self.result["stops"]]
        self.assertIn(STOP_REST, types)

    def test_multiple_daily_logs(self):
        logs = group_events_by_day(self.result["events"])
        self.assertGreater(len(logs), 1)

    def test_no_hos_session_exceeds_11hr_driving(self):
        # 11-hr limit is per HOS session (between 10-hr rests), not calendar day.
        events = self.result["events"]
        session_driving = 0.0
        for ev in events:
            if ev.status == DRIVING:
                session_driving += ev.duration_hours
            elif ev.status == SLEEPER and ev.duration_hours >= 9.9:
                self.assertLessEqual(session_driving, MAX_DRIVING_HRS + 0.01)
                session_driving = 0.0
        self.assertLessEqual(session_driving, MAX_DRIVING_HRS + 0.01)


class GroupByDayTest(TestCase):
    def test_single_day(self):
        now = datetime(2025, 1, 15, 6, 0, 0, tzinfo=timezone.utc)
        events = [ELDEvent(DRIVING, now, now + timedelta(hours=5), "Chicago")]
        logs = group_events_by_day(events)
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["date"], "2025-01-15")
        self.assertAlmostEqual(logs[0]["totalDriving"], 5.0, places=1)
        # Gap-fill pads remaining 19 hours as OFF_DUTY → total = 24
        day_total = logs[0]["totalOffDuty"] + logs[0]["totalSleeperBerth"] + logs[0]["totalDriving"] + logs[0]["totalOnDuty"]
        self.assertAlmostEqual(day_total, 24.0, places=1)

    def test_event_spanning_midnight(self):
        midnight = datetime(2025, 1, 15, 23, 0, 0, tzinfo=timezone.utc)
        events = [ELDEvent(OFF_DUTY, midnight, midnight + timedelta(hours=10), "Rest")]
        logs = group_events_by_day(events)
        self.assertEqual(len(logs), 2)
        # Gap-filling ensures each day totals exactly 24 hours
        for log in logs:
            day_total = log["totalOffDuty"] + log["totalSleeperBerth"] + log["totalDriving"] + log["totalOnDuty"]
            self.assertAlmostEqual(day_total, 24.0, places=1)
        # Only OFF_DUTY events exist, so both days are all OFF_DUTY
        self.assertAlmostEqual(logs[0]["totalOffDuty"], 24.0, places=1)
        self.assertAlmostEqual(logs[1]["totalOffDuty"], 24.0, places=1)
