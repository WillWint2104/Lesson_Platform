/**
 * @file ProgressContext.tsx — React layer over the progress store.
 *
 * Writes go through store functions ONLY — no component touches localStorage.
 * The provider subscribes to the store and bumps a context version on every
 * change, so consumers re-read the (stale-id-guarded, hierarchy-scoped) query
 * helpers and re-render.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  LessonRecord,
  Outcome,
  ProgressStore,
  ScopedProgress,
} from "./progress";

interface ProgressContextValue {
  store: ProgressStore;
  /** Bumped on every store change; identity change re-renders consumers. */
  version: number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({
  store,
  children,
}: {
  store: ProgressStore;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);
  return (
    <ProgressContext.Provider value={{ store, version }}>{children}</ProgressContext.Provider>
  );
}

function useProgressContext(hook: string): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error(`${hook} must be used within a <ProgressProvider>`);
  return ctx;
}

/** Access the raw store (e.g. for resetAll / setLastVisited in the harness). */
export function useProgressStore(): ProgressStore {
  return useProgressContext("useProgressStore").store;
}

export interface LessonProgressApi {
  record: LessonRecord | null;
  recordOutcome: (questionIndex: number, outcome: Outcome) => void;
  recordAttempt: (completed: boolean) => void;
}

export function useLessonProgress(lessonId: string): LessonProgressApi {
  const { store } = useProgressContext("useLessonProgress");
  return {
    record: store.getLessonProgress(lessonId),
    recordOutcome: (questionIndex, outcome) =>
      store.recordOutcome(lessonId, questionIndex, outcome),
    recordAttempt: (completed) => store.recordAttempt(lessonId, completed),
  };
}

export function useTopicProgress(subject: string, topic: string): ScopedProgress {
  return useProgressContext("useTopicProgress").store.getTopicProgress(subject, topic);
}

export function useTopicAreaProgress(
  subject: string,
  topic: string,
  topicArea: string,
): ScopedProgress {
  return useProgressContext("useTopicAreaProgress").store.getTopicAreaProgress(
    subject,
    topic,
    topicArea,
  );
}
