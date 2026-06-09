import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/shared/AuthProvider';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { Layout } from './components/shared/Layout';

// Pages
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import EmployeeList from './features/employees/EmployeeList';
import LeaveManagement from './features/leave/LeaveManagement';
import AttendancePage from './features/attendance/Attendance';
import DocumentsPage from './features/documents/Documents';
import SettingsPage from './features/settings/Settings';
import HolidaysPage from './features/holidays/Holidays';
import AnnouncementsPage from './features/announcements/Announcements';
import TestDashboard from './features/settings/TestDashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-slate-800 mb-2">403</h1>
                <p className="text-slate-500 mb-4">You don't have permission to access this page.</p>
                <a href="/" className="text-primary hover:underline text-sm">← Go back to Dashboard</a>
              </div>
            </div>
          } />

          {/* Protected Routes — All authenticated users */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/leave" element={<LeaveManagement />} />
              <Route path="/holidays" element={<HolidaysPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/system-tests" element={<TestDashboard />} />

              {/* Admin & HR Manager only */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER']} />}>
                <Route path="/employees" element={<EmployeeList />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
