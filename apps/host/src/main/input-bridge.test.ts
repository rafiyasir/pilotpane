import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputBridge, MAX_MOVES_PER_SECOND } from './input-bridge.js';
import type { InputCommand } from './platform/input-command.js';
import type { InputInjector } from './platform/input-injector.js';

class FakeInjector implements InputInjector {
  available = true;
  commands: InputCommand[] = [];
  released = 0;
  inject(cmd: InputCommand): void {
    this.commands.push(cmd);
  }
  releaseAll(): void {
    this.released += 1;
  }
  dispose(): void {}
}

test('maps each message to a command', () => {
  const inj = new FakeInjector();
  const bridge = new InputBridge(inj);
  bridge.handle({ type: 'mouse-move', x: 10, y: 20 });
  bridge.handle({ type: 'mouse-button', button: 'right', down: true });
  bridge.handle({ type: 'mouse-wheel', dx: 0, dy: -2 });
  assert.deepEqual(inj.commands, [
    { kind: 'move', x: 10, y: 20 },
    { kind: 'button', button: 'right', down: true },
    { kind: 'wheel', dx: 0, dy: -2 }
  ]);
});

test('drops moves above the rate limit but never buttons or wheel', () => {
  const inj = new FakeInjector();
  let t = 1000;
  const bridge = new InputBridge(inj, () => t);
  for (let i = 0; i < MAX_MOVES_PER_SECOND + 50; i++) bridge.handle({ type: 'mouse-move', x: i, y: 0 });
  assert.equal(inj.commands.length, MAX_MOVES_PER_SECOND);
  bridge.handle({ type: 'mouse-button', button: 'left', down: false });
  bridge.handle({ type: 'mouse-wheel', dx: 0, dy: 1 });
  assert.equal(inj.commands.length, MAX_MOVES_PER_SECOND + 2);
  t += 1000; // a new second
  bridge.handle({ type: 'mouse-move', x: 1, y: 1 });
  assert.equal(inj.commands.length, MAX_MOVES_PER_SECOND + 3);
});

test('end releases held input', () => {
  const inj = new FakeInjector();
  const bridge = new InputBridge(inj);
  bridge.end();
  assert.equal(inj.released, 1);
});

test('reports whether the injector can inject', () => {
  const inj = new FakeInjector();
  inj.available = false;
  assert.equal(new InputBridge(inj).available, false);
});
