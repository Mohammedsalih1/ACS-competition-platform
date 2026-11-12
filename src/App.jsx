import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleRoute from './components/common/RoleRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SubmitPage from './pages/SubmitPage';
import Forbidden from './pages/Forbidden';
import JudgeDashboard from './pages/judge/JudgeDashboard';
import Projects from './pages/judge/Projects';
import ProjectDetails from './pages/judge/ProjectDetails';
import EvaluationPage from './pages/judge/EvaluationPage';
import MyEvaluations from './pages/judge/MyEvaluations';
import CodeWorkspace from './pages/judge/CodeWorkspace';
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersPage from './pages/admin/UsersPage';
import ProjectsPage from './pages/admin/ProjectsPage';
import ProjectDetailsPage from './pages/admin/ProjectDetailsPage';
import JudgingSettingsPage from './pages/admin/JudgingSettingsPage';
import CompetitionStagesPage from './pages/admin/CompetitionStagesPage';
import './App.css';

const protectedLayout = (role) => <ProtectedRoute><RoleRoute role={role}><AppLayout /></RoleRoute></ProtectedRoute>;

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<Login />} />
    <Route path="/forbidden" element={<Forbidden />} />
    <Route path="/dashboard" element={protectedLayout('contestant')}><Route index element={<Dashboard />} /><Route path="submit" element={<SubmitPage />} /></Route>
    <Route path="/judge" element={protectedLayout('judge')}><Route index element={<JudgeDashboard />} /><Route path="dashboard" element={<Navigate to="/judge" replace />} /><Route path="projects" element={<Projects />} /><Route path="projects/:projectId" element={<ProjectDetails />} /><Route path="projects/:projectId/evaluate" element={<EvaluationPage />} /><Route path="projects/:projectId/workspace" element={<CodeWorkspace />} /><Route path="evaluations" element={<MyEvaluations />} /></Route>
    <Route path="/admin" element={protectedLayout('admin')}><Route index element={<AdminDashboard />} /><Route path="users" element={<UsersPage />} /><Route path="projects" element={<ProjectsPage />} /><Route path="projects/:projectId" element={<ProjectDetailsPage />} /><Route path="settings" element={<JudgingSettingsPage />} /><Route path="stages" element={<CompetitionStagesPage />} /></Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}
