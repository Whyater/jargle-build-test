import { describe, expect, it } from "vitest";
import { buildContent } from "./__fixtures__/content";
import { dateOfDay } from "./dates";
import { newState } from "./state";
import {
  finishLesson,
  lessonOptions,
  lessonStatuses,
  saveLessonProgress,
  todaysLesson,
} from "./lessons";

describe("lessons", function () {
  it("orders lessons by topic and lesson number", function () {
    const content = buildContent({ allLessons: true });
    const statuses = lessonStatuses(newState(), content, dateOfDay(1));

    expect(statuses[0].lesson.topic).toBe("locks-and-keys");
    expect(statuses[0].lesson.number).toBe(1);
    expect(statuses[1].lesson.number).toBe(2);
    expect(statuses[4].lesson.topic).toBe("scams-and-fakes");
    // Chatbot lessons come last now.
    expect(statuses[statuses.length - 1].lesson.topic).toBe("talking-computers");
  });

  it("locks an earlier lesson until it is finished", function () {
    const content = buildContent();
    const statuses = lessonStatuses(newState(), content, dateOfDay(1));

    expect(statuses[0].open).toBe(true);
    expect(statuses[1].open).toBe(false);
    expect(statuses[1].lockLine).toBe("Finish the earlier lesson first.");
  });

  it("uses the exact release lock line for lesson one", function () {
    const content = buildContent();
    content.lessons[0].release_day = 3;
    const statuses = lessonStatuses(newState(), content, dateOfDay(1));

    expect(statuses[0].lockLine).toBe("Opens Tuesday, October 27.");
    expect(statuses[0].open).toBe(false);
  });

  it("uses the later of release and the previous lesson date", function () {
    const content = buildContent();
    const state = newState();
    state.lessons[content.lessons[0].id] = {
      card: 0,
      answers: [],
      finished_on: dateOfDay(2),
    };
    content.lessons[1].release_day = 2;

    const statuses = lessonStatuses(state, content, dateOfDay(2));

    expect(statuses[1].lockLine).toBe("Opens Tuesday, October 27.");
    expect(statuses[1].open).toBe(false);
  });

  it("saves progress without changing the input state", function () {
    const content = buildContent();
    const state = newState();
    const saved = saveLessonProgress(state, content.lessons[0].id, {
      card: 1,
      answer: "x",
    });

    expect(saved.lessons[content.lessons[0].id].card).toBe(1);
    expect(saved.lessons[content.lessons[0].id].answers).toEqual(["x"]);
    expect(state.lessons[content.lessons[0].id]).toBeUndefined();
  });

  it("finishes a lesson once and awards the First Lesson badge", function () {
    const content = buildContent();
    const first = content.lessons[0].id;
    const result = finishLesson(newState(), content, first, dateOfDay(1));

    expect(result.state.lessons[first].finished_on).toBe(dateOfDay(1));
    expect(result.newBadges).toContain("first-lesson");
  });

  it("finishing a lesson twice keeps the first finish date", function () {
    const content = buildContent();
    const first = content.lessons[0].id;
    const firstFinish = finishLesson(newState(), content, first, dateOfDay(2));
    const secondFinish = finishLesson(
      firstFinish.state,
      content,
      first,
      dateOfDay(3),
    );

    expect(secondFinish.state.lessons[first].finished_on).toBe(dateOfDay(2));
  });

  it("returns the first open unfinished lesson for today", function () {
    const content = buildContent();
    const lesson = todaysLesson(newState(), content, dateOfDay(1));

    expect(lesson).not.toBeNull();
    expect(lesson!.id).toBe(content.lessons[0].id);
  });

  it("returns no lesson after one was finished today", function () {
    const content = buildContent();
    const first = content.lessons[0].id;
    const state = finishLesson(newState(), content, first, dateOfDay(1)).state;

    expect(todaysLesson(state, content, dateOfDay(1))).toBeNull();
  });

  it("shuffles lesson options stably without losing any option", function () {
    const content = buildContent();
    const lesson = content.lessons[0];
    const first = lessonOptions(lesson, 0);
    const second = lessonOptions(lesson, 0);

    expect(first).toEqual(second);
    expect(first.slice().sort()).toEqual(
      lesson.checks[0].options.slice().sort(),
    );
  });
});
