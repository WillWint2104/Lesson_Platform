import { Routes, Route } from "react-router-dom";
import { Library } from "./screens/Library";
import { LessonSelection } from "./screens/LessonSelection";
import { LessonPlaceholder } from "./screens/LessonPlaceholder";
import { DebugHarness } from "./screens/DebugHarness";
import { NotFound } from "./screens/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Library />} />
      {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
      <Route path="/debug" element={<DebugHarness />} />
      <Route path="/:subject/:topic/:topicArea" element={<LessonSelection />} />
      <Route path="/:subject/:topic/:topicArea/:lessonId" element={<LessonPlaceholder />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
