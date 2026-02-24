# React Integration Snippets (Shared UI)

## 1) Import the CSS (App Entry)

**src/index.css**
```css
@import "../../../shared-ui/index.css";
```

**src/main.tsx / index.tsx**
```tsx
import "./index.css";
```

---

## 2) App Shell
```tsx
export function App() {
  return (
    <div className="ui-app">
      {/* app layout */}
    </div>
  );
}
```

---

## 3) Rail Navigation
```tsx
<nav className="ui-rail">
  <button className="ui-rail-item" data-active={true}>Dashboard</button>
  <button className="ui-rail-item">Activity</button>
</nav>
```

---

## 4) Cards + KPIs
```tsx
<section className="ui-card">
  <h2 className="ui-label">Overview</h2>
  <p className="ui-muted">Weekly totals</p>
</section>

<div className="ui-kpi">
  <div className="ui-label">Active Users</div>
  <div className="ui-highlight">2,114</div>
</div>
```

---

## 5) CTA + Buttons
```tsx
<button className="ui-cta">Create Alert</button>
<button className="ui-button">Secondary</button>
```

---

## 6) Status Pills
```tsx
<span className="ui-status" data-variant="active">Active</span>
<span className="ui-status" data-variant="pending">Pending</span>
<span className="ui-status" data-variant="unverified">Unverified</span>
```

---

## 7) Table
```tsx
<table className="ui-table">
  <thead>
    <tr>
      <th>Session</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alpha</td>
      <td><span className="ui-status" data-variant="info">Info</span></td>
    </tr>
  </tbody>
</table>
```

---

## 8) Input Fields
```tsx
<label className="ui-label" htmlFor="name">Name</label>
<input id="name" className="ui-input" placeholder="Enter name" />
```
