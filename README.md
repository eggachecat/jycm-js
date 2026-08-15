# JYCM for JavaScript

[![Coverage Status](https://coveralls.io/repos/github/eggachecat/jycm-js/badge.svg?branch=main)](https://coveralls.io/github/eggachecat/jycm-js?branch=main)

JYCM is a semantic JSON diff and RFC 6902 JSON Patch library for JavaScript and TypeScript. It compares data by business meaning—not only by position or serialization—so teams can match array records by identity, ignore order at selected paths, add domain-specific comparison operators, and still produce an executable standards-based patch.

Use it for API regression testing, configuration drift, audit workflows, data migration validation, and any JSON comparison where ordinary structural diff creates too much noise.

## Install

```bash
npm install jycm
```

## Compare JSON

```ts
import {
    ListItemFieldMatchOperator,
    YouchamaJsonDiffer,
    make_ignore_order_func
} from 'jycm';

const before = {
    users: [
        { id: 1, role: 'viewer' },
        { id: 2, role: 'editor' }
    ]
};

const after = {
    users: [
        { id: 2, role: 'admin' },
        { id: 1, role: 'viewer' }
    ]
};

const differ = new YouchamaJsonDiffer(before, after, {
    custom_operators: [
        new ListItemFieldMatchOperator('^users->\\[\\d+\\]$', 'id')
    ],
    ignore_order_func: make_ignore_order_func(['^users$'])
});

console.log(differ.get_diff(true));
```

The structured result groups additions, removals, value changes, matched paths, and custom-operator events. Consumers can render or analyze those events without parsing human-formatted text. For a synchronized browser view, see [react-jycm-viewer](https://github.com/eggachecat/react-jycm-viewer) and the [live playground source](https://github.com/eggachecat/jycm-json-diff-viewer).

## Generate and apply JSON Patch

JYCM can turn a comparison into a deterministic [RFC 6902 JSON Patch](https://www.rfc-editor.org/rfc/rfc6902). Generated patches honor path-level ignore-order rules and custom operators that declare values equivalent.

```ts
const patch = differ.toJsonPatch(true); // include defensive `test` operations
const updated = differ.applyPatch();

// Python-compatible aliases are also available:
const samePatch = differ.to_json_patch();
const sameResult = differ.apply_patch();
```

Standalone helpers support all six standard operations: `add`, `remove`, `replace`, `move`, `copy`, and `test`.

```ts
import { applyJsonPatch, makeJsonPatch } from 'jycm';

const patch = makeJsonPatch({ enabled: false }, { enabled: true });
const result = applyJsonPatch({ enabled: false }, patch);
```

Inputs are copied by default. Pass `true` as the third argument to `applyJsonPatch`, or as the third argument to `differ.applyPatch`, only when in-place mutation is intentional.

## Configure from JSON

Applications can store comparison policy as data:

```ts
import { get_jycm_instance_from_json } from 'jycm';

const differ = get_jycm_instance_from_json(before, after, {
    operators: [
        {
            name: 'operator:list:matchWithField',
            args: ['^users->\\[\\d+\\]$', 'id']
        }
    ],
    ignore_orders: ['^users$']
});
```

## Development

```bash
pnpm install
pnpm run check
```

The test suite covers semantic operators, ordered and unordered matching, every RFC 6902 operation, JSON Pointer escaping, immutable application, and large-array LCS backtracking.

## Related projects

- [JYCM (Python)](https://github.com/eggachecat/jycm) — the original Python implementation
- [react-jycm-viewer](https://github.com/eggachecat/react-jycm-viewer) — embeddable React visualization
- [jycm-json-diff-viewer](https://github.com/eggachecat/jycm-json-diff-viewer) — interactive semantic diff playground

MIT licensed.
