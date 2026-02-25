import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/servers', label: 'Servers', icon: '🖥️' },
  { to: '/admin/document-types', label: 'Document Types', icon: '🧾' },
  { to: '/admin/crawlers', label: 'Crawlers', icon: '🕸️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' }
];

export default function Sidebar({ isOpen = false, onNavigate = () => {} }) {
  return (
    <aside className={`admin-sidebar ${isOpen ? 'admin-sidebar--open' : ''}`}>
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__brand-icon">🔦</span>
        <span>Beacon Admin</span>
      </div>

      <nav className="admin-nav" aria-label="Admin Navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `admin-nav__link ${isActive ? 'admin-nav__link--active' : ''}`
            }
            onClick={onNavigate}
          >
            <span className="admin-nav__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
