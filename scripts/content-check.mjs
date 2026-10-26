import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Loading files
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptsDir);
const contentDir = path.join(rootDir, 'content');
const TOPICS = ['locks-and-keys', 'talking-computers', 'scams-and-fakes', 'your-phone', 'internet-talk', 'how-the-internet-works', 'money-on-your-phone', 'old-tech'];
const DAILY_TOPICS = TOPICS.slice(0, 7);
const DEMO_ORDER = ['two-factor-login', 'wi-fi', 'screenshot', 'emoji', 'phishing', 'deepfake', 'the-cloud', 'bluetooth', 'zelle', 'hashtag', 'spam', 'claude'];
const PRODUCTS = ['venmo', 'cash app', 'paypal', 'siri', 'alexa', 'facebook', 'instagram', 'whatsapp', 'google', 'iphone'];
const KEEP_OUT = ['addictive', 'get smarter', 'brain training', 'inoculate', 'scammer', 'teachers know less ai than students', 'national winner', 'first ever', 'no one else'];
const CODE_KEYS = new Set(['id', 'kind', 'topic', 'checked_on', 'speaker', 'tone', 'mascot', 'words']);
const URL_KEYS = new Set(['url', 'source_urls', 'link_urls']);

// Read one JSON file and record parse errors.
function readJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    addError(errors, file, `invalid JSON (${error.message})`);
    return null;
  }
}

