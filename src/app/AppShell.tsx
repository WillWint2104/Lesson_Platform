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
import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

/** Map a route to its content container width (kept in sync with each screen). */
function containerForPath(pathname: string): string {
  if (pathname === "/") return "var(--container-wide)"; // Library hub
  if (pathname === "/debug") return "var(--container-area)";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 3) return "var(--container-area)"; // /:subject/:topic/:topicArea
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
      <Outlet />
      <AppFooter />
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
