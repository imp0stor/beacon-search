import React from 'react';

export default function Header({ onMenuToggle = () => {}, onSignOut = () => {}, title = 'Admin Console' }) {
  const role = localStorage.getItem('beacon_role') || 'admin';
  const user = localStorage.getItem('beacon_user') || role;

  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button className="admin-mobile-toggle" onClick={onMenuToggle} aria-label="Toggle admin navigation">
          ☰
        </button>
        <div>
          <h1 className="admin-header__title">{title}</h1>
          <p className="admin-header__subtitle">System configuration and ingestion controls</p>
        </div>
      </div>

      <div className="admin-header__right">
        <span className="admin-user-chip" title={`Signed in as ${user}`}>
          👤 {user}
        </span>
        <button className="admin-btn admin-btn--ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
