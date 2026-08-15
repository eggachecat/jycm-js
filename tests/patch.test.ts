import {
    JsonPatchTestFailed,
    ListItemFieldMatchOperator,
    YouchamaJsonDiffer,
    apply_json_patch,
    make_ignore_order_func
} from '../src/index';

describe('RFC 6902 JSON Patch', () => {
    test('generates an executable deterministic patch', () => {
        const left = {
            version: 1,
            profile: { name: 'old', obsolete: true },
            tags: ['stable', 'legacy']
        };
        const right = {
            version: 2,
            profile: { name: 'new', active: true },
            tags: ['stable', 'modern', 'new']
        };
        const differ = new YouchamaJsonDiffer(left, right);

        const patch = differ.to_json_patch(true);

        expect(differ.apply_patch()).toStrictEqual(right);
        expect(apply_json_patch(left, patch)).toStrictEqual(right);
        expect(left.version).toBe(1);
        expect(patch[0]).toStrictEqual({
            op: 'test',
            path: '/profile/obsolete',
            value: true
        });
    });

    test('escapes JSON Pointer keys and supports every standard operation', () => {
        const document = { 'a/b': { '~key': 1 }, values: ['a', 'b'] };
        const result = apply_json_patch(document, [
            { op: 'test', path: '/a~1b/~0key', value: 1 },
            { op: 'replace', path: '/a~1b/~0key', value: 2 },
            { op: 'copy', from: '/a~1b', path: '/copy' },
            { op: 'move', from: '/values/0', path: '/values/1' },
            { op: 'add', path: '/values/-', value: 'c' },
            { op: 'remove', path: '/copy/~0key' }
        ]);

        expect(result).toStrictEqual({
            'a/b': { '~key': 2 },
            values: ['b', 'a', 'c'],
            copy: {}
        });
        expect(() =>
            apply_json_patch(document, [
                { op: 'test', path: '/a~1b/~0key', value: 999 }
            ])
        ).toThrow(JsonPatchTestFailed);
        expect(() =>
            apply_json_patch(document, [
                { op: 'add', path: '/missing-value' } as any
            ])
        ).toThrow("Add operation requires 'value'");
    });

    test('respects ignore-order and field matching business semantics', () => {
        const left = {
            items: [
                { id: 1, label: 'one' },
                { id: 2, label: 'two' }
            ]
        };
        const reordered = {
            items: [
                { id: 2, label: 'two' },
                { id: 1, label: 'one' }
            ]
        };
        const ignored = new YouchamaJsonDiffer(left, reordered, {
            ignore_order_func: make_ignore_order_func(['^items$'])
        });
        expect(ignored.to_json_patch()).toStrictEqual([]);

        const changed = {
            items: [
                { id: 2, label: 'updated' },
                { id: 1, label: 'one' }
            ]
        };
        const matched = new YouchamaJsonDiffer(left, changed, {
            custom_operators: [
                new ListItemFieldMatchOperator('^items->\\[\\d+\\]$', 'id')
            ],
            ignore_order_func: make_ignore_order_func(['^items$'])
        });
        expect(matched.apply_patch()).toStrictEqual(changed);
        expect(matched.toJsonPatch()).not.toHaveLength(0);
    });
});

describe('large ordered arrays', () => {
    test('does not overflow the call stack during LCS backtracking', () => {
        const left = Array.from({ length: 1200 }, (_, index) => index);
        const right = [...left, 1200];
        const differ = new YouchamaJsonDiffer(left, right);

        expect(differ.get_diff(true)['list:add']).toHaveLength(1);
    });
});
