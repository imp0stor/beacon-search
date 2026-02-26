import React from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute, useAuth } from '@strangesignal/nostr-auth';

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <ProtectedRoute
      requiredRole="admin"
      fallback={isAuthenticated && !isAdmin ? <Navigate to="/search" replace /> : <Navigate to="/admin/login" replace />}
    >
      {children}
    </ProtectedRoute>
  );
}
