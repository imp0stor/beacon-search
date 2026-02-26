import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NostrAuthProvider } from '@strangesignal/nostr-auth';
import App from './App';
import UserApp from './user/UserApp';
import LoginPage from './admin/pages/LoginPage';
import { nostrAuthConfig } from './admin/authConfig';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <NostrAuthProvider config={nostrAuthConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/search" element={<UserApp />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<App />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </BrowserRouter>
    </NostrAuthProvider>
  </React.StrictMode>
);
