import { Routes, Route } from 'react-router-dom'
import App from './App'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'
import ProtectedRoute from './auth/ProtectedRoute'
import ApplicantRoute from './auth/ApplicantRoute'
import DashboardLayout from './dashboard/DashboardLayout'
import SubmissionLayout from './dashboard/SubmissionLayout'
import OverviewPage from './dashboard/pages/OverviewPage'
import EntriesListPage from './dashboard/pages/EntriesListPage'
import NewEntryPage from './dashboard/pages/NewEntryPage'
import EntryEditorPage from './dashboard/pages/EntryEditorPage'
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
        {/* The submission flow lives outside the dashboard in a focused shell —
            composing an entry is an application, not a dashboard page. It's
            applicant-only: pure reviewers are bounced to their review queue. */}
        <Route element={<ApplicantRoute />}>
          <Route element={<SubmissionLayout />}>
            <Route path="/entries/new" element={<NewEntryPage />} />
            <Route path="/entries/:id" element={<EntryEditorPage />} />
          </Route>
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route element={<ApplicantRoute />}>
            <Route path="entries" element={<EntriesListPage />} />
          </Route>
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="review/:id" element={<ReviewEntryPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/*" element={<App />} />
    </Routes>
  )
}
