import { Routes, Route } from "react-router-dom";
import { Library } from "@/app/screens/Library";
import { LessonSelection } from "@/app/screens/LessonSelection";
import { LessonPage } from "@/app/screens/LessonPage";
import { DebugHarness } from "@/app/screens/DebugHarness";
import { NotFound } from "@/app/screens/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Library />} />
      {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
      <Route path="/debug" element={<DebugHarness />} />
      <Route path="/:subject/:topic/:topicArea" element={<LessonSelection />} />
      <Route path="/:subject/:topic/:topicArea/:lessonId" element={<LessonPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
