import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HelperInputInjector, type HelperProcess } from './helper-input-injector.js';

class FakeProc implements HelperProcess {
  written: string[] = [];
  closed = false;
  private lineCb: (line: string) => void = () => {};
  private exitCb: () => void = () => {};
  write(line: string): void {
    this.written.push(line);
  }
  onLine(cb: (line: string) => void): void {
    this.lineCb = cb;
  }
  onExit(cb: () => void): void {
    this.exitCb = cb;
  }
  close(): void {
    this.closed = true;
  }
  say(line: string): void {
    this.lineCb(line);
  }
  die(): void {
    this.exitCb();
  }
}

function setup() {
  const procs: FakeProc[] = [];
  const injector = new HelperInputInjector({
    spawn: () => {
      const p = new FakeProc();
      procs.push(p);
      return p;
    }
  });
  return { injector, procs };
}

test('drops commands until the helper says ready, then writes lines', () => {
  const { injector, procs } = setup();
  const proc = procs[0]!;
  injector.inject({ kind: 'move', x: 1, y: 2 });
  assert.deepEqual(proc.written, []);
  proc.say('ready');
  injector.inject({ kind: 'move', x: 1, y: 2 });
  injector.inject({ kind: 'wheel', dx: 0, dy: -1 });
  assert.deepEqual(proc.written, ['M 1 2', 'W 0 -1']);
});

test('drops invalid commands', () => {
  const { injector, procs } = setup();
  procs[0]!.say('ready');
  injector.inject({ kind: 'move', x: -5, y: 0 });
  assert.deepEqual(procs[0]!.written, []);
});

test('dispose releases held buttons and keys, closes stdin, and is safe twice', () => {
  const { injector, procs } = setup();
  const proc = procs[0]!;
  proc.say('ready');
  injector.inject({ kind: 'button', button: 'left', down: true });
  injector.inject({ kind: 'key', vk: 65, down: true });
  injector.inject({ kind: 'key', vk: 66, down: true });
  injector.inject({ kind: 'key', vk: 66, down: false });
  proc.written.length = 0;
  injector.dispose();
  injector.dispose();
  assert.deepEqual(proc.written, ['B L 0', 'K 65 0']);
  assert.equal(proc.closed, true);
  injector.inject({ kind: 'move', x: 1, y: 1 });
  assert.equal(proc.written.length, 2);
});

test('restarts once after the helper exits and releases what was held', () => {
  const { injector, procs } = setup();
  procs[0]!.say('ready');
  injector.inject({ kind: 'button', button: 'right', down: true });
  procs[0]!.die();
  assert.equal(procs.length, 2);
  injector.inject({ kind: 'move', x: 1, y: 1 });
  assert.deepEqual(procs[1]!.written, []);
  procs[1]!.say('ready');
  assert.deepEqual(procs[1]!.written, ['B R 0']);
  injector.inject({ kind: 'move', x: 3, y: 4 });
  assert.equal(procs[1]!.written.at(-1), 'M 3 4');
});

test('after a second exit input stays off and nothing throws', () => {
  const { injector, procs } = setup();
  procs[0]!.say('ready');
  procs[0]!.die();
  procs[1]!.say('ready');
  procs[1]!.die();
  assert.equal(procs.length, 2);
  assert.doesNotThrow(() => injector.inject({ kind: 'move', x: 1, y: 1 }));
  assert.doesNotThrow(() => injector.dispose());
});

test('a spawn that throws leaves a working no-op injector', () => {
  const injector = new HelperInputInjector({
    spawn: () => {
      throw new Error('no exe');
    }
  });
  assert.doesNotThrow(() => injector.inject({ kind: 'move', x: 1, y: 1 }));
  assert.doesNotThrow(() => injector.dispose());
});

test('a write that throws does not reach the caller', () => {
  const { injector, procs } = setup();
  const proc = procs[0]!;
  proc.write = () => {
    throw new Error('EPIPE');
  };
  proc.say('ready');
  assert.doesNotThrow(() => injector.inject({ kind: 'move', x: 1, y: 1 }));
});

test('releaseAll lets go of held buttons and keys but keeps the helper running', () => {
  const { injector, procs } = setup();
  const proc = procs[0]!;
  proc.say('ready');
  injector.inject({ kind: 'button', button: 'left', down: true });
  injector.inject({ kind: 'button', button: 'middle', down: true });
  injector.inject({ kind: 'button', button: 'middle', down: false });
  proc.written.length = 0;
  injector.releaseAll();
  assert.deepEqual(proc.written, ['B L 0']);
  injector.releaseAll();
  assert.deepEqual(proc.written, ['B L 0']);
  assert.equal(proc.closed, false);
});

test('available is true while the helper runs and false after dispose', () => {
  const { injector, procs } = setup();
  procs[0]!.say('ready');
  assert.equal(injector.available, true);
  injector.dispose();
  assert.equal(injector.available, false);
});
