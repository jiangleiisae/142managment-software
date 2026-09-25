import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { BookingsPage } from './pages/BookingsPage'
import { CoursesPage } from './pages/CoursesPage'
import { FstdsPage } from './pages/FstdsPage'
import { ManagementSystemPage } from './pages/ManagementSystemPage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { StudentsPage } from './pages/StudentsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/organizations" replace />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="/management-system" element={<ManagementSystemPage />} />
        <Route path="/fstds" element={<FstdsPage />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
