import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkContent } from './content-check.mjs';

function item(id, topic = 'locks-and-keys', extra = {}) {
  return { id, kind: 'term', topic, term: id, meaning: 'A useful meaning.', clues: ['one', 'two', 'three', 'four', 'five'], assumes: [], decoys: [
    { term: 'wrong one', meaning: 'A meaning.', source_urls: ['https://example.com/one'] },
    { term: 'wrong two', meaning: 'A meaning.', source_urls: ['https://example.com/two'] },
    { term: 'wrong three', meaning: 'A meaning.', source_urls: ['https://example.com/three'] },
  ], exchange: [{ speaker: 'floyd', tone: 'friendly', text: 'Good.' }], old_tech: false, sources: [{ name: 'Example', url: 'https://example.com' }], checked_on: '2026-01-01', difficulty: 1, decisive_clue: 1, ...extra };
}
function lesson(extra = {}) {
  return { id: 'lesson-one', topic: 'locks-and-keys', number: 1, title: 'A lesson', cards: [{ text: 'Card one', mascot: 'floyd', line: 'Learn.' }, { text: 'Card two', mascot: 'bud', line: 'Practice.' }], checks: [
    { prompt: 'Pick one', options: ['Yes', 'No'], answer: 'Yes', why: 'Because.' }, { prompt: 'Pick two', options: ['A', 'Long answer'], answer: 'Long answer', why: 'Because.' }, { prompt: 'Pick three', options: ['Maybe', 'No'], answer: 'Maybe', why: 'Because.' },
  ], takeaway: 'Keep learning.', sources: [{ name: 'Example', url: 'https://example.com' }], checked_on: '2026-01-01', ...extra };
}
function fixture({ items = [item('alpha'), item('ptp-1'), item('ptp-2')], lessons = [], scheduleDays = [{ date: '2026-10-25', term: 'alpha', rerun: false }] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jargle-check-')); fs.mkdirSync(path.join(dir, 'items')); fs.mkdirSync(path.join(dir, 'lessons'));
  for (const value of items) fs.writeFileSync(path.join(dir, 'items', `${value.id}.json`), JSON.stringify(value));
  for (const value of lessons) fs.writeFileSync(path.join(dir, 'lessons', `${value.id}.json`), JSON.stringify(value));
  fs.writeFileSync(path.join(dir, 'schedule.json'), JSON.stringify({ version: 1, days: scheduleDays })); fs.writeFileSync(path.join(dir, 'old_tech_order.json'), '[]'); fs.writeFileSync(path.join(dir, 'ptp_extras.json'), '["ptp-1","ptp-2"]'); fs.writeFileSync(path.join(dir, 'miss_lines.json'), '{"either":[],"floyd":[]}'); fs.writeFileSync(path.join(dir, 'common_words.json'), '[]');
  return dir;
}
function errorsFor(options) { return checkContent({ contentDir: fixture(options) }).errors; }

test('good item passes', () => { const dir = fixture({ items: [item('alpha', 'locks-and-keys', { blank: { sentence: 'Use ___ to protect it.', wrong: ['phone', 'paper'] }, why: 'It helps people stay safe.', short: 'A safety tool', situations: [{ text: 'A lock blocks a stranger.', options: ['Safe', 'Scam'], answer: 'Safe', why: 'It blocks entry.' }] }), item('ptp-1'), item('ptp-2')] }); assert.equal(checkContent({ contentDir: dir }).errors.length, 0); });
test('blank with two blanks is rejected', () => { const errors = errorsFor({ items: [item('alpha', 'locks-and-keys', { blank: { sentence: '___ has ___.', wrong: ['phone', 'paper'] } })] }); assert.ok(errors.some((entry) => entry.message.includes('blank.sentence'))); });
test('wrong choice containing the term is rejected', () => { const errors = errorsFor({ items: [item('alpha', 'locks-and-keys', { blank: { sentence: 'Use ___ here.', wrong: ['alpha', 'paper'] } })] }); assert.ok(errors.some((entry) => entry.message.includes('blank.wrong'))); });
test('short text over six words is rejected', () => { const errors = errorsFor({ items: [item('alpha', 'locks-and-keys', { short: 'one two three four five six seven' })] }); assert.ok(errors.some((entry) => entry.message.includes('short'))); });
test('situation answer must be an option', () => { const errors = errorsFor({ items: [item('alpha', 'locks-and-keys', { situations: [{ text: 'A moment.', options: ['Safe', 'Scam'], answer: 'Maybe', why: 'A reason.' }] })] }); assert.ok(errors.some((entry) => entry.message.includes('answer must be one of options'))); });
test('lesson words must use the lesson topic', () => { const values = [item('a'), item('b'), item('c'), item('d'), item('other', 'your-phone'), item('ptp-1'), item('ptp-2')].map((value) => ({ ...value, blank: { sentence: 'Use ___ here.', wrong: ['x', 'y'] } })); const errors = errorsFor({ items: values, lessons: [lesson({ words: ['a', 'b', 'c', 'other'] })] }); assert.ok(errors.some((entry) => entry.message.includes('different topic'))); });
test('lesson words cannot use a later daily word', () => { const values = [item('alpha', 'locks-and-keys', { blank: { sentence: 'Use ___ here.', wrong: ['x', 'y'] } }), item('late', 'locks-and-keys', { difficulty: 2, blank: { sentence: 'Use ___ here.', wrong: ['x', 'y'] } }), item('ptp-1'), item('ptp-2')]; const errors = errorsFor({ items: values, lessons: [lesson({ words: ['alpha', 'late', 'ptp-1', 'ptp-2'] })], scheduleDays: [{ date: '2026-10-25', term: 'alpha', rerun: false }, { date: '2026-10-26', term: 'late', rerun: false }] }); assert.ok(errors.some((entry) => entry.message.includes('released after lesson day'))); });
test('lesson needs at least two situations', () => { const errors = errorsFor({ lessons: [lesson({ situations: [{ text: 'A moment.', options: ['Safe', 'Scam'], answer: 'Safe', why: 'A reason.' }] })] }); assert.ok(errors.some((entry) => entry.message.includes('situations must have 2 to 4'))); });
test('banned text checks new fields', () => { const bad = `This has an em dash ${String.fromCodePoint(0x2014)} here.`; const value = item('alpha', 'locks-and-keys', { blank: { sentence: bad, wrong: ['x', 'y'] }, why: bad, short: bad, situations: [{ text: bad, options: ['Safe', 'Scam'], answer: 'Safe', why: bad }] }); const errors = errorsFor({ items: [value] }); assert.ok(errors.filter((entry) => entry.message.includes('em dash')).length >= 5); });

test('lesson words need different short meanings', () => {
  const values = [item('a'), item('b'), item('c'), item('d'), item('ptp-1'), item('ptp-2')].map((value) => ({ ...value, short: 'Same short text', blank: { sentence: 'Use ___ here.', wrong: ['x', 'y'] } }));
  const errors = errorsFor({ items: values, lessons: [lesson({ words: ['a', 'b', 'c', 'd'] })] });
  assert.ok(errors.some((entry) => entry.message.includes('same short meaning')));
});
