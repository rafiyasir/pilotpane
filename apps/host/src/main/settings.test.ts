import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings.js';

function inTempDir(run: (file: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'pilotpane-settings-'));
  try {
    run(join(dir, 'settings.json'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the low quality preset survives a save and a load', () => {
  inTempDir((file) => {
    saveSettings(file, { ...DEFAULT_SETTINGS, quality: 'low' });
    assert.equal(loadSettings(file).quality, 'low');
  });
});

test('the close notice flag survives a save and a load', () => {
  inTempDir((file) => {
    assert.equal(loadSettings(file).closeNoticeSeen, false);
    saveSettings(file, { ...DEFAULT_SETTINGS, closeNoticeSeen: true });
    assert.equal(loadSettings(file).closeNoticeSeen, true);
  });
});

test('a junk close notice flag counts as not seen', () => {
  inTempDir((file) => {
    writeFileSync(file, JSON.stringify({ closeNoticeSeen: 'yes' }));
    assert.equal(loadSettings(file).closeNoticeSeen, false);
  });
});

test('a junk stored quality falls back to the default', () => {
  inTempDir((file) => {
    writeFileSync(file, JSON.stringify({ quality: '4k' }));
    assert.equal(loadSettings(file).quality, DEFAULT_SETTINGS.quality);
  });
});
