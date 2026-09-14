import { Routes, Route } from 'react-router-dom'
import App from './App'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'
import ProtectedRoute from './auth/ProtectedRoute'
import ApplicantRoute from './auth/ApplicantRoute'
import AdminRoute from './auth/AdminRoute'
import RegistrationsAdminRoute from './auth/RegistrationsAdminRoute'
import RegionalRepRoute from './auth/RegionalRepRoute'
import DashboardLayout from './dashboard/DashboardLayout'
import SubmissionLayout, { ConventionLayout } from './dashboard/SubmissionLayout'
import OverviewPage from './dashboard/pages/OverviewPage'
import EntriesListPage from './dashboard/pages/EntriesListPage'
import NewEntryPage from './dashboard/pages/NewEntryPage'
import EntryEditorPage from './dashboard/pages/EntryEditorPage'
import ProfilePage from './dashboard/pages/ProfilePage'
import ReviewQueuePage from './dashboard/pages/ReviewQueuePage'
import ReviewEntryPage from './dashboard/pages/ReviewEntryPage'
import SummaryPage from './dashboard/pages/SummaryPage'
import ReviewerAdminPage from './dashboard/pages/ReviewerAdminPage'
import AdminAccessPage from './dashboard/pages/AdminAccessPage'
import ScoringQueuePage from './dashboard/pages/ScoringQueuePage'
import ScoringEntryPage from './dashboard/pages/ScoringEntryPage'
import AssessorAdminPage from './dashboard/pages/AssessorAdminPage'
import ScoringResultsPage from './dashboard/pages/ScoringResultsPage'
import FinalsQueuePage from './dashboard/pages/FinalsQueuePage'
import FinalsBracketPage from './dashboard/pages/FinalsBracketPage'
import AdjudicatorAdminPage from './dashboard/pages/AdjudicatorAdminPage'
import FinalsResultsPage from './dashboard/pages/FinalsResultsPage'
import FinalistRosterPage from './dashboard/pages/FinalistRosterPage'
import ConventionPage from './dashboard/pages/ConventionPage'
import NewRegistrationPage from './dashboard/pages/NewRegistrationPage'
import RegistrationDetailPage from './dashboard/pages/RegistrationDetailPage'
import TourPickerPage from './dashboard/pages/TourPickerPage'
import AdminRegistrationsPage from './dashboard/pages/AdminRegistrationsPage'
import AdminRegistrationDetailPage from './dashboard/pages/AdminRegistrationDetailPage'
import RegionalDelegatesPage from './dashboard/pages/RegionalDelegatesPage'
import RegionalAllocationsPage from './dashboard/pages/RegionalAllocationsPage'

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
        {/* Scoring an entry is a focused, full-screen task (its own shell, no dashboard
            chrome) — opened in a new tab from the scoring queue. Role-gated in-page. */}
        <Route path="/scoring/:id" element={<ScoringEntryPage />} />

        {/* Ranking a bracket's finalists is likewise a focused, full-screen task — the adjudicator
            orders the whole field in one sitting, so it gets its own shell. Role-gated in-page. */}
        <Route path="/finals/:categoryNumber/:bracket" element={<FinalsBracketPage />} />

        {/* The submission flow lives outside the dashboard in a focused shell —
            composing an entry is an application, not a dashboard page. It's
            applicant-only: pure reviewers are bounced to their review queue. */}
        <Route element={<ApplicantRoute />}>
          <Route element={<SubmissionLayout />}>
            <Route path="/entries/new" element={<NewEntryPage />} />
            <Route path="/entries/:id" element={<EntryEditorPage />} />
          </Route>
        </Route>

        {/* Convention booking, outside the dashboard chrome. Signed in still — a booking
            belongs to an account so the payer can come back to it — just not buried. */}
        <Route element={<ConventionLayout />}>
          <Route path="/convention/register" element={<NewRegistrationPage />} />
          {/* Same wizard, resuming a saved draft. */}
          <Route path="/convention/register/:id" element={<NewRegistrationPage />} />
          <Route path="/convention/registrations/:id" element={<RegistrationDetailPage />} />
          {/* The tour picker earns a route rather than a dialog: the six posters carry the
              itineraries and inclusions, and they have to be big enough to read. */}
          <Route path="/convention/registrations/:id/tours/:delegateId" element={<TourPickerPage />} />
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route element={<ApplicantRoute />}>
            <Route path="entries" element={<EntriesListPage />} />
          </Route>
          <Route path="summary" element={<SummaryPage />} />
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="review/:id" element={<ReviewEntryPage />} />
          <Route path="scoring" element={<ScoringQueuePage />} />
          <Route path="finals" element={<FinalsQueuePage />} />

          {/* The convention landing stays in the dashboard — it's where a member finds the
              thing. Booking and paying happen in their own shell (below): registering a
              delegation is a task, not a dashboard page, and half the people doing it are
              not members browsing a dashboard at all. */}
          <Route path="convention" element={<ConventionPage />} />
          {/* The representative's own allocation page. Role-gated at the route; whether they
              have actually been given a region is a question for the page, which explains it. */}
          <Route element={<RegionalRepRoute />}>
            <Route path="regional" element={<RegionalDelegatesPage />} />
          </Route>
          <Route element={<RegistrationsAdminRoute />}>
            <Route path="admin/registrations" element={<AdminRegistrationsPage />} />
            <Route path="admin/registrations/:id" element={<AdminRegistrationDetailPage />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="admin/reviewers" element={<ReviewerAdminPage />} />
            <Route path="admin/assessors" element={<AssessorAdminPage />} />
            <Route path="admin/scoring" element={<ScoringResultsPage />} />
            <Route path="admin/adjudicators" element={<AdjudicatorAdminPage />} />
            <Route path="admin/finals" element={<FinalsResultsPage />} />
            <Route path="admin/finalists" element={<FinalistRosterPage />} />
            <Route path="admin/access" element={<AdminAccessPage />} />
            <Route path="admin/regional" element={<RegionalAllocationsPage />} />
          </Route>
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/*" element={<App />} />
    </Routes>
  )
}
