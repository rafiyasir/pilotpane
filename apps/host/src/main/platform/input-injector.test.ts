import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullInputInjector } from './input-injector.js';

test('NullInputInjector drops events without throwing', () => {
  const injector = new NullInputInjector();
  assert.doesNotThrow(() => {
    injector.inject({ kind: 'move', x: 0, y: 0 });
    injector.inject({ kind: 'move', x: 0, y: 0 });
  });
});

test('dispose is safe to call twice', () => {
  const injector = new NullInputInjector();
  assert.doesNotThrow(() => {
    injector.dispose();
    injector.dispose();
  });
});

test('NullInputInjector says it is not available and releaseAll is safe', () => {
  const injector = new NullInputInjector();
  assert.equal(injector.available, false);
  assert.doesNotThrow(() => injector.releaseAll());
});
