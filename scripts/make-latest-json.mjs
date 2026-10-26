import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function currentPubDate() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function makeLatestJson({
  version,
  notes,
  pubDate,
  baseUrl,
  macSignature,
  windowsSignature,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error(`Version must be numeric x.y.z, got ${version ?? ''}`);
  }
  if (!/^https:\/\//.test(baseUrl ?? '')) {
    throw new Error('Base URL must use https');
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const platforms = {};
  if (macSignature?.trim()) {
    const url = `${cleanBaseUrl}/Jargle-mac-update.app.tar.gz`;
    for (const platform of ['darwin-universal', 'darwin-aarch64', 'darwin-x86_64']) {
      platforms[platform] = { signature: macSignature.trim(), url };
    }
  }
  if (windowsSignature?.trim()) {
    platforms['windows-x86_64'] = {
      signature: windowsSignature.trim(),
      url: `${cleanBaseUrl}/Jargle-windows-setup.exe`,
    };
  }
  if (Object.keys(platforms).length === 0) {
    throw new Error('At least one update signature is required');
  }

  return {
    version,
    notes: notes ?? `Jargle ${version}`,
    pub_date: pubDate ?? currentPubDate(),
    platforms,
  };
}

function readArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    values[name] = args[i + 1];
    i += 1;
  }
  return values;
}

function readSignature(file, label) {
  if (!file) return undefined;
  let value;
  try {
    value = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`${label} signature file not found: ${file}`);
  }
  if (!value.trim()) throw new Error(`${label} signature file is empty: ${file}`);
  return value;
}

function runCli() {
  const args = readArgs(process.argv.slice(2));
  for (const name of ['version', 'base-url', 'out']) {
    if (!args[name]) throw new Error(`Missing required option: --${name}`);
  }
  const result = makeLatestJson({
    version: args.version,
    notes: args.notes,
    pubDate: args['pub-date'],
    baseUrl: args['base-url'],
    macSignature: readSignature(args['mac-sig'], 'Mac'),
    windowsSignature: readSignature(args['windows-sig'], 'Windows'),
  });
  fs.writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
