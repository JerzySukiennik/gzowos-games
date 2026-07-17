import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlay, safeUrl } from '../src/store.js';

const dobYearsAgo = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10); };
test('age gates E, 13+ and 18+ games', () => {
  assert.equal(canPlay({ dob: dobYearsAgo(10) }, { age: 'E' }), true);
  assert.equal(canPlay({ dob: dobYearsAgo(10) }, { age: '13+' }), false);
  assert.equal(canPlay({ dob: dobYearsAgo(15) }, { age: '13+' }), true);
  assert.equal(canPlay({ dob: dobYearsAgo(15) }, { age: '18+' }), false);
  assert.equal(canPlay({ dob: dobYearsAgo(20) }, { age: '18+' }), true);
});
test('safe links accept http(s) and reject dangerous protocols/domains', () => {
  assert.equal(safeUrl('https://example.com/game').ok, true);
  assert.equal(safeUrl('http://example.com/game').ok, false);
  assert.equal(safeUrl('http://localhost:4173/game').ok, true);
  assert.equal(safeUrl('javascript:alert(1)').ok, false);
  assert.equal(safeUrl('https://free-robux.example/login').ok, false);
  assert.equal(safeUrl('not a url').ok, false);
});
