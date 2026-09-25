import { GraphQLError } from 'graphql';

export type ServiceError = {
    error?: string;
    code?: string;
    status?: number;
};

export function toGraphQLError(result: ServiceError): GraphQLError {
    return new GraphQLError(result.error ?? 'Terjadi kesalahan', {
        extensions: {
            ...(result.code ? { code: result.code } : {}),
            status: result.status ?? 400,
        },
    });
}

export function unauthenticated(message = 'User belum login', code = 'ERR-LOG-01'): GraphQLError {
    return new GraphQLError(message, {
        extensions: { code, status: 401 },
    });
}

export function forbidden(message = 'Akses ditolak', code?: string): GraphQLError {
    return new GraphQLError(message, {
        extensions: {
            ...(code ? { code } : {}),
            status: 403,
        },
    });
}
