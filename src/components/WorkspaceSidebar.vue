<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <div>
        <div class="eyebrow">Migration Preview</div>
        <h2>Workspace Tree</h2>
      </div>
      <button class="refresh" type="button" @click="$emit('refresh')">Reload</button>
    </div>

    <div class="stats" v-if="!loading && !error">
      <span>{{ stats.folders }} folders</span>
      <span>{{ stats.scripts }} scripts</span>
    </div>

    <div v-if="loading" class="status-card">Loading demo workspace…</div>
    <div v-else-if="error" class="status-card error">{{ error }}</div>
    <div v-else class="tree">
      <div
        v-for="node in rootNodes"
        :key="node.id"
        class="root-node"
      >
        <div class="root-label">
          <span class="dot" :style="{ background: node.color || '#e8b84b' }"></span>
          <strong>{{ node.name }}</strong>
        </div>

        <div class="section-list" v-if="node.type === 'folder'">
          <div
            v-for="section in getChildren(nodes, node.id)"
            :key="section.id"
            class="section"
          >
            <div class="section-title">
              <span class="folder-mark">▸</span>
              <span>{{ section.name }}</span>
            </div>
            <div class="script-list" v-if="section.type === 'folder'">
              <div
                v-for="script in getChildren(nodes, section.id)"
                :key="script.id"
                class="script"
              >
                <span class="script-mark">◈</span>
                <span>{{ script.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { WorkspaceNode } from '../types/workspace'
import { getChildren } from '../utils/workspace'

defineProps<{
  nodes: WorkspaceNode[]
  rootNodes: WorkspaceNode[]
  stats: {
    folders: number
    scripts: number
  }
  loading: boolean
  error: string | null
}>()

defineEmits<{
  refresh: []
}>()
</script>

<style scoped>
.sidebar {
  width: 320px;
  min-width: 320px;
  border-right: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.92);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 12px;
}

.eyebrow {
  font: 700 10px/1.2 Inter, system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 8px;
}

.sidebar-head h2 {
  margin: 0;
  font: 700 18px/1.2 Inter, system-ui, sans-serif;
  color: #f8fafc;
}

.refresh {
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 999px;
  background: transparent;
  color: #cbd5e1;
  padding: 8px 12px;
  font: 600 12px/1 Inter, system-ui, sans-serif;
  cursor: pointer;
}

.refresh:hover {
  border-color: rgba(232, 184, 75, 0.55);
  color: #fff;
}

.stats {
  display: flex;
  gap: 10px;
  padding: 0 18px 14px;
  color: #94a3b8;
  font: 500 12px/1.4 Inter, system-ui, sans-serif;
}

.tree {
  overflow: auto;
  padding: 4px 12px 16px;
}

.status-card {
  margin: 0 18px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.5);
  color: #cbd5e1;
  font: 500 13px/1.6 Inter, system-ui, sans-serif;
}

.status-card.error {
  color: #fca5a5;
}

.root-node + .root-node {
  margin-top: 12px;
}

.root-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.72);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex-shrink: 0;
}

.root-label strong {
  font: 700 13px/1.2 Inter, system-ui, sans-serif;
  color: #f8fafc;
}

.section-list {
  margin-top: 10px;
  padding-left: 8px;
}

.section + .section {
  margin-top: 8px;
}

.section-title,
.script {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  color: #cbd5e1;
  font: 500 12px/1.4 Inter, system-ui, sans-serif;
}

.folder-mark,
.script-mark {
  color: #64748b;
}

.script-list {
  margin-left: 14px;
}

.script {
  color: #94a3b8;
}
</style>
