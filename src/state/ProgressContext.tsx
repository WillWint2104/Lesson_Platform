/**
 * @file ProgressContext.tsx — React layer over the progress store.
 *
 * Writes go through store functions ONLY — no component touches localStorage.
 * The provider subscribes to the store and bumps a context version on every
 * change, so consumers re-read the store and re-render.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProgressStore } from "./progress";

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

export function useProgressStore(): ProgressStore {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgressStore must be used within a <ProgressProvider>");
  return ctx.store;
}