// Return a path relative to the repository root.
function relativeFile(file) {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

// Add a structured error for later printing.
function addError(errors, file, message) {
  errors.push({ file: relativeFile(file), message });
}

// Add a structured warning for later printing.
function addWarning(warnings, file, message) {
  warnings.push({ file: relativeFile(file), message });
}

// Check whether a value is a plain object.
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Check required and allowed object keys.
function checkKeys(value, keys, errors, file, label, optional = []) {
  if (!isObject(value)) {
    addError(errors, file, `${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) addError(errors, file, `${label} has unknown key ${key}`);
  }
  for (const key of keys) {
    if (!optional.includes(key) && !(key in value)) addError(errors, file, `${label} is missing ${key}`);
  }
  return true;
}

// Check a non-empty string.
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

// Check the URL format allowed in content.
function isValidUrl(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

// Check a real calendar date in UTC.
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Check the review date field.
function checkCheckedOn(value, file, errors) {
  if (value !== null && !isValidDate(value)) addError(errors, file, 'checked_on must be null or a real YYYY-MM-DD date');
}

// Check a list of named source URLs.
function checkSources(value, file, errors, label = 'sources') {
  if (!Array.isArray(value) || value.length < 1) {
    addError(errors, file, `${label} must have at least one entry`);
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    const source = value[i];
    const field = `${label}[${i}]`;
    if (!checkKeys(source, ['name', 'url'], errors, file, field)) continue;
    if (!isNonEmptyString(source.name)) addError(errors, file, `${field}.name must be non-empty`);
    if (!isValidUrl(source.url)) addError(errors, file, `${field}.url must start with https://`);
  }
}

// Check an array whose entries must all be strings.
function checkStringArray(value, file, errors, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) addError(errors, file, `${label} must be an array of strings`);
}

// Check one situation card.
function checkSituation(value, file, errors, label) {
  if (!checkKeys(value, ['text', 'options', 'answer', 'why'], errors, file, label)) return;
  if (!isNonEmptyString(value.text) || wordCount(value.text) > 35) addError(errors, file, `${label}.text must be non-empty and have 35 words or fewer`);
  if (!Array.isArray(value.options) || value.options.length !== 2 || value.options.some((option) => !isNonEmptyString(option)) || new Set(value.options.map((option) => option.toLowerCase())).size !== 2) {
    addError(errors, file, `${label}.options must have exactly 2 distinct non-empty strings`);
  } else if (!value.options.includes(value.answer)) {
    addError(errors, file, `${label}.answer must be one of options`);
  }
  if (!isNonEmptyString(value.why) || wordCount(value.why) > 25) addError(errors, file, `${label}.why must be non-empty and have 25 words or fewer`);
}

// Check optional item lesson fields.
function checkItemLessonFields(item, file, errors) {
  if (item.blank !== undefined) {
    if (!checkKeys(item.blank, ['sentence', 'wrong'], errors, file, 'blank')) return;
    if (!isNonEmptyString(item.blank.sentence) || (item.blank.sentence.match(/___/g) || []).length !== 1 || item.blank.sentence.startsWith('___')) addError(errors, file, 'blank.sentence must be non-empty, contain ___ exactly once, and not start with ___');
    if (!Array.isArray(item.blank.wrong) || ![2, 3].includes(item.blank.wrong.length) || item.blank.wrong.some((entry) => !isNonEmptyString(entry)) || new Set(item.blank.wrong.map((entry) => entry.toLowerCase())).size !== item.blank.wrong.length) addError(errors, file, 'blank.wrong must have 2 or 3 distinct non-empty strings');
    else if (item.term && item.blank.wrong.some((entry) => entry.toLowerCase() === item.term.toLowerCase())) addError(errors, file, 'blank.wrong must not contain the item term');
    if (isNonEmptyString(item.blank.sentence) && item.term && isWholeWord(item.blank.sentence.replace('___', ''), item.term)) addError(errors, file, 'blank.sentence must not contain the item term');
  }
  if (item.why !== undefined && (!isNonEmptyString(item.why) || wordCount(item.why) > 20)) addError(errors, file, 'why must be non-empty and have 20 words or fewer');
  if (item.short !== undefined && (!isNonEmptyString(item.short) || wordCount(item.short) > 6 || (item.term && isWholeWord(item.short, item.term)))) addError(errors, file, 'short must be non-empty, have 6 words or fewer, and not contain the item term');
  if (item.situations !== undefined) {
    if (!Array.isArray(item.situations) || item.situations.length < 1 || item.situations.length > 4) addError(errors, file, 'situations must have 1 to 4 entries');
    else for (let i = 0; i < item.situations.length; i += 1) checkSituation(item.situations[i], file, errors, `situations[${i}]`);
  }
}

// Check the shape and fields of one term item.
function checkItem(item, file, errors) {
  const keys = ['id', 'kind', 'topic', 'term', 'meaning', 'clues', 'assumes', 'decoys', 'exchange', 'old_tech', 'sources', 'checked_on', 'difficulty', 'decisive_clue', 'release_day', 'bank', 'blank', 'why', 'short', 'situations', 'puzzle'];
  if (!checkKeys(item, keys, errors, file, 'item', ['release_day', 'bank', 'blank', 'why', 'short', 'situations', 'puzzle'])) return;
  if (item.kind !== 'term') addError(errors, file, 'kind must be term');
  if (!TOPICS.includes(item.topic)) addError(errors, file, 'topic is invalid');
  if (!isNonEmptyString(item.term)) addError(errors, file, 'term must be non-empty');
  if (typeof item.meaning !== 'string') addError(errors, file, 'meaning must be a string');
  if (!Array.isArray(item.clues) || item.clues.length !== 5 || item.clues.some((entry) => !isNonEmptyString(entry))) addError(errors, file, 'clues must be exactly 5 non-empty strings');
  checkStringArray(item.assumes, file, errors, 'assumes');
  if (!Array.isArray(item.decoys) || item.decoys.length !== 3) {
    addError(errors, file, 'decoys must be exactly 3 entries');
  } else {
    for (let i = 0; i < item.decoys.length; i += 1) {
      const decoy = item.decoys[i];
      const field = `decoys[${i}]`;
      if (!checkKeys(decoy, ['term', 'meaning', 'source_urls'], errors, file, field)) continue;
      if (!isNonEmptyString(decoy.term) || typeof decoy.meaning !== 'string') addError(errors, file, `${field} has invalid text`);
      if (!Array.isArray(decoy.source_urls) || decoy.source_urls.length < 1 || decoy.source_urls.some((url) => !isValidUrl(url))) addError(errors, file, `${field}.source_urls must contain https:// urls`);
    }
  }
  if (!Array.isArray(item.exchange) || item.exchange.length < 1) {
    addError(errors, file, 'exchange must have at least one line');
  } else {
    for (let i = 0; i < item.exchange.length; i += 1) {
      const line = item.exchange[i];
      const field = `exchange[${i}]`;
      if (!checkKeys(line, ['speaker', 'tone', 'text', 'link_urls'], errors, file, field, ['tone', 'link_urls'])) continue;
      if (!['floyd', 'bud'].includes(line.speaker)) addError(errors, file, `${field}.speaker is invalid`);
      if (!isNonEmptyString(line.text)) addError(errors, file, `${field}.text must be non-empty`);
      if (line.speaker === 'floyd' && !['right', 'neutral', 'friendly'].includes(line.tone)) addError(errors, file, `${field} Floyd line must have tone right, neutral, or friendly`);
      if (line.speaker === 'bud' && line.tone !== undefined) addError(errors, file, `${field} Bud line must not have tone`);
      if (line.link_urls !== undefined && (!Array.isArray(line.link_urls) || line.link_urls.some((url) => !isValidUrl(url)))) addError(errors, file, `${field}.link_urls must contain https:// urls`);
    }
  }
  if (typeof item.old_tech !== 'boolean') addError(errors, file, 'old_tech must be boolean');
  checkSources(item.sources, file, errors);
  checkCheckedOn(item.checked_on, file, errors);
  if (![1, 2, 3].includes(item.difficulty)) addError(errors, file, 'difficulty must be 1, 2, or 3');
  if (item.decisive_clue !== item.difficulty) addError(errors, file, 'decisive_clue must equal difficulty');
  if (item.release_day !== undefined && (!Number.isInteger(item.release_day) || item.release_day <= 0)) addError(errors, file, 'release_day must be a positive integer');
  // Bank words are extra Endless words. They are out from day 1, so they never get a release day.
  if (item.bank !== undefined && item.bank !== true) addError(errors, file, 'bank must be true when present');
  if (item.bank && item.release_day !== undefined) addError(errors, file, 'bank items must not have release_day');
  checkItemLessonFields(item, file, errors);
  if (item.puzzle !== undefined && (typeof item.puzzle !== 'string' || !/^[A-Z]{4,7}$/.test(item.puzzle))) addError(errors, file, 'puzzle must be 4 to 7 capital letters');
}

// Check the shape and fields of one lesson.
function checkLesson(lesson, file, errors) {
  const keys = ['id', 'topic', 'number', 'title', 'cards', 'checks', 'takeaway', 'sources', 'checked_on', 'release_day', 'words', 'situations'];
  if (!checkKeys(lesson, keys, errors, file, 'lesson', ['release_day', 'words', 'situations'])) return;
  if (!DAILY_TOPICS.includes(lesson.topic)) addError(errors, file, 'topic must be a daily topic');
  if (!Number.isInteger(lesson.number) || lesson.number <= 0) addError(errors, file, 'number must be a positive integer');
  if (!isNonEmptyString(lesson.title) || !isNonEmptyString(lesson.takeaway)) addError(errors, file, 'title and takeaway must be non-empty');
  if (!Array.isArray(lesson.cards) || lesson.cards.length < 2 || lesson.cards.length > 4) addError(errors, file, 'cards must contain 2 to 4 cards');
  else {
    for (let i = 0; i < lesson.cards.length; i += 1) {
      const card = lesson.cards[i];
      const field = `cards[${i}]`;
      if (!checkKeys(card, ['text', 'mascot', 'line'], errors, file, field)) continue;
      if (!isNonEmptyString(card.text) || !isNonEmptyString(card.line)) addError(errors, file, `${field} text and line must be non-empty`);
      if (!['floyd', 'bud'].includes(card.mascot)) addError(errors, file, `${field}.mascot is invalid`);
    }
  }
  checkLessonChecks(lesson, file, errors);
  checkSources(lesson.sources, file, errors);
  checkCheckedOn(lesson.checked_on, file, errors);
  if (lesson.release_day !== undefined && (!Number.isInteger(lesson.release_day) || lesson.release_day <= 0)) addError(errors, file, 'release_day must be a positive integer');
  if (lesson.situations !== undefined) {
    if (!Array.isArray(lesson.situations) || lesson.situations.length < 2 || lesson.situations.length > 4) addError(errors, file, 'situations must have 2 to 4 entries');
    else for (let i = 0; i < lesson.situations.length; i += 1) checkSituation(lesson.situations[i], file, errors, `situations[${i}]`);
  }
}

// Check lesson questions and their answer length limits.
function checkLessonChecks(lesson, file, errors) {
  if (!Array.isArray(lesson.checks) || lesson.checks.length !== 3) {
    addError(errors, file, 'checks must contain exactly 3 entries');
    return;
  }
  let shortestCount = 0;
  let longestCount = 0;
  let middleCount = 0;
  for (let i = 0; i < lesson.checks.length; i += 1) {
    const check = lesson.checks[i];
    const field = `checks[${i}]`;
    if (!checkKeys(check, ['prompt', 'options', 'answer', 'why'], errors, file, field)) continue;
    if (!isNonEmptyString(check.prompt) || !isNonEmptyString(check.why) || !isNonEmptyString(check.answer)) addError(errors, file, `${field} text must be non-empty`);
    if (!Array.isArray(check.options) || check.options.length < 2 || check.options.some((option) => !isNonEmptyString(option)) || new Set(check.options.map((option) => option.toLowerCase())).size !== check.options.length) {
      addError(errors, file, `${field}.options must have 2+ distinct strings`);
      continue;
    }
    if (!check.options.includes(check.answer)) addError(errors, file, `${field}.answer must be one of options`);
    const lengths = check.options.map((option) => option.length);
    const shortest = Math.min(...lengths);
    const longest = Math.max(...lengths);
    if (check.answer.length === shortest) shortestCount += 1;
    else if (check.answer.length === longest) longestCount += 1;
    else middleCount += 1;
  }
  if (shortestCount > 1) addError(errors, file, 'lesson answers may use the shortest option at most once');
  if (longestCount > 1) addError(errors, file, 'lesson answers may use the longest option at most once');
  if (middleCount > 2) addError(errors, file, 'lesson answers may use the middle option at most twice');
}

// Collect text fields while skipping codes and URLs.
function textValues(value, values = [], key = '') {
  const keyName = key.split('.').pop()?.replace(/\[\d+\]$/, '') || '';
  if (CODE_KEYS.has(keyName) || URL_KEYS.has(keyName)) return values;
  if (typeof value === 'string') {
    values.push({ text: value, field: key || '(root)' });
    return values;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) textValues(value[i], values, `${key}[${i}]`);
    return values;
  }
  if (isObject(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      const childPath = key ? `${key}.${childKey}` : childKey;
      textValues(childValue, values, childPath);
    }
  }
  return values;
}

