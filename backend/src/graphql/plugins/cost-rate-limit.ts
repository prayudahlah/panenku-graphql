import type { Plugin } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { getComplexity } from 'graphql-query-complexity';
import { estimator } from './security';
import type { GraphQLContext } from '../context';

export type CostRateLimitOptions = {
    limit?: number;
    windowMs?: number;
};

type Budget = { remaining: number; resetAt: number };

export function useCostRateLimit(options: CostRateLimitOptions = {}): Plugin {
    const limit = options.limit ?? 300;
    const windowMs = options.windowMs ?? 60_000;
    const store = new Map<string, Budget>();

    function keyFor(context: GraphQLContext | undefined): string {
        const userId = context?.session?.userId;
        if (userId) return `user:${userId}`;
        return `ip:${context?.ipAddress ?? 'unknown'}`;
    }

    function consume(key: string, cost: number): Budget & { ok: boolean } {
        const now = Date.now();
        let budget = store.get(key);

        if (!budget || now >= budget.resetAt) {
            budget = { remaining: limit, resetAt: now + windowMs };
            store.set(key, budget);
        }

        if (budget.remaining < cost) return { ...budget, ok: false };

        budget.remaining -= cost;
        return { ...budget, ok: true };
    }

    return {
        onExecute({ args }) {
            const context = args.contextValue as GraphQLContext | undefined;

            const cost = getComplexity({
                schema: args.schema,
                query: args.document,
                variables: (args.variableValues ?? {}) as Record<string, unknown>,
                estimators: [estimator],
            });

            const key = keyFor(context);
            const budget = consume(key, cost);

            if (!budget.ok) {
                const retryAfter = Math.max(1, Math.ceil((budget.resetAt - Date.now()) / 1000));

                throw new GraphQLError('Batas penggunaan (cost) terlampaui', {
                    extensions: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        cost,
                        limit,
                        remaining: 0,
                        resetAt: budget.resetAt,
                        http: {
                            status: 429,
                            headers: {
                                'Retry-After': String(retryAfter),
                                'X-RateLimit-Limit': String(limit),
                                'X-RateLimit-Remaining': '0',
                                'X-RateLimit-Reset': String(budget.resetAt),
                            },
                        },
                    },
                });
            }

            const info = { cost, limit, remaining: budget.remaining, resetAt: budget.resetAt };

            return {
                onExecuteDone({ result, setResult }) {
                    if (!result || typeof result !== 'object' || 'errors' in result) return;

                    setResult({
                        ...result,
                        extensions: { ...(result.extensions ?? {}), rateLimit: info },
                    });
                },
            };
        },
    };
}
