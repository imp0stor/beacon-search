import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import UserApp from './user/UserApp';
import AdminConsole from './admin/AdminConsole';

function AdminGuard() {
  const role = localStorage.getItem('beacon_role');
  return role === 'admin' ? <AdminConsole /> : <Navigate to="/search" replace />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/search" element={<UserApp />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
