<template>
  <section class="frame-shell">
    <div class="frame-note">
      <h1>Current App Preserved</h1>
      <p>
        The existing workbench is currently hosted intact inside the new Vue project so build,
        deploy, and repo structure can land without changing behavior. The next migration step is
        porting the UI into Vue components one area at a time.
      </p>
    </div>

    <iframe class="frame" :src="src" title="JSONata Workbench"></iframe>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<style scoped>
.frame-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.frame-note {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
}

.frame-note h1 {
  margin: 0 0 6px;
  font: 700 16px/1.2 Inter, system-ui, sans-serif;
  color: #f8fafc;
}

.frame-note p {
  margin: 0;
  max-width: 880px;
  font: 400 13px/1.6 Inter, system-ui, sans-serif;
  color: #94a3b8;
}

.frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #111214;
}
</style>
