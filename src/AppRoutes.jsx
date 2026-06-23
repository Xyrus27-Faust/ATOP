import { Routes, Route } from 'react-router-dom'
import App from './App'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'

// Auth pages are real routes (the email verification link points at
// /verify-email). The existing marketing SPA stays untouched under the /*
// catch-all, keeping its own currentPage-based navigation.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/*" element={<App />} />
    </Routes>
  )
}
