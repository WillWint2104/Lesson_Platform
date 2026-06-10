import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { DashboardShell } from "@/app/DashboardShell";
import { DashboardHome } from "@/app/screens/DashboardHome";
import { Onboarding } from "@/app/screens/Onboarding";
import { ExplorePage } from "@/app/screens/ExplorePage";
import { CourseDetailPage } from "@/app/screens/CourseDetailPage";
import { AreaRedirect } from "@/app/screens/AreaRedirect";
import { StagePage } from "@/app/screens/StagePage";
import { ExercisePage } from "@/app/screens/ExercisePage";
import { DebugHarness } from "@/app/screens/DebugHarness";
import { NotFound } from "@/app/screens/NotFound";
import { useProgressStore } from "@/state/ProgressContext";

/** `/`: first visit (no joined courses, no remembered course) → onboarding. */
function HomeGate() {
  const store = useProgressStore();
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
  return store.isFirstVisit() ? <Onboarding /> : <DashboardHome />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* DASHBOARD register (dashboard-register-v1): sidebar shell, no grid
          texture, no mint strips. */}
      <Route element={<DashboardShell />}>
        <Route path="/" element={<HomeGate />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/explore/:course" element={<CourseDetailPage />} />
        <Route path="/:course" element={<DashboardHome />} />
      </Route>

      {/* LESSON register (design-language-v2): grid canvas + mint-strip panels. */}
      <Route element={<AppShell />}>
        {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
        <Route path="/debug" element={<DebugHarness />} />
        {/* Area root redirects to the current stage (progress-derived). */}
        <Route path="/:course/:topic/:topicArea" element={<AreaRedirect />} />
        <Route path="/:course/:topic/:topicArea/stage/:n" element={<StagePage />} />
        <Route
          path="/:course/:topic/:topicArea/stage/:n/exercise"
          element={<ExercisePage />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
