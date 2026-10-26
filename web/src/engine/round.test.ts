import { describe, expect, it } from "vitest";
import { buildContent } from "./__fixtures__/content";
import { addDays, dateOfDay } from "./dates";
import { newState } from "./state";
import {
  applyRound,
  replayRound,
  roundView,
  shareLines,
  shareText,
  startRound,
} from "./round";
import type { ContentBundle, SaveState } from "./types";

const D1 = dateOfDay(1);
const ITEM = "two-factor-login";
const ANSWER = "two factor login";
const WRONG = "two factor login decoy a";
const C = buildContent();
type Action = Parameters<typeof applyRound>[3];
function begin(
  state: SaveState = newState(),
  key = "d:1",
  item = ITEM,
  mode: "daily" | "practice" | "oldtech" | "ptp" = "daily",
  today = D1,
  c: ContentBundle = C,
) {
  return startRound(state, c, key, item, mode, today);
}
function tap(
  state: SaveState,
  action: Action,
  key = "d:1",
  today = D1,
  c: ContentBundle = C,
) {
  return applyRound(state, c, key, action, today);
}
function wrong(
  state: SaveState,
  key = "d:1",
  today = D1,
  c: ContentBundle = C,
  term = WRONG,
) {
  state = tap(state, { type: "select", term }, key, today, c).state;
  return tap(state, { type: "check" }, key, today, c);
}
function solve(
  state: SaveState,
  key = "d:1",
  today = D1,
  c: ContentBundle = C,
) {
  state = tap(state, { type: "select", term: ANSWER }, key, today, c).state;
  return tap(state, { type: "check" }, key, today, c);
}