// Escape text before placing it in a regular expression.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match a phrase as a whole word or phrase.
function isWholeWord(text, term) {
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(term)}([^A-Za-z0-9]|$)`, 'i').test(text);
}

// Check banned phrases, prices, versions, and dash characters.
function checkBannedText(text, field, file, errors, warnings) {
  if (text.includes('\u2014')) addError(errors, file, `${field} contains an em dash`);
  if (text.includes('\u2013')) addWarning(warnings, file, `${field} contains an en dash`);
  for (const phrase of KEEP_OUT) if (text.toLowerCase().includes(phrase)) addError(errors, file, `${field} contains keep-out word or phrase ${phrase}`);
  const hasPrice = /\$\d/.test(text) || /\b\d+(?:\.\d+)? dollars\b/i.test(text) || /\b\d+(?:\.\d+)? cents\b/i.test(text);
  const hasVersion = /\b\d+\.\d+\b/.test(text) || /\bversion\s+\d/i.test(text) || /\bv\d+\b/i.test(text) || /\b\d+G\b/i.test(text);
  if (hasPrice || hasVersion) addError(errors, file, `${field} contains a version or price`);
}

// Count syllables with a small vowel-group approximation.
function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 1;
  let count = (clean.match(/[aeiouy]+/g) || []).length;
  if (clean.endsWith('e') && !clean.endsWith('le') && count > 1) count -= 1;
  return Math.max(1, count);
}

// Warn when a text field is above the target reading level.
function checkReading(text, field, file, warnings) {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  if (words.length < 4) return;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  let syllables = 0;
  for (const word of words) syllables += countSyllables(word);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  if (grade > 8) addWarning(warnings, file, `${field} reading level ${grade.toFixed(1)}`);
}

// Check item text rules and collect reading-level fields.
function checkItemText(item, file, errors, warnings) {
  const strings = textValues(item);
  if (typeof item.meaning === 'string') {
    const wordCount = item.meaning.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 25) addError(errors, file, `meaning must have 25 words or fewer (found ${wordCount} words)`);
  }
  const protectedFields = [];
  if (typeof item.meaning === 'string') protectedFields.push({ text: item.meaning, field: 'meaning' });
  if (Array.isArray(item.clues)) for (let i = 0; i < item.clues.length; i += 1) protectedFields.push({ text: item.clues[i], field: `clues[${i}]` });
  if (Array.isArray(item.decoys)) for (let i = 0; i < item.decoys.length; i += 1) protectedFields.push({ text: item.decoys[i]?.meaning, field: `decoys[${i}].meaning` });
  // The answer (or its plural) must never show up in its own meaning or clues.
  if (typeof item.term === 'string' && item.term) {
    const ownForms = [item.term];
    if (!item.term.endsWith('s')) ownForms.push(`${item.term}s`);
    for (const entry of protectedFields) {
      if (typeof entry.text !== 'string') continue;
      for (const form of ownForms) {
        if (isWholeWord(entry.text, form)) {
          addError(errors, file, `${entry.field} must not contain the item's term`);
          break;
        }
      }
    }
  }
  if (Array.isArray(item.decoys)) {
    const terms = item.decoys.map((decoy) => typeof decoy?.term === 'string' ? decoy.term.toLowerCase() : '');
    if (new Set(terms).size !== terms.length || (item.term && terms.includes(item.term.toLowerCase()))) addError(errors, file, 'decoy terms must be distinct from each other and the answer');
  }
  for (const entry of strings) checkBannedText(entry.text, entry.field, file, errors, warnings);
  for (const entry of protectedFields) if (typeof entry.text === 'string') checkReading(entry.text, entry.field, file, warnings);
  if (Array.isArray(item.exchange)) for (let i = 0; i < item.exchange.length; i += 1) if (typeof item.exchange[i]?.text === 'string') checkReading(item.exchange[i].text, `exchange[${i}].text`, file, warnings);
  if (typeof item.blank?.sentence === 'string') checkReading(item.blank.sentence, 'blank.sentence', file, warnings);
  if (typeof item.why === 'string') checkReading(item.why, 'why', file, warnings);
  if (Array.isArray(item.situations)) for (let i = 0; i < item.situations.length; i += 1) {
    if (typeof item.situations[i]?.text === 'string') checkReading(item.situations[i].text, `situations[${i}].text`, file, warnings);
    if (typeof item.situations[i]?.why === 'string') checkReading(item.situations[i].why, `situations[${i}].why`, file, warnings);
  }
}

