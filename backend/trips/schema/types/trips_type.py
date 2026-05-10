import graphene


class WaypointType(graphene.ObjectType):
    lat = graphene.Float()
    lng = graphene.Float()
    label = graphene.String()


class RouteType(graphene.ObjectType):
    total_miles = graphene.Float()
    total_duration_hours = graphene.Float()
    waypoints = graphene.List(WaypointType)
    polyline = graphene.List(WaypointType)


class StopType(graphene.ObjectType):
    stop_type = graphene.String()
    location = graphene.String()
    lat = graphene.Float()
    lng = graphene.Float()
    arrival_time = graphene.String()
    duration_hours = graphene.Float()
    notes = graphene.String()


class DutyEventType(graphene.ObjectType):
    status = graphene.String()
    start_time = graphene.String()
    end_time = graphene.String()
    location = graphene.String()
    notes = graphene.String()


class DailyLogType(graphene.ObjectType):
    date = graphene.String()
    events = graphene.List(DutyEventType)
    total_off_duty = graphene.Float()
    total_sleeper_berth = graphene.Float()
    total_driving = graphene.Float()
    total_on_duty = graphene.Float()
    total_miles = graphene.Float()


class TripResultType(graphene.ObjectType):
    route = graphene.Field(RouteType)
    stops = graphene.List(StopType)
    eld_logs = graphene.List(DailyLogType)
