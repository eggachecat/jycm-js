import { YouchamaJsonDiffer } from '../src/jycm';
import { BusinessDiffPolicy, BusinessPolicyError } from '../src/policy';

const orderPolicy = {
    version: 1,
    name: 'order-reconciliation',
    rules: [
        { name: 'items-are-a-set', path: '^items$', operation: 'unordered' },
        {
            name: 'match-sku',
            path: '^items->\\[\\d+\\]$',
            operation: 'match_by',
            options: { field: 'sku' }
        },
        {
            name: 'price-rounding',
            path: '^items->\\[\\d+\\]->price$',
            operation: 'numeric_tolerance',
            options: { absolute: 0.02 }
        },
        {
            name: 'canonical-label',
            path: '^items->\\[\\d+\\]->label$',
            operation: 'string_normalize',
            options: {
                trim: true,
                lowercase: true,
                collapse_whitespace: true
            }
        },
        {
            name: 'volatile-timestamp',
            path: '^generated_at$',
            operation: 'ignore'
        }
    ]
};

describe('BusinessDiffPolicy', () => {
    test('compiles a serializable cross-language policy', () => {
        const left = {
            generated_at: 'old',
            items: [
                { sku: 'A', label: '  RED   Shirt ', price: 10 },
                { sku: 'B', label: 'Blue', price: 20 }
            ]
        };
        const right = {
            generated_at: 'new',
            items: [
                { sku: 'B', label: ' blue ', price: 20.01 },
                { sku: 'A', label: 'red shirt', price: 10.01 }
            ]
        };
        const differ = YouchamaJsonDiffer.fromPolicy(left, right, orderPolicy);
        const explanation = differ.explain();

        expect(explanation.equal).toBe(true);
        expect(explanation.summary.change_count).toBe(0);
        expect(explanation.summary.rule_violation_count).toBe(0);
        expect(explanation.summary.policy).toMatchObject({
            version: 1,
            name: 'order-reconciliation'
        });
        expect(explanation.summary.policy.rules).toHaveLength(5);
        expect(explanation.diff['operator:number:tolerance']).toHaveLength(2);
        expect(explanation.diff['operator:string:normalize']).toHaveLength(2);
        expect(explanation.diff.ignore).toHaveLength(1);
    });

    test('matching by identity does not hide child-field violations', () => {
        const differ = YouchamaJsonDiffer.fromPolicy(
            { items: [{ sku: 'A', price: 10 }] },
            { items: [{ sku: 'A', price: 10.5 }] },
            orderPolicy
        );
        const explanation = differ.explain(false);

        expect(explanation.equal).toBe(false);
        expect(explanation.summary.rule_violation_count).toBe(1);
        expect(explanation.violations[0]).toMatchObject({
            event: 'operator:number:tolerance',
            rule: 'price-rounding',
            pass: false,
            delta: 0.5
        });
        expect(explanation).not.toHaveProperty('diff');
    });

    test('uses the same business semantics for diff and JSON Patch', () => {
        const left = { items: [{ sku: 'A', label: 'Red', price: 10 }] };
        const equivalent = YouchamaJsonDiffer.fromPolicy(
            left,
            { items: [{ sku: 'A', label: ' red ', price: 10.01 }] },
            orderPolicy
        );
        expect(equivalent.diff()).toBe(true);
        expect(equivalent.toJsonPatch()).toEqual([]);

        const violation = YouchamaJsonDiffer.fromPolicy(
            left,
            { items: [{ sku: 'A', label: 'Red', price: 10.5 }] },
            orderPolicy
        );
        expect(violation.diff()).toBe(false);
        expect(violation.toJsonPatch()).toEqual([
            { op: 'replace', path: '/items/0/price', value: 10.5 }
        ]);
    });

    test('accepts legacy rule fields and expectation/range operations', () => {
        const policy = new BusinessDiffPolicy([
            {
                operation: 'operator:expectExist',
                value: '^status$',
                parameter: {}
            },
            {
                operation: 'operator:floatInRange',
                value: '^score$',
                parameter: { start: 0, end: 10 }
            },
            { operation: 'operator:expectChange', value: '^revision$' }
        ]);
        const explanation = YouchamaJsonDiffer.fromPolicy(
            { status: 'ready', score: 5, revision: 1 },
            { status: 'ready', score: 7, revision: 2 },
            policy
        ).explain();

        expect(explanation.equal).toBe(true);
        expect(explanation.summary.rule_evaluation_count).toBe(3);
        expect(policy.to_dict().rules[0].operation).toBe('expect_exist');
    });

    test('rejects invalid policies with actionable messages', () => {
        expect(() => new BusinessDiffPolicy(null as any)).toThrow(
            'policy must be an object or a list of rules'
        );
        expect(() => new BusinessDiffPolicy({ version: 2, rules: [] })).toThrow(
            'unsupported policy version: 2'
        );
        expect(
            () => new BusinessDiffPolicy({ version: 1, rules: {} as any })
        ).toThrow('policy.rules must be a list');
        expect(() => new BusinessDiffPolicy([null as any])).toThrow(
            'rule 0 must be an object'
        );
        expect(
            () => new BusinessDiffPolicy([{ operation: 'unknown', path: '^x$' }])
        ).toThrow('rule 0 has unsupported operation: unknown');
        expect(
            () => new BusinessDiffPolicy([{ operation: 'ignore', path: '' }])
        ).toThrow('rule 0 requires a non-empty path regex');
        expect(
            () =>
                new BusinessDiffPolicy([
                    { operation: 'ignore', path: '^x$', options: [] as any }
                ])
        ).toThrow('rule 0 options must be an object');
        expect(
            () =>
                new BusinessDiffPolicy([
                    { operation: 'match_by', path: '^items$' }
                ])
        ).toThrow('requires options.field');
        expect(
            () =>
                new BusinessDiffPolicy([
                    {
                        operation: 'numeric_tolerance',
                        path: '^amount$',
                        options: { absolute: -1 }
                    }
                ]).compile()
        ).toThrow('numeric tolerances must be non-negative');
        expect(
            () =>
                new BusinessDiffPolicy([
                    { operation: 'range', path: '^score$', options: {} }
                ]).compile()
        ).toThrow(BusinessPolicyError);
    });

    test('reports missing values for expect-exist rules on either side', () => {
        const policy = new BusinessDiffPolicy([
            { name: 'required-status', operation: 'expect_exist', path: '^status$' }
        ]);

        const missingLeft = YouchamaJsonDiffer.fromPolicy(
            {},
            { status: 'ready' },
            policy
        ).explain();
        expect(missingLeft.equal).toBe(false);
        expect(missingLeft.violations[0]).toMatchObject({
            rule: 'required-status',
            left_non_exist: true,
            pass: false
        });

        const missingRight = YouchamaJsonDiffer.fromPolicy(
            { status: 'ready' },
            {},
            policy
        ).explain();
        expect(missingRight.equal).toBe(false);
        expect(missingRight.violations[0]).toMatchObject({
            rule: 'required-status',
            right_non_exist: true,
            pass: false
        });
    });
});