// Check schedule dates, terms, difficulty, and product rules.
function checkSchedule(schedule, items, file, errors, warnings) {
  if (!isObject(schedule) || !Number.isInteger(schedule?.version) || !Array.isArray(schedule?.days)) {
    addError(errors, file, 'schedule must have integer version and days array');
    return new Map();
  }
  const seen = new Map();
  let previousDay = 0;
  for (let i = 0; i < schedule.days.length; i += 1) {
    const day = schedule.days[i];
    const field = `days[${i}]`;
    if (!checkKeys(day, ['date', 'term', 'rerun'], errors, file, field)) continue;
    if (!isValidDate(day.date)) addError(errors, file, `${field}.date is invalid`);
    let dayNumber = 0;
    if (isValidDate(day.date)) {
      const [year, month, date] = day.date.split('-').map(Number);
      // Day 1 is launch day, Sun Oct 25, 2026.
      dayNumber = Math.floor((Date.UTC(year, month - 1, date) - Date.UTC(2026, 9, 25)) / 86400000) + 1;
    }
    if (dayNumber !== previousDay + 1) addError(errors, file, `${field}.date must be consecutive starting at day 1`);
    previousDay = dayNumber;
    if (!items.has(day.term)) addError(errors, file, `${field} references missing item ${day.term}`);
    if (seen.has(day.term) && !day.rerun) addError(errors, file, `${day.term} appears more than once as non-rerun`);
    if (day.rerun && !seen.has(day.term)) addError(errors, file, `${day.term} rerun has no earlier non-rerun`);
    if (typeof day.rerun !== 'boolean') addError(errors, file, `${field}.rerun must be boolean`);
    const item = items.get(day.term);
    if (item && item.puzzle === undefined) addError(errors, file, `${day.term} is missing puzzle`);
    if (item && isValidDate(day.date)) {
      // Weeks count from launch day: day 1 of each week is easy, days 2 to 4 medium, days 5 to 7 hard.
      const dayOfWeek = (dayNumber - 1) % 7;
      const tier = dayOfWeek === 0 ? 1 : (dayOfWeek <= 3 ? 2 : 3);
      if ((!day.rerun && item.difficulty !== tier) || (day.rerun && item.difficulty > tier)) addError(errors, file, `${day.term} difficulty does not match its day of the week tier`);
      if (item.old_tech || item.topic === 'old-tech' || ['ptp-1', 'ptp-2'].includes(item.id)) addError(errors, file, `${day.term} is not schedulable`);
      if (item.bank) addError(errors, file, `${day.term} is a bank word and is not schedulable`);
      if (/^(chatgpt|gemini|copilot)$/i.test(item.term)) addError(errors, file, `${day.term} is a prohibited product answer`);
      if (PRODUCTS.includes(item.term.toLowerCase())) addWarning(warnings, file, `${day.term} is a product name`);
    }
    seen.set(day.term, true);
  }
  return seen;
}

