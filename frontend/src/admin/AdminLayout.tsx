import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const title = useMemo(() => titleMap[location.pathname] || 'Admin Console', [location.pathname]);

  const handleSignOut = () => {
    localStorage.removeItem('beacon_role');
    localStorage.removeItem('beacon_user');
    navigate('/search', { replace: true });
  };

  return (
    <div className="admin-shell">
      {sidebarOpen && <div className="admin-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      <section className="admin-shell__main">
        <Header
          title={title}
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
