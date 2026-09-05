import { Routes, Route, Navigate } from "react-router-dom";
import JudgeLayout from "../layouts/JudgeLayout";
import JudgeDashboard from "../pages/judge/JudgeDashboard";
import Projects from "../pages/judge/Projects";
import ProjectDetails from "../pages/judge/ProjectDetails";

function JudgeRoutes() {
  return (
    <Routes>
      <Route path="/judge" element={<JudgeLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<JudgeDashboard />} />

        <Route path="projects" element={<Projects />} />

        <Route
          path="projects/:projectId"
          element={<ProjectDetails />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/judge/dashboard" replace />}
      />
    </Routes>
  );
}

export default JudgeRoutes;