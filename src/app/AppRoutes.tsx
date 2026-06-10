import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { CoursePicker } from "@/app/screens/CoursePicker";
import { CourseHub } from "@/app/screens/CourseHub";
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
        {/* Course picker landing; selecting a course routes into its hub (§5). */}
        <Route path="/" element={<CoursePicker />} />
        {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
        <Route path="/debug" element={<DebugHarness />} />
        {/* Course-scoped routes (content-architecture-v1 §4). */}
        <Route path="/:course" element={<CourseHub />} />
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
