<template>
  <div class="workbench-host">
    <div class="hdr">
      <div class="logo" onclick="goHome()">
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
      <button class="hbtn" id="themeBtn" onclick="toggleTheme()">Theme</button>
      <button class="hbtn" onclick="pickFile()">📂 Link file</button>
      <button class="hbtn" onclick="saveNow()">💾 Save</button>
      <button class="hbtn" onclick="exportFile()">Export</button>
      <button class="hbtn" onclick="importFile()">Import</button>
    </div>

    <div class="ws">
      <div class="sb">
        <div class="sbhd">
          <span class="sbtitle">Collections</span>
          <button class="sibtn" title="New Collection" onclick="openAddModal('folder',null)">📁</button>
          <button class="sibtn" title="New Script" onclick="openAddModal('script',null)">＋</button>
        </div>
        <div class="tscroll" id="tscroll"></div>
      </div>

      <div class="main" id="main">
        <div class="empty-s">
          <div class="eg">◈</div>
          <h2>Nothing open</h2>
          <p>Create a collection then add scripts inside it.</p>
          <button class="hbtn prim" onclick="openAddModal('folder',null)">New Collection</button>
        </div>
      </div>
    </div>

    <div class="ctxm" id="ctxm">
      <div class="citem" id="ctx-af" onclick="ctxDo('af')"><span class="ci">📁</span>New Subfolder</div>
      <div class="citem" id="ctx-as" onclick="ctxDo('as')"><span class="ci">＋</span>New Script</div>
      <div class="csep"></div>
      <div class="citem" onclick="ctxDo('rn')"><span class="ci">✎</span>Rename</div>
      <div class="citem danger" onclick="ctxDo('del')"><span class="ci">🗑</span>Delete</div>
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
          <button class="hbtn" onclick="closeOv()">Cancel</button>
          <button class="hbtn prim" onclick="confirmAdd()">Create</button>
        </div>
      </div>
    </div>

    <div class="overlay" id="rnOv">
      <div class="modal">
        <div class="mtitle">Rename</div>
        <div class="field"><label>Name</label><input id="rnName" /></div>
        <div class="mrow">
          <button class="hbtn" onclick="closeOv()">Cancel</button>
          <button class="hbtn prim" onclick="confirmRename()">Rename</button>
        </div>
      </div>
    </div>

    <div class="overlay" id="delOv">
      <div class="modal">
        <div class="mtitle">Delete</div>
        <div id="delMsg" style="font-size:12px;line-height:1.7;color:var(--tx2)"></div>
        <div class="mrow">
          <button class="hbtn" onclick="closeOv()">Cancel</button>
          <button class="hbtn prim" style="background:var(--err);border-color:var(--err);color:#fff" onclick="confirmDelete()">Delete</button>
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
          <button class="hbtn" onclick="closeOv()">Close</button>
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
import { onMounted } from 'vue'

import '../workbench/styles.css'
import { initWorkbench } from '../workbench/runtime.js'

onMounted(() => {
  initWorkbench()
})
</script>

<style>
#app {
  flex: 1;
  min-height: 100vh;
}

.workbench-host {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
