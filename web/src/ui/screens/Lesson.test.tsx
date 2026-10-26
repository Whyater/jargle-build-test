// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from 'preact';
import { buildContent } from '../../engine/__fixtures__/content';
import { newState } from '../../engine/api';
import { setAppForDev } from '../store';
import { LessonScreen } from './Lesson';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buttonWithText(root: HTMLElement, text: string): HTMLButtonElement | null {
  const buttons = root.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    if ((buttons[i].textContent || '').indexOf(text) >= 0) return buttons[i];
  }
  return null;
}

describe('LessonScreen checks', () => {
  it('starts each question unanswered', async () => {
    window.scrollTo = () => undefined;
    const content = buildContent();
    const lesson = content.lessons[0];
    const save = newState();
    // Skip the learn cards: start on the first check.
    save.lessons[lesson.id] = { card: lesson.cards.length, answers: [], finished_on: null };
    setAppForDev({ status: 'ready', content, save, today: '2026-11-06', canSave: false });

    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<LessonScreen lessonId={lesson.id} />, root);
    await wait(20);

    const first = buttonWithText(root, lesson.checks[0].options[0]);
    expect(first).not.toBeNull();
    first!.click();
    await wait(20);
    buttonWithText(root, 'Next question')!.click();
    await wait(20);

    // Question 2 must not show Next question or Finish until it is answered.
    expect(buttonWithText(root, 'Next question')).toBeNull();
    expect(buttonWithText(root, 'Finish')).toBeNull();
    const second = buttonWithText(root, lesson.checks[1].options[0]);
    expect(second!.getAttribute('aria-disabled')).toBeNull();
  });
});
