import { describe, expect, it } from "vitest";
import { buildContent } from "./__fixtures__/content";
import { newState } from "./state";
import { dateOfDay, dayNumber } from "./dates";
import {
  dayStatus,
  gentleLine,
  isInGrace,
  roundCounts,
  streak,
} from "./counting";

describe("counting", () => {
  it("recognizes today and grace counting", () => {
    const content = buildContent({ days: 4 });
    const state = newState();
    state.rounds["d:1"] = {
      item_id: "two-factor-login",
      mode: "daily",
      started_on: dateOfDay(1),
      k: 1,
      spent: [],
      selected: null,
      status: "playing",
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    expect(isInGrace(state, 1, dateOfDay(2))).toBe(true);
    state.rounds["d:1"].status = "solved";
    expect(roundCounts(state, "d:1", dateOfDay(2))).toBe(true);
    expect(roundCounts(state, "d:1", dateOfDay(3))).toBe(false);
    expect(dayStatus(state, content, 1, dateOfDay(2))).toBe("none");
  });
  it("resets after two missed days and skips no-word days", () => {
    const content = buildContent({ days: 12 });
    const state = newState();
    state.firstPlayDay = 1;
    state.countedDays = [1, 2, 3, 4, 5, 9, 10, 11];
    expect(streak(state, content, dateOfDay(12))).toBe(3);
    expect(dayStatus(state, content, 0, dateOfDay(12))).toBe("none");
  });
  it("writes the three gentle lines", () => {
    const content = buildContent({ days: 5 });
    const state = newState();
    state.firstPlayDay = 1;
    state.countedDays = [1, 2];
    expect(gentleLine(state, content, dateOfDay(4))).toContain(
      "keep your streak",
    );
    state.countedDays = [1];
    expect(gentleLine(state, content, dateOfDay(3))).toContain("keep learning");
    state.countedDays = [1];
    state.rounds["d:2"] = {
      item_id: "wi-fi",
      mode: "daily",
      started_on: dateOfDay(2),
      k: 1,
      spent: [],
      selected: null,
      status: "learned",
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    expect(gentleLine(state, content, dateOfDay(4))).toContain(
      "New streak starts today",
    );
  });
});

it("counts a daily finished on its own day", () => {
  const state = newState();
  state.rounds["d:1"] = {
    item_id: "two-factor-login",
    mode: "daily",
    started_on: dateOfDay(1),
    k: 1,
    spent: [],
    selected: null,
    status: "solved",
    post_step: 0,
    miss_line: null,
    replay: false,
  };
  expect(roundCounts(state, "d:1", dateOfDay(1))).toBe(true);
});

it("does not count after the grace day", () => {
  const state = newState();
  state.rounds["d:1"] = {
    item_id: "two-factor-login",
    mode: "daily",
    started_on: dateOfDay(1),
    k: 1,
    spent: [],
    selected: null,
    status: "solved",
    post_step: 0,
    miss_line: null,
    replay: false,
  };
  expect(roundCounts(state, "d:1", dateOfDay(3))).toBe(false);
});

it("does not count non-daily keys", () => {
  const state = newState();
  state.rounds["old-tech"] = {
    item_id: "old-tech",
    mode: "oldtech",
    started_on: dateOfDay(1),
    k: 1,
    spent: [],
    selected: null,
    status: "solved",
    post_step: 0,
    miss_line: null,
    replay: false,
  };
  expect(roundCounts(state, "old-tech", dateOfDay(1))).toBe(false);
});

it("uses the fall-back clock dates as consecutive days", () => {
  expect(dayNumber("2026-11-01")).toBe(8);
  expect(dayNumber("2026-11-02")).toBe(9);
});

it("does not mark a single missed day as a streak break", () => {
  const content = buildContent({ days: 4 });
  const state = newState();
  state.firstPlayDay = 1;
  state.countedDays = [1, 3, 4];
  expect(streak(state, content, dateOfDay(4))).toBe(3);
});