// Check the Old Tech order and its special exchange lines.
function checkOldTech(value, items, file, errors) {
  if (!Array.isArray(value) || new Set(value).size !== value.length || value.length > 20) {
    addError(errors, file, 'old_tech_order must be unique array of at most 20 ids');
    return;
  }
  for (const id of value) {
    const item = items.get(id);
    if (!item) {
      addError(errors, file, `old_tech_order references missing item ${id}`);
      continue;
    }
    if (!item.old_tech || item.topic !== 'old-tech' || ![1, 2].includes(item.difficulty) || item.bank) addError(errors, file, `${id} is invalid Old Tech`);
    if (item.exchange?.[0]?.speaker !== 'floyd') addError(errors, file, `${id} Old Tech exchange must start with Floyd`);
    if (!item.exchange?.some((line) => line.speaker === 'bud' && line.text.startsWith("Today's version: "))) addError(errors, file, `${id} Old Tech needs a Today's version line`);
  }
  // Old-tech bank words only show up in Endless, so they stay out of the Old Tech list.
  for (const item of items.values()) if (item.old_tech && !item.bank && !value.includes(item.id)) addError(errors, file, `${item.id} is missing from old_tech_order`);
}

// Check the two PTP extra items.
function checkPtp(value, items, scheduleTerms, file, errors) {
  if (JSON.stringify(value) !== '["ptp-1","ptp-2"]') {
    addError(errors, file, 'ptp_extras must be exactly ["ptp-1","ptp-2"]');
    return;
  }
  for (const id of value) {
    const item = items.get(id);
    if (!item) {
      addError(errors, file, `ptp_extras references missing item ${id}`);
      continue;
    }
    if (![1, 2].includes(item.difficulty) || item.old_tech || item.release_day !== undefined || item.bank) addError(errors, file, `${id} is invalid PTP extra`);
    if (scheduleTerms.has(id)) addError(errors, file, `${id} must not be scheduled`);
  }
}

