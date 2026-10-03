import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminOnlyRoute, PermissionRoute } from './auth/PermissionRoute'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { AuditLogPage } from './pages/AuditLogPage'
import { BookingsPage } from './pages/BookingsPage'
import { TrainingPlanPage } from './pages/TrainingPlanPage'
import { CoursesPage } from './pages/CoursesPage'
import { FstdsPage } from './pages/FstdsPage'
import { GroundingPage } from './pages/GroundingPage'
import { ReportsPage } from './pages/ReportsPage'
import { RosterPage } from './pages/RosterPage'
import { DutyPage } from './pages/DutyPage'
import { ChecklistConfigPage } from './pages/ChecklistConfigPage'
import { QtgPlanPage } from './pages/QtgPlanPage'
import { UpgradePage } from './pages/UpgradePage'
import { QualityInspectionsPage } from './pages/QualityInspectionsPage'
import { QualityMeetingsPage } from './pages/QualityMeetingsPage'
import { MySurveysPage, QualitySurveysPage } from './pages/QualitySurveysPage'
import { ChecklistRecordPage } from './pages/ChecklistRecordPage'
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
          {/* 我的问卷: 任何登录用户都能填写本租户已发布的问卷, 与后端 @SkipPermissionCheck() 一致 */}
          <Route path="/my-surveys" element={<MySurveysPage />} />
          <Route element={<PermissionRoute permission="MANAGEMENT_SYSTEM" />}>
            <Route path="/quality/surveys" element={<QualitySurveysPage />} />
            <Route path="/quality/trainings" element={<QualityMeetingsPage kind="training" />} />
            <Route path="/quality/meetings" element={<QualityMeetingsPage kind="meeting" />} />
            <Route path="/quality/inspections" element={<QualityInspectionsPage />} />
            <Route path="/management-system" element={<ManagementSystemPage />} />
          </Route>
          <Route element={<PermissionRoute permission="FSTD" />}>
            <Route path="/fstds" element={<FstdsPage />} />
            <Route path="/grounding" element={<GroundingPage />} />
            <Route path="/pre-flight" element={<ChecklistRecordPage type="PRE_FLIGHT" />} />
            <Route path="/post-flight" element={<ChecklistRecordPage type="POST_FLIGHT" />} />
            <Route path="/checklist-config" element={<ChecklistConfigPage />} />
            <Route path="/upgrades" element={<UpgradePage />} />
            <Route path="/qtg-plans" element={<QtgPlanPage />} />
          </Route>
          <Route element={<PermissionRoute permission={["FSTD", "INVENTORY"]} />}>
            <Route path="/reports" element={<ReportsPage />} />
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
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/duty" element={<DutyPage />} />
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
