import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { section: 'Overview' },
  { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
  
  { section: 'Content' },
  { path: '/admin/sources', label: 'Sources', icon: '🔌' },
  { path: '/admin/documents', label: 'Documents', icon: '📄' },
  
  { section: 'Knowledge' },
  { path: '/admin/ontology', label: 'Ontology', icon: '🌳' },
  { path: '/admin/dictionary', label: 'Dictionary', icon: '📖' },
  
  { section: 'Automation' },
  { path: '/admin/triggers', label: 'Triggers', icon: '⚡' },
  { path: '/admin/webhooks', label: 'Webhooks', icon: '🔗' },
  
  { section: 'System' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="admin-layout">
      {/* Mobile Header */}
      <div className="admin-mobile-header lg:hidden fixed top-0 left-0 right-0 h-14 bg-dark-900 border-b border-dark-600 flex items-center px-4 z-50">
        <button 
          onClick={toggleSidebar}
          className="admin-btn-icon admin-btn-ghost"
        >
          ☰
        </button>
        <span className="ml-3 font-semibold text-lg">Beacon Admin</span>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <a href="/" className="admin-logo">
            <span className="admin-logo-icon">🔍</span>
            <span className="admin-logo-text">Beacon Admin</span>
          </a>
        </div>

        <nav className="admin-nav">
          {navItems.map((item, idx) => {
            if (item.section) {
              return (
                <div key={idx} className="admin-nav-section">
                  <div className="admin-nav-label">{item.section}</div>
                </div>
              );
            }

            const isActive = item.exact 
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/admin';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-4 border-t border-dark-600">
          <a 
            href="/" 
            className="admin-nav-item"
            style={{ marginBottom: 0 }}
          >
            <span className="admin-nav-icon">🏠</span>
            <span>Back to Search</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main lg:ml-0 mt-14 lg:mt-0">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
