from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

# ── HOS Constants ──────────────────────────────────────────────────────────────
MAX_DRIVING_HRS = 11.0
DUTY_WINDOW_HRS = 14.0
BREAK_TRIGGER_HRS = 8.0
BREAK_DUR_HRS = 0.5
REST_DUR_HRS = 10.0
MAX_CYCLE_HRS = 70.0
FUEL_INTERVAL_MI = 1000.0
FUEL_DUR_HRS = 0.5
INSPECTION_DUR_HRS = 0.25
LOAD_DUR_HRS = 1.0
DEFAULT_START_HOUR = 6
SPEED_MPH = 55.0

# Duty status constants
OFF_DUTY = "OFF_DUTY"
SLEEPER = "SLEEPER_BERTH"
DRIVING = "DRIVING"
ON_DUTY_ND = "ON_DUTY_NOT_DRIVING"

# Stop type constants
STOP_PICKUP = "PICKUP"
STOP_DROPOFF = "DROPOFF"
STOP_FUEL = "FUEL"
STOP_REST = "OVERNIGHT_REST"
STOP_BREAK = "REST_BREAK"


@dataclass
class ELDEvent:
    status: str
    start_dt: datetime
    end_dt: datetime
    location: str
    notes: str = ""

    @property
    def duration_hours(self) -> float:
        return (self.end_dt - self.start_dt).total_seconds() / 3600.0


@dataclass
class StopRecord:
    stop_type: str
    location: str
    lat: float
    lng: float
    arrival_dt: datetime
    duration_hours: float
    notes: str = ""


@dataclass
class TripState:
    current_dt: datetime
    duty_window_start: Optional[datetime]
    driving_hrs_today: float
    driving_since_last_break: float
    miles_since_last_fuel: float
    cycle_hours_used: float
    current_location: str
    current_lat: float
    current_lng: float
    events: list = field(default_factory=list)
    stops: list = field(default_factory=list)


def _hours(td: timedelta) -> float:
    return td.total_seconds() / 3600.0


def _compute_max_driveable(state: TripState) -> tuple[float, str]:
    """Returns (max_driveable_hours, limiting_factor_name)."""
    candidates = []

    # 11-hr driving limit
    driving_left = MAX_DRIVING_HRS - state.driving_hrs_today
    candidates.append((driving_left, "DRIVING_LIMIT"))

    # 14-hr duty window
    if state.duty_window_start:
        elapsed = _hours(state.current_dt - state.duty_window_start)
        window_left = DUTY_WINDOW_HRS - elapsed
        candidates.append((window_left, "DUTY_WINDOW"))

    # 30-min break trigger (8 hrs cumulative driving since last break)
    break_left = BREAK_TRIGGER_HRS - state.driving_since_last_break
    candidates.append((break_left, "BREAK_NEEDED"))

    # 70-hr cycle
    cycle_left = MAX_CYCLE_HRS - state.cycle_hours_used
    candidates.append((cycle_left, "CYCLE_LIMIT"))

    valid = [(h, r) for h, r in candidates if h > 0.001]
    if not valid:
        return 0.0, "ALL_LIMITS"
    return min(valid, key=lambda x: x[0])


def _add_event(state: TripState, status: str, hours: float, notes: str = "") -> None:
    start = state.current_dt
    end = start + timedelta(hours=hours)
    state.events.append(ELDEvent(
        status=status,
        start_dt=start,
        end_dt=end,
        location=state.current_location,
        notes=notes,
    ))
    state.current_dt = end


def _on_duty_nd(state: TripState, hours: float, notes: str = "") -> None:
    _add_event(state, ON_DUTY_ND, hours, notes)
    state.cycle_hours_used += hours
    # duty window starts at first on-duty event of the day
    if state.duty_window_start is None:
        state.duty_window_start = state.events[-1].start_dt


def _insert_break(state: TripState) -> None:
    _add_event(state, OFF_DUTY, BREAK_DUR_HRS, "30-min rest break")
    state.stops.append(StopRecord(
        stop_type=STOP_BREAK,
        location=state.current_location,
        lat=state.current_lat,
        lng=state.current_lng,
        arrival_dt=state.events[-1].start_dt,
        duration_hours=BREAK_DUR_HRS,
        notes="Mandatory 30-minute rest break",
    ))
    state.driving_since_last_break = 0.0
    # duty_window_start is NOT reset by a break


def _insert_fuel(state: TripState) -> None:
    _add_event(state, ON_DUTY_ND, FUEL_DUR_HRS, "Fuel stop")
    state.stops.append(StopRecord(
        stop_type=STOP_FUEL,
        location=state.current_location,
        lat=state.current_lat,
        lng=state.current_lng,
        arrival_dt=state.events[-1].start_dt,
        duration_hours=FUEL_DUR_HRS,
        notes="Fuel stop (required every 1,000 miles)",
    ))
    state.cycle_hours_used += FUEL_DUR_HRS
    state.miles_since_last_fuel = 0.0


