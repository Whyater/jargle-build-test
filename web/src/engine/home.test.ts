import { describe, expect, it } from "vitest";
import { buildContent } from "./__fixtures__/content";
import { newState } from "./state";
import { dateOfDay } from "./dates";
import { homeView } from "./home";

describe("home", () => {
  it("shows the first phase and review strings", () => {
    const state = newState();
    const view = homeView(state, buildContent(), dateOfDay(1));
    expect(view.phase).toBe("first");
    expect(view.reviewLink).toBe("Review: nothing due today.");
    expect(view.streakLine).toBeNull();
  });
  it("shows grace and a streak line", () => {
    const content = buildContent();
    const state = newState();
    state.firstPlayDay = 1;
    state.countedDays = [1];
    state.rounds["d:2"] = {
      item_id: "wi-fi",
      mode: "daily",
      started_on: dateOfDay(2),
      k: 1,
      spent: [],
      selected: null,
      status: "playing",
      post_step: 0,
      miss_line: null,
      replay: false,
    };
    const view = homeView(state, content, dateOfDay(3));
    expect(view.grace).not.toBeNull();
    expect(view.streak).toBe(1);
    expect(view.streakLine).toBeNull();
  });
});

it("shows noWord when the schedule has ended", () => {
  const content = buildContent({ schedule: ["two-factor-login"], days: 1 });
  const view = homeView(newState(), content, dateOfDay(2));
  expect(view.phase).toBe("noWord");
  expect(view.today).toBeNull();
});

it("shows notPlayed after an earlier finished day", () => {
  const content = buildContent({ days: 2 });
  const state = newState();
  state.finishedDays = [1];
  const view = homeView(state, content, dateOfDay(2));
  expect(view.phase).toBe("notPlayed");
});

it("counts one due review item once", () => {
  const state = newState();
  state.review["two-factor-login"] = [dateOfDay(1), dateOfDay(2)];
  const view = homeView(state, buildContent(), dateOfDay(2));
  expect(view.reviewDue).toBe(1);
  expect(view.reviewLink).toBe("Review: 1 word to practice");
});

it("shows the prelaunch phase before day one", () => {
  const view = homeView(newState(), buildContent(), "2026-10-24");
  expect(view.phase).toBe("prelaunch");
  expect(view.gentleLine).toBeNull();
});

it("shows the streak line at 2 or more days", () => {
  const content = buildContent();
  const state = newState();
  state.countedDays = [1, 2, 3];
  const view = homeView(state, content, dateOfDay(4));
  expect(view.streakLine).toBe("Streak: 3 days played");
});

it("hides the streak line under 2 days", () => {
  const content = buildContent();
  const state = newState();
  state.countedDays = [1];
  const view = homeView(state, content, dateOfDay(2));
  expect(view.streakLine).toBeNull();
});
