import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function GoogleLoginButton() {
  const { isGoogleLoaded, initializeGoogleButton } = useAuth();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasClientId = clientId && clientId !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" && clientId.trim() !== "";

  useEffect(() => {
    if (isGoogleLoaded && hasClientId) {
      initializeGoogleButton('google-signin-btn-container', {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
      });
    }
  }, [isGoogleLoaded, hasClientId, initializeGoogleButton]);

  if (!hasClientId) {
    return (
      <div className="google-auth-warning">
        <div className="warning-icon"><i className="fab fa-google"></i></div>
        <div className="warning-text">
          <strong>Google Auth Not Configured</strong>
          <p>
            Add your client ID in <code>.env</code>:
            <br />
            <code>VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</code>
          </p>
        </div>
        <style>{`
          .google-auth-warning {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #F3F4F6;
            border: 1px dashed #D1D5DB;
            padding: 12px 16px;
            border-radius: var(--radius-sm);
            color: var(--gray-600);
            font-size: 0.78rem;
            text-align: left;
            margin-top: 10px;
          }
          .google-auth-warning .warning-icon {
            font-size: 1.25rem;
            color: #EF4444;
          }
          .google-auth-warning code {
            font-family: monospace;
            background: #E5E7EB;
            padding: 2px 4px;
            border-radius: 3px;
            color: #111827;
            font-size: 0.72rem;
            word-break: break-all;
          }
          .google-auth-warning strong {
            display: block;
            color: var(--navy);
            margin-bottom: 2px;
            font-weight: 700;
          }
          .google-auth-warning p {
            margin: 0;
            line-height: 1.4;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      id="google-signin-btn-container" 
      className="google-btn-wrapper"
      style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center' }} 
    />
  );
}
