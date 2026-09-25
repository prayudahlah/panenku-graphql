import { upsertSessionAdapter } from '../utils/session-adapter';
import { createLoaders, type Loaders } from './loaders';

const COOKIE_NAME = 'panenku_session';

export type SessionUser = {
    userId: number | null;
    email: string | null;
    role: string | null;
};

export type GraphQLContext = {
    session: SessionUser | null;
    loaders: Loaders;
    ipAddress: string;
};

function parseCookie(header?: string | null): Record<string, string> {
    const out: Record<string, string> = {};
    if (!header) return out;

    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index === -1) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key) out[key] = decodeURIComponent(value);
    }

    return out;
}

function readIpAddress(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip');
    return (forwarded || realIp || 'unknown').substring(0, 45);
}

export async function createContext({ request }: { request: Request }): Promise<GraphQLContext> {
    const cookies = parseCookie(request.headers.get('cookie'));
    const sessionId = cookies[COOKIE_NAME];
    const stored = sessionId ? await upsertSessionAdapter.get(sessionId) : null;
    const data = (stored?.data ?? null) as Partial<SessionUser> | null;

    return {
        session: data
            ? {
                  userId: data.userId ?? null,
                  email: data.email ?? null,
                  role: data.role ?? null,
              }
            : null,
        loaders: createLoaders(),
        ipAddress: readIpAddress(request),
    };
}
