import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { API_URL } from '../constants';

// Endpoint GraphQL mengikuti base REST agar ikut VITE_API_URL / proxy dev / nginx prod.
// REST:  {API_URL}/products   -> GraphQL: {API_URL}/graphql
const GRAPHQL_URL = `${API_URL}/graphql`;

export const client = new ApolloClient({
    link: new HttpLink({
        uri: GRAPHQL_URL,
        // Wajib untuk session cookie `panenku_session` (samakan dengan fetchApi credentials:include).
        credentials: 'include',
    }),
    cache: new InMemoryCache({
        typePolicies: {
            Query: {
                fields: {
                    // Query list dibedakan per kombinasi filter/sort, tapi
                    // halaman berbeda (page/limit) TIDAK digabung — tiap page cache sendiri.
                    products: {
                        keyArgs: [
                            'search',
                            'categoryId',
                            'minPrice',
                            'maxPrice',
                            'isNegotiable',
                            'sortBy',
                            'sortOrder',
                        ],
                    },
                },
            },
            Product: {
                keyFields: ['id'],
            },
        },
    }),
});

export default client;
