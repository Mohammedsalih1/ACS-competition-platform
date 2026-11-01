import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProjectPreview from "./pages/ProjectPreview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/project/project-001/preview" replace />} />

        <Route
          path="/project/:projectId/preview"
          element={<ProjectPreview />}
        />

        <Route
          path="*"
          element={<Navigate to="/project/project-001/preview" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
