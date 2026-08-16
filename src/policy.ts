import { make_ignore_order_func } from './helper';
import {
    ExpectChangeOperator,
    ExpectExistOperator,
    IgnoreOperator,
    ListItemFieldMatchOperator,
    NumericRangeOperator,
    NumericToleranceOperator,
    StringNormalizeOperator
} from './operator';

export type BusinessRule = {
    name?: string;
    path?: string;
    value?: string;
    operation: string;
    options?: { [key: string]: any };
    parameter?: { [key: string]: any };
};

export type BusinessPolicyInput =
    | BusinessRule[]
    | { version?: number; name?: string; rules?: BusinessRule[] };

type NormalizedRule = {
    name: string;
    path: string;
    operation: string;
    options: { [key: string]: any };
};

const OPERATION_ALIASES: { [key: string]: string } = {
    ignore: 'ignore',
    unordered: 'unordered',
    ignore_order: 'unordered',
    'operator:list:ignoreOrder': 'unordered',
    match_by: 'match_by',
    'operator:list:matchWithField': 'match_by',
    numeric_tolerance: 'numeric_tolerance',
    'operator:number:tolerance': 'numeric_tolerance',
    string_normalize: 'string_normalize',
    'operator:string:normalize': 'string_normalize',
    expect_change: 'expect_change',
    'operator:expectChange': 'expect_change',
    expect_exist: 'expect_exist',
    'operator:expectExist': 'expect_exist',
    range: 'range',
    'operator:floatInRange': 'range'
};

export class BusinessPolicyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BusinessPolicyError';
        Object.setPrototypeOf(this, BusinessPolicyError.prototype);
    }
}

/** A versioned, JSON-serializable business comparison policy. */
export class BusinessDiffPolicy {
    static readonly VERSION = 1;
    name?: string;
    rules: NormalizedRule[];

    constructor(policy: BusinessPolicyInput = { version: 1, rules: [] }) {
        const input = Array.isArray(policy)
            ? { version: BusinessDiffPolicy.VERSION, rules: policy }
            : policy;
        if (!input || typeof input !== 'object') {
            throw new BusinessPolicyError(
                'policy must be an object or a list of rules'
            );
        }
        const version = input.version ?? BusinessDiffPolicy.VERSION;
        if (version !== BusinessDiffPolicy.VERSION) {
            throw new BusinessPolicyError(
                `unsupported policy version: ${version}`
            );
        }
        if (input.rules !== undefined && !Array.isArray(input.rules)) {
            throw new BusinessPolicyError('policy.rules must be a list');
        }
        this.name = input.name;
        this.rules = (input.rules || []).map((rule, index) =>
            this.normalizeRule(rule, index)
        );
    }

    private normalizeRule(rule: BusinessRule, index: number): NormalizedRule {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            throw new BusinessPolicyError(`rule ${index} must be an object`);
        }
        const operation = OPERATION_ALIASES[rule.operation];
        if (!operation) {
            throw new BusinessPolicyError(
                `rule ${index} has unsupported operation: ${rule.operation}`
            );
        }
        const path = rule.path ?? rule.value;
        if (typeof path !== 'string' || !path) {
            throw new BusinessPolicyError(
                `rule ${index} requires a non-empty path regex`
            );
        }
        const options = rule.options ?? rule.parameter ?? {};
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            throw new BusinessPolicyError(`rule ${index} options must be an object`);
        }
        if (
            operation === 'match_by' &&
            (typeof options.field !== 'string' || !options.field)
        ) {
            throw new BusinessPolicyError(
                `match_by rule ${index} requires options.field`
            );
        }
        return {
            name: rule.name || `rule-${index + 1}`,
            path,
            operation,
            options: { ...options }
        };
    }

    compile() {
        const custom_operators: any[] = [];
        const unorderedPaths: string[] = [];
        for (const rule of this.rules) {
            const { operation, path, options, name } = rule;
            if (operation === 'unordered') unorderedPaths.push(path);
            else if (operation === 'ignore')
                custom_operators.push(new IgnoreOperator(path, name));
            else if (operation === 'match_by')
                custom_operators.push(
                    new ListItemFieldMatchOperator(path, options.field, name)
                );
            else if (operation === 'numeric_tolerance')
                custom_operators.push(
                    new NumericToleranceOperator(
                        path,
                        options.absolute ?? 0,
                        options.relative ?? 0,
                        name
                    )
                );
            else if (operation === 'string_normalize')
                custom_operators.push(
                    new StringNormalizeOperator(
                        path,
                        options.trim ?? true,
                        options.lowercase ?? false,
                        options.collapse_whitespace ?? false,
                        name
                    )
                );
            else if (operation === 'expect_change')
                custom_operators.push(new ExpectChangeOperator(path, name));
            else if (operation === 'expect_exist')
                custom_operators.push(new ExpectExistOperator(path, name));
            else if (operation === 'range') {
                if (options.start === undefined || options.end === undefined) {
                    throw new BusinessPolicyError(
                        `range rule ${name} requires options.start and options.end`
                    );
                }
                custom_operators.push(
                    new NumericRangeOperator(path, options.start, options.end, name)
                );
            }
        }
        return {
            custom_operators,
            ignore_order_func: make_ignore_order_func(unorderedPaths)
        };
    }

    toJSON() {
        return {
            version: BusinessDiffPolicy.VERSION,
            ...(this.name === undefined ? {} : { name: this.name }),
            rules: this.rules.map((rule) => ({
                ...rule,
                options: { ...rule.options }
            }))
        };
    }

    to_dict() {
        return this.toJSON();
    }
}
