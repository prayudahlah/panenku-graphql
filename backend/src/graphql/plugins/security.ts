import type { Plugin } from 'graphql-yoga';
import { getNamedType } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { createComplexityRule, simpleEstimator, type ComplexityEstimator } from 'graphql-query-complexity';

export type SecurityLimitsOptions = {
    maxDepth?: number;
    maxComplexity?: number;
};

const baseEstimator = simpleEstimator({ defaultComplexity: 1 });

const estimator: ComplexityEstimator = (options) => {
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
        onValidate({ addValidationRule }) {
            addValidationRule(depthLimit(maxDepth));
            addValidationRule(
                createComplexityRule({
                    maximumComplexity: maxComplexity,
                    variables: {},
                    estimators: [estimator],
                })
            );
        },
    };
}
