import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Global styling source of truth — design tokens (CLAUDE.md §d). Imported once,
// here, so every component can reference the CSS custom properties.
import "../styles/tokens.css";
// v2 re-theme tokens + primitives (design-language-v2). Loaded after the v1
// tokens; additive — screens migrate onto these PR-by-PR (no page restyle yet).
import "../styles/tokens-v2.css";
import "../styles/v2-primitives.css";
import "../styles/components.css";
import "../styles/screens.css";
// v2 shell + contents sidebar — loaded last so it re-themes the shared chrome.
import "../styles/v2-shell.css";
import "../styles/v2-stage.css";
// Dashboard register (dashboard-register-v1) — scoped tokens + components.
import "../styles/dashboard.css";
import "../styles/v2-exercise.css";
// KaTeX stylesheet (npm, not CDN — see CLAUDE.md §f). Required for math layout.
import "katex/dist/katex.min.css";

import { loadAllAreas } from "@/ingest/load";
import { createProgressStore } from "@/state/progress";
import { figureSchemas } from "@/render/figures/registry";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

// Built once at startup. Figure schemas validate figure data per kind; the
// area-id list enables the store's stale-id guard.
const registry = loadAllAreas({ figureSchemas });
const store = createProgressStore({
  areaIds: registry.areas.map((a) => a.id),
  courseIds: registry.courses.map((c) => c.id),
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <RegistryProvider registry={registry}>
        <ProgressProvider store={store}>
          <AppRoutes />
        </ProgressProvider>
      </RegistryProvider>
    </BrowserRouter>
  </StrictMode>,
);
