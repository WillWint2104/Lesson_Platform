/**
 * @file RegistryContext.tsx — provides the loaded lesson registry to screens.
 * Built once at the app root (main.tsx); injected in tests.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { AreaRegistry } from "@/ingest/load";

const RegistryContext = createContext<AreaRegistry | null>(null);

export function RegistryProvider({
  registry,
  children,
}: {
  registry: AreaRegistry;
  children: ReactNode;
}) {
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

export function useRegistry(): AreaRegistry {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error("useRegistry must be used within a <RegistryProvider>");
  return registry;
}
