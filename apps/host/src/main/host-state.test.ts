import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HostState } from '@pilotpane/protocol';
import { HostStateStore } from './host-state.js';

const initial: HostState = {
  status: 'starting',
  appVersion: '0.0.0',
  hostName: 'TEST-HOST',
  pin: '123456',
  port: 7420,
  addresses: [],
  theme: 'cockpit',
  quality: '1080p',
  viewer: null,
  stats: null,
  lockedUntil: null,
  message: null,
  update: { phase: 'idle' }
};

test('patch merges into the state and keeps other fields', () => {
  const store = new HostStateStore(initial);
  store.patch({ status: 'ready', pin: '654321' });
  assert.equal(store.state.status, 'ready');
  assert.equal(store.state.pin, '654321');
  assert.equal(store.state.port, 7420);
});

test('subscribers get the new state on every patch', () => {
  const store = new HostStateStore(initial);
  const seen: string[] = [];
  store.subscribe((s) => seen.push(s.status));
  store.patch({ status: 'ready' });
  store.patch({ status: 'paused' });
  assert.deepEqual(seen, ['ready', 'paused']);
});

test('unsubscribe stops notifications', () => {
  const store = new HostStateStore(initial);
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.patch({ message: 'a' });
  off();
  store.patch({ message: 'b' });
  assert.equal(calls, 1);
});
