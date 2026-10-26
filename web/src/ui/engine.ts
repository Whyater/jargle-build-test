// The screens call the engine through this one object instead of importing api.ts directly.
// The dev gallery swaps single functions for fixtures, so every screen can be shown
// before the real engine is finished.

import * as api from '../engine/api';

export const engine = {
  todayLocal: api.todayLocal,
  dayNumber: api.dayNumber,
  dateOfDay: api.dateOfDay,
  newState: api.newState,
  startRound: api.startRound,
  roundView: api.roundView,
  applyRound: api.applyRound,
  replayRound: api.replayRound,
  shareText: api.shareText,
  homeView: api.homeView,
  reviewSession: api.reviewSession,
  answerReview: api.answerReview,
  lessonStatuses: api.lessonStatuses,
  lessonOptions: api.lessonOptions,
  saveLessonProgress: api.saveLessonProgress,
  finishLesson: api.finishLesson,
  practiceList: api.practiceList,
  oldTechList: api.oldTechList,
  nextWord: api.nextWord,
  startPtpSet: api.startPtpSet,
  advancePtp: api.advancePtp,
  ptpRoundItem: api.ptpRoundItem,
  ptpSummary: api.ptpSummary,
  badgeViews: api.badgeViews,
  encodeProgressCode: api.encodeProgressCode,
  decodeProgressCode: api.decodeProgressCode,
  demoState: api.demoState,
};
