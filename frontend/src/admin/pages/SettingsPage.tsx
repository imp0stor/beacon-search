import React, { useEffect, useState } from 'react';
import { fetchSystemHealth } from '../../services/adminApi.ts';

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setHealth(await fetchSystemHealth());
      } catch (err) {
        setError((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to load system settings');
      }
    })();
  }, []);

  return (
    <section className='admin-page admin-page--full'>
      <h2 className='admin-page__title'>Settings</h2>
      <p className='admin-page__subtitle'>Operational controls and environment health status.</p>
      {error ? <div className='admin-error-banner'>{error}</div> : null}
      <div className='admin-widget' style={{ marginTop: '1rem' }}>
        <div className='admin-widget__header'>
          <h3>System Health</h3>
          <span className={'admin-badge ' + (health && health.status === 'ok' ? 'admin-badge--ok' : 'admin-badge--warn')}>{(health && health.status) || 'unknown'}</span>
        </div>
        <pre className='admin-json-block'>{JSON.stringify(health || {}, null, 2)}</pre>
      </div>
    </section>
  );
}