describe("Clue Ladder round", () => {
  it("starts with the required record", () => {
    const s = begin();
    expect(s.rounds["d:1"]).toEqual({
      item_id: ITEM,
      mode: "daily",
      started_on: D1,
      k: 1,
      spent: [],
      selected: null,
      status: "playing",
      post_step: 0,
      miss_line: null,
      replay: false,
    });
  });
  it("sets firstPlayDay once", () => {
    expect(begin().firstPlayDay).toBe(1);
  });
  it("does not replace an existing record", () => {
    const s = begin();
    expect(startRound(s, C, "d:1", "claude", "practice", D1)).toBe(s);
  });
  it("shows six bars at clue one", () => {
    expect(roundView(begin(), C, "d:1", D1).bars).toBe(6);
  });
  it("shows five bars at clue two", () => {
    let s = tap(begin(), { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).bars).toBe(5);
  });
  it("shows four bars at clue three", () => {
    let s = tap(begin(), { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).bars).toBe(4);
  });
  it("shows the exact clue-two battery state", () => {
    const s = tap(begin(), { type: "nextClue" }).state;
    const v = roundView(s, C, "d:1", D1);
    expect(v.bars).toBe(5);
    expect(v.batteryLine).toBe(
      "5 bars left. An extra clue costs 1. A wrong guess costs 3.",
    );
    expect(v.nextClue).toEqual({
      enabled: true,
      label: "Next clue (costs 1 bar)",
    });
  });
  it("shows the exact clue-three battery state", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    const v = roundView(s, C, "d:1", D1);
    expect(v.bars).toBe(4);
    expect(v.batteryLine).toBe(
      "4 bars left. An extra clue costs 1. A wrong guess costs 3.",
    );
    expect(v.nextClue).toEqual({
      enabled: true,
      label: "Next clue (costs 1 bar)",
    });
  });
  it("shows three bars at clue four", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).bars).toBe(3);
  });
  it("shows three bars at clue five", () => {
    let s = begin();
    for (let i = 0; i < 4; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).bars).toBe(3);
  });
  it("shows the exact clue-four next-clue state", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    const v = roundView(s, C, "d:1", D1);
    expect(v.nextClue).toEqual({ enabled: true, label: "Last clue (free)" });
  });
  it("uses the ordinary battery line before clue four", () => {
    expect(roundView(begin(), C, "d:1", D1).batteryLine).toBe(
      "6 bars left. An extra clue costs 1. A wrong guess costs 3.",
    );
  });
  it("uses the free last-clue battery line", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).batteryLine).toBe(
      "3 bars left. The last clue is free. A wrong guess costs 3.",
    );
  });
  it("uses the clue-five battery line", () => {
    let s = begin();
    for (let i = 0; i < 4; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).batteryLine).toBe(
      "3 bars left. A wrong guess costs 3.",
    );
  });
  it("labels the last clue correctly", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).nextClue.label).toBe("Last clue (free)");
  });
  it("disables clue five with No more clues", () => {
    let s = begin();
    for (let i = 0; i < 4; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).nextClue).toEqual({
      enabled: false,
      label: "Next clue (costs 1 bar)",
      reason: "No more clues",
    });
  });
  it("shows no warning above three bars", () => {
    expect(roundView(begin(), C, "d:1", D1).warning).toBeNull();
  });
  it("shows a warning at three bars", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).warning).toBe(
      "Careful: a wrong guess now ends the round. It still counts.",
    );
  });
  it("does not show answer before clue three", () => {
    expect(roundView(begin(), C, "d:1", D1).canShowAnswer).toBe(false);
  });
  it("shows answer at clue three", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    expect(roundView(s, C, "d:1", D1).canShowAnswer).toBe(true);
  });
  it("shows three bars after one miss at clue one", () => {
    const r = wrong(begin());
    const v = roundView(r.state, C, "d:1", D1);
    expect(v.bars).toBe(3);
    expect(v.batteryLine).toBe(
      "3 bars left. An extra clue costs 1. A wrong guess costs 3.",
    );
    expect(v.nextClue).toEqual({
      enabled: true,
      label: "Next clue (costs 1 bar)",
    });
    expect(v.warning).toBe(
      "Careful: a wrong guess now ends the round. It still counts.",
    );
    expect(v.canShowAnswer).toBe(true);
  });
  it("shows two bars after one miss and one extra clue", () => {
    let s = wrong(begin()).state;
    s = tap(s, { type: "nextClue" }).state;
    const v = roundView(s, C, "d:1", D1);
    expect(v.bars).toBe(2);
    expect(v.nextClue).toEqual({
      enabled: true,
      label: "Next clue (costs 1 bar)",
    });
    expect(v.warning).toBe(
      "Careful: a wrong guess now ends the round. It still counts.",
    );
  });
  it("shows one bar after one miss at clue three", () => {
    let s = wrong(begin()).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    const v = roundView(s, C, "d:1", D1);
    expect(v.bars).toBe(1);
    expect(v.nextClue.enabled).toBe(false);
    expect(v.nextClue.reason).toBe("Last bar: pick a word");
    expect(v.warning).toBe(
      "Careful: a wrong guess now ends the round. It still counts.",
    );
  });
  it("selects a live card", () => {
    const r = tap(begin(), { type: "select", term: ANSWER });
    expect(r.outcome).toBe("selected");
    expect(r.message).toBe("Selected. Now tap Check.");
  });
  it("marks the selected live card", () => {
    const s = tap(begin(), { type: "select", term: ANSWER }).state;
    const answer = roundView(s, C, "d:1", D1).cards.find((card) =>
      card.term === ANSWER
    );
    expect(answer && answer.selected).toBe(true);
    expect(answer && answer.state).toBe("live");
  });
  it("rejects an unknown card", () => {
    const r = tap(begin(), { type: "select", term: "nope" });
    expect(r.outcome).toBe("none");
    expect(r.message).toBeNull();
  });
  it("rejects checking with no card", () => {
    const r = tap(begin(), { type: "check" });
    expect(r.outcome).toBe("none");
    expect(r.message).toBe("Tap a word first.");
  });
  it("solves with the exact message", () => {
    const r = solve(begin());
    expect(r.outcome).toBe("solved");
    expect(r.message).toBe(
      "You learned two factor login. Solved with 6 bars left.",
    );
  });
  it("freezes the ended battery line", () => {
    const r = solve(begin());
    expect(roundView(r.state, C, "d:1", D1).batteryLine).toBe("6 bars left.");
  });
  it("reports a wrong guess with the exact miss line", () => {
    const r = wrong(begin());
    expect(r.outcome).toBe("wrong");
    expect(r.message).toBe("Good guess. Another clue can narrow it down.");
  });
  it("clears the miss line on the next action", () => {
    const r = wrong(begin());
    expect(
      roundView(tap(r.state, { type: "nextClue" }).state, C, "d:1", D1)
        .missLine,
    ).toBeNull();
  });
  it("adds the after-miss text once", () => {
    const r = wrong(begin());
    const first = tap(r.state, { type: "nextClue" });
    expect(first.message).toContain(
      "After a wrong guess, you can't reach the last clue.",
    );
    expect(tap(first.state, { type: "nextClue" }).message).not.toContain(
      "After a wrong guess, you can't reach the last clue.",
    );
  });
  it("adds careful text to a low-bar next clue", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    expect(tap(s, { type: "nextClue" }).message).toBe(
      "Clue 4 shown. 3 bars left. Careful: a wrong guess now ends the round. It still counts.",
    );
  });
  it("reports Last bar when a miss disables the next clue", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    s = wrong(s).state;
    expect(tap(s, { type: "nextClue" }).message).toBe("Last bar: pick a word");
  });
  it("reports No more clues at clue five", () => {
    let s = begin();
    for (let i = 0; i < 4; i++) s = tap(s, { type: "nextClue" }).state;
    expect(tap(s, { type: "nextClue" }).message).toBe("No more clues");
  });
  it("shows the answer with the exact message", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    const r = tap(s, { type: "showAnswer" });
    expect(r.outcome).toBe("learned");
    expect(r.message).toBe("Learned it: two factor login.");
  });
  it("ends a zero-bar miss with result note", () => {
    let s = wrong(begin()).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "select", term: "two factor login decoy b" }).state;
    const r = tap(s, { type: "check" });
    const v = roundView(r.state, C, "d:1", D1);
    expect(r.message).toBe(
      "Learned it: two factor login. That's a hard one. Here's what it means.",
    );
    expect(v.resultNote).toBe("That's a hard one. Here's what it means.");
  });
  it("flips both cards after a zero-bar miss", () => {
    let s = begin();
    for (let i = 0; i < 3; i++) s = tap(s, { type: "nextClue" }).state;
    const v = roundView(wrong(s).state, C, "d:1", D1);
    expect(v.cards.filter((card) => card.meaning).length).toBe(2);
  });
  it("does nothing on an ended select", () => {
    const s = solve(begin()).state;
    const r = tap(s, { type: "select", term: WRONG });
    expect(r.outcome).toBe("none");
    expect(r.message).toBeNull();
  });
  it("does nothing on ended check, clue, and answer actions", () => {
    const s = solve(begin()).state;
    expect(tap(s, { type: "check" }).message).toBeNull();
    expect(tap(s, { type: "nextClue" }).message).toBeNull();
    expect(tap(s, { type: "showAnswer" }).message).toBeNull();
  });
  it("allows postStep on an ended round", () => {
    const s = solve(begin()).state;
    expect(tap(s, { type: "postStep", step: 2 }).state.rounds["d:1"].post_step)
      .toBe(2);
  });
  it("keeps card order stable", () => {
    expect(roundView(begin(), C, "d:1", D1).cards.map((x) => x.term)).toEqual(
      roundView(begin(newState()), C, "d:1", D1).cards.map((x) => x.term),
    );
  });
  it("moves missed cards to the end in order", () => {
    let s = wrong(begin()).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "select", term: "two factor login decoy b" }).state;
    s = tap(s, { type: "check" }).state;
    const cards = roundView(s, C, "d:1", D1).cards;
    expect(cards[cards.length - 2].term).toBe(WRONG);
    expect(cards[cards.length - 1].term).toBe("two factor login decoy b");
  });
  it("marks a missed card and its meaning correctly", () => {
    let s = wrong(begin()).state;
    const missed = roundView(s, C, "d:1", D1).cards.find((card) =>
      card.term === WRONG
    );
    expect(missed && missed.state).toBe("missed");
    expect(missed && missed.meaning).toBe("Decoy a meaning.");
  });
  it("uses Today title", () => {
    expect(roundView(begin(), C, "d:1", D1).title).toBe("Today's word");
  });
  it("uses Yesterday title during grace", () => {
    expect(roundView(begin(), C, "d:1", dateOfDay(2)).title).toBe(
      "Yesterday's word",
    );
  });
  it("keeps Yesterday title after a grace finish", () => {
    const r = solve(begin(), "d:1", dateOfDay(2));
    expect(roundView(r.state, C, "d:1", dateOfDay(2)).title).toBe(
      "Yesterday's word",
    );
    expect(roundView(r.state, C, "d:1", dateOfDay(2)).justForFun).toBeNull();
  });
  it("uses Practice title outside grace", () => {
    expect(
      roundView(
        begin(newState(), "d:2", "wi-fi", "practice", dateOfDay(2)),
        C,
        "d:2",
        dateOfDay(4),
      ).title,
    ).toBe("Practice word");
  });
  it("uses Old tech and PTP titles", () => {
    expect(
      roundView(
        begin(newState(), "old", "rotary-phone", "oldtech"),
        C,
        "old",
        D1,
      ).title,
    ).toBe("Old tech");
    expect(
      roundView(begin(newState(), "ptp:7:1", "ptp-1", "ptp"), C, "ptp:7:1", D1)
        .title,
    ).toBe("Pass the Phone");
  });
  it("marks non-counting modes just for fun", () => {
    expect(
      roundView(
        begin(newState(), "old", "rotary-phone", "oldtech"),
        C,
        "old",
        D1,
      ).justForFun,
    ).toBe("Just for fun: this doesn't change your streak or Days learned.");
  });
  it("counts today finish", () => {
    expect(solve(begin()).state.countedDays).toEqual([1]);
  });
  it("counts grace finish", () => {
    let s = begin();
    s = tap(s, { type: "select", term: ANSWER }).state;
    expect(tap(s, { type: "check" }, "d:1", dateOfDay(2)).state.countedDays)
      .toEqual([1]);
  });
  it("does not count a next-day start", () => {
    expect(
      solve(
        begin(newState(), "d:1", ITEM, "daily", dateOfDay(2)),
        "d:1",
        dateOfDay(2),
      ).state.countedDays,
    ).toEqual([]);
  });
  it("does not count a replay twice", () => {
    const s = solve(begin()).state;
    expect(
      solve(replayRound(s, C, "d:1", dateOfDay(2)), "d:1", dateOfDay(2)).state
        .countedDays,
    ).toEqual([1]);
  });
  it("replay preserves history and sets replay", () => {
    const s = solve(begin()).state;
    const r = replayRound(s, C, "d:1", dateOfDay(2));
    expect(r.rounds["d:1"].replay).toBe(true);
    expect(r.finishedDays).toEqual([1]);
  });
  it("creates review dates including learned extra", () => {
    let s = tap(begin(), { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "showAnswer" }).state;
    expect(s.review[ITEM]).toEqual([
      addDays(D1, 1),
      addDays(D1, 2),
      addDays(D1, 3),
      addDays(D1, 7),
    ]);
  });
  it("does not recreate review on replay", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "showAnswer" }).state;
    const before = s.review[ITEM];
    s =
      solve(replayRound(s, C, "d:1", dateOfDay(2)), "d:1", dateOfDay(2)).state;
    expect(s.review[ITEM]).toEqual(before);
  });
  it("does not review old tech or PTP", () => {
    expect(
      solve(begin(newState(), "old", "rotary-phone", "oldtech"), "old").state
        .review["rotary-phone"],
    ).toBeUndefined();
    expect(
      solve(begin(newState(), "ptp:7:3", "ptp-1", "ptp"), "ptp:7:3").state
        .review["ptp-1"],
    ).toBeUndefined();
  });
  it("uses Floyd lines in order", () => {
    const lines = C.missLines.either.concat(C.missLines.floyd);
    let s = newState();
    for (let i = 0; i < lines.length; i++) {
      const key = "d:" + (i + 1);
      const r = wrong(
        begin(s, key, ITEM, "daily", dateOfDay(i + 1)),
        key,
        dateOfDay(i + 1),
      );
      expect(r.message).toBe(lines[i].text);
      s = r.state;
    }
  });
  it("uses Bud on floppy disk and counts lines", () => {
    const r = wrong(
      begin(newState(), "old", "floppy-disk", "oldtech"),
      "old",
      D1,
      C,
      "floppy disk decoy a",
    );
    expect(r.state.rounds.old.miss_speaker).toBe("bud");
    expect(r.state.missLineIndex.bud).toBe(1);
  });
  it("waits on a needs-clue line after a clue-three miss", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    expect(wrong(s).message).toBe("That one's tricky.");
    expect(
      wrong(
        begin(newState(), "d:2", "wi-fi", "daily", dateOfDay(2)),
        "d:2",
        dateOfDay(2),
        C,
        "wi fi decoy a",
      ).message,
    ).toBe("Good guess. Another clue can narrow it down.");
  });
  it("shares solved text exactly", () => {
    expect(
      shareText(solve(begin()).state, C, "d:1", {
        appUrl: "https://x.test",
        demo: false,
      }),
    ).toBe(
      "Jargle #1: 6 bars left\n1 clue, no misses\nA daily tech word game. Try today's:\nhttps://x.test",
    );
  });
  it("shares a three-clue solve with four bars", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    expect(
      shareText(solve(s).state, C, "d:1", {
        appUrl: "https://x.test",
        demo: false,
      }),
    ).toBe(
      "Jargle #1: 4 bars left\n3 clues, no misses\nA daily tech word game. Try today's:\nhttps://x.test",
    );
  });
  it("shares a one-miss learned round at one bar", () => {
    let s = begin();
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "select", term: WRONG }).state;
    const r = tap(s, { type: "check" });
    s = r.state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    const learned = tap(s, { type: "showAnswer" }).state;
    expect(learned.rounds["d:1"].end_bars).toBe(1);
    expect(
      shareText(learned, C, "d:1", { appUrl: "https://x.test", demo: false }),
    ).toContain("learned it (3 clues)");
  });
  it("shares learned text exactly", () => {
    let s = tap(begin(), { type: "nextClue" }).state;
    s = tap(s, { type: "nextClue" }).state;
    s = tap(s, { type: "showAnswer" }).state;
    expect(shareText(s, C, "d:1", { appUrl: "https://x.test", demo: false }))
      .toBe(
        "Jargle #1: learned it (3 clues)\nA daily tech word game. Try today's:\nhttps://x.test",
      );
  });
  it("shares demo text", () => {
    expect(
      shareText(solve(begin()).state, C, "d:1", {
        appUrl: "https://x.test",
        demo: true,
      }),
    ).toContain("Jargle demo: 6 bars left");
  });
  it("shares rerun text", () => {
    const rerun = buildContent();
    rerun.schedule.days[0].rerun = true;
    expect(shareLines(solve(begin()).state, rerun, "d:1", false)).toContain(
      "(Rerun)",
    );
  });
  it("updates PTP on round four and awards taught-someone", () => {
    let s = newState();
    s.ptpSet = { id: 7, rounds: ["ptp-1", "ptp-2", "ptp-1", "ptp-2"], r: 1 };
    function finish(n: number, id: string, show: boolean) {
      const key = "ptp:7:" + n;
      let x = begin(s, key, id, "ptp", D1);
      x = tap(
        x,
        show
          ? { type: "showAnswer" }
          : { type: "select", term: C.items[id].term },
        key,
      ).state;
      if (!show) x = tap(x, { type: "check" }, key).state;
      s = x;
    }
    finish(1, "ptp-1", false);
    finish(2, "ptp-2", false);
    finish(3, "ptp-1", true);
    expect(s.ptpSet?.done).toBeUndefined();
    finish(4, "ptp-2", false);
    expect(s.ptpSet?.done).toBe(true);
    expect(s.ptpTotal).toBe(4);
    expect(s.ptpBest).toBe(3);
    expect(s.badges["taught-someone"]).toBe(D1);
  });
  it("does not update PTP totals on round three", () => {
    let s = newState();
    s.ptpSet = { id: 7, rounds: ["ptp-1", "ptp-2", "ptp-1", "ptp-2"], r: 1 };
    const key = "ptp:7:3";
    s = begin(s, key, "ptp-1", "ptp");
    s = tap(s, { type: "select", term: C.items["ptp-1"].term }, key).state;
    s = tap(s, { type: "check" }, key).state;
    expect(s.ptpSet?.done).toBeUndefined();
    expect(s.ptpTotal).toBe(0);
  });
  it("awards first-word", () => {
    expect(solve(begin()).newBadges).toContain("first-word");
  });
  it("does not mutate inputs", () => {
    const s = newState();
    const before = JSON.stringify(s);
    const started = begin(s);
    expect(JSON.stringify(s)).toBe(before);
    const startedBefore = JSON.stringify(started);
    tap(started, { type: "nextClue" });
    expect(JSON.stringify(started)).toBe(startedBefore);
    const ended = solve(started).state;
    const endedBefore = JSON.stringify(ended);
    replayRound(ended, C, "d:1", dateOfDay(2));
    expect(JSON.stringify(ended)).toBe(endedBefore);
  });
});
