<template>
  <main class="app-shell">
    <HeaderBar />
    <WorkbenchFrame src="./legacy/workbench-legacy.html" />
  </main>
</template>

<script setup lang="ts">
import HeaderBar from './components/HeaderBar.vue'
import WorkbenchFrame from './components/WorkbenchFrame.vue'
</script>

<style>
:root {
  color-scheme: dark;
  font-family: Inter, system-ui, sans-serif;
  background: #0f172a;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  min-height: 100vh;
}

body {
  background:
    radial-gradient(circle at top, rgba(91, 156, 246, 0.12), transparent 30%),
    radial-gradient(circle at right, rgba(232, 184, 75, 0.08), transparent 28%),
    #0f172a;
  color: #e2e8f0;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
