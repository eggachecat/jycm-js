import {
    JsonPatchError,
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

    test('validates malformed operations, pointers, and array indexes', () => {
        const document = {
            value: 1,
            values: ['a'],
            nested: [[1]]
        };

        const invalidPatches: Array<{
            patch: any[];
            message: string;
        }> = [
            {
                patch: [null],
                message: "Each patch operation requires 'op' and 'path'"
            },
            {
                patch: [{ op: 'add', path: 'invalid', value: true }],
                message: "JSON Pointer paths must be empty or start with '/'"
            },
            {
                patch: [{ op: 'remove', path: '/values/not-an-index' }],
                message: 'Invalid array index: not-an-index'
            },
            {
                patch: [{ op: 'remove', path: '/values/1' }],
                message: 'Array index out of bounds: 1'
            },
            {
                patch: [{ op: 'test', path: '/missing', value: true }],
                message: 'Path does not exist: /missing'
            },
            {
                patch: [{ op: 'add', path: '/missing/child', value: true }],
                message: 'Parent path does not exist: /missing/child'
            },
            {
                patch: [{ op: 'add', path: '/value/child', value: true }],
                message: 'Add target is not a container: /value/child'
            },
            {
                patch: [{ op: 'remove', path: '' }],
                message: 'Removing the document root is not supported'
            },
            {
                patch: [{ op: 'remove', path: '/missing' }],
                message: 'Remove path does not exist: /missing'
            },
            {
                patch: [{ op: 'test', path: '/value' }],
                message: "Test operation requires 'value'"
            },
            {
                patch: [{ op: 'replace', path: '/value' }],
                message: "Replace operation requires 'value'"
            },
            {
                patch: [{ op: 'copy', path: '/copy' }],
                message: "Copy operation requires 'from'"
            },
            {
                patch: [{ op: 'move', path: '/copy' }],
                message: "Move operation requires 'from'"
            },
            {
                patch: [{ op: 'unknown', path: '' }],
                message: 'Unsupported patch operation: unknown'
            }
        ];

        invalidPatches.forEach(({ patch, message }) => {
            expect(() => apply_json_patch(document, patch as any)).toThrow(
                message
            );
        });
        expect(() =>
            apply_json_patch(document, [
                { op: 'remove', path: '/nested/0/0' }
            ])
        ).not.toThrow();
        expect(new JsonPatchError('invalid').name).toBe('JsonPatchError');
    });

    test('supports root replacement, in-place writes, and shrinking arrays', () => {
        const rootPatch = new YouchamaJsonDiffer(
            { old: true },
            ['replacement']
        );
        expect(rootPatch.applyPatch()).toStrictEqual(['replacement']);

        const mutable = { enabled: false };
        const sameReference = apply_json_patch(
            mutable,
            [{ op: 'replace', path: '/enabled', value: true }],
            true
        );
        expect(sameReference).toBe(mutable);
        expect(mutable.enabled).toBe(true);

        const shrink = new YouchamaJsonDiffer(
            { values: [1, 2, 3] },
            { values: [1] }
        );
        const patch = shrink.toJsonPatch(true);
        expect(patch).toStrictEqual([
            { op: 'test', path: '/values/2', value: 3 },
            { op: 'remove', path: '/values/2' },
            { op: 'test', path: '/values/1', value: 2 },
            { op: 'remove', path: '/values/1' }
        ]);
        expect(shrink.applyPatch(undefined, patch)).toStrictEqual({
            values: [1]
        });
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
