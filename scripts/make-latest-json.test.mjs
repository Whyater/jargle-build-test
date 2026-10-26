import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { makeLatestJson } from './make-latest-json.mjs';

const base = 'https://example.test/releases/v2.1.0';

test('builds entries for both platforms', () => {
  const result = makeLatestJson({
    version: '2.1.0',
    baseUrl: `${base}/`,
    macSignature: 'mac-signature\n',
    windowsSignature: 'windows-signature\n',
  });
  assert.equal(result.notes, 'Jargle 2.1.0');
  assert.equal(Object.keys(result.platforms).length, 4);
  assert.deepEqual(result.platforms['darwin-universal'], {
    signature: 'mac-signature',
    url: `${base}/Jargle-mac-update.app.tar.gz`,
  });
  assert.deepEqual(result.platforms['windows-x86_64'], {
    signature: 'windows-signature',
    url: `${base}/Jargle-windows-setup.exe`,
  });
});

test('supports mac-only and windows-only releases', () => {
  const mac = makeLatestJson({ version: '1.2.3', baseUrl: base, macSignature: 'mac' });
  assert.deepEqual(Object.keys(mac.platforms), ['darwin-universal', 'darwin-aarch64', 'darwin-x86_64']);
  const windows = makeLatestJson({ version: '1.2.3', baseUrl: base, windowsSignature: 'windows' });
  assert.deepEqual(Object.keys(windows.platforms), ['windows-x86_64']);
});

test('rejects a bad version and no platforms', () => {
  assert.throws(() => makeLatestJson({ version: '2.1', baseUrl: base, macSignature: 'mac' }), /numeric x\.y\.z/);
  assert.throws(() => makeLatestJson({ version: '2.1.0', baseUrl: base }), /At least one update signature/);
});

test('CLI writes latest.json from signature files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jargle-latest-'));
  const macSig = path.join(dir, 'mac.sig');
  const windowsSig = path.join(dir, 'windows.sig');
  const out = path.join(dir, 'latest.json');
  fs.writeFileSync(macSig, 'mac-cli-signature\n');
  fs.writeFileSync(windowsSig, 'windows-cli-signature\n');
  execFileSync(process.execPath, [
    'scripts/make-latest-json.mjs', '--version', '2.1.0', '--base-url', base,
    '--mac-sig', macSig, '--windows-sig', windowsSig, '--out', out,
  ]);
  const result = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(Object.keys(result.platforms).length, 4);
  assert.equal(result.platforms['darwin-universal'].url, `${base}/Jargle-mac-update.app.tar.gz`);
  assert.equal(result.platforms['windows-x86_64'].url, `${base}/Jargle-windows-setup.exe`);
});
