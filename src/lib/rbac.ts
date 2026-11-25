import type { InterviewState } from '../types.ts';

export function isInterviewCompleted(interview?: InterviewState | null): boolean {
  if (!interview) return false;
  return Boolean(
    interview.isComplete ||
      interview.abilityAssessment ||
      interview.videoInterviewReport
  );
}