def _insert_rest(state: TripState, next_loc: str, next_lat: float, next_lng: float) -> None:
    _add_event(state, SLEEPER, REST_DUR_HRS, "10-hour mandatory rest")
    state.stops.append(StopRecord(
        stop_type=STOP_REST,
        location=state.current_location,
        lat=state.current_lat,
        lng=state.current_lng,
        arrival_dt=state.events[-1].start_dt,
        duration_hours=REST_DUR_HRS,
        notes="Mandatory 10-hour rest period",
    ))
    # Reset daily counters
    state.driving_hrs_today = 0.0
    state.driving_since_last_break = 0.0
    state.duty_window_start = None

    # Pre-trip inspection starts the new day
    _add_event(state, ON_DUTY_ND, INSPECTION_DUR_HRS, "Pre-trip inspection")
    state.duty_window_start = state.events[-1].start_dt
    state.cycle_hours_used += INSPECTION_DUR_HRS


def _drive_chunk(state: TripState, miles: float) -> None:
    hours = miles / SPEED_MPH
    _add_event(state, DRIVING, hours)
    state.driving_hrs_today += hours
    state.driving_since_last_break += hours
    state.miles_since_last_fuel += miles
    state.cycle_hours_used += hours


def _interpolate_location(
    start_loc: str, end_loc: str, fraction: float
) -> tuple[str, float, float]:
    """Returns a placeholder location name — the real lat/lng must come from caller."""
    if fraction < 0.3:
        label = f"En route from {start_loc}"
    elif fraction < 0.7:
        label = f"En route (mid-trip)"
    else:
        label = f"En route to {end_loc}"
    return label


def _drive_segment(
    state: TripState,
    segment_miles: float,
    start_loc_name: str,
    end_loc_name: str,
    end_lat: float,
    end_lng: float,
) -> None:
    """Drive segment_miles, inserting breaks/fuel/rest as required."""
    remaining = segment_miles
    guard = 0

    while remaining > 0.01:
        guard += 1
        if guard > 200:
            raise RuntimeError("HOS engine loop exceeded 200 iterations — possible infinite loop")

        if state.cycle_hours_used >= MAX_CYCLE_HRS:
            raise ValueError("Driver has exhausted the 70-hour/8-day cycle limit")

        max_hrs, reason = _compute_max_driveable(state)

        if max_hrs <= 0.001:
            _insert_rest(state, end_loc_name, end_lat, end_lng)
            continue

        driveable_miles = max_hrs * SPEED_MPH
        miles_to_fuel = FUEL_INTERVAL_MI - state.miles_since_last_fuel

        # Check if fuel stop comes before the driving limit or destination
        if miles_to_fuel <= min(driveable_miles, remaining) + 0.01:
            # Drive to fuel stop
            drive_now = min(miles_to_fuel, remaining)
            _drive_chunk(state, drive_now)
            remaining -= drive_now
            if remaining <= 0.01:
                break
            # Update location to midpoint estimate
            frac = 1.0 - remaining / segment_miles
            state.current_location = f"En route (fuel, ~{int(state.miles_since_last_fuel)} mi driven)"
            _insert_fuel(state)
        else:
            drive_now = min(driveable_miles, remaining)
            _drive_chunk(state, drive_now)
            remaining -= drive_now

            if remaining > 0.01:
                # Hit a HOS limit before reaching destination
                frac = 1.0 - remaining / segment_miles
                state.current_location = f"En route ({reason.lower().replace('_', ' ')})"
                if reason == "BREAK_NEEDED":
                    _insert_break(state)
                else:
                    _insert_rest(state, end_loc_name, end_lat, end_lng)

    # Arrived at destination
    state.current_location = end_loc_name
    state.current_lat = end_lat
    state.current_lng = end_lng


# ── Public API ──────────────────────────────────────────────────────────────────

