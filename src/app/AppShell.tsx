/**
 * @file AppShell.tsx — the app's page chrome (full-width bar + footer).
 *
 * The app is a PAGE, not a framed card: the cream background fills the viewport
 * (set on <body>), the shell is a min-height flex column so the footer pins to
 * the bottom on short pages, and only the *content* is width-constrained. The
 * active content width is published as the `--container` custom property on the
 * shell (per route) so the app bar, footer, and page content all align to the
 * same column.
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useProgressStore } from "@/state/ProgressContext";

/** Map a route to its content container width (kept in sync with each screen). */
function containerForPath(pathname: string): string {
  if (pathname === "/") return "var(--container-wide)"; // Library hub
  if (pathname === "/debug") return "var(--container-area)";
  const segments = pathname.split("/").filter(Boolean);
  // /:subject/:topic/:topicArea/stage/:n[/exercise] — the stage-flow pages.
  if (segments.length >= 4 && segments[3] === "stage") return "var(--container-stage)";
  if (segments.length === 3) return "var(--container-area)"; // area redirect (brief)
  return "var(--container-list)"; // not-found / everything else
}

export function AppShell() {
  const { pathname } = useLocation();

  // Body-class hook for the page surface (the cream background lives on <body>).
  useEffect(() => {
    document.body.classList.add("lp-app");
  }, []);

  const style = { "--container": containerForPath(pathname) } as CSSProperties;

  return (
    <div className="app-shell" style={style}>
      <AppBar />
      {/* The local-progress notice belongs to the Library hub only. */}
      <NoticeBar visible={pathname === "/"} />
      <Outlet />
      <AppFooter />
    </div>
  );
}

/**
 * Demoted local-progress notice (design-language v3): a single muted full-width
 * app-bar line, out of the content flow. Dismissal is store-backed and persists;
 * local state hides it immediately for the session.
 */
function NoticeBar({ visible }: { visible: boolean }) {
  const store = useProgressStore();
  const [dismissed, setDismissed] = useState(() => store.isNoticeDismissed("local-progress"));
  if (!visible || dismissed) return null;
  return (
    <div className="app-noticebar">
      <div className="app-noticebar__inner">
        <span className="app-noticebar__text">
          Your progress is saved in this browser on this device. Clearing site data or switching
          devices starts fresh.
        </span>
        <button
          type="button"
          className="app-noticebar__dismiss"
          onClick={() => {
            store.dismissNotice("local-progress");
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AppBar() {
  return (
    <header className="app-bar">
      <div className="app-bar__inner">
        <Link className="app-bar__wordmark" to="/">
          Lesson Platform
        </Link>
        <span className="app-bar__identity" aria-label="Profile (placeholder)">
          LP
        </span>
      </div>
    </header>
  );
}

function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <span className="app-footer__wordmark">Lesson Platform</span>
        <span>© {year}</span>
      </div>
    </footer>
  );
}