// Check common words and miss-line shapes.
function checkCommonAndMiss(common, miss, items, file, errors) {
  if (!Array.isArray(common) || common.some((entry) => typeof entry !== 'string')) addError(errors, file, 'common_words must be an array of strings');
  if (!isObject(miss) || !Array.isArray(miss.either) || !Array.isArray(miss.floyd)) {
    addError(errors, file, 'miss_lines must have either and floyd arrays');
    return;
  }
  for (const speaker of ['either', 'floyd']) {
    for (let i = 0; i < miss[speaker].length; i += 1) {
      const line = miss[speaker][i];
      const field = `${speaker}[${i}]`;
      if (!checkKeys(line, ['text', 'needs_clue'], errors, file, field, ['needs_clue']) || !isNonEmptyString(line.text)) addError(errors, file, `${field} text must be non-empty`);
      if (line.needs_clue !== undefined && typeof line.needs_clue !== 'boolean') addError(errors, file, `${field}.needs_clue must be boolean`);
    }
  }
  const commonWords = new Set((Array.isArray(common) ? common : []).map((entry) => typeof entry === 'string' ? entry.toLowerCase() : ''));
  for (const item of items.values()) if (!item.old_tech && commonWords.has(item.term.toLowerCase())) addError(errors, file, `${item.id} daily term is a common word`);
}

// Check that every bank word is new: no other item may use the same term.
function checkBankTerms(items, errors, rootContentDir = contentDir) {
  const owners = new Map();
  for (const item of items.values()) {
    if (typeof item.term !== 'string') continue;
    const key = item.term.toLowerCase();
    if (!owners.has(key)) owners.set(key, []);
    owners.get(key).push(item);
  }
  for (const list of owners.values()) {
    if (list.length < 2) continue;
    for (const item of list) {
      if (item.bank) addError(errors, path.join(rootContentDir, 'items', `${item.id}.json`), `bank term "${item.term}" is already used by another item`);
    }
  }
}

