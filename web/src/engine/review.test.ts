import { describe, expect, it } from "vitest";
import { buildContent } from "./__fixtures__/content";
import { dateOfDay } from "./dates";
import {
  answerReview,
  reviewDoneLine,
  reviewDueCount,
  reviewLinkText,
  reviewSession,
} from "./review";
import { newState } from "./state";

describe("review", () => {
  it("selects the oldest due cards and limits the session to five", () => {
    const content = buildContent();
    const state = newState();
    const ids = content.schedule.days.slice(0, 6);

    for (let i = 0; i < ids.length; i++) {
      state.review[ids[i].term] = [dateOfDay(1)];
    }

    const questions = reviewSession(state, content, dateOfDay(2));

    expect(questions).toHaveLength(5);
    expect(questions[0].itemId).toBe("two-factor-login");
    expect(questions[0].prompt).toBe(
      "Which one means: The meaning of two factor login?",
    );
    expect(questions[0].options).toHaveLength(3);
    expect(questions[0].options.some(function (option) {
      return option.term === "two factor login";
    })).toBe(true);
  });

  it("does not show a card twice on one day", () => {
    const content = buildContent();
    const state = newState();
    state.review["two-factor-login"] = [dateOfDay(1)];
    state.reviewSeen["two-factor-login"] = dateOfDay(2);

    expect(reviewSession(state, content, dateOfDay(2))).toEqual([]);
    expect(reviewSession(state, content, dateOfDay(3))).toHaveLength(1);
  });

  it("answers right and wrong cards without mutating the input", () => {
    const state = newState();
    state.review.a = [dateOfDay(1), dateOfDay(2)];

    const right = answerReview(state, "a", true, dateOfDay(2));

    expect(right.review.a).toEqual([]);
    expect(state.review.a).toEqual([dateOfDay(1), dateOfDay(2)]);

    const wrong = answerReview(right, "a", false, dateOfDay(2));

    expect(wrong.review.a).toEqual([dateOfDay(3)]);
    expect(answerReview(wrong, "a", false, dateOfDay(2)).review.a).toEqual([
      dateOfDay(3),
    ]);
  });

  it("counts words with any due date", () => {
    const state = newState();
    state.review = {
      old: [dateOfDay(1)],
      future: [dateOfDay(4)],
      mixed: [dateOfDay(1), dateOfDay(8)],
    };

    expect(reviewDueCount(state, dateOfDay(2))).toBe(2);
  });

  it("uses exact copy and plurals", () => {
    expect(reviewLinkText(0)).toBe("Review: nothing due today.");
    expect(reviewLinkText(1)).toBe("Review: 1 word to practice");
    expect(reviewLinkText(2)).toBe("Review: 2 words to practice");
    expect(reviewDoneLine(1)).toBe("You reviewed 1 word.");
    expect(reviewDoneLine(2)).toBe("You reviewed 2 words.");
  });

  it("works through the demo history and leaves three words due on day twelve", () => {
    const content = buildContent();
    let state = newState();

    for (let day = 1; day <= 5; day++) {
      const id = content.schedule.days[day - 1].term;
      state.review[id] = [
        dateOfDay(day + 1),
        dateOfDay(day + 3),
        dateOfDay(day + 7),
      ];
    }
    for (let day = 9; day <= 11; day++) {
      const id = content.schedule.days[day - 1].term;
      state.review[id] = [
        dateOfDay(day + 1),
        dateOfDay(day + 3),
        dateOfDay(day + 7),
      ];
    }

    for (let day = 2; day <= 5; day++) {
      state = answerAllDue(state, content, dateOfDay(day), null);
    }
    for (let day = 9; day <= 11; day++) {
      const missedId = day === 9 ? content.schedule.days[0].term : null;
      state = answerAllDue(state, content, dateOfDay(day), missedId);
    }

    expect(reviewDueCount(state, dateOfDay(12))).toBe(3);
  });
});

function answerAllDue(
  state: ReturnType<typeof newState>,
  content: ReturnType<typeof buildContent>,
  today: string,
  wrongId: string | null,
) {
  let next = state;
  let questions = reviewSession(next, content, today);
  while (questions.length > 0) {
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      next = answerReview(
        next,
        question.itemId,
        question.itemId !== wrongId,
        today,
      );
    }
    questions = reviewSession(next, content, today);
  }
  return next;
}
