import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Global styling source of truth — design tokens (CLAUDE.md §d). Imported once,
// here, so every component can reference the CSS custom properties.
import "../styles/tokens.css";
import "../styles/components.css";
import "../styles/screens.css";
// KaTeX stylesheet (npm, not CDN — see CLAUDE.md §f). Required for math layout.
import "katex/dist/katex.min.css";

import { loadAllLessons } from "@/ingest/load";
import { createProgressStore } from "@/state/progress";
import { figureSchemas } from "@/render/figures/registry";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

// Built once at startup. Per-question skill/difficulty meta feeds the progress
// store's scoped queries; figure schemas validate figure data per kind.
const registry = loadAllLessons({ figureSchemas });
const store = createProgressStore({
  lessons: registry.lessons.map((l) => ({
    id: l.id,
    subject: l.subject,
    topic: l.topic,
    topicArea: l.topicArea,
    questions: l.questions.map((q) => ({ skill: q.skill, difficulty: q.difficulty })),
  })),
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
