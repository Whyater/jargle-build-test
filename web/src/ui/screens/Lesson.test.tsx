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

describe('LessonScreen session', () => {
  it('starts each question unanswered', async () => {
    window.scrollTo = () => undefined;
    const content = buildContent();
    // The test lesson has no words, so its session is the learn cards, its 3 checks, then a recap.
    const lesson = content.lessons[0];
    const save = newState();
    setAppForDev({ status: 'ready', content, save, today: '2026-11-06', canSave: false });

    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<LessonScreen lessonId={lesson.id} />, root);
    await wait(20);

    // Read through the learn cards.
    for (let i = 0; i < lesson.cards.length - 1; i++) {
      buttonWithText(root, 'Next')!.click();
      await wait(20);
    }
    buttonWithText(root, 'Got it')!.click();
    await wait(20);

    const first = buttonWithText(root, lesson.checks[0].options[0]);
    expect(first).not.toBeNull();
    first!.click();
    await wait(20);
    // The feedback sheet says why.
    expect(root.textContent).toContain(lesson.checks[0].why);
    buttonWithText(root, 'Continue')!.click();
    await wait(20);

    // Question 2 must not show Continue until it is answered.
    expect(buttonWithText(root, 'Continue')).toBeNull();
    const second = buttonWithText(root, lesson.checks[1].options[0]);
    expect(second!.getAttribute('aria-disabled')).toBeNull();
  });
});
