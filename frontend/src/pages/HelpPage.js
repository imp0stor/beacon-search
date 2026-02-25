import React from 'react';
import './HelpPage.css';

const EXAMPLES = [
  'nostr onboarding checklist',
  'kind:30023 wallet security',
  'relay outage root cause',
  'author:fiatjaf zaps',
  'wot:trusted lightning wallets'
];

function HelpPage() {
  return (
    <main className="help-page" aria-labelledby="help-title">
      <header className="help-header">
        <h1 id="help-title">Beacon Search Help</h1>
        <p>
          Beacon combines keyword and semantic retrieval across indexed Nostr events and connected content sources.
        </p>
        <a className="help-back-link" href="/">← Back to search</a>
      </header>

      <section className="help-section">
        <h2>Search syntax</h2>
        <ul>
          <li><code>quoted phrase</code> for exact phrase matching.</li>
          <li><code>term AND term</code>, <code>term OR term</code>, <code>term NOT term</code> for boolean logic.</li>
          <li><code>tag:nostr</code>, <code>source:web</code>, <code>author:npub...</code> style filters (when indexed).</li>
          <li><code>*</code> wildcard for partial terms, e.g. <code>wallet*</code>.</li>
        </ul>
      </section>

      <section className="help-section">
        <h2>Quality score</h2>
        <p>
          Quality score is a ranking signal used for default ordering. It blends textual relevance, semantic similarity,
          source confidence, and metadata completeness. Higher score means “more likely to be useful first.”
        </p>
      </section>

      <section className="help-section">
        <h2>WoT filtering</h2>
        <p>
          Web-of-Trust filtering reduces spam/noise by prioritizing content from trusted identities and their network.
          Use WoT filters when signal quality is more important than broad recall.
        </p>
      </section>

      <section className="help-section">
        <h2>Example queries</h2>
        <div className="help-example-grid">
          {EXAMPLES.map((example) => (
            <a key={example} className="help-example" href={`/?q=${encodeURIComponent(example)}`}>
              {example}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

export default HelpPage;