// Check early terms against one release order.
function checkEarlyWords(items, lessons, common, errors, order, label, rootContentDir = contentDir) {
  const dayMap = new Map();
  for (let i = 0; i < order.length; i += 1) dayMap.set(order[i], i + 1);
  const release = new Map();
  for (const item of items.values()) {
    if (dayMap.has(item.id)) release.set(item.id, dayMap.get(item.id));
    else if (label === 'demo' && !item.release_day && !dayMap.has(item.id) && item.topic !== 'old-tech' && !item.old_tech) continue;
    else release.set(item.id, item.release_day || 1);
  }
  for (const lesson of lessons) release.set(lesson.id, lesson.release_day || lesson.number);
  const commonWords = new Set((Array.isArray(common) ? common : []).map((entry) => typeof entry === 'string' ? entry.toLowerCase() : ''));
  for (const id of order) {
    const item = items.get(id);
    if (item && commonWords.has(item.term.toLowerCase())) addError(errors, path.join(rootContentDir, 'schedule.json'), `daily term ${item.term} is a common word`);
  }
  const files = [];
  for (const [id, item] of items.entries()) files.push({ id, value: item, file: path.join(rootContentDir, 'items', `${id}.json`), own: id });
  for (const lesson of lessons) files.push({ id: lesson.id, value: lesson, file: path.join(rootContentDir, 'lessons', `${lesson.id}.json`), own: null });
  for (const entry of files) {
    const strings = textValues(entry.value);
    for (const id of order) {
      if (id === entry.own) continue;
      const item = items.get(id);
      if (!item) continue;
      const variants = [item.term];
      if (!item.term.endsWith('s')) variants.push(`${item.term}s`);
      if (item.term.toLowerCase().startsWith('the ')) {
        const shortTerm = item.term.slice(4);
        variants.push(shortTerm);
        if (!shortTerm.endsWith('s')) variants.push(`${shortTerm}s`);
      }
      let found = null;
      for (const stringEntry of strings) {
        for (const variant of variants) {
          if (isWholeWord(stringEntry.text, variant)) {
            found = stringEntry;
            break;
          }
        }
        if (found) break;
      }
      const releaseDay = release.get(entry.id);
      const termDay = dayMap.get(id);
      if (found && releaseDay !== undefined && termDay !== undefined && releaseDay <= termDay) addError(errors, entry.file, `${found.field} mentions "${item.term}" (day ${termDay}) but this file is released on day ${releaseDay} (${label} order)`);
    }
  }
}

// Check lesson words against topics and release days.
function checkLessonWords(lessons, items, schedule, errors, rootContentDir) {
  const dayMap = new Map();
  const realOrder = (schedule.days || []).filter((day) => !day.rerun).map((day) => day.term);
  for (let i = 0; i < realOrder.length; i += 1) dayMap.set(realOrder[i], i + 1);
  const release = new Map();
  for (const item of items.values()) release.set(item.id, dayMap.get(item.id) || item.release_day || 1);
  for (const lesson of lessons) {
    if (lesson.words === undefined) continue;
    const file = path.join(rootContentDir, 'lessons', `${lesson.id}.json`);
    if (!Array.isArray(lesson.words) || lesson.words.length !== 4 || new Set(lesson.words).size !== lesson.words.length) {
      addError(errors, file, 'words must have 4 distinct item ids');
      continue;
    }
    const shortsSeen = [];
    for (const id of lesson.words) {
      const item = items.get(id);
      if (!item) { addError(errors, file, `words references missing item ${id}`); continue; }
      if (item.topic !== lesson.topic) addError(errors, file, `word ${id} has a different topic`);
      if (!item.blank) addError(errors, file, `word ${id} must have a blank`);
      // Match pairs needs every meaning tile to be different.
      const short = (item.short || item.meaning || '').trim().toLowerCase();
      if (shortsSeen.indexOf(short) !== -1) addError(errors, file, `word ${id} has the same short meaning as another word in this lesson`);
      shortsSeen.push(short);
      const lessonDay = lesson.release_day || lesson.number;
      if ((release.get(id) || 1) > lessonDay) addError(errors, file, `word ${id} is released after lesson day ${lessonDay}`);
    }
  }
}

