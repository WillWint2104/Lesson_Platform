import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { Library } from "@/app/screens/Library";
import { AreaRedirect } from "@/app/screens/AreaRedirect";
import { StagePage } from "@/app/screens/StagePage";
import { ExercisePage } from "@/app/screens/ExercisePage";
import { DebugHarness } from "@/app/screens/DebugHarness";
import { NotFound } from "@/app/screens/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      {/* Shared page chrome (full-width app bar + footer) wraps every route. */}
      <Route element={<AppShell />}>
        <Route path="/" element={<Library />} />
        {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
        <Route path="/debug" element={<DebugHarness />} />
        {/* Area root redirects to the current stage (progress-derived). */}
        <Route path="/:subject/:topic/:topicArea" element={<AreaRedirect />} />
        <Route path="/:subject/:topic/:topicArea/stage/:n" element={<StagePage />} />
        <Route
          path="/:subject/:topic/:topicArea/stage/:n/exercise"
          element={<ExercisePage />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
