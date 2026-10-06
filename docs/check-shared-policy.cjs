const assert = require('node:assert/strict');
const fixture = require('./shared-policy.json');
const { YouchamaJsonDiffer } = require('../dist/index.js');
const differ = YouchamaJsonDiffer.fromPolicy(fixture.before, fixture.after, fixture.policy);
assert.equal(differ.explain().equal, fixture.expected_equal);
assert.deepEqual(differ.toJsonPatch(), fixture.expected_patch);
console.log('JavaScript: semantic equality; empty patch');
