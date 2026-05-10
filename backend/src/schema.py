import graphene
from trips.schema.mutations import trips_mutation
from trips.schema.queries import trip_query


class Mutation(
    trips_mutation.Mutation,
):
    pass


class Query(trip_query.Query):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
