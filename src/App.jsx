import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import RoleRoute from './components/common/RoleRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SubmitPage from './pages/SubmitPage'
import Forbidden from './pages/Forbidden'
import JudgeRoutes from './routes/JudgeRoutes'
import AppLayout from './components/layout/AppLayout'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forbidden" element={<Forbidden />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="submit" element={<SubmitPage />} />
          </Route>
          <Route
            path="/judge/*"
            element={
              <RoleRoute role="judge">
                <JudgeRoutes />
              </RoleRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
export default App