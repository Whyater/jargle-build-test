import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { checkContent, printResult } from './content-check.mjs';

// Locate the repository root beside the scripts directory.
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptsDir);

// Validate content and build the public bundle when validation succeeds.
const strict = process.argv.includes('--strict');
const result = checkContent({ strict });
printResult(result, strict);
if (result.errors.length) {
  process.exitCode = 1;
} else {
  const topicOrder = ['locks-and-keys', 'talking-computers', 'scams-and-fakes', 'your-phone', 'internet-talk', 'how-the-internet-works', 'money-on-your-phone'];
  const lessons = [...result.content.lessons].sort((first, second) => topicOrder.indexOf(first.topic) - topicOrder.indexOf(second.topic) || first.number - second.number);
  const items = Object.fromEntries([...result.content.items.entries()].sort(([first], [second]) => first.localeCompare(second)));
  // The apps swap in a downloaded bundle only when its version is higher than the one they ship,
  // so every build gets a bigger number: minutes since 1970 (or CONTENT_VERSION if set).
  const version = Number(process.env.CONTENT_VERSION) || Math.floor(Date.now() / 60000);
  const bundle = { version, items, lessons, oldTech: result.content.oldTech, ptpExtras: result.content.ptpExtras, schedule: result.content.schedule, missLines: result.content.missLines, commonWords: result.content.commonWords };
  const outputDir = path.join(rootDir, 'web', 'public', 'content');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'bundle.json');
  const data = JSON.stringify(bundle);
  fs.writeFileSync(outputPath, data);
  console.log(`wrote ${outputPath}`);
  console.log(`size ${(Buffer.byteLength(data) / 1000).toFixed(1)} kB, gzip ${(gzipSync(data).length / 1000).toFixed(1)} kB`);
}
