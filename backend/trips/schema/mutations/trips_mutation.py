import graphene
from trips.hos_engine import group_events_by_day, plan_trip
from trips.routing import geocode_location, get_ors_route
from trips.models import TripPlan
from trips.schema.types.trips_type import (
    WaypointType,
    RouteType,
    StopType,
    DutyEventType,
    DailyLogType,
    TripResultType,
)


class PlanTrip(graphene.Mutation):
    class Arguments:
        current_location = graphene.String(required=True)
        pickup_location = graphene.String(required=True)
        dropoff_location = graphene.String(required=True)
        cycle_hours_used = graphene.Float(default_value=0.0)

    Output = TripResultType

    @staticmethod
    def mutate(
        root,
        info,
        current_location,
        pickup_location,
        dropoff_location,
        cycle_hours_used,
    ):
        # Geocode all three locations (Nominatim: 1s delay between calls)
        cur = geocode_location(current_location)
        pu = geocode_location(pickup_location)
        do = geocode_location(dropoff_location)

        # Fetch route via ORS
        route = get_ors_route([cur, pu, do])

        # Run HOS simulation
        result = plan_trip(cur, pu, do, route, cycle_hours_used)

        # Build daily logs
        daily_logs = group_events_by_day(result["events"])

        # Assemble GraphQL response
        route_obj = RouteType(
            total_miles=route["total_miles"],
            total_duration_hours=route["total_duration_hours"],
            waypoints=[
                WaypointType(lat=wp["lat"], lng=wp["lng"]) for wp in [cur, pu, do]
            ],
            polyline=[
                WaypointType(lat=p["lat"], lng=p["lng"]) for p in route["polyline"]
            ],
        )

        stops_list = [
            StopType(
                stop_type=s.stop_type,
                location=s.location,
                lat=s.lat,
                lng=s.lng,
                arrival_time=s.arrival_dt.isoformat(),
                duration_hours=s.duration_hours,
                notes=s.notes,
            )
            for s in result["stops"]
        ]

        logs_list = [
            DailyLogType(
                date=log["date"],
                events=[
                    DutyEventType(
                        status=ev["status"],
                        start_time=ev["startTime"],
                        end_time=ev["endTime"],
                        location=ev["location"],
                        notes=ev["notes"],
                    )
                    for ev in log["events"]
                ],
                total_off_duty=log["totalOffDuty"],
                total_sleeper_berth=log["totalSleeperBerth"],
                total_driving=log["totalDriving"],
                total_on_duty=log["totalOnDuty"],
                total_miles=log["totalMiles"],
            )
            for log in daily_logs
        ]

        trip_result = TripResultType(route=route_obj, stops=stops_list, eld_logs=logs_list)

        TripPlan.objects.create(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            cycle_hours_used=cycle_hours_used,
            result_json={
                "route": {
                    "totalMiles": route["total_miles"],
                    "totalDurationHours": route["total_duration_hours"],
                    "polyline": route["polyline"],
                },
                "stops": [
                    {
                        "stopType": s.stop_type,
                        "location": s.location,
                        "lat": s.lat,
                        "lng": s.lng,
                        "arrivalTime": s.arrival_dt.isoformat(),
                        "durationHours": s.duration_hours,
                        "notes": s.notes,
                    }
                    for s in result["stops"]
                ],
                "eldLogs": daily_logs,
            },
        )

        return trip_result


class Mutation(graphene.ObjectType):
    plan_trip = PlanTrip.Field()