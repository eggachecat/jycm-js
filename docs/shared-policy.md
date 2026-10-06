# Share a JSON diff policy between Python and JavaScript

Use one declarative policy to specify collection ordering, identity matching,
numeric tolerances, and ignored fields. The [fixture](shared-policy.json) has
reordered items, price changes inside a tolerance, and a changing trace ID.
Both engines should report semantic equality and an empty JSON Patch.

## Run the Python example

Install the current Python source from a checkout of
[eggachecat/jycm](https://github.com/eggachecat/jycm):

```bash
python -m pip install -e /path/to/jycm
```

From the `jycm-js` checkout, run:

```bash
python - <<'PYTHON'
import json
from jycm import BusinessDiffPolicy
with open("docs/shared-policy.json") as stream:
    fixture = json.load(stream)
policy = BusinessDiffPolicy(fixture["policy"])
assert policy.compare(fixture["before"], fixture["after"])["equal"] == fixture["expected_equal"]
assert policy.build(fixture["before"], fixture["after"]).to_json_patch() == fixture["expected_patch"]
print("Python: semantic equality; empty patch")
PYTHON
```

## Run the JavaScript example

Build this source checkout so the example does not depend on the capabilities
of an earlier registry release:

```bash
pnpm install
pnpm run build
node docs/check-shared-policy.cjs
```

The npm package for this repository is named `jycm`, not `jycm-js`. For an
application, pin the package version you have validated and confirm that it
exports `YouchamaJsonDiffer.fromPolicy`.

## Interpreting the result

An empty patch means no changes are required under this policy. It preserves
source ordering, prices, and trace ID; it does not reconstruct the exact target.
Changing a price beyond the configured tolerance should make equality false.

`version: 1` is the policy format version. It is not the library release version.
Use stable unique identity fields, JSON-compatible inputs, and shared fixtures.
Regex behavior, Unicode transformations, and numeric precision can differ
between runtimes. Custom Python operators and JavaScript functions must be
implemented separately. This example verifies one fixture, not all policies.

[More task guides](https://github.com/eggachecat/jycm/tree/master/docs/source/guides)
· [Playground](https://eggachecat.github.io/jycm-json-diff-viewer/)
