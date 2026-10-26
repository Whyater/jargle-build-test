# Jargle content

All the text in the game is stored in this folder as plain JSON. The app
never makes up text while you play. Each file follows the types in
`web/src/engine/types.ts`.

## What's in this folder

| Path | What it holds |
| --- | --- |
| `items/<id>.json` | One word (daily, Pass the Phone extra or Old Tech) |
| `items/bank-<id>.json` | One bank word, used only in Endless |
| `lessons/<id>.json` | Short lessons: 2 to 4 cards, then 3 questions |
| `schedule.json` | Which word plays on which date (Day 1 is Oct 26, 2026) |
| `old_tech_order.json` | The fixed order of Floyd's Old Tech words |
| `ptp_extras.json` | `ptp-1` and `ptp-2`, which are never daily words |
| `common_words.json` | Everyday words any item may use |
| `miss_lines.json` | What Floyd and Bud say after a wrong guess |

A common word can never be a daily word.

## How to add a word

1. Copy `items/claude.json` to `items/<new-id>.json` and set `id` to the
   new file name.
2. Write the `meaning` in 25 words or fewer, without the word itself, at
   about a grade 8 reading level.
3. Write 5 clues that build on each other. Add 3 decoys of the same kind,
   each with its own meaning and a source link.
4. Set `difficulty` and `decisive_clue` to the same number:
   - 1 (Sundays): clue 1 alone rules out every decoy.
   - 2 (Monday to Wednesday): clue 1 still fits a decoy. After clue 2,
     none fit.
   - 3 (Thursday to Saturday): clue 1 fits two or more decoys and clue 2
     still fits one. After clue 3, none fit.
5. Only clue 5 may give away letters.
6. Write a short exchange between Floyd and Bud. Give each Floyd line a
   `tone`: `right`, `neutral` or `friendly`.
7. List the pages you used in `sources`. Open each link and check each
   fact against the page.
8. Leave `checked_on` as `null` until a person has checked the item. Then
   set it to that date (`YYYY-MM-DD`).
9. Add the word to a future date in `schedule.json`. Dates that have
   already passed stay as they are.

A daily word can't show up early. Items that come out on or before a
word's day may not use that word, except the word's own item. The
checker finds these for you.

## Lesson fields

Lessons play as short sessions of mixed steps. These fields feed them.
All of them are optional.

- `blank` (item): a real sentence with `___` where the word goes, plus
  2 or 3 wrong choices that clearly don't fit.
- `why` (item): why the word matters, in 20 words or fewer.
- `short` (item): the meaning in 6 words or fewer, for Match pairs.
- `situations` (item, 1 to 4; lesson, 2 to 4): a short real moment
  with 2 choices like Scam and Safe, the right one, and a reason.
  The moment has 35 words or fewer and the reason 25 or fewer.
- `words` (lesson): 4 item ids from the lesson's topic. Each needs a
  `blank` and must be out by the lesson's day, so bank words work best.

## Bank words

Bank words give Endless more to ask. They have the same fields as any
other word, plus `"bank": true`, and their file names start with `bank-`.

- A bank word is never a daily word. Don't add it to `schedule.json`,
  `old_tech_order.json` or `ptp_extras.json`.
- Its term can't match any other item's term.
- Endless can ask it from Day 1, so it can't mention any daily word
  either. The checker treats it as out on Day 1.
- Old tech bank words set `old_tech` to `true` and use the `old-tech`
  topic, but they stay out of Floyd's Old Tech list.

When you add a new daily word later, pick one that isn't already a bank
word. The checker stops if two items share a term.

## How to check it

From the repo root (Node 20 or newer, nothing to install):

```sh
node scripts/content-check.mjs            # unchecked items are a warning
node scripts/content-check.mjs --strict   # unchecked items are an error
node scripts/build-content.mjs            # checks, then writes the bundle
```

The bundle goes to `web/public/content/bundle.json`.

The checker stops with an error when a file is missing a field or has an
extra one. It also stops on a clue ladder that doesn't match its
difficulty, a word that appears too early, or a meaning that runs long.
Lesson answers that follow a length pattern fail too, and so does text
with a dash, a price or a version number. Sentences that read above
grade 8 get a warning.

The checker only tests rules it can count. Whether a clue is fair and a
fact is true still takes a person reading each item against its sources.
