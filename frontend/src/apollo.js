import { ApolloClient } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { HttpLink } from "@apollo/client/link/http";

const client = new ApolloClient({
  link: new HttpLink({
    uri: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/",
  }),
  cache: new InMemoryCache(),
});

export default client;
