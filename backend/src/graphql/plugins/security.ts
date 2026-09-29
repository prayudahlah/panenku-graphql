import type { Plugin } from 'graphql-yoga';
import { getNamedType } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { createComplexityRule, simpleEstimator, type ComplexityEstimator } from 'graphql-query-complexity';

export type SecurityLimitsOptions = {
    maxDepth?: number;
    maxComplexity?: number;
};

const baseEstimator = simpleEstimator({ defaultComplexity: 1 });

export const estimator: ComplexityEstimator = (options) => {
    const parentName = (options.type as { name?: string })?.name ?? '';
    const fieldTypeName = getNamedType(options.field.type).name;

    if (
        options.field.name.startsWith('__') ||
        parentName.startsWith('__') ||
        fieldTypeName.startsWith('__')
    ) {
        return 0;
    }

    return baseEstimator(options);
};

export function useSecurityLimits(options: SecurityLimitsOptions = {}): Plugin {
    const maxDepth = options.maxDepth ?? 10;
    const maxComplexity = options.maxComplexity ?? 100;

    return {
        onValidate({ context, params, addValidationRule }) {
            // Lokasi variabel asli request beda tiap versi Yoga:
            // - Yoga v5: params.variables (hook payload = GraphQLParams)
            // - Yoga v3 (yang jalan sekarang via @elysia/graphql-yoga@1.4.1):
            //   hook params = { schema, documentAST, ... } TANPA variables;
            //   variabel asli ada di context.params.variables (initialContext
            //   dibangun dari { request, params } di YogaServer.getResultForParams).
            // Tanpa ini, rule meng-coerce varDefs terhadap {} dan melaporkan
            // error palsu `Variable "$x" of required type "Y!" was not provided`
            // untuk SETIAP operasi bervariabel required.
            const variables =
                (params as { variables?: Record<string, unknown> })?.variables ??
                (context as { params?: { variables?: Record<string, unknown> } })?.params
                    ?.variables ??
                {};
            addValidationRule(depthLimit(maxDepth));
            addValidationRule(
                createComplexityRule({
                    maximumComplexity: maxComplexity,
                    variables,
                    estimators: [estimator],
                })
            );
        },
    };
}
