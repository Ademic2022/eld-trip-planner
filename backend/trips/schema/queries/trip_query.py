import graphene
from trips.models import TripPlan


class TripHistoryType(graphene.ObjectType):
    id = graphene.ID()
    created_at = graphene.String()
    current_location = graphene.String()
    pickup_location = graphene.String()
    dropoff_location = graphene.String()
    cycle_hours_used = graphene.Float()
    result_json = graphene.JSONString()


class Query(graphene.ObjectType):
    health = graphene.String()
    trip_history = graphene.List(TripHistoryType)
    trip = graphene.Field(TripHistoryType, id=graphene.ID(required=True))

    def resolve_health(root, info):
        return "ok"

    def resolve_trip_history(root, info):
        return [
            TripHistoryType(
                id=t.id,
                created_at=t.created_at.isoformat(),
                current_location=t.current_location,
                pickup_location=t.pickup_location,
                dropoff_location=t.dropoff_location,
                cycle_hours_used=t.cycle_hours_used,
                result_json=t.result_json,
            )
            for t in TripPlan.objects.all()
        ]

    def resolve_trip(root, info, id):
        try:
            t = TripPlan.objects.get(pk=id)
        except TripPlan.DoesNotExist:
            return None
        return TripHistoryType(
            id=t.id,
            created_at=t.created_at.isoformat(),
            current_location=t.current_location,
            pickup_location=t.pickup_location,
            dropoff_location=t.dropoff_location,
            cycle_hours_used=t.cycle_hours_used,
            result_json=t.result_json,
        )
