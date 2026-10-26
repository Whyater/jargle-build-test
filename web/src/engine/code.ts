import { addDays, dateOfDay, dayNumber } from './dates';
import { awardBadges } from './badges';
import {
  copyState,
  countedDays,
  finishedDays,
  soloDone,
  addSortedNumber,
  addUnique,
  dailyItem,
} from './state';
import { TOPIC_ORDER } from './types';
import type { ContentBundle, LocalDate, SaveState } from './types';
import type { DecodeResult } from './api';

export const TYPO_MESSAGE = 'That code has a typo. Check each character and try again.';
export const NEWER_MESSAGE =
  'This code is from a newer version. Close Jargle, open it again, then try once more.';
export const COPY_HINT =
  'Save a picture of your screen or write this down. On a new phone, open Settings, then '
  + 'Use a progress code, and type or paste it in.';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crc32(bytes: number[]): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bitsToBytes(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let n = 0;
    for (let j = 0; j < 8; j++) {
      n = (n << 1) | (bits[i + j] || 0);
    }
    out.push(n);
  }
  return out;
}

function pushBits(out: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    out.push((value >>> i) & 1);
  }
}

export function encodeProgressCode(state: SaveState, content: ContentBundle, today: LocalDate): string {
  const day = dayNumber(today);
  const d = day < 1 ? 0 : Math.min(day, 255);
  const bits: number[] = [];
  pushBits(bits, d, 8);
  const counted = countedDays(state);
  const finished = finishedDays(state);
  for (let i = 1; i <= d; i++) {
    bits.push(counted.indexOf(i) !== -1 ? 1 : 0);
  }
  for (let i = 1; i <= d; i++) {
    bits.push(finished.indexOf(i) !== -1 ? 1 : 0);
  }
  const done = soloDone(state);
  for (let i = 0; i < 20; i++) {
    bits.push(i < content.oldTech.length && done.indexOf(content.oldTech[i]) !== -1 ? 1 : 0);
  }
  for (let i = 0; i < TOPIC_ORDER.length; i++) {
    for (let n = 1; n <= 4; n++) {
      let found = false;
      for (let j = 0; j < content.lessons.length; j++) {
        const lesson = content.lessons[j];
        if (
          lesson.topic === TOPIC_ORDER[i]
          && lesson.number === n
          && state.lessons[lesson.id]
          && state.lessons[lesson.id].finished_on
        ) {
          found = true;
        }
      }
      bits.push(found ? 1 : 0);
    }
  }
  bits.push(state.badges['taught-someone'] ? 1 : 0);
  pushBits(bits, Math.min(state.ptpTotal || 0, 255), 8);
  pushBits(bits, Math.min(state.ptpBest || 0, 7), 3);
  const first = state.firstPlayDay && state.firstPlayDay > 0 ? Math.min(state.firstPlayDay, 255) : 0;
  pushBits(bits, first, 8);
  const check = crc32(bitsToBytes(bits)) & 0x3ff;
  pushBits(bits, check, 10);
  // Padding comes after the check, so it is never included in the CRC.
  while (bits.length % 5) {
    bits.push(0);
  }
  let body = '';
  for (let i = 0; i < bits.length; i += 5) {
    let value = 0;
    for (let j = 0; j < 5; j++) {
      value = (value << 1) | bits[i + j];
    }
    body += ALPHABET[value];
  }
  let grouped = '';
  for (let i = 0; i < body.length; i++) {
    grouped += (i && i % 4 === 0 ? '-' : '') + body[i];
  }
  return 'JRG1-' + grouped;
}

function fail(error: 'format' | 'newer' | 'typo'): DecodeResult {
  return { ok: false, error };
}

interface DecodedCode {
  countedCodes: number[];
  finishedCodes: number[];
  oldBits: number[];
  lessonBits: number[];
  taught: number;
  ptpTotal: number;
  ptpBest: number;
  firstPlayDay: number;
}

