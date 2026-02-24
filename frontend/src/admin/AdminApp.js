import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminLayout from './components/AdminLayout';
import DashboardHome from './pages/DashboardHome';
import SourcesManagement from './pages/SourcesManagement';
import DocumentsBrowser from './pages/DocumentsBrowser';
import OntologyManager from './pages/OntologyManager';
import DictionaryEditor from './pages/DictionaryEditor';
import TriggersEditor from './pages/TriggersEditor';
import WebhooksManager from './pages/WebhooksManager';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

import './styles/admin.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

/**
 * Beacon Search Admin Dashboard Application
 * Main entry point for the admin UI
 */
function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="admin-app">
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="sources" element={<SourcesManagement />} />
              <Route path="sources/:sourceId" element={<SourcesManagement />} />
              <Route path="documents" element={<DocumentsBrowser />} />
              <Route path="documents/:docId" element={<DocumentsBrowser />} />
              <Route path="ontology" element={<OntologyManager />} />
              <Route path="dictionary" element={<DictionaryEditor />} />
              <Route path="triggers" element={<TriggersEditor />} />
              <Route path="webhooks" element={<WebhooksManager />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default AdminApp;
