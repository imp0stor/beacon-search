import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@strangesignal/nostr-auth';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import './admin.css';

const titleMap = {
  '/admin': 'Dashboard',
  '/admin/servers': 'Servers',
  '/admin/document-types': 'Document Types',
  '/admin/crawlers': 'Crawlers',
  '/admin/settings': 'Settings'
};

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const title = useMemo(() => titleMap[location.pathname] || 'Admin Console', [location.pathname]);

  const handleSignOut = () => {
    signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-shell">
      {sidebarOpen && <div className="admin-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <section className="admin-shell__main">
        <Header
          title={title}
          user={user?.npub || user?.role || 'admin'}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onSignOut={handleSignOut}
        />

        <main className="admin-shell__content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
