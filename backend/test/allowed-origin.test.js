import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrigins, isAllowed } from '../src/allowed-origin.js';

test('the allowlist is parsed from a comma separated string', () => {
  assert.deepEqual(parseOrigins('https://a.app, https://b.app'), ['https://a.app', 'https://b.app']);
  assert.deepEqual(parseOrigins(''), []);
  assert.deepEqual(parseOrigins(undefined), []);
});

test('trailing slashes do not change the origin', () => {
  assert.deepEqual(parseOrigins('https://a.app/'), ['https://a.app']);
  assert.ok(isAllowed('https://a.app/', parseOrigins('https://a.app')));
  assert.ok(isAllowed('https://a.app', parseOrigins('https://a.app/')));
});

test('a listed origin is allowed, an unlisted one is not', () => {
  const list = parseOrigins('https://a.app');
  assert.ok(isAllowed('https://a.app', list));
  assert.ok(!isAllowed('https://evil.app', list));
});

test('a request with no Origin always passes', () => {
  // curl, server-to-server, and same-origin navigations send no Origin header.
  assert.ok(isAllowed(undefined, []));
  assert.ok(isAllowed(undefined, parseOrigins('https://a.app')));
});

test('an empty allowlist still lets same-origin proxied traffic through', () => {
  // The regression: proxied calls carry the browser Origin but are same-origin
  // to the browser. isAllowed returning false must only drop the CORS headers,
  // never reject - which is why nothing here throws.
  assert.equal(isAllowed('https://jc-brain.vercel.app', []), false);
  assert.doesNotThrow(() => isAllowed('https://jc-brain.vercel.app', []));
});
