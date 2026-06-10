/**
 * @file AreaRedirect.tsx — /:course/:topic/:topicArea
 *
 * The area root has no page of its own; it redirects to the current stage
 * (progress-derived: first stage with an incomplete core exercise, else the
 * last stage). Invalid areas fall through to the not-found treatment.
 */
import { Navigate, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import { currentStageNumber, stagePath } from "@/app/stageProgress";
import { NotFound } from "@/app/screens/NotFound";

export function AreaRedirect() {
  const { course, topic, topicArea } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const area = registry.getAreaById(`${course}/${topic}/${topicArea}`);
  if (!area || !area.valid) {
    return <NotFound message="That topic area doesn’t exist." />;
  }
  return <Navigate to={stagePath(area, currentStageNumber(area, store))} replace />;
}
