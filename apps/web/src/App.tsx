import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminOnlyRoute, PermissionRoute } from './auth/PermissionRoute'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { AuditLogPage } from './pages/AuditLogPage'
import { BookingsPage } from './pages/BookingsPage'
import { TrainingPlanPage } from './pages/TrainingPlanPage'
import { CoursesPage } from './pages/CoursesPage'
import { FstdsPage } from './pages/FstdsPage'
import { HelpPage } from './pages/HelpPage'
import { InventoryPage } from './pages/InventoryPage'
import { IsmsPage } from './pages/IsmsPage'
import { KioskPage } from './pages/KioskPage'
import { LoginPage } from './pages/LoginPage'
import { ManagementSystemPage } from './pages/ManagementSystemPage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { RegisterPage } from './pages/RegisterPage'
import { StudentsPage } from './pages/StudentsPage'
import { UsersPage } from './pages/UsersPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/organizations" replace />} />
          <Route element={<PermissionRoute permission="ORGANIZATION" />}>
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
          </Route>
          <Route element={<PermissionRoute permission="MANAGEMENT_SYSTEM" />}>
            <Route path="/management-system" element={<ManagementSystemPage />} />
          </Route>
          <Route element={<PermissionRoute permission="FSTD" />}>
            <Route path="/fstds" element={<FstdsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="INVENTORY" />}>
            <Route path="/inventory" element={<InventoryPage />} />
          </Route>
          <Route element={<PermissionRoute permission="PERSONNEL" />}>
            <Route path="/personnel" element={<PersonnelPage />} />
          </Route>
          <Route element={<PermissionRoute permission="COURSES" />}>
            <Route path="/courses" element={<CoursesPage />} />
          </Route>
          <Route element={<PermissionRoute permission="STUDENTS" />}>
            <Route path="/students" element={<StudentsPage />} />
          </Route>
          <Route element={<PermissionRoute permission="SCHEDULING" />}>
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/training-plan" element={<TrainingPlanPage />} />
          </Route>
          {/* Kiosk故障报告面向任何在场人员开放, 不受模块权限限制, 与后端 @SkipPermissionCheck() 一致 */}
          <Route path="/kiosk" element={<KioskPage />} />
          <Route element={<PermissionRoute permission="ISMS" />}>
            <Route path="/isms" element={<IsmsPage />} />
          </Route>
          {/* 帮助页面向所有登录账户开放, 不受模块权限限制 */}
          <Route path="/help" element={<HelpPage />} />
          <Route element={<AdminOnlyRoute />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
