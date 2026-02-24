import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const IntegrationCatalog = ({ onSelect }) => {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/wizard/templates`)
      .then(res => res.json())
      .then(data => {
        setTemplates(data.templates);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading templates...</div>;

  return (
    <div className="catalog-container">
      <h2>Integration Catalog</h2>
      {Object.entries(templates).map(([category, items]) => (
        <section key={category} className="catalog-section">
          <h3>{category.toUpperCase()}</h3>
          <div className="catalog-grid">
            {items.map(t => (
              <div key={t.id} className="template-card" onClick={() => onSelect(t)}>
                <div className="template-icon">{t.icon}</div>
                <h4>{t.name}</h4>
                <p>{t.description}</p>
                <div className="template-tags">
                  {t.features.slice(0, 3).map(f => <span key={f}>{f}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default IntegrationCatalog;
