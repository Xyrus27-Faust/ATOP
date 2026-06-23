import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from './GoogleLoginButton';

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleTraditionalSubmit = (e) => {
    e.preventDefault();
    // In a full implementation, you would authenticate against your backend here.
    // For demonstration, we'll log in as a mock member.
    const mockUser = {
      name: email.split('@')[0],
      email: email,
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100&h=100',
      given_name: email.split('@')[0].toUpperCase(),
    };
    loginWithMock(mockUser);
    onClose();
  };

  const handleMockClick = () => {
    // Generate a premium developer mock account
    const mockUser = {
      name: 'Dir. Juan Dela Cruz',
      email: 'juan.delacruz@atop.gov.ph',
      picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100',
      given_name: 'Juan',
      family_name: 'Dela Cruz',
      locale: 'en',
    };
    loginWithMock(mockUser);
    onClose();
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-btn" onClick={onClose} aria-label="Close modal">
          <i className="fas fa-times"></i>
        </button>

        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-logo">
            <img src="/Untitled.png" alt="ATOP Logo" />
          </div>
          <h3>ATOP Portal Login</h3>
          <p>Sign in to access members-only directories, local codes, and program files.</p>
        </div>

        {/* Traditional Form */}
        <form onSubmit={handleTraditionalSubmit} className="traditional-login-form">
          <div className="modal-form-group">
            <label htmlFor="modal-email">Email Address</label>
            <input 
              type="email" 
              id="modal-email" 
              required 
              placeholder="name@lgu.gov.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="modal-password">Password</label>
            <input 
              type="password" 
              id="modal-password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-actions-row">
            <label className="remember-me">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
          </div>

          <button type="submit" className="btn-gold-modal w-full justify-center">
            Sign In
          </button>
        </form>

        {/* Divider */}
        <div className="modal-divider">
          <span>or sign in with</span>
        </div>

        {/* Google Authentication */}
        <div className="google-auth-container">
          <GoogleLoginButton />
        </div>

        {/* Mock/Developer Login */}
        <div className="mock-login-section">
          <button onClick={handleMockClick} className="btn-mock-login">
            <i className="fas fa-tools"></i> Fast Mock Login (Testing Only)
          </button>
        </div>
      </div>

      <style>{`
        .login-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 25, 46, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 24px;
        }

        .login-modal-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-premium);
          border: 1px solid var(--gray-200);
          border-top: 5px solid var(--gold);
          width: 100%;
          max-width: 440px;
          padding: 40px;
          position: relative;
          text-align: center;
        }

        .close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: none;
          border: none;
          font-size: 1.2rem;
          color: var(--gray-400);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .close-btn:hover {
          color: var(--navy);
        }

        .modal-header {
          margin-bottom: 24px;
        }

        .modal-logo {
          width: 60px;
          height: 60px;
          margin: 0 auto 16px;
        }

        .modal-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .modal-header h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--navy);
          text-transform: uppercase;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
        }

        .modal-header p {
          font-size: 0.8rem;
          color: var(--gray-600);
          line-height: 1.5;
        }

        .traditional-login-form {
          text-align: left;
        }

        .modal-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .modal-form-group label {
          font-family: var(--font-heading);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--navy);
        }

        .modal-form-group input {
          padding: 10px 14px;
          font-size: 0.88rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200);
          outline: none;
          background: var(--off-white);
          transition: var(--transition-fast);
        }

        .modal-form-group input:focus {
          border-color: var(--gold);
          background: var(--white);
          box-shadow: 0 0 0 3px rgba(200, 168, 75, 0.12);
        }

        .form-actions-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.76rem;
          margin-bottom: 20px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--gray-600);
          cursor: pointer;
        }

        .forgot-password {
          color: var(--gold-dark);
          font-weight: 600;
        }

        .forgot-password:hover {
          color: var(--gold);
        }

        .btn-gold-modal {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
          color: var(--white);
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 12px 24px;
          border-radius: var(--radius-sm);
          box-shadow: 0 4px 12px rgba(200, 168, 75, 0.2);
          width: 100%;
          justify-content: center;
          transition: var(--transition);
        }

        .btn-gold-modal:hover {
          background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(200, 168, 75, 0.35);
        }

        .modal-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: var(--gray-400);
          font-size: 0.7rem;
          font-family: var(--font-heading);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .modal-divider::before,
        .modal-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--gray-200);
        }

        .modal-divider::before { margin-right: 12px; }
        .modal-divider::after { margin-left: 12px; }

        .google-auth-container {
          margin-bottom: 20px;
        }

        .mock-login-section {
          border-top: 1px solid var(--gray-200);
          padding-top: 20px;
          margin-top: 16px;
        }

        .btn-mock-login {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #E0F2FE;
          color: #0369A1;
          font-size: 0.72rem;
          font-weight: 700;
          font-family: var(--font-heading);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 10px 16px;
          border-radius: var(--radius-sm);
          border: 1px solid #BAE6FD;
          width: 100%;
          justify-content: center;
          transition: var(--transition-fast);
        }

        .btn-mock-login:hover {
          background: #0284C7;
          color: var(--white);
          border-color: #0284C7;
        }

        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .animate-scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
