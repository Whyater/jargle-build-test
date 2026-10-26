/// <reference types="node" />

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const webRoot = process.cwd();

function sourceFiles(folder: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(folder)) {
    const file = join(folder, name);
    if (statSync(file).isDirectory()) {
      files.push(...sourceFiles(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      files.push(file);
    }
  }
  return files;
}

function lineNumber(text: string, position: number): number {
  return text.slice(0, position).split('\n').length;
}

describe('browser floor', () => {
  it('contains no unsupported methods or CSS features', () => {
    const banned = [
      /structuredClone\(/,
      /\.at\(/,
      /\.replaceAll\(/,
      /Object\.hasOwn\(/,
      /:focus-visible/,
      /clamp\(/,
      /aspect-ratio/,
      /dvh/,
      /svh/,
      /lvh/,
    ];
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
      const relativeFile = relative(webRoot, file);
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file === __filename) {
        continue;
      }
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        for (const pattern of banned) {
          if (pattern.test(lines[index])) {
            violations.push(`${relativeFile}:${index + 1}`);
          }
        }
      }

      if (file.endsWith('.css')) {
        const rules = /[^{}]*\{[^{}]*\}/g;
        let match: RegExpExecArray | null;
        while ((match = rules.exec(text)) !== null) {
          const block = match[0];
          const hasFlex = /display\s*:\s*(?:inline-)?flex\b/.test(block);
          const hasGap = /(?:^|[;{])\s*(?:gap|row-gap|column-gap)\s*:/.test(block);
          if (hasFlex && hasGap) {
            violations.push(`${relativeFile}:${lineNumber(text, match.index)}`);
          }
        }
      }
    }

    const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
    const htmlLines = html.split('\n');
    for (let index = 0; index < htmlLines.length; index += 1) {
      if (/maximum-scale|user-scalable/.test(htmlLines[index])) {
        violations.push(`index.html:${index + 1}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
