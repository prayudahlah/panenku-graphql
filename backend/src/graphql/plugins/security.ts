import type { Plugin } from 'graphql-yoga';
import depthLimit from 'graphql-depth-limit';
import { createComplexityRule, simpleEstimator } from 'graphql-query-complexity';

export type SecurityLimitsOptions = {
    maxDepth?: number;
    maxComplexity?: number;
};

export function useSecurityLimits(options: SecurityLimitsOptions = {}): Plugin {
    const maxDepth = options.maxDepth ?? 10;
    const maxComplexity = options.maxComplexity ?? 100;

    return {
        onValidate({ addValidationRule }) {
            addValidationRule(depthLimit(maxDepth));
            addValidationRule(
                createComplexityRule({
                    maximumComplexity: maxComplexity,
                    variables: {},
                    estimators: [simpleEstimator({ defaultComplexity: 1 })],
                })
            );
        },
    };
}
