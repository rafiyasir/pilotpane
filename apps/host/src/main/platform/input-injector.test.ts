import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullInputInjector } from './input-injector.js';

test('NullInputInjector drops events without throwing', () => {
  const injector = new NullInputInjector();
  assert.doesNotThrow(() => {
    injector.inject({ kind: 'move' });
    injector.inject({ kind: 'move' });
  });
});

test('dispose is safe to call twice', () => {
  const injector = new NullInputInjector();
  assert.doesNotThrow(() => {
    injector.dispose();
    injector.dispose();
  });
});
