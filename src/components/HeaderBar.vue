<template>
  <header class="header-bar">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#20232b" />
        <path d="M18 20h18a8 8 0 0 1 8 8v16H26a8 8 0 0 1-8-8V20Z" fill="#e8b84b" />
        <path d="M28 24h18v20a8 8 0 0 1-8 8H28V24Z" fill="#5b9cf6" fill-opacity=".92" />
        <path d="M24 18h16a6 6 0 0 1 6 6v4H30a6 6 0 0 1-6-6v-4Z" fill="#4db887" />
      </svg>
      <div class="brand-copy">
        <strong>jsonata.workbench</strong>
        <span>Vue/Vite migration shell</span>
      </div>
    </div>

    <div class="actions">
      <a class="action" href="./jsonata-demo-workspace.json" download>Download Demo Workspace</a>
      <a class="action" href="./legacy/workbench-legacy.html" target="_blank" rel="noreferrer">Open Legacy Workbench</a>
    </div>
  </header>
</template>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9));
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-copy strong {
  font: 700 13px/1.1 'JetBrains Mono', monospace;
  color: #f8fafc;
}

.brand-copy span {
  font: 500 11px/1.2 Inter, system-ui, sans-serif;
  color: #94a3b8;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.action {
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 999px;
  padding: 8px 12px;
  color: #cbd5e1;
  text-decoration: none;
  font: 600 12px/1 Inter, system-ui, sans-serif;
}

.action:hover {
  border-color: rgba(232, 184, 75, 0.55);
  color: #fff;
}
</style>
