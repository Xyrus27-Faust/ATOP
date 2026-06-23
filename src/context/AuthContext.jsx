import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('atop_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    const initGoogle = () => {
      if (window.google) {
        setIsGoogleLoaded(true);
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        
        if (clientId && clientId !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
          });
        }
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
      
      // Cleanup script tag on unmount
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, []);

  // Decode JWT ID Token in pure JavaScript without external libraries
  const decodeJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT decoding failed:", e);
      return null;
    }
  };

  const handleCredentialResponse = (response) => {
    const payload = decodeJwt(response.credential);
    if (payload) {
      // The profile payload contains: name, email, picture, given_name, family_name, sub (unique ID), etc.
      setUser(payload);
      localStorage.setItem('atop_user', JSON.stringify(payload));
    }
  };

  const loginWithMock = (mockUser) => {
    setUser(mockUser);
    localStorage.setItem('atop_user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('atop_user');
  };

  // Re-initialize Google dynamic sign-in button if container references change
  const initializeGoogleButton = (elementId, options = {}) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
    if (window.google && isGoogleLoaded && clientId && clientId !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
      const element = document.getElementById(elementId);
      if (element) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(element, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          ...options
        });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isGoogleLoaded, logout, loginWithMock, initializeGoogleButton }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
