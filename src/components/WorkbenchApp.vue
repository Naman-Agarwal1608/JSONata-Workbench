<template>
  <div class="workbench-host" :class="{ 'sidebar-auto-open': sidebarOpen }">
    <div class="hdr">
      <div class="logo" @click="callRuntime('goHome')">
        <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--surf3)" />
          <path d="M18 20h18a8 8 0 0 1 8 8v16H26a8 8 0 0 1-8-8V20Z" fill="var(--acc)" />
          <path d="M28 24h18v20a8 8 0 0 1-8 8H28V24Z" fill="var(--blue)" fill-opacity=".92" />
          <path d="M24 18h16a6 6 0 0 1 6 6v4H30a6 6 0 0 1-6-6v-4Z" fill="var(--ok)" />
        </svg>
        <div>jsonata<span>.workbench</span></div>
      </div>
      <div class="hgap"></div>
      <div class="spill">
        <div class="sdot" id="sdot"></div>
        <span id="slabel">—</span>
      </div>
      <button class="hbtn" id="themeBtn" @click="callRuntime('toggleTheme')">Theme</button>
      <button class="hbtn" @click="callRuntime('pickFile')">📂 Link file</button>
      <button class="hbtn" @click="callRuntime('saveNow')">💾 Save</button>
      <button class="hbtn" @click="callRuntime('exportFile')">Export</button>
      <button class="hbtn" @click="callRuntime('importFile')">Import</button>
    </div>

    <div class="ws">
      <button
        v-if="!sidebarOpen"
        class="sb-peek"
        type="button"
        aria-label="Open collections sidebar"
        @mouseenter="sidebarOpen = true"
      >
        <span class="sb-peek-arrow">›</span>
      </button>
      <div class="sb" @mouseenter="onSidebarEnter" @mouseleave="onSidebarLeave">
        <div class="sbhd">
          <span class="sbtitle">Collections</span>
          <button
            class="sibtn"
            :title="sidebarCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'"
            :aria-label="sidebarCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'"
            @click="toggleSidebarCollapse"
          >
            {{ sidebarCollapsed ? '⇥' : '⇤' }}
          </button>
          <button class="sibtn" title="New Collection" @click="openAddModal('folder', null)">📁</button>
          <button class="sibtn" title="New Script" @click="openAddModal('script', null)">＋</button>
        </div>
        <div class="tscroll" id="tscroll"></div>
      </div>

      <div class="main" id="main">
        <div class="empty-s">
          <div class="eg">◈</div>
          <h2>Nothing open</h2>
          <p>Create a collection then add scripts inside it.</p>
          <button class="hbtn prim" @click="openAddModal('folder', null)">New Collection</button>
        </div>
      </div>
    </div>

    <div class="ctxm" id="ctxm">
      <div class="citem" id="ctx-af" @click="ctxDo('af')"><span class="ci">📁</span>New Subfolder</div>
      <div class="citem" id="ctx-as" @click="ctxDo('as')"><span class="ci">＋</span>New Script</div>
      <div class="csep"></div>
      <div class="citem" @click="ctxDo('rn')"><span class="ci">✎</span>Rename</div>
      <div class="citem danger" @click="ctxDo('del')"><span class="ci">🗑</span>Delete</div>
    </div>

    <div class="overlay" id="addOv">
      <div class="modal">
        <div class="mtitle" id="addTitle">New</div>
        <div class="field"><label>Name</label><input id="addName" /></div>
        <div class="field" id="colorField">
          <label>Color</label>
          <div class="swatches" id="swatches"></div>
        </div>
        <div class="mrow">
          <button class="hbtn" @click="callRuntime('closeOv')">Cancel</button>
          <button class="hbtn prim" @click="callRuntime('confirmAdd')">Create</button>
        </div>
      </div>
    </div>

    <div class="overlay" id="rnOv">
      <div class="modal">
        <div class="mtitle">Rename</div>
        <div class="field"><label>Name</label><input id="rnName" /></div>
        <div class="mrow">
          <button class="hbtn" @click="callRuntime('closeOv')">Cancel</button>
          <button class="hbtn prim" @click="callRuntime('confirmRename')">Rename</button>
        </div>
      </div>
    </div>

    <div class="overlay" id="delOv">
      <div class="modal">
        <div class="mtitle">Delete</div>
        <div id="delMsg" style="font-size:12px;line-height:1.7;color:var(--tx2)"></div>
        <div class="mrow">
          <button class="hbtn" @click="callRuntime('closeOv')">Cancel</button>
          <button class="hbtn prim" style="background:var(--err);border-color:var(--err);color:#fff" @click="callRuntime('confirmDelete')">Delete</button>
        </div>
      </div>
    </div>

    <div class="overlay" id="valOv">
      <div class="modal xmodal">
        <div class="xmodal-head">
          <div class="xmodal-copy">
            <div class="mtitle" id="valTitle">Value Inspector</div>
            <small id="valMeta">Read-only value preview</small>
          </div>
          <button class="hbtn" @click="callRuntime('closeOv')">Close</button>
        </div>
        <div class="xmodal-body">
          <div class="cm-wrap" id="valCM">
            <div class="cm-loading">Loading viewer…</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import '../workbench/styles.css'

let disposeWorkbench: null | (() => void) = null
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(false)
let sidebarHover = false
let lastMouseX = Number.POSITIVE_INFINITY

type RuntimeAction =
  | 'goHome'
  | 'toggleTheme'
  | 'pickFile'
  | 'saveNow'
  | 'exportFile'
  | 'importFile'
  | 'closeOv'
  | 'confirmAdd'
  | 'confirmRename'
  | 'confirmDelete'

function callRuntime(action: RuntimeAction) {
  const fn = (window as Window & Record<string, unknown>)[action]
  if (typeof fn === 'function') (fn as () => void)()
}

function openAddModal(type: 'folder' | 'script', parentId: string | null) {
  const fn = (window as Window & Record<string, unknown>).openAddModal
  if (typeof fn === 'function') (fn as (kind: 'folder' | 'script', target: string | null) => void)(type, parentId)
}

function ctxDo(action: 'af' | 'as' | 'rn' | 'del') {
  const fn = (window as Window & Record<string, unknown>).ctxDo
  if (typeof fn === 'function') (fn as (value: 'af' | 'as' | 'rn' | 'del') => void)(action)
}

function updateSidebarState(x: number) {
  lastMouseX = x
  if (!sidebarCollapsed.value) {
    sidebarOpen.value = true
    return
  }
  if (sidebarHover) {
    sidebarOpen.value = true
    return
  }
  sidebarOpen.value = x <= 18
}

function handlePointerMove(event: MouseEvent) {
  updateSidebarState(event.clientX)
}

function onSidebarEnter() {
  sidebarHover = true
  sidebarOpen.value = true
}

function onSidebarLeave() {
  sidebarHover = false
  sidebarOpen.value = lastMouseX <= 18
}

function toggleSidebarCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  sidebarOpen.value = !sidebarCollapsed.value
}

onMounted(() => {
  sidebarOpen.value = true
  window.addEventListener('mousemove', handlePointerMove)
  void import('../workbench/runtime.js').then(({ initWorkbench }) => {
    disposeWorkbench = initWorkbench()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handlePointerMove)
  disposeWorkbench?.()
  disposeWorkbench = null
})
</script>

<style>
#app {
  flex: 1;
  min-height: 100vh;
}

.workbench-host {
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workbench-host.landing-mode {
  height: auto;
  overflow: visible;
}
</style>