// Check every content file and return parsed content plus messages.
export function checkContent({ strict = false, contentDir: rootContentDir = contentDir } = {}) {
  const errors = [];
  const warnings = [];
  const items = new Map();
  const lessons = [];
  const itemDir = path.join(rootContentDir, 'items');
  const lessonDir = path.join(rootContentDir, 'lessons');
  const itemFiles = fs.existsSync(itemDir) ? fs.readdirSync(itemDir).filter((name) => name.endsWith('.json')).sort() : [];
  for (const name of itemFiles) {
    const file = path.join(itemDir, name);
    const item = readJson(file, errors);
    if (!item) continue;
    if (item.id !== path.basename(name, '.json')) addError(errors, file, 'id must equal filename');
    checkItem(item, file, errors);
    checkItemText(item, file, errors, warnings);
    items.set(item.id, item);
  }
  const lessonFiles = fs.existsSync(lessonDir) ? fs.readdirSync(lessonDir).filter((name) => name.endsWith('.json')).sort() : [];
  for (const name of lessonFiles) {
    const file = path.join(lessonDir, name);
    const lesson = readJson(file, errors);
    if (!lesson) continue;
    if (lesson.id !== path.basename(name, '.json')) addError(errors, file, 'id must equal filename');
    checkLesson(lesson, file, errors);
    for (const entry of textValues(lesson)) checkBannedText(entry.text, entry.field, file, errors, warnings);
    const readingFields = [];
    if (Array.isArray(lesson.cards)) for (let i = 0; i < lesson.cards.length; i += 1) readingFields.push([`cards[${i}].text`, lesson.cards[i].text], [`cards[${i}].line`, lesson.cards[i].line]);
    if (Array.isArray(lesson.checks)) for (let i = 0; i < lesson.checks.length; i += 1) {
      readingFields.push([`checks[${i}].prompt`, lesson.checks[i].prompt], [`checks[${i}].why`, lesson.checks[i].why]);
      if (Array.isArray(lesson.checks[i].options)) for (let j = 0; j < lesson.checks[i].options.length; j += 1) readingFields.push([`checks[${i}].options[${j}]`, lesson.checks[i].options[j]]);
    }
    readingFields.push(['takeaway', lesson.takeaway]);
    if (Array.isArray(lesson.situations)) for (let i = 0; i < lesson.situations.length; i += 1) readingFields.push([`situations[${i}].text`, lesson.situations[i].text], [`situations[${i}].why`, lesson.situations[i].why]);
    for (const [field, text] of readingFields) if (typeof text === 'string') checkReading(text, field, file, warnings);
    lessons.push(lesson);
  }
  const scheduleFile = path.join(rootContentDir, 'schedule.json');
  const schedule = readJson(scheduleFile, errors) || { version: 1, days: [] };
  const scheduleTerms = checkSchedule(schedule, items, scheduleFile, errors, warnings);
  const oldFile = path.join(rootContentDir, 'old_tech_order.json');
  const oldTech = readJson(oldFile, errors) || [];
  checkOldTech(oldTech, items, oldFile, errors);
  const ptpFile = path.join(rootContentDir, 'ptp_extras.json');
  const ptpExtras = readJson(ptpFile, errors) || [];
  checkPtp(ptpExtras, items, scheduleTerms, ptpFile, errors);
  const missFile = path.join(rootContentDir, 'miss_lines.json');
  const missLines = readJson(missFile, errors) || {};
  const commonFile = path.join(rootContentDir, 'common_words.json');
  const commonWords = readJson(commonFile, errors) || [];
  checkCommonAndMiss(commonWords, missLines, items, commonFile, errors);
  const realOrder = schedule.days?.filter((day) => !day.rerun).map((day) => day.term) || [];
  checkLessonWords(lessons, items, schedule, errors, rootContentDir);
  checkBankTerms(items, errors, rootContentDir);
  // Bank items count as out on day 1 here, so they can't name a daily word before its day.
  checkEarlyWords(items, lessons, commonWords, errors, realOrder, 'real', rootContentDir);
  checkEarlyWords(items, lessons, commonWords, errors, DEMO_ORDER, 'demo', rootContentDir);
  const referenced = new Set([...scheduleTerms.keys(), ...oldTech, ...ptpExtras]);
  for (const item of items.values()) if (item.bank) referenced.add(item.id);
  const unreferenced = [...items.keys()].filter((id) => !referenced.has(id));
  if (unreferenced.length) addWarning(warnings, itemDir, `${unreferenced.length} item file(s) are not referenced`);
  const uncheckedFiles = [];
  for (const item of items.values()) if (item.checked_on === null) uncheckedFiles.push(path.join(rootContentDir, 'items', `${item.id}.json`));
  for (const lesson of lessons) if (lesson.checked_on === null) uncheckedFiles.push(path.join(rootContentDir, 'lessons', `${lesson.id}.json`));
  if (strict) for (const file of uncheckedFiles) addError(errors, file, 'checked_on is null (strict mode)');
  else if (uncheckedFiles.length) addWarning(warnings, rootContentDir, `${uncheckedFiles.length} unchecked file(s)`);
  const content = { items, lessons, oldTech, ptpExtras, schedule, missLines, commonWords };
  return { errors, warnings, content };
}

// Print checker messages and the summary line.
export function printResult(result, strict) {
  for (const entry of result.errors) console.log(`ERROR ${entry.file}: ${entry.message}`);
  for (const entry of result.warnings) if (entry.message) console.log(`warn ${entry.file}: ${entry.message}`);
  const itemCount = result.content.items.size;
  const lessonCount = result.content.lessons.length;
  const dayCount = result.content.schedule.days?.length || 0;
  console.log(`content-check (${strict ? 'strict' : 'preview'}): ${itemCount} items, ${lessonCount} lessons, ${dayCount} schedule days: ${result.errors.length} errors, ${result.warnings.length} warnings`);
}

// Compare real paths so the check still runs when the repo sits behind a symlink.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
}

if (isEntryPoint()) {
  const strict = process.argv.includes('--strict');
  const result = checkContent({ strict });
  printResult(result, strict);
  process.exitCode = result.errors.length ? 1 : 0;
}