def plan_trip(
    current_loc: dict,
    pickup_loc: dict,
    dropoff_loc: dict,
    route: dict,
    cycle_hours_used: float,
) -> dict:
    """
    Build the complete trip plan with HOS-compliant duty events and stops.

    current_loc / pickup_loc / dropoff_loc: dicts with keys lat, lng, display_name
    route: dict from routing.get_ors_route (polyline, segments, total_miles, ...)
    cycle_hours_used: hours already used in the current 8-day cycle

    Returns: {"events": [...], "stops": [...]}
    """
    today = datetime.now(timezone.utc).replace(
        hour=DEFAULT_START_HOUR, minute=0, second=0, microsecond=0
    )

    state = TripState(
        current_dt=today,
        duty_window_start=None,
        driving_hrs_today=0.0,
        driving_since_last_break=0.0,
        miles_since_last_fuel=0.0,
        cycle_hours_used=float(cycle_hours_used),
        current_location=current_loc["display_name"],
        current_lat=current_loc["lat"],
        current_lng=current_loc["lng"],
    )

    # Pre-trip inspection at origin
    _on_duty_nd(state, INSPECTION_DUR_HRS, "Pre-trip inspection")

    segments = route.get("segments", [])
    seg0_miles = segments[0]["miles"] if segments else route["total_miles"] * 0.5
    seg1_miles = segments[1]["miles"] if len(segments) > 1 else route["total_miles"] * 0.5

    # Drive current → pickup
    _drive_segment(
        state,
        seg0_miles,
        current_loc["display_name"],
        pickup_loc["display_name"],
        pickup_loc["lat"],
        pickup_loc["lng"],
    )

    # Pickup: 1-hr on-duty not driving
    state.current_location = pickup_loc["display_name"]
    state.current_lat = pickup_loc["lat"]
    state.current_lng = pickup_loc["lng"]
    _on_duty_nd(state, LOAD_DUR_HRS, "Loading — pickup")
    state.stops.append(StopRecord(
        stop_type=STOP_PICKUP,
        location=pickup_loc["display_name"],
        lat=pickup_loc["lat"],
        lng=pickup_loc["lng"],
        arrival_dt=state.events[-1].start_dt,
        duration_hours=LOAD_DUR_HRS,
        notes="Pickup (1-hour loading time)",
    ))

    # Drive pickup → dropoff
    _drive_segment(
        state,
        seg1_miles,
        pickup_loc["display_name"],
        dropoff_loc["display_name"],
        dropoff_loc["lat"],
        dropoff_loc["lng"],
    )

    # Dropoff: 1-hr on-duty not driving
    state.current_location = dropoff_loc["display_name"]
    state.current_lat = dropoff_loc["lat"]
    state.current_lng = dropoff_loc["lng"]
    _on_duty_nd(state, LOAD_DUR_HRS, "Unloading — dropoff")
    state.stops.append(StopRecord(
        stop_type=STOP_DROPOFF,
        location=dropoff_loc["display_name"],
        lat=dropoff_loc["lat"],
        lng=dropoff_loc["lng"],
        arrival_dt=state.events[-1].start_dt,
        duration_hours=LOAD_DUR_HRS,
        notes="Dropoff (1-hour unloading time)",
    ))

    return {
        "events": state.events,
        "stops": state.stops,
    }


def group_events_by_day(events: list[ELDEvent]) -> list[dict]:
    """
    Groups ELD events into per-calendar-day DailyLog dicts.
    Events spanning midnight are split across two days.
    """
    if not events:
        return []

    # Collect all calendar dates touched by any event
    dates = set()
    for ev in events:
        d = ev.start_dt.date()
        dates.add(d)
        if ev.end_dt.date() != d:
            dates.add(ev.end_dt.date())
    dates = sorted(dates)

    logs = []
    for date in dates:
        day_start = datetime(date.year, date.month, date.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        day_events = []
        for ev in events:
            clipped_start = max(ev.start_dt, day_start)
            clipped_end = min(ev.end_dt, day_end)
            if clipped_end <= clipped_start:
                continue
            day_events.append({
                "status": ev.status,
                "startTime": clipped_start.isoformat(),
                "endTime": clipped_end.isoformat(),
                "location": ev.location,
                "notes": ev.notes,
            })

        if not day_events:
            continue

        # Sort by start time then fill every uncovered minute with OFF_DUTY
        # so per-status totals always sum to exactly 24 hours.
        day_events.sort(key=lambda e: e["startTime"])
        filled: list[dict] = []
        cursor = day_start
        prev_loc = day_events[0]["location"]

        for ev in day_events:
            ev_start = datetime.fromisoformat(ev["startTime"])
            if ev_start > cursor:
                filled.append({
                    "status": OFF_DUTY,
                    "startTime": cursor.isoformat(),
                    "endTime": ev_start.isoformat(),
                    "location": prev_loc,
                    "notes": "Off duty",
                })
            filled.append(ev)
            cursor = datetime.fromisoformat(ev["endTime"])
            prev_loc = ev["location"]

        if cursor < day_end:
            filled.append({
                "status": OFF_DUTY,
                "startTime": cursor.isoformat(),
                "endTime": day_end.isoformat(),
                "location": prev_loc,
                "notes": "Off duty",
            })

        # Compute per-status totals from the gap-filled event list
        raw = {OFF_DUTY: 0.0, SLEEPER: 0.0, DRIVING: 0.0, ON_DUTY_ND: 0.0}
        miles = 0.0
        for ev in filled:
            hrs = (datetime.fromisoformat(ev["endTime"]) - datetime.fromisoformat(ev["startTime"])).total_seconds() / 3600.0
            raw[ev["status"]] = raw.get(ev["status"], 0.0) + hrs
            if ev["status"] == DRIVING:
                miles += hrs * SPEED_MPH

        # Round non-OFF_DUTY buckets first, then compute OFF_DUTY as the remainder
        # so the four values always sum to exactly 24.00 regardless of float drift.
        t_sleeper  = round(raw[SLEEPER], 2)
        t_driving  = round(raw[DRIVING], 2)
        t_on_duty  = round(raw[ON_DUTY_ND], 2)
        t_off_duty = round(24.0 - t_sleeper - t_driving - t_on_duty, 2)

        logs.append({
            "date": date.isoformat(),
            "events": filled,
            "totalOffDuty": t_off_duty,
            "totalSleeperBerth": t_sleeper,
            "totalDriving": t_driving,
            "totalOnDuty": t_on_duty,
            "totalMiles": round(miles, 1),
        })

    return logs