function applyCode(
  decoded: DecodedCode,
  state: SaveState,
  content: ContentBundle,
  today: LocalDate,
): SaveState {
  const s = copyState(state);

  for (let i = 0; i < decoded.countedCodes.length; i++) {
    addSortedNumber(s.countedDays!, decoded.countedCodes[i]);
  }
  for (let i = 0; i < decoded.finishedCodes.length; i++) {
    addSortedNumber(s.finishedDays!, decoded.finishedCodes[i]);
  }
  for (let i = 0; i < 20 && i < content.oldTech.length; i++) {
    if (decoded.oldBits[i]) {
      const id = content.oldTech[i];
      addUnique(s.soloDone!, id);
      if (content.items[id] && !s.lastFinished![id]) {
        // Old Tech codes do not include the original finish day.
        s.lastFinished![id] = addDays(today, -1);
      }
    }
  }
  for (let i = 0; i < content.lessons.length; i++) {
    const lesson = content.lessons[i];
    const topic = TOPIC_ORDER.indexOf(lesson.topic);
    if (topic < 0 || lesson.number < 1 || lesson.number > 4) continue;
    const bitIndex = topic * 4 + lesson.number - 1;
    if (!decoded.lessonBits[bitIndex]) continue;
    const existing = s.lessons[lesson.id];
    if (existing) {
      existing.finished_on = existing.finished_on || addDays(today, -1);
    } else {
      s.lessons[lesson.id] = { card: 0, answers: [], finished_on: addDays(today, -1) };
    }
  }
  if (decoded.taught && !s.badges['taught-someone']) {
    s.badges['taught-someone'] = today;
  }
  s.ptpTotal = Math.max(s.ptpTotal || 0, decoded.ptpTotal);
  s.ptpBest = Math.max(s.ptpBest || 0, decoded.ptpBest);
  if (decoded.firstPlayDay > 0 && (!s.firstPlayDay || decoded.firstPlayDay < s.firstPlayDay)) {
    s.firstPlayDay = decoded.firstPlayDay;
  }
  for (let i = 0; i < decoded.finishedCodes.length; i++) {
    const item = dailyItem(content, decoded.finishedCodes[i]);
    if (item) {
      if (!s.lastFinished![item.id]) s.lastFinished![item.id] = dateOfDay(decoded.finishedCodes[i]);
      if (!s.review[item.id]) s.review[item.id] = [today];
    }
  }
  awardBadges(s, content, today);
  return s;
}

export function decodeProgressCode(text: string): DecodeResult {
  // Ignore formatting characters that can appear when a code is copied from a screen.
  const compact = text.toUpperCase().replace(/[\s\u002d\u00ad\u200b\u2010-\u2015\u2212\ufe63\uff0d]/g, '');
  if (compact.slice(0, 3) !== 'JRG' || compact.length < 4) {
    return fail('format');
  }
  const version = compact[3];
  if ('2' <= version && version <= '9') {
    return fail('newer');
  }
  if (version !== '1' && version !== 'I' && version !== 'L') {
    return fail('format');
  }
  const raw = compact.slice(4);
  let body = '';
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    // O, I, and L are Crockford aliases that make codes easier to type from a screenshot.
    if (ch === 'O') ch = '0';
    if (ch === 'I' || ch === 'L') ch = '1';
    if (ALPHABET.indexOf(ch) === -1) return fail('typo');
    body += ch;
  }
  const bits: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const value = ALPHABET.indexOf(body[i]);
    pushBits(bits, value, 5);
  }
  if (bits.length < 8) return fail('typo');
  let d = 0;
  for (let i = 0; i < 8; i++) d = (d << 1) | bits[i];
  const expected = Math.ceil((86 + 2 * d) / 5);
  // The length check catches a typo in D before reading the rest of the payload.
  if (body.length !== expected) return fail('typo');
  const payloadLength = 76 + 2 * d;
  if (bits.length < payloadLength + 10) return fail('typo');
  const payload = bits.slice(0, payloadLength);
  let check = 0;
  for (let i = payloadLength; i < payloadLength + 10; i++) {
    check = (check << 1) | bits[i];
  }
  if ((crc32(bitsToBytes(payload)) & 0x3ff) !== check) return fail('typo');
  const read = (pos: number, count: number): number => {
    let n = 0;
    for (let i = 0; i < count; i++) {
      n = (n << 1) | payload[pos + i];
    }
    return n;
  };
  const countedCodes: number[] = [];
  const finishedCodes: number[] = [];
  for (let i = 0; i < d; i++) {
    if (payload[8 + i]) countedCodes.push(i + 1);
  }
  for (let i = 0; i < d; i++) {
    if (payload[8 + d + i]) finishedCodes.push(i + 1);
  }
  const oldBits = payload.slice(8 + 2 * d, 28 + 2 * d);
  const lessonBits = payload.slice(28 + 2 * d, 56 + 2 * d);
  const taught = payload[56 + 2 * d];
  const ptpTotal = read(57 + 2 * d, 8);
  const ptpBest = read(65 + 2 * d, 3);
  const firstPlayDay = read(68 + 2 * d, 8);
  const decoded: DecodedCode = {
    countedCodes,
    finishedCodes,
    oldBits,
    lessonBits,
    taught,
    ptpTotal,
    ptpBest,
    firstPlayDay,
  };
  return {
    ok: true,
    apply: (state: SaveState, content: ContentBundle, today: LocalDate): SaveState => {
      return applyCode(decoded, state, content, today);
    },
  };
}
