import { Routes, Route } from 'react-router-dom'
import App from './App'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'
import ProtectedRoute from './auth/ProtectedRoute'
import DashboardLayout from './dashboard/DashboardLayout'
import OverviewPage from './dashboard/pages/OverviewPage'
import EntriesListPage from './dashboard/pages/EntriesListPage'
import NewEntryPage from './dashboard/pages/NewEntryPage'
import EntryEditorPage from './dashboard/pages/EntryEditorPage'
import AwardCategoriesPage from './dashboard/pages/AwardCategoriesPage'
import AwardCategoryDetailPage from './dashboard/pages/AwardCategoryDetailPage'
import ProfilePage from './dashboard/pages/ProfilePage'
import ReviewQueuePage from './dashboard/pages/ReviewQueuePage'
import ReviewEntryPage from './dashboard/pages/ReviewEntryPage'

// Auth pages are real routes (the email verification link points at
// /verify-email). The authenticated dashboard lives under /dashboard, guarded
// by ProtectedRoute and framed by DashboardLayout. The existing marketing SPA
// stays untouched under the /* catch-all with its own currentPage navigation.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="entries" element={<EntriesListPage />} />
          <Route path="entries/new" element={<NewEntryPage />} />
          <Route path="entries/:id" element={<EntryEditorPage />} />
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="review/:id" element={<ReviewEntryPage />} />
          <Route path="awards" element={<AwardCategoriesPage />} />
          <Route path="awards/:number" element={<AwardCategoryDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/*" element={<App />} />
    </Routes>
  )
}
