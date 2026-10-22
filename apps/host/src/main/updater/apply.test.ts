import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyUpdate } from './apply.js';

const installerPath = 'C:\\Temp\\PilotPane-update\\PilotPane-Setup-0.2.0.exe';
const relaunchPath = 'C:\\Users\\me\\AppData\\Local\\Programs\\PilotPane\\PilotPane.exe';

test('the installer is started before the app quits, with /S', () => {
  const order: string[] = [];
  let args: string[] = [];
  applyUpdate({
    installerPath,
    relaunchPath,
    spawn: (command, a) => {
      order.push(`spawn ${command}`);
      args = a;
    },
    quit: () => order.push('quit')
  });
  assert.deepEqual(order, ['spawn cmd.exe', 'quit']);
  const script = args[3] ?? '';
  assert.ok(script.includes(`"${installerPath}" /S`));
  assert.ok(script.indexOf('/S') < script.indexOf(`start "" "${relaunchPath}"`));
});

test('paths that could change the command are refused and nothing runs', () => {
  for (const bad of ['C:\\a&b\\Setup.exe', 'C:\\a"b\\Setup.exe', 'C:\\%TEMP%\\Setup.exe']) {
    let ran = false;
    assert.throws(() =>
      applyUpdate({
        installerPath: bad,
        relaunchPath,
        spawn: () => (ran = true),
        quit: () => (ran = true)
      })
    );
    assert.equal(ran, false);
  }
});
