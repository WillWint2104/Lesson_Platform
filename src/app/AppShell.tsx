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
import { ArrowLeft } from "lucide-react";
import { useProgressStore } from "@/state/ProgressContext";
import { useRegistry } from "@/app/RegistryContext";
import { parseAreaRoute } from "@/app/routeArea";
import { ContentsSidebar } from "@/app/ContentsSidebar";
import { stageInputs } from "@/app/stageProgress";
import { titleCase } from "@/app/format";
import type { ValidatedArea } from "@/ingest/load";

/** Map a route to its content container width (kept in sync with each screen). */
function containerForPath(pathname: string): string {
  if (pathname === "/debug") return "var(--container-area)";
  const segments = pathname.split("/").filter(Boolean);
  // /:course/:topic/:topicArea/stage/:n[/exercise] — the stage-flow pages.
  if (segments.length >= 4 && segments[3] === "stage") return "var(--container-stage)";
  if (segments.length === 3) return "var(--container-area)"; // area redirect (brief)
  return "var(--container-list)"; // not-found / everything else
}

export function AppShell() {
  const { pathname } = useLocation();
  const registry = useRegistry();
  const store = useProgressStore();

  // Body-class hook for the page surface.
  useEffect(() => {
    document.body.classList.add("lp-app");
  }, []);

  const style = { "--container": containerForPath(pathname) } as CSSProperties;

  // The contents sidebar (§4) renders whenever the route resolves to a known,
  // valid area. Layout routes can't read route params, so derive from the path.
  const route = parseAreaRoute(pathname);
  const area = route ? registry.getAreaById(route.areaId) : undefined;
  const activeArea = area && area.valid ? area : undefined;
  const showSidebar = Boolean(activeArea);

  // Area mastery for the top bar (§7a): completed stages / total.
  let mastery: number | null = null;
  if (activeArea) {
    const inputs = stageInputs(activeArea, store);
    mastery = inputs.length === 0 ? 0 : Math.round((inputs.filter((s) => s.complete).length / inputs.length) * 100);
  }
  // The course of the active area, for the breadcrumb hub link + course switcher.
  const courseManifest = activeArea ? registry.getCourseById(activeArea.course) : undefined;
  const courseName = activeArea
    ? (courseManifest?.displayName ?? titleCase(activeArea.course))
    : undefined;

  return (
    <div className="app-shell v2-canvas" style={style}>
      <AppBar area={activeArea} mastery={mastery} courseName={courseName} />
      <div className={`shell-body${showSidebar ? " shell-body--with-sidebar" : ""}`}>
        {showSidebar && area ? (
          <ContentsSidebar
            area={area}
            store={store}
            activeStage={route?.stageNumber}
            activeView={route?.view}
          />
        ) : null}
        <div className="shell-main">
          <Outlet />
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

// The old full-width local-progress NoticeBar lived on the landing route, which
// is now the DASHBOARD register: its job is carried by the sidebar's "Local
// progress" footer + the onboarding footnote (dashboard-register-v1). The store
// notice API (isNoticeDismissed/dismissNotice) is retained (lesson 8) and still
// store-tested.

function AppBar({
  area,
  mastery,
  courseName,
}: {
  area?: ValidatedArea;
  mastery: number | null;
  courseName?: string;
}) {
  return (
    <header className="app-bar">
      <div className="app-bar__inner">
        <div className="app-bar__lead">
          <Link className="app-bar__wordmark" to="/">
            Lesson Platform
          </Link>
          {/* §13 chrome addendum: a REAL bounded back button, then the breadcrumb
              at body contrast — every segment a real link, ≥40px targets. */}
          {area ? (
            <>
              <Link className="appbar-back" to={`/${area.course}`}>
                <ArrowLeft size={16} aria-hidden="true" /> Back to course
              </Link>
              <nav className="appbar-crumb" aria-label="Breadcrumb">
                <Link className="appbar-crumb__link" to={`/${area.course}`}>
                  {courseName ?? titleCase(area.course)}
                </Link>
                <span className="appbar-crumb__sep" aria-hidden="true">
                  ›
                </span>
                {/* Topics live on the course home — the topic segment goes there. */}
                <Link className="appbar-crumb__link" to={`/${area.course}`}>
                  {titleCase(area.topic)}
                </Link>
                <span className="appbar-crumb__sep" aria-hidden="true">
                  ›
                </span>
                <Link
                  className="appbar-crumb__link appbar-crumb__link--current"
                  to={`/${area.course}/${area.topic}/${area.topicArea}`}
                  aria-current="page"
                >
                  {area.title}
                </Link>
              </nav>
            </>
          ) : null}
        </div>
        <div className="app-bar__trail">
          {/* Course switcher (§5) — a clearly bounded button; → dashboard home. */}
          {area && courseName ? (
            <Link className="appbar-course" to="/" aria-label={`Switch course (current: ${courseName})`}>
              <span className="appbar-course__name">{courseName}</span>
              <span className="appbar-course__hint v2-mono">Switch</span>
            </Link>
          ) : null}
          {mastery !== null ? (
            <span className="appbar-mastery" aria-label={`${mastery}% mastery`}>
              <span className="appbar-mastery__pct">{mastery}%</span>
              <span className="appbar-mastery__label v2-mono">mastery</span>
            </span>
          ) : null}
          <span className="app-bar__identity" aria-label="Profile (placeholder)">
            LP
          </span>
        </div>
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
