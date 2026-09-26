import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { BookingsPage } from './pages/BookingsPage'
import { CoursesPage } from './pages/CoursesPage'
import { FstdsPage } from './pages/FstdsPage'
import { InventoryPage } from './pages/InventoryPage'
import { LoginPage } from './pages/LoginPage'
import { ManagementSystemPage } from './pages/ManagementSystemPage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { RegisterPage } from './pages/RegisterPage'
import { StudentsPage } from './pages/StudentsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/organizations" replace />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="/management-system" element={<ManagementSystemPage />} />
          <Route path="/fstds" element={<FstdsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/personnel" element={<PersonnelPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
