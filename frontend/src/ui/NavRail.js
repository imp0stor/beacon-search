import React from 'react';

export default function NavRail({ children, label = 'Primary' }) {
  return (
    <nav className="ui-rail side-nav ss-nav-rail" aria-label={label}>
      {children}
    </nav>
  );
}
