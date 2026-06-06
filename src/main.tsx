import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";

// Global styling source of truth — design tokens (CLAUDE.md §d). Imported once,
// here, so every component can reference the CSS custom properties.
import "../styles/tokens.css";
import "../styles/components.css";
// KaTeX stylesheet (npm, not CDN — see CLAUDE.md §f). Required for math layout.
import "katex/dist/katex.min.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
