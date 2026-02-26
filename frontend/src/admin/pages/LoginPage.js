import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SignInButton, useAuth } from '@strangesignal/nostr-auth';
import { authEventToToken } from '../authConfig';

export default function LoginPage() {
  const { isAuthenticated, isAdmin, signInWithToken } = useAuth();
  const [error, setError] = useState('');

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleAuthEvent = async (authEvent) => {
    setError('');

    try {
      const token = await authEventToToken(authEvent);
      signInWithToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate with Nostr');
    }
  };

  return (
    <div className="admin-login" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        <h1>Beacon Admin Login</h1>
        <p className="panel-subtitle">Sign in with your Nostr key to access the admin console.</p>

        <SignInButton onAuthEvent={handleAuthEvent} className="admin-btn admin-btn--primary" />

        {error && (
          <p style={{ marginTop: '12px', color: '#f87171' }} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
