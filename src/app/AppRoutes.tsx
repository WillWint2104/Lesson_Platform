import { Routes, Route } from "react-router-dom";
import { Library } from "@/app/screens/Library";
import { AreaPage } from "@/app/screens/AreaPage";
import { DebugHarness } from "@/app/screens/DebugHarness";
import { NotFound } from "@/app/screens/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Library />} />
      {/* Dormant dev harness, retained but linked nowhere (lesson 8/9). */}
      <Route path="/debug" element={<DebugHarness />} />
      {/* One page per topic area: notes + ordered video/exercise sequence. */}
      <Route path="/:subject/:topic/:topicArea" element={<AreaPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
