import jsonata from 'jsonata'
import * as view from '@codemirror/view'
import * as state from '@codemirror/state'
import * as commands from '@codemirror/commands'
import * as language from '@codemirror/language'
import * as search from '@codemirror/search'
import * as lint from '@codemirror/lint'
import * as autocomplete from '@codemirror/autocomplete'
import * as langJson from '@codemirror/lang-json'
import * as langJavascript from '@codemirror/lang-javascript'
import * as theme from '@codemirror/theme-one-dark'
import * as langJsonata from '@jsonhero/codemirror-lang-jsonata'

let activeCleanup = null
let activeInstanceId = 0

export function initWorkbench() {
  activeCleanup?.()
  const instanceId = ++activeInstanceId
  let disposed = false
  const runtimeActions = {
    goHome,
    toggleTheme,
    pickFile,
    saveNow,
    exportFile,
    importFile,
    openAddModal,
    closeOv,
    confirmAdd,
    confirmRename,
    confirmDelete,
    ctxDo,
    runExpr,
    fmtJSON,
    minJSON,
    clearInput,
    toggleExecContext,
    pickC
  }

  function isCurrent() {
    return !disposed && instanceId === activeInstanceId
  }

  // ── JSONATA loader ────────────────────────────────────────────
  let JR = true; // jsonata ready

  // ── APP CONSTANTS / STATE ────────────────────────────────────
      const COLS = ['#e8b84b', '#e07b40', '#4db887', '#5b9cf6', '#b07ef8', '#e05252', '#38c4c4', '#f07090', '#a0d060'];
      const SK = 'jcv5';
      const THEME_KEY = `${SK}:theme`;
      const FHDB = 'jsonataCollectionsMeta';
      const FHSTORE = 'handles';
      const FHKEY = 'workspaceFile';

      function normalizeDB(raw) {
        const base = (raw && typeof raw === 'object') ? raw : {};
        return {
          nodes: Array.isArray(base.nodes) ? base.nodes : [],
          settings: {
            globalContext: typeof base.settings?.globalContext === 'string' ? base.settings.globalContext : '',
            bindings: typeof base.settings?.bindings === 'string' ? base.settings.bindings : '',
            customFunctions: typeof base.settings?.customFunctions === 'string' ? base.settings.customFunctions : ''
          }
        };
      }
      function getSettings() { return db.settings || (db.settings = { globalContext: '', bindings: '', customFunctions: '' }); }
      function hasWorkspaceContent(candidate = db) {
        return !!(candidate && Array.isArray(candidate.nodes) && candidate.nodes.length);
      }
      async function loadDefaultWorkspace() {
        try {
          const response = await fetch('./jsonata-demo-workspace.json');
          if (!response.ok) throw new Error(`Failed to load default workspace (${response.status})`);
          const parsed = normalizeDB(await response.json());
          if (!hasWorkspaceContent(parsed)) return false;
          db = parsed;
          resetWorkspaceViewState();
          renderAll();
          slabel('Demo workspace loaded');
          return true;
        } catch (e) {
          console.warn('Failed to load demo workspace:', e);
          return false;
        }
      }

      // Workspace data persisted to disk.
      let db = normalizeDB();

      // View state for the currently open workspace session.
      let activeId = null;
      let tabs = [];
      let addCtx = {};
      let ctxId = null;
      let rnId = null;
      let delId = null;
      let pickedCol = COLS[0];

      // Persistence / execution timers and file link state.
      let fh = null; // fileHandle
      let saveTimer = null;
      let runTimer = null;
      let savePromptDismissed = false;

      // Split-pane sizing state.
      let rszLeft = 50; // % width of input panel in top row
      let rszTop = 60;  // % height of top row

      // Live editor instances.
      let inputEditor = null, outputEditor = null, exprEditor = null;
      let landingContextEditor = null, landingBindingsEditor = null, landingFunctionsEditor = null;
      let inspectValueEditor = null;

      // Inspector / modal state.
      let inspectValueStore = new Map();
      let inspectValueId = null;
      let execCtxExpanded = false;
      let execCtxTab = 'values';

      // UI theme preference.
      let currentTheme = 'dark';

      // ── PERSISTENCE ───────────────────────────────────────────────
      function openMetaDB() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open(FHDB, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(FHSTORE);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      async function idbSet(key, value) {
        const dbi = await openMetaDB();
        return new Promise((resolve, reject) => {
          const tx = dbi.transaction(FHSTORE, 'readwrite');
          tx.objectStore(FHSTORE).put(value, key);
          tx.oncomplete = () => { dbi.close(); resolve(); };
          tx.onerror = () => { dbi.close(); reject(tx.error); };
        });
      }
      async function idbGet(key) {
        const dbi = await openMetaDB();
        return new Promise((resolve, reject) => {
          const tx = dbi.transaction(FHSTORE, 'readonly');
          const req = tx.objectStore(FHSTORE).get(key);
          req.onsuccess = () => { dbi.close(); resolve(req.result); };
          req.onerror = () => { dbi.close(); reject(req.error); };
        });
      }
      async function idbDelete(key) {
        const dbi = await openMetaDB();
        return new Promise((resolve, reject) => {
          const tx = dbi.transaction(FHSTORE, 'readwrite');
          tx.objectStore(FHSTORE).delete(key);
          tx.oncomplete = () => { dbi.close(); resolve(); };
          tx.onerror = () => { dbi.close(); reject(tx.error); };
        });
      }
      async function saveHandleMeta() {
        if (!fh) return;
        try {
          await idbSet(FHKEY, fh);
          localStorage.setItem(SK, JSON.stringify({ linkedFileName: fh.name || '' }));
        } catch { }
      }
      async function clearHandleMeta() {
        try {
          await idbDelete(FHKEY);
          localStorage.removeItem(SK);
        } catch { }
      }
      function resetWorkspaceViewState() {
        activeId = null;
        tabs = [];
        ctxId = null;
        rnId = null;
        delId = null;
        closeOv();
      }
      async function loadSavedHandle() {
        if (!window.indexedDB) return null;
        try { return await idbGet(FHKEY); } catch { return null; }
      }
      async function ensureHandlePermission(mode = 'readwrite', {
        request = false
      } = {}) {
        if (!fh) return false;
        try {
          let perm = await fh.queryPermission({ mode });
          if (perm === 'granted') return true;
          if (request) {
            perm = await fh.requestPermission({ mode });
            return perm === 'granted';
          }
        } catch { }
        return false;
      }
      async function readLinkedFile(handle = fh) {
        if (!handle) return false;
        try {
          const perm = await handle.queryPermission({ mode: 'read' });
          if (perm === 'denied') return false;
          const file = await handle.getFile();
          const parsed = normalizeDB(JSON.parse(await file.text()));
          if (!isCurrent()) return false;
          fh = handle;
          db = parsed;
          resetWorkspaceViewState();
          renderAll();
          savePromptDismissed = false;
          slabel('Linked · ' + handle.name);
          return true;
        } catch (e) {
          console.warn('Failed to read linked file:', e);
          return false;
        }
      }
      async function ensureFileHandle(request = true) {
        if (fh) return fh;
        if (!request && savePromptDismissed) return null;
        if (!('showSaveFilePicker' in window)) {
          alert('File System Access API needs Chrome/Edge to auto-save to disk.');
          return null;
        }
        try {
          fh = await window.showSaveFilePicker({ suggestedName: 'jsonata-workbench.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
          await saveHandleMeta();
          savePromptDismissed = false;
          slabel('Linked · ' + fh.name);
          return fh;
        } catch (e) {
          if (e.name === 'AbortError') savePromptDismissed = true;
          if (e.name !== 'AbortError') console.error(e);
          return null;
        }
      }
      async function bootPersistence() {
        try {
          const meta = JSON.parse(localStorage.getItem(SK) || '{}');
          const savedHandle = await loadSavedHandle();
          if (!isCurrent()) return;
          if (savedHandle) {
            if (await readLinkedFile(savedHandle)) {
              await saveHandleMeta();
              return;
            }
            if (!isCurrent()) return;
            fh = null;
            await clearHandleMeta();
          }
          if (!isCurrent()) return;
          if (!hasWorkspaceContent()) {
            const loadedDefault = await loadDefaultWorkspace();
            if (loadedDefault || !isCurrent()) return;
          }
          if (meta?.linkedFileName) slabel('Unlinked · ' + meta.linkedFileName);
        } catch { }
      }
      function schedSave() { sdot('busy'); clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(false), 800); }
      async function saveNow(requestHandle = true) {
        const handle = await ensureFileHandle(requestHandle);
        if (!handle) {
          sdot('');
          if (requestHandle) slabel('Save cancelled');
          else slabel('Unsaved · no file linked');
          return;
        }
        if (!await ensureHandlePermission('readwrite', { request: true })) {
          sdot('');
          slabel('Save permission denied');
          return;
        }
        try {
          const w = await handle.createWritable();
          await w.write(JSON.stringify(db, null, 2));
          await w.close();
          await saveHandleMeta();
          slabel('Saved · ' + handle.name);
          sdot('ok'); setTimeout(() => sdot(''), 2500);
        } catch (e) {
          console.error(e);
          sdot('');
          slabel('Disk save failed');
        }
      }
      async function pickFile() {
        if (!('showOpenFilePicker' in window)) {
          alert('File System Access API needs Chrome/Edge to link a workspace file.');
          return;
        }
        try {
          const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
          });
          if (!handle) return;
          if (await readLinkedFile(handle)) {
            await saveHandleMeta();
          } else {
            fh = null;
            slabel('Link failed');
            alert('Could not read that workspace file.');
          }
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e);
        }
      }
      async function exportFile() {
        if (!('showSaveFilePicker' in window)) {
          alert('File System Access API needs Chrome/Edge to export a workspace file.');
          return;
        }
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fh?.name || 'jsonata-workbench-export.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
          });
          if (!handle) return;
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(db, null, 2));
          await writable.close();
          slabel('Exported · ' + handle.name);
          sdot('ok'); setTimeout(() => sdot(''), 2500);
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error(e);
            slabel('Export failed');
          }
        }
      }
      function importFile() {
        const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
        inp.onchange = async () => {
          try {
            const file = inp.files?.[0];
            if (!file) return;
            const p = JSON.parse(await file.text());
            if (Array.isArray(p.nodes)) {
              db = normalizeDB(p);
              resetWorkspaceViewState();
              fh = null;
              savePromptDismissed = false;
              await clearHandleMeta();
              renderAll();
              slabel('Imported · unsaved');
              sdot('');
            } else alert('Invalid format.');
          } catch (e) { alert('Parse error: ' + e.message); }
        };
        inp.click();
      }
      function sdot(s) { const d = document.getElementById('sdot'); d.className = 'sdot' + (s ? ' ' + s : ''); }
      function slabel(t) { document.getElementById('slabel').textContent = t; }
      function updateThemeButton() {
        const btn = document.getElementById('themeBtn');
        if (btn) btn.textContent = currentTheme === 'light' ? '☀ Light' : '☾ Dark';
      }
      function applyTheme(theme, { rerender = true } = {}) {
        currentTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        try { localStorage.setItem(THEME_KEY, currentTheme); } catch { }
        updateThemeButton();
        if (!rerender) return;
        renderMain();
        if (inspectValueId && document.getElementById('valOv')?.classList.contains('open')) openInspectValue(inspectValueId);
      }
      function initTheme() {
        let stored = 'dark';
        try { stored = localStorage.getItem(THEME_KEY) || 'dark'; } catch { }
        applyTheme(stored, { rerender: false });
      }
      function toggleTheme() {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      }

      // ── TREE HELPERS ──────────────────────────────────────────────
      function kids(pid) {
        return db.nodes
          .filter(n => (n.parentId || null) === (pid || null))
          .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
      }
      function findNode(id) { return db.nodes.find(node => node.id === id); }
      function allDesc(id) {
        const r = []; const q = [id];
        while (q.length) { const c = q.shift(); db.nodes.filter(n => n.parentId === c).forEach(k => { r.push(k.id); q.push(k.id); }); }
        return r;
      }
      function folderColor(id) {
        const n = db.nodes.find(x => x.id === id);
        if (!n) return 'var(--tx3)';
        if (n.color) return n.color;
        if (n.parentId) return folderColor(n.parentId);
        return 'var(--tx3)';
      }
      function breadcrumb(id) {
        const parts = []; let n = db.nodes.find(x => x.id === id);
        while (n && n.parentId) { n = db.nodes.find(x => x.id === n.parentId); if (n) parts.unshift(n.name); }
        const self = db.nodes.find(x => x.id === id);
        if (self) parts.push(self.name);
        return parts.join(' › ');
      }

      function parseJSONText(raw, label, { requireObject = false } = {}) {
        if (!raw.trim()) return { ok: true, value: requireObject ? {} : {} };
        try {
          const value = JSON.parse(raw);
          if (requireObject && (value === null || Array.isArray(value) || typeof value !== 'object')) {
            return { ok: false, message: `${label} must be a JSON object.` };
          }
          return { ok: true, value };
        } catch (e) {
          return { ok: false, message: `${label}: ${e.message.split('\n')[0]}` };
        }
      }

      function getLineInfoFromOffset(text, offset) {
        const safe = Math.max(0, Math.min(text.length, offset || 0));
        let line = 1, col = 1;
        for (let i = 0; i < safe; i++) {
          if (text[i] === '\n') { line++; col = 1; }
          else col++;
        }
        return { line, column: col, offset: safe };
      }

      function getOffsetFromLineCol(text, line, column = 1) {
        const targetLine = Math.max(1, line || 1);
        const targetCol = Math.max(1, column || 1);
        let curLine = 1, idx = 0;
        while (curLine < targetLine && idx < text.length) {
          if (text[idx] === '\n') curLine++;
          idx++;
        }
        return Math.min(text.length, idx + targetCol - 1);
      }

      function formatErrorLocation(loc) {
        if (!loc || !loc.line) return '';
        return ` (line ${loc.line}, col ${loc.column || 1})`;
      }

      function extractStackLineCol(err) {
        const stack = String(err?.stack || '');
        const m = stack.match(/<anonymous>:(\d+):(\d+)/);
        if (!m) return null;
        return { line: Number(m[1]), column: Number(m[2]) };
      }

      function focusEditorLocation(view, loc, { moveCursor = false, focus = false } = {}) {
        if (!view || !loc || !loc.line) return;
        if (window._CM?.setEditorErrorLocation) window._CM.setEditorErrorLocation(view, loc);
        if (!moveCursor) return;
        const doc = view.state.doc.toString();
        const anchor = getOffsetFromLineCol(doc, loc.line, loc.column || 1);
        view.dispatch({ selection: { anchor }, scrollIntoView: true });
        if (focus) view.focus();
      }

      function clearEditorLocationHighlight(view) {
        if (view && window._CM?.clearEditorErrorLocation) window._CM.clearEditorErrorLocation(view);
      }

      function parseCustomFunctions(raw) {
        if (!raw.trim()) return { ok: true, value: [] };
        const src = raw.trim();
        const candidates = [];
        if (src.startsWith('({') || src.startsWith('{')) candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 });
        if (src.startsWith('(')) candidates.push({ code: `return \n${src};`, lineOffset: 1, colOffset: 0 });
        candidates.push({ code: `return ({\n${src}\n});`, lineOffset: 1, colOffset: 0 });
        candidates.push({ code: `return (\n${src}\n);`, lineOffset: 1, colOffset: 0 });

        let defs, lastErr = null, lastLoc = null;
        for (const candidate of candidates) {
          try {
            defs = (new Function(candidate.code))();
            lastErr = null;
            lastLoc = null;
            break;
          } catch (e) {
            lastErr = e;
            const stackLoc = extractStackLineCol(e);
            lastLoc = stackLoc ? {
              line: Math.max(1, stackLoc.line - candidate.lineOffset),
              column: stackLoc.line - candidate.lineOffset <= 1 ? Math.max(1, stackLoc.column - candidate.colOffset) : stackLoc.column
            } : null;
          }
        }
        if (lastErr) {
          return { ok: false, message: `Custom functions: ${lastErr.message}${formatErrorLocation(lastLoc)}`, location: lastLoc };
        }
        if (!defs || typeof defs !== 'object' || Array.isArray(defs)) {
          return { ok: false, message: 'Custom functions must evaluate to an object.' };
        }
        const out = [];
        for (const [key, val] of Object.entries(defs)) {
          const regName = String(key).replace(/^\$/, '');
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(regName)) {
            return { ok: false, message: `Custom functions: "${key}" is not a valid function name.` };
          }
          if (typeof val === 'function') {
            out.push({ name: regName, label: `$${regName}`, impl: val, signature: undefined, info: 'Custom workspace function' });
            continue;
          }
          if (val && typeof val === 'object' && typeof val.implementation === 'function') {
            if (val.signature !== undefined && typeof val.signature !== 'string') {
              return { ok: false, message: `Custom functions: "${key}" signature must be a string.` };
            }
            if (val.description !== undefined && typeof val.description !== 'string') {
              return { ok: false, message: `Custom functions: "${key}" description must be a string.` };
            }
            out.push({
              name: regName,
              label: `$${regName}`,
              impl: val.implementation,
              signature: val.signature,
              info: val.description || 'Custom workspace function'
            });
            continue;
          }
          return { ok: false, message: `Custom functions: "${key}" must be a function or { implementation, signature?, description? }.` };
        }
        return { ok: true, value: out };
      }

      function getCustomFunctionEntries() {
        const parsed = parseCustomFunctions(getSettings().customFunctions || '');
        return parsed.ok ? parsed.value : [];
      }

      function registerCustomFunctions(compiled, fns) {
        fns.forEach(fn => {
          compiled.assign(fn.name, fn.impl);
          if (fn.signature) compiled.registerFunction(fn.name, fn.impl, fn.signature);
        });
      }

      function getJsonataErrorLocation(err, source) {
        if (err && typeof err.position === 'number') {
          return getLineInfoFromOffset(source, Math.max(0, err.position - 1));
        }
        const msg = String(err?.message || '');
        const lineCol = msg.match(/\bline\s+(\d+)\b(?:\D+col(?:umn)?\s+(\d+))?/i);
        if (lineCol) {
          return { line: Number(lineCol[1]), column: Number(lineCol[2] || 1) };
        }
        return null;
      }

      function summariseValue(value) {
        if (value === undefined) return '(undefined)';
        if (value === null) return 'null';
        if (typeof value === 'string') return value.length > 88 ? `${JSON.stringify(value.slice(0, 88))}…` : JSON.stringify(value);
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (typeof value === 'object') {
          const keys = Object.keys(value);
          return `Object(${keys.length} keys){${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''}}`;
        }
        return JSON.stringify(value);
      }

      function getExpressionSnippet(expr, loc) {
        const lines = expr.split('\n');
        const lineNo = Math.max(1, Math.min(lines.length, loc?.line || 1));
        const start = Math.max(1, lineNo - 1);
        const end = Math.min(lines.length, lineNo + 1);
        const block = [];
        for (let i = start; i <= end; i++)block.push(`${String(i).padStart(3, ' ')} | ${lines[i - 1]}`);
        const caretPad = ' '.repeat(6 + Math.max(0, (loc?.column || 1) - 1));
        block.splice(lineNo - start + 1, 0, `${caretPad}^`);
        return block.join('\n');
      }

      function getExpressionBodyBounds(expr) {
        const trimmed = expr.trim();
        if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return { start: 0, end: expr.length };
        const start = expr.indexOf('(');
        let depth = 0, quote = null, escape = false;
        for (let i = start; i < expr.length; i++) {
          const ch = expr[i];
          if (quote) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === quote) quote = null;
            continue;
          }
          if (ch === '"' || ch === "'") { quote = ch; continue; }
          if (ch === '(') depth++;
          else if (ch === ')') {
            depth--;
            if (depth === 0) {
              const tail = expr.slice(i + 1).trim();
              if (!tail) return { start: start + 1, end: i };
              return { start: 0, end: expr.length };
            }
          }
        }
        return { start: 0, end: expr.length };
      }

      function splitTopLevelStatements(expr) {
        const { start, end } = getExpressionBodyBounds(expr);
        const body = expr.slice(start, end);
        const out = [];
        let quote = null, escape = false, paren = 0, brace = 0, bracket = 0, last = 0;
        for (let i = 0; i < body.length; i++) {
          const ch = body[i];
          if (quote) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === quote) quote = null;
            continue;
          }
          if (ch === '"' || ch === "'") { quote = ch; continue; }
          if (ch === '(') paren++;
          else if (ch === ')' && paren > 0) paren--;
          else if (ch === '{') brace++;
          else if (ch === '}' && brace > 0) brace--;
          else if (ch === '[') bracket++;
          else if (ch === ']' && bracket > 0) bracket--;
          else if (ch === ';' && paren === 0 && brace === 0 && bracket === 0) {
            const raw = body.slice(last, i);
            if (raw.trim()) {
              const startOffset = start + last;
              const endOffset = start + i;
              out.push({
                text: raw.trim(),
                startOffset,
                endOffset,
                startLine: getLineInfoFromOffset(expr, startOffset).line,
                endLine: getLineInfoFromOffset(expr, endOffset).line
              });
            }
            last = i + 1;
          }
        }
        const tail = body.slice(last);
        if (tail.trim()) {
          const startOffset = start + last;
          const endOffset = start + body.length;
          out.push({
            text: tail.trim(),
            startOffset,
            endOffset,
            startLine: getLineInfoFromOffset(expr, startOffset).line,
            endLine: getLineInfoFromOffset(expr, endOffset).line
          });
        }
        return out;
      }

      async function getVariableSnapshots(expr, loc, data, bindings, customFns) {
        const statements = splitTopLevelStatements(expr);
        const snapshots = [];
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          if (stmt.endLine >= (loc?.line || Infinity)) break;
          const match = stmt.text.match(/^\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s*:=\s*([\s\S]+)$/);
          if (!match) continue;
          const varName = match[1];
          const prefix = statements.slice(0, i + 1).map(s => s.text).join(';\n');
          try {
            const compiled = jsonata(`(\n${prefix};\n${varName}\n)`);
            registerCustomFunctions(compiled, customFns);
            const value = await compiled.evaluate(data, bindings);
            snapshots.push({ name: varName, value, line: stmt.startLine });
            if (snapshots.length >= 8) break;
          } catch { }
        }
        return snapshots;
      }

      async function buildExecutionContext({ expr, data = {}, bindings, customFns, functionsError, error = null, location = null, resultValue = undefined }) {
        const effectiveLoc = location || null;
        let variableSnapshots = [];
        try {
          variableSnapshots = await getVariableSnapshots(expr, effectiveLoc, data, bindings || {}, customFns || []);
        } catch (e) {
          console.error('Variable snapshot build failed:', e);
        }
        return {
          status: error ? 'error' : 'ok',
          message: error ? (error.message || String(error)) : '',
          location: effectiveLoc,
          snippet: effectiveLoc ? getExpressionSnippet(expr, effectiveLoc) : '',
          variableSnapshots,
          resultValue,
          bindings: Object.keys(bindings || {}),
          customFunctions: (customFns || []).map(fn => ({ label: fn.label, info: fn.info || 'Custom workspace function' })),
          functionsError: functionsError?.ok === false ? functionsError.message : ''
        };
      }

      function updateExecContextUI(ctx) {
        const shell = document.getElementById('ctxshell');
        const body = document.getElementById('errctx');
        const meta = document.getElementById('ctxMeta');
        if (!shell || !body || !meta) return;
        shell.classList.toggle('expanded', !!execCtxExpanded);
        body.classList.toggle('open', !!execCtxExpanded);
        if (!ctx) {
          meta.textContent = execCtxExpanded ? 'No execution yet' : 'Collapsed';
          return;
        }
        if (ctx.status === 'error' && ctx.location) meta.textContent = `Failed at line ${ctx.location.line}, col ${ctx.location.column || 1}`;
        else if (ctx.status === 'error') meta.textContent = 'Execution failed';
        else meta.textContent = (ctx.variableSnapshots?.length || ctx.resultValue !== undefined)
          ? `${ctx.variableSnapshots.length + (ctx.resultValue !== undefined ? 1 : 0)} value${(ctx.variableSnapshots.length + (ctx.resultValue !== undefined ? 1 : 0)) === 1 ? '' : 's'}`
          : 'No values resolved';
      }

      function toggleExecContext(force) {
        execCtxExpanded = typeof force === 'boolean' ? force : !execCtxExpanded;
        updateExecContextUI(window.__lastExecContext || null);
      }

      function setExecContextTab(tab) {
        execCtxTab = tab || 'values';
        renderErrorContext(window.__lastExecContext || null);
      }

      function renderErrorContext(ctx) {
        const root = document.getElementById('errctx');
        if (!root) return;
        window.__lastExecContext = ctx || null;
        inspectValueStore = new Map();
        if (!ctx) {
          root.innerHTML = '<div class="errctx-grid"><section class="errctx-card"><div class="errctx-head">Inspector</div><div class="errctx-body"><div class="errctx-item"><small>Run an expression to inspect resolved values, scope, and error details.</small></div></div></section></div>';
          updateExecContextUI(null);
          return;
        }
        const mkValueItem = (label, value, meta) => {
          const id = uid();
          inspectValueStore.set(id, { label, value, meta });
          return `
      <button class="errctx-item clickable" data-inspect-id="${id}" type="button">
        <strong><code>${esc(label)}</code></strong>
        <small>${esc(summariseValue(value))}${meta ? ` · ${esc(meta)}` : ''}</small>
      </button>
    `;
        };
        const resultValue = ctx.resultValue !== undefined ? mkValueItem('$result', ctx.resultValue, ctx.status === 'error' ? 'last computed result' : 'expression result') : '';
        const variableSnapshots = ctx.variableSnapshots?.length ? ctx.variableSnapshots.map(v => mkValueItem(v.name, v.value, `line ${v.line}`)).join('') : '<div class="errctx-item"><small>No prior top-level variable values could be resolved.</small></div>';
        const bindings = ctx.bindings.length ? ctx.bindings.map(name => `<div class="errctx-item"><code>$${esc(name)}</code></div>`).join('') : '<div class="errctx-item"><small>No bindings provided.</small></div>';
        const customFns = ctx.customFunctions.length ? ctx.customFunctions.map(fn => `<div class="errctx-item"><strong><code>${esc(fn.label)}</code></strong><small>${esc(fn.info)}</small></div>`).join('') : '<div class="errctx-item"><small>No custom functions registered.</small></div>';
        const activeTab = ['values', 'scope', 'functions'].includes(execCtxTab) ? execCtxTab : 'values';
        const errorBlock = ctx.status === 'error' ? `
      <section class="errctx-card">
        <div class="errctx-head">Execution Failure</div>
        <div class="errctx-body">
          <div class="errctx-row"><span class="errctx-k">Location</span><span class="errctx-v">${ctx.location ? `line ${ctx.location.line}, col ${ctx.location.column || 1}` : 'Unknown'}</span></div>
          <div class="errctx-item"><small>${esc(ctx.message || 'Execution failed')}</small></div>
          ${ctx.snippet ? `<pre class="errctx-pre">${esc(ctx.snippet)}</pre>` : ''}
        </div>
      </section>` : '';
        root.innerHTML = `
    <div class="errctx-tabs">
      <button class="errctx-tab ${activeTab === 'values' ? 'active' : ''}" type="button" data-ctx-tab="values">Execution Context</button>
      <button class="errctx-tab ${activeTab === 'scope' ? 'active' : ''}" type="button" data-ctx-tab="scope">Available Scope</button>
      <button class="errctx-tab ${activeTab === 'functions' ? 'active' : ''}" type="button" data-ctx-tab="functions">Custom Functions</button>
    </div>
    <div class="errctx-panel ${activeTab === 'values' ? 'active' : ''}">
      <div class="errctx-grid">
        ${errorBlock}
        <section class="errctx-card">
          <div class="errctx-head">Resolved Values</div>
          <div class="errctx-body errctx-list">${resultValue || ''}${variableSnapshots}</div>
        </section>
      </div>
    </div>
    <div class="errctx-panel ${activeTab === 'scope' ? 'active' : ''}">
      <div class="errctx-grid">
        <section class="errctx-card">
          <div class="errctx-head">Available Scope</div>
          <div class="errctx-body">
            <div class="errctx-list">${bindings}</div>
            ${ctx.functionsError ? `<div class="errctx-item"><small>${esc(ctx.functionsError)}</small></div>` : ''}
          </div>
        </section>
      </div>
    </div>
    <div class="errctx-panel ${activeTab === 'functions' ? 'active' : ''}">
      <div class="errctx-grid">
        <section class="errctx-card">
          <div class="errctx-head">Custom Functions</div>
          <div class="errctx-body">
            <div class="errctx-list">${customFns}</div>
          </div>
        </section>
      </div>
    </div>`;
        root.querySelectorAll('[data-ctx-tab]').forEach(el => {
          el.addEventListener('click', () => setExecContextTab(el.getAttribute('data-ctx-tab')));
        });
        root.querySelectorAll('[data-inspect-id]').forEach(el => {
          el.addEventListener('click', () => openInspectValue(el.getAttribute('data-inspect-id')));
        });
        if (ctx.status === 'error') execCtxExpanded = true;
        updateExecContextUI(ctx);
      }

      // ── RENDER ALL ────────────────────────────────────────────────
      function renderAll() { renderTree(); renderMain(); }

      // ── RENDER TREE ───────────────────────────────────────────────
      function renderTree() {
        const sc = document.getElementById('tscroll');
        const roots = kids(null);
        if (!roots.length) {
          sc.innerHTML = '<div style="padding:18px 14px;font-size:11px;color:var(--tx3);line-height:2">No collections yet.<br>Click 📁 above to create one.</div>';
          return;
        }
        sc.innerHTML = '';
        roots.forEach(n => sc.appendChild(buildNode(n, 0)));
      }

      function buildNode(node, depth) {
        const wrap = document.createElement('div');
        wrap.className = 'tnode';

        const row = document.createElement('div');
        row.className = 'trow' + (node.id === activeId ? ' active' : '');
        row.style.paddingLeft = (depth * 13 + 4) + 'px';

        // caret
        const caret = document.createElement('div');
        caret.className = 'tcaret' + (node.type === 'script' ? ' invis' : (node.open ? ' open' : ''));
        caret.textContent = '▶';

        // icon
        const icon = document.createElement('div');
        if (node.type === 'folder') {
          icon.className = 'tfoldericon';
          icon.style.setProperty('--fc', node.color || folderColor(node.id));
        } else {
          icon.className = 'tscripticon';
          icon.textContent = '◈';
        }

        // label
        const lbl = document.createElement('div');
        lbl.className = 'tlabel';
        lbl.textContent = node.name;

        // actions (show on hover via CSS)
        const acts = document.createElement('div');
        acts.className = 'tacts';
        if (node.type === 'folder') {
          acts.appendChild(mkAct('📁', 'New subfolder', () => openAddModal('folder', node.id)));
          acts.appendChild(mkAct('＋', 'New script', () => openAddModal('script', node.id)));
        }
        acts.appendChild(mkAct('✎', 'Rename', () => openRename(node.id)));
        const d = mkAct('✕', 'Delete', () => openDeleteModal(node.id)); d.classList.add('del'); acts.appendChild(d);

        row.append(caret, icon, lbl, acts);
        row.addEventListener('click', e => {
          if (e.target.closest('.tacts')) return;
          if (node.type === 'folder') toggleFolder(node.id);
          else openScript(node.id);
        });
        row.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e, node.id); });
        wrap.appendChild(row);

        if (node.type === 'folder') {
          const ch = document.createElement('div');
          ch.className = 'tchildren' + (node.open ? ' open' : '');
          const children = kids(node.id);
          if (children.length) {
            children.forEach(c => ch.appendChild(buildNode(c, depth + 1)));
          } else {
            const dz = document.createElement('div');
            dz.className = 'tempty';
            dz.style.paddingLeft = ((depth + 1) * 13 + 20) + 'px';
            dz.textContent = '+ New Script';
            dz.onclick = () => openAddModal('script', node.id);
            ch.appendChild(dz);
          }
          wrap.appendChild(ch);
        }
        return wrap;
      }

      function mkAct(ico, title, fn) {
        const b = document.createElement('button');
        b.className = 'tact'; b.title = title; b.textContent = ico;
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        return b;
      }

      function toggleFolder(id) {
        const n = db.nodes.find(x => x.id === id);
        if (n) { n.open = !n.open; renderTree(); schedSave(); }
      }

      // ── SCRIPT / TABS ─────────────────────────────────────────────
      function openScript(id) {
        activeId = id;
        if (!tabs.includes(id)) tabs.push(id);
        renderTree();
        renderMain();
      }

      function closeTab(id, e) {
        if (e) e.stopPropagation();
        tabs = tabs.filter(t => t !== id);
        if (activeId === id) activeId = tabs[tabs.length - 1] || null;
        renderMain(); renderTree();
      }

      function destroyScriptEditors() {
        if (inputEditor) { inputEditor.destroy(); inputEditor = null; }
        if (outputEditor) { outputEditor.destroy(); outputEditor = null; }
        if (exprEditor) { exprEditor.destroy(); exprEditor = null; }
      }

      function destroyLandingEditors() {
        if (landingContextEditor) { landingContextEditor.destroy(); landingContextEditor = null; }
        if (landingBindingsEditor) { landingBindingsEditor.destroy(); landingBindingsEditor = null; }
        if (landingFunctionsEditor) { landingFunctionsEditor.destroy(); landingFunctionsEditor = null; }
      }

      function destroyInspectValueEditor() {
        if (inspectValueEditor) { inspectValueEditor.destroy(); inspectValueEditor = null; }
      }

      function renderLandingView() {
        return `
      <div class="landing">
        <div class="landing-hero">
          <div class="landing-copy">
            <div class="landing-kicker">Workspace</div>
            <h2>Configure shared JSONata execution data.</h2>
            <p>These values apply across the workspace. Global context is used whenever a script's Input JSON is empty. Bindings are passed as JSONata variables and can be referenced as <code>$name</code> inside expressions.</p>
            <div class="landing-actions">
              <button class="hbtn prim" onclick="openAddModal('folder',null)">New Collection</button>
              <button class="hbtn" onclick="importFile()">Import Workspace</button>
            </div>
          </div>
        </div>
        <div class="landing-top">
          <section class="landing-card context">
            <div class="landing-card-body">
              <div class="landing-label">Global Context</div>
              <h3>Default input document</h3>
              <p>Use this for shared sample data or a reusable context object. Per-script Input JSON overrides it.</p>
            </div>
            <div class="landing-editor-shell">
              <div class="landing-panel">
                <div class="phead">
                  <span class="ptitle">Global Context</span>
                  <span class="pbadge">JSON</span>
                </div>
                <div class="cm-wrap" id="globalContextCM"><div class="cm-loading">Loading editor…</div></div>
              </div>
              <div class="landing-foot">
                <span class="landing-note">Accepts any valid JSON value.</span>
                <span class="landing-err" id="globalContextErr"></span>
              </div>
            </div>
          </section>
          <section class="landing-card bindings">
            <div class="landing-card-body">
              <div class="landing-label">Bindings</div>
              <h3>Shared variables</h3>
              <p>Provide a JSON object of variables. For example, <code>{"limit": 3}</code> becomes available as <code>$limit</code>.</p>
            </div>
            <div class="landing-editor-shell">
              <div class="landing-panel">
                <div class="phead">
                  <span class="ptitle">Bindings</span>
                  <span class="pbadge">JSON</span>
                </div>
                <div class="cm-wrap" id="bindingsCM"><div class="cm-loading">Loading editor…</div></div>
              </div>
              <div class="landing-foot">
                <span class="landing-note">Must be a JSON object.</span>
                <span class="landing-err" id="bindingsErr"></span>
              </div>
            </div>
          </section>
        </div>
        <section class="landing-card functions">
          <div class="landing-card-body">
            <div class="landing-label">Custom Functions</div>
            <h3>Reusable JSONata extensions</h3>
            <p>Define JavaScript functions once and use them in any script as <code>$name()</code>. Export an object whose keys are function names.</p>
          </div>
          <div class="landing-editor-shell">
            <div class="landing-panel">
              <div class="phead">
                <span class="ptitle">Custom Functions</span>
                <span class="pbadge">JS</span>
              </div>
              <div class="cm-wrap" id="functionsCM"><div class="cm-loading">Loading editor…</div></div>
            </div>
            <div class="landing-foot">
              <span class="landing-note">Example: <code>({ slug: (s) => String(s).toLowerCase() })</code></span>
              <span class="landing-err" id="functionsErr"></span>
            </div>
          </div>
        </section>
      </div>`;
      }

      function renderWorkspaceView(node) {
        return `
    <div class="tabbar" id="tabbar"></div>
    <div class="editor">
      <div class="etoolbar">
        <input class="ename" id="ename" value="${esc(node.name)}" placeholder="Untitled" />
        <span class="bctag" title="${esc(breadcrumb(node.id))}">${esc(breadcrumb(node.id))}</span>
        <button class="hbtn prim" onclick="runExpr()">▶ Run <small style="opacity:.55;font-size:10px">⌘↵</small></button>
      </div>
      <div class="panels">
        <div class="panels-top" id="panelsTop">
          <div class="panel" id="panelInput">
            <div class="phead">
              <span class="ptitle">Input JSON</span>
              <span id="jerr" class="jerr"></span>
            </div>
            <div class="jtoolbar">
              <button class="jbtn" onclick="fmtJSON()">Format</button>
              <button class="jbtn" onclick="minJSON()">Minify</button>
              <button class="jbtn" onclick="clearInput()">Clear</button>
            </div>
            <div class="cm-wrap" id="inputCM"><div class="cm-loading">Loading editor…</div></div>
          </div>
          <div class="rsz-h" id="hrsz"></div>
          <div class="panel" id="panelExpr">
            <div class="phead">
              <span class="ptitle">Expression</span>
              <span class="pbadge" id="xbadge"></span>
            </div>
            <div class="cm-wrap" id="exprCM"><div class="cm-loading">Loading editor…</div></div>
          </div>
        </div>
        <div class="rsz-v" id="vrsz"></div>
        <div class="panel" id="panelOut" style="border-top:1px solid var(--bdr)">
          <div class="phead">
            <span class="ptitle">Output</span>
            <span class="pbadge" id="obadge"></span>
          </div>
          <div class="cm-wrap" id="outCM" style="display:none"></div>
          <div class="outview empty" id="outview">Run the expression to see results…</div>
          <div class="ctxshell" id="ctxshell">
            <button class="ctxshell-head" type="button" onclick="toggleExecContext()">
              <span class="ctxshell-title">Inspector</span>
              <span class="ctxshell-meta" id="ctxMeta">Collapsed</span>
              <span class="ctxshell-caret">▾</span>
            </button>
            <div class="errctx" id="errctx"></div>
          </div>
        </div>
      </div>
      <div class="sbar"><span id="sstat">Ready</span></div>
    </div>`;
      }

      function goHome() {
        activeId = null;
        renderTree();
        renderMain();
      }

      // ── RENDER MAIN ───────────────────────────────────────────────
      function renderMain() {
        const main = document.getElementById('main');
        if (!main) return;
        const landingMode = !activeId;
        document.documentElement.classList.toggle('workbench-landing-mode', landingMode);
        document.body.classList.toggle('workbench-landing-mode', landingMode);
        document.querySelector('.workbench-host')?.classList.toggle('landing-mode', landingMode);
        destroyScriptEditors();
        destroyLandingEditors();
        main.classList.toggle('main-landing', landingMode);
        main.classList.toggle('main-workspace', !landingMode);
        if (landingMode) {
          main.innerHTML = renderLandingView();
          initLandingEditors();
          return;
        }
        const node = findNode(activeId);
        if (!node) { activeId = null; renderMain(); return; }

        main.innerHTML = renderWorkspaceView(node);

        renderTabs();
        initResizers();
        initCMEditors(node);
        renderErrorContext(null);

        document.getElementById('ename').addEventListener('input', e => {
          const n = db.nodes.find(x => x.id === activeId);
          if (n) { n.name = e.target.value; schedSave(); renderTree(); renderTabs(); }
        });

        // auto-run if there's already content
        if (node.expr && node.expr.trim()) scheduleRun();
      }

      function renderTabs() {
        const bar = document.getElementById('tabbar');
        if (!bar) return;
        bar.innerHTML = '';
        tabs.forEach(id => {
          const n = db.nodes.find(x => x.id === id);
          if (!n) return;
          const t = document.createElement('div');
          t.className = 'tab' + (id === activeId ? ' active' : '');
          t.innerHTML = `<span>${esc(n.name)}</span><button class="tabx">✕</button>`;
          t.addEventListener('click', () => { if (activeId !== id) { activeId = id; renderTree(); renderMain(); } });
          t.querySelector('.tabx').addEventListener('click', e => closeTab(id, e));
          bar.appendChild(t);
        });
      }

      function createCMEditor(parent, doc, extensions) {
        if (!parent || !window._CM?.EditorView) return null;
        parent.innerHTML = '';
        return new window._CM.EditorView({ doc: doc || '', extensions, parent });
      }

      function buildEditorExtensions({
        mode = 'plain',
        readOnly = false,
        withErrorMarkers = false,
        updateListener = null,
        domHandlers = null,
        autocomplete = null,
        hover = null
      } = {}) {
        if (!window._CM) return [];
        const {
          EditorView,
          EditorState,
          basicSetup,
          json,
          javascript,
          oneDark,
          searchExt,
          jsonataFn,
          jsonFoldSummaryExt,
          jsonataFoldSummaryExt
        } = window._CM;
        const extensions = [...basicSetup];
        if (withErrorMarkers && window._CM.errorMarkerExt) extensions.push(window._CM.errorMarkerExt());
        if (mode === 'json') {
          if (jsonFoldSummaryExt) extensions.push(jsonFoldSummaryExt());
          extensions.push(json());
        } else if (mode === 'javascript' && javascript) {
          extensions.push(javascript({ jsx: false, typescript: false }));
        } else if (mode === 'jsonata' && jsonataFn) {
          if (jsonataFoldSummaryExt) extensions.push(jsonataFoldSummaryExt());
          extensions.push(jsonataFn());
        }
        if (currentTheme === 'dark') extensions.push(oneDark);
        extensions.push(searchExt({ top: false }));
        if (autocomplete) extensions.push(autocomplete);
        if (hover) extensions.push(hover);
        if (updateListener) extensions.push(EditorView.updateListener.of(updateListener));
        if (domHandlers) extensions.push(EditorView.domEventHandlers(domHandlers));
        if (readOnly) extensions.push(EditorState.readOnly.of(true));
        return extensions;
      }

      function setRunBadges(state, text = '') {
        const ss = document.getElementById('sstat');
        const ob = document.getElementById('obadge');
        const xb = document.getElementById('xbadge');
        const badgeClass = state ? `pbadge ${state}` : 'pbadge';
        const badgeText = state ? state.toUpperCase() : '';
        if (ss) ss.innerHTML = text;
        if (ob) { ob.className = badgeClass; ob.textContent = badgeText; }
        if (xb) { xb.className = badgeClass; xb.textContent = badgeText; }
      }

      function initLandingEditors() {
        if (!window._CM) return;
        const { jsAutocomplete } = window._CM;
        const settings = getSettings();
        const ctxEl = document.getElementById('globalContextCM');
        const bindingsEl = document.getElementById('bindingsCM');
        const fnEl = document.getElementById('functionsCM');
        if (ctxEl) {
          landingContextEditor = createCMEditor(ctxEl, settings.globalContext || '', buildEditorExtensions({
            mode: 'json',
            updateListener: v => {
                if (!v.docChanged) return;
                getSettings().globalContext = v.state.doc.toString();
                schedSave();
                validateLandingField('globalContext');
            }
          }));
        }
        if (bindingsEl) {
          landingBindingsEditor = createCMEditor(bindingsEl, settings.bindings || '', buildEditorExtensions({
            mode: 'json',
            updateListener: v => {
                if (!v.docChanged) return;
                getSettings().bindings = v.state.doc.toString();
                schedSave();
                validateLandingField('bindings');
            }
          }));
        }
        if (fnEl) {
          landingFunctionsEditor = createCMEditor(fnEl, settings.customFunctions || '', buildEditorExtensions({
            mode: 'javascript',
            withErrorMarkers: true,
            autocomplete: jsAutocomplete,
            updateListener: v => {
                if (!v.docChanged) return;
                clearEditorLocationHighlight(landingFunctionsEditor);
                getSettings().customFunctions = v.state.doc.toString();
                schedSave();
                validateLandingField('functions');
                if (exprEditor) exprEditor.dispatch({});
            }
          }));
        }
        validateLandingField('globalContext');
        validateLandingField('bindings');
        validateLandingField('functions');
      }

      function validateLandingField(field) {
        const settings = getSettings();
        if (field === 'globalContext') {
          const res = parseJSONText(settings.globalContext || '', 'Global context');
          const el = document.getElementById('globalContextErr');
          if (el) el.textContent = res.ok ? '' : res.message;
        }
        if (field === 'bindings') {
          const res = parseJSONText(settings.bindings || '', 'Bindings', { requireObject: true });
          const el = document.getElementById('bindingsErr');
          if (el) el.textContent = res.ok ? '' : res.message;
        }
        if (field === 'functions') {
          const res = parseCustomFunctions(settings.customFunctions || '');
          const el = document.getElementById('functionsErr');
          if (el) el.textContent = res.ok ? '' : res.message;
          if (!res.ok && res.location && landingFunctionsEditor) focusEditorLocation(landingFunctionsEditor, res.location);
        }
      }

      // ── JSON INPUT ────────────────────────────────────────────────
      function onInputChange(val) {
        const n = db.nodes.find(x => x.id === activeId);
        if (n) { n.input = val; schedSave(); }
        checkJSON(val);
        scheduleRun();
      }
      function checkJSON(val) {
        const el = document.getElementById('jerr'); if (!el) return;
        if (!val.trim()) { el.textContent = ''; return; }
        try { JSON.parse(val); el.textContent = ''; }
        catch (e) { el.textContent = '⚠ ' + e.message.split('\n')[0]; }
      }
      function fmtJSON() {
        if (!inputEditor) return;
        try {
          const v = JSON.stringify(JSON.parse(inputEditor.state.doc.toString()), null, 2);
          inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: v } });
        } catch { }
      }
      function minJSON() {
        if (!inputEditor) return;
        try {
          const v = JSON.stringify(JSON.parse(inputEditor.state.doc.toString()));
          inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: v } });
        } catch { }
      }
      function clearInput() {
        if (!inputEditor) return;
        inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: '' } });
      }

      // ── EXPRESSION ────────────────────────────────────────────────
      function onExprChange(val) {
        const n = db.nodes.find(x => x.id === activeId);
        if (n) { n.expr = val; schedSave(); }
        scheduleRun();
      }
      function scheduleRun() { clearTimeout(runTimer); runTimer = setTimeout(runExpr, 600); }

      async function runExpr() {
        if (!exprEditor) return;

        if (!JR) {
          renderErrorContext(null);
          setOutput('JSONata still loading… wait a moment.', 'err'); return;
        }
        const expr = (exprEditor ? exprEditor.state.doc.toString() : '').trim();
        if (!expr) {
          clearEditorLocationHighlight(exprEditor);
          setOutput('Enter an expression in the middle panel…', 'empty');
          setRunBadges('', 'Ready');
          return;
        }
        const settings = getSettings();
        const bindingsRaw = (settings.bindings || '').trim();
        const bindingsResult = parseJSONText(bindingsRaw, 'Bindings', { requireObject: true });
        if (!bindingsResult.ok) {
          clearEditorLocationHighlight(exprEditor);
          setOutput(bindingsResult.message, 'err', null);
          execCtxExpanded = true;
          const ctx = await buildExecutionContext({ expr, bindings: {}, customFns: [], functionsError: { ok: false, message: bindingsResult.message }, error: new Error(bindingsResult.message) });
          renderErrorContext(ctx);
          setRunBadges('err', '<span class="err">✗ Invalid bindings</span>');
          return;
        }
        const functionsResult = parseCustomFunctions(settings.customFunctions || '');
        const customFns = functionsResult.ok ? functionsResult.value : [];
        if (!functionsResult.ok && functionsResult.location && landingFunctionsEditor) {
          focusEditorLocation(landingFunctionsEditor, functionsResult.location);
        }

        let data = {};
        const rawInput = (inputEditor ? inputEditor.state.doc.toString() : '').trim();
        const rawGlobal = (settings.globalContext || '').trim();
        const sourceLabel = rawInput ? 'JSON input' : 'Global context';
        const dataRaw = rawInput || rawGlobal;
        if (dataRaw) {
          try { data = JSON.parse(dataRaw); }
          catch (e) {
            clearEditorLocationHighlight(exprEditor);
            const msg = sourceLabel + ' error:\n' + e.message;
            setOutput(msg, 'err', null);
            execCtxExpanded = true;
            const ctx = await buildExecutionContext({ expr, bindings: bindingsResult.value, customFns, functionsError: functionsResult, error: new Error(msg) });
            renderErrorContext(ctx);
            setRunBadges('err', `<span class="err">✗ Invalid ${esc(sourceLabel.toLowerCase())}</span>`);
            return;
          }
        }
        try {
          const compiled = jsonata(expr);
          registerCustomFunctions(compiled, customFns);
          const result = await compiled.evaluate(data, bindingsResult.value);
          const out = result === undefined ? '(undefined — expression returned no value)' : JSON.stringify(result, null, 2);
          clearEditorLocationHighlight(exprEditor);
          setOutput(out, 'ok', null);
          buildExecutionContext({ expr, data, bindings: bindingsResult.value, customFns, functionsError: functionsResult, resultValue: result }).then(ctx => {
            if (exprEditor && expr === exprEditor.state.doc.toString().trim()) renderErrorContext(ctx);
          });
          const warn = !functionsResult.ok ? ' · custom functions ignored' : '';
          setRunBadges('ok', '<span class="ok">✓ OK</span> · ' + new Date().toLocaleTimeString() + warn);
        } catch (e) {
          const loc = getJsonataErrorLocation(e, expr);
          if (loc) focusEditorLocation(exprEditor, loc);
          const msg = (e.message || String(e)) + formatErrorLocation(loc);
          setOutput(msg, 'err', null);
          execCtxExpanded = true;
          buildExecutionContext({ error: e, expr, data, location: loc, bindings: bindingsResult.value, customFns, functionsError: functionsResult }).then(ctx => {
            if (exprEditor && expr === exprEditor.state.doc.toString().trim()) renderErrorContext(ctx);
          });
          setRunBadges('err', '<span class="err">✗ ' + esc(msg || 'Error') + '</span>');
        }
      }

      function setStat(html) { const el = document.getElementById('sstat'); if (el) el.innerHTML = html; }

      function formatInspectableValue(value) {
        if (value === undefined) return '(undefined)';
        try { return JSON.stringify(value, null, 2); }
        catch { return String(value); }
      }

      function openInspectValue(id) {
        const entry = inspectValueStore.get(id);
        if (!entry) return;
        inspectValueId = id;
        document.getElementById('valTitle').textContent = entry.label || 'Value Inspector';
        document.getElementById('valMeta').textContent = entry.meta || 'Read-only value preview';
        const host = document.getElementById('valCM');
        if (!host) return;
        host.innerHTML = '';
        destroyInspectValueEditor();
        const text = formatInspectableValue(entry.value);
        if (window._CM) {
          let useJson = false;
          if (text !== '(undefined)') {
            try { JSON.parse(text); useJson = true; } catch { }
          }
          inspectValueEditor = createCMEditor(host, text, buildEditorExtensions({
            mode: useJson ? 'json' : 'plain',
            readOnly: true
          }));
        } else {
          host.innerHTML = `<pre class="outview" style="display:block">${esc(text)}</pre>`;
        }
        document.getElementById('valOv').classList.add('open');
      }

      // ── MODALS ────────────────────────────────────────────────────
      function openAddModal(type, parentId) {
        addCtx = { type, parentId };
        pickedCol = COLS[0];
        document.getElementById('addTitle').textContent =
          type === 'folder' ? (parentId ? 'New Subfolder' : 'New Collection') : 'New Script';
        document.getElementById('addName').value = '';
        document.getElementById('colorField').style.display = type === 'folder' ? '' : 'none';
        renderSwatches();
        document.getElementById('addOv').classList.add('open');
        setTimeout(() => document.getElementById('addName').focus(), 60);
      }

      function confirmAdd() {
        const name = document.getElementById('addName').value.trim();
        if (!name) return;
        const node = {
          id: uid(), type: addCtx.type, name,
          parentId: addCtx.parentId || null,
          color: addCtx.type === 'folder' ? pickedCol : undefined,
          open: true, expr: '', input: '',
          order: db.nodes.filter(n => n.parentId === (addCtx.parentId || null)).length
        };
        // expand ancestors
        let pid = addCtx.parentId;
        while (pid) { const p = db.nodes.find(n => n.id === pid); if (p) { p.open = true; pid = p.parentId; } else break; }
        db.nodes.push(node);
        schedSave(); closeOv(); renderTree();
        if (node.type === 'script') openScript(node.id);
      }

      function openRename(id) {
        rnId = id;
        const n = db.nodes.find(x => x.id === id);
        document.getElementById('rnName').value = n?.name || '';
        document.getElementById('rnOv').classList.add('open');
        setTimeout(() => document.getElementById('rnName').focus(), 60);
      }

      function openDeleteModal(id) {
        delId = id;
        const n = db.nodes.find(x => x.id === id); if (!n) return;
        const desc = allDesc(id).length;
        document.getElementById('delMsg').textContent =
          desc ? `Delete "${n.name}" and ${desc} item(s) inside it? This cannot be undone.` : `Delete "${n.name}"? This cannot be undone.`;
        document.getElementById('delOv').classList.add('open');
      }

      function confirmRename() {
        const name = document.getElementById('rnName').value.trim(); if (!name) return;
        const n = db.nodes.find(x => x.id === rnId);
        if (n) { n.name = name; schedSave(); renderTree(); }
        if (rnId === activeId) { const i = document.getElementById('ename'); if (i) i.value = name; renderTabs(); }
        closeOv();
      }

      function confirmDelete() {
        const id = delId;
        const n = db.nodes.find(x => x.id === id); if (!n) { closeOv(); return; }
        const desc = allDesc(id);
        const kill = new Set([id, ...desc]);
        db.nodes = db.nodes.filter(n => !kill.has(n.id));
        tabs = tabs.filter(t => !kill.has(t));
        if (kill.has(activeId)) activeId = tabs[tabs.length - 1] || null;
        closeOv();
        schedSave(); renderTree(); renderMain();
      }

      function closeOv() {
        delId = null;
        inspectValueId = null;
        destroyInspectValueEditor();
        document.querySelectorAll('.overlay.open').forEach(el => el.classList.remove('open'));
      }

      document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => {
          if (e.target === ov) closeOv();
        });
      });

      function renderSwatches() {
        document.getElementById('swatches').innerHTML = COLS.map(c =>
          `<div class="sw${c === pickedCol ? ' sel' : ''}" style="background:${c}" onclick="pickC('${c}')"></div>`
        ).join('');
      }
      function pickC(c) { pickedCol = c; renderSwatches(); }

      // ── CONTEXT MENU ──────────────────────────────────────────────
      function showCtx(e, id) {
        ctxId = id;
        const n = db.nodes.find(x => x.id === id);
        const isF = n?.type === 'folder';
        document.getElementById('ctx-af').style.display = isF ? '' : 'none';
        document.getElementById('ctx-as').style.display = isF ? '' : 'none';
        const m = document.getElementById('ctxm');
        m.classList.add('open');
        let x = e.clientX, y = e.clientY;
        if (x + 180 > window.innerWidth) x = window.innerWidth - 184;
        if (y + 160 > window.innerHeight) y = window.innerHeight - 164;
        m.style.left = x + 'px'; m.style.top = y + 'px';
      }
      function ctxDo(a) {
        document.getElementById('ctxm').classList.remove('open');
        const n = db.nodes.find(x => x.id === ctxId); if (!n) return;
        if (a === 'af') openAddModal('folder', ctxId);
        else if (a === 'as') openAddModal('script', ctxId);
        else if (a === 'rn') openRename(ctxId);
        else if (a === 'del') openDeleteModal(ctxId);
      }
      document.addEventListener('click', () => document.getElementById('ctxm').classList.remove('open'));

      // ── RESIZERS ──────────────────────────────────────────────────
      function applyPanelSizes() {
        const inputP = document.getElementById('panelInput');
        const exprP = document.getElementById('panelExpr');
        const topRow = document.getElementById('panelsTop');
        const outRow = document.getElementById('panelOut');
        if (inputP) { inputP.style.flexGrow = rszLeft; inputP.style.flexShrink = '1'; inputP.style.flexBasis = '0'; }
        if (exprP) { exprP.style.flexGrow = 100 - rszLeft; exprP.style.flexShrink = '1'; exprP.style.flexBasis = '0'; }
        if (topRow) { topRow.style.flexGrow = rszTop; topRow.style.flexShrink = '1'; topRow.style.flexBasis = '0'; }
        if (outRow) { outRow.style.flexGrow = 100 - rszTop; outRow.style.flexShrink = '1'; outRow.style.flexBasis = '0'; }
      }
      function initResizers() {
        applyPanelSizes();
        const hRsz = document.getElementById('hrsz');
        const vRsz = document.getElementById('vrsz');
        if (hRsz) {
          hRsz.addEventListener('mousedown', e => {
            e.preventDefault();
            const startX = e.clientX, startW = rszLeft;
            const totalW = document.getElementById('panelsTop').getBoundingClientRect().width;
            hRsz.classList.add('dragging');
            function onMove(e) { rszLeft = Math.max(15, Math.min(85, startW + (e.clientX - startX) / totalW * 100)); applyPanelSizes(); }
            function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); hRsz.classList.remove('dragging'); }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });
        }
        if (vRsz) {
          vRsz.addEventListener('mousedown', e => {
            e.preventDefault();
            const startY = e.clientY, startH = rszTop;
            const totalH = document.querySelector('.panels').getBoundingClientRect().height;
            vRsz.classList.add('dragging');
            function onMove(e) { rszTop = Math.max(20, Math.min(80, startH + (e.clientY - startY) / totalH * 100)); applyPanelSizes(); }
            function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); vRsz.classList.remove('dragging'); }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });
        }
      }

      // ── CODEMIRROR EDITORS ────────────────────────────────────────
      function initCMEditors(node) {
        if (!window._CM) {
          // CM not loaded yet — listener below will retry
          return;
        }
        const { jsonataCompletion, jsonataHover } = window._CM;
        const inputEl = document.getElementById('inputCM');
        const outEl = document.getElementById('outCM');
        if (!inputEl || !outEl) return;
        inputEditor = createCMEditor(inputEl, node.input || '', buildEditorExtensions({
          mode: 'json',
          withErrorMarkers: true,
          updateListener: v => {
            if (!v.docChanged) return;
            onInputChange(v.state.doc.toString());
          },
          domHandlers: {
            paste() {
              setTimeout(() => {
                if (!inputEditor) return;
                const val = inputEditor.state.doc.toString();
                try {
                  const fmt = JSON.stringify(JSON.parse(val), null, 2);
                  if (fmt === val) return;
                  inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: fmt } });
                } catch { }
              }, 20);
            }
          }
        }));

        outputEditor = createCMEditor(outEl, '', buildEditorExtensions({
          mode: 'json',
          withErrorMarkers: true,
          readOnly: true
        }));

        const exprEl = document.getElementById('exprCM');
        if (exprEl) {
          exprEditor = createCMEditor(exprEl, node.expr || '', buildEditorExtensions({
            mode: 'jsonata',
            withErrorMarkers: true,
            autocomplete: jsonataCompletion,
            hover: jsonataHover,
            updateListener: v => {
              if (!v.docChanged) return;
              clearEditorLocationHighlight(exprEditor);
              onExprChange(v.state.doc.toString());
            }
          }));
        }
      }


      function setOutput(text, state, errorContext = null) {
        // state: 'ok' | 'err' | 'empty'
        const outCM = document.getElementById('outCM');
        const ov = document.getElementById('outview');
        renderErrorContext(errorContext);
        if (state === 'ok' && outputEditor) {
          if (outCM) { outCM.style.display = ''; outCM.className = 'cm-wrap'; }
          if (ov) ov.style.display = 'none';
          outputEditor.dispatch({ changes: { from: 0, to: outputEditor.state.doc.length, insert: text } });
        } else {
          if (outCM) outCM.style.display = 'none';
          if (ov) {
            ov.style.display = '';
            ov.className = 'outview' + (state === 'err' ? ' err' : state === 'empty' ? ' empty' : '');
            ov.textContent = text;
          }
        }
      }

      // ── UTILS ─────────────────────────────────────────────────────
      function uid() { return globalThis.crypto?.randomUUID?.() || (Math.random().toString(36).slice(2, 8) + Date.now().toString(36)); }
      function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

      // ── KEYBOARD ──────────────────────────────────────────────────
      function handleKeyDown(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runExpr(); }
        if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveNow(); }
        if (e.key === 'Escape') closeOv();
        if (e.key === 'Enter') {
          if (document.getElementById('addOv')?.classList.contains('open')) { e.preventDefault(); confirmAdd(); }
          if (document.getElementById('rnOv')?.classList.contains('open')) { e.preventDefault(); confirmRename(); }
          if (document.getElementById('delOv')?.classList.contains('open')) { e.preventDefault(); confirmDelete(); }
        }
      }
      document.addEventListener('keydown', handleKeyDown);

      // ── INIT ──────────────────────────────────────────────────────

      function setupCodeMirror() {
        const { EditorView, Decoration, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection,
          dropCursor, highlightActiveLine, keymap, rectangularSelection, crosshairCursor, hoverTooltip } = view;
        const { EditorState, StateEffect, StateField, RangeSetBuilder } = state;
        const { defaultKeymap, indentWithTab, history, historyKeymap } = commands;
        const { defaultHighlightStyle, syntaxHighlighting, foldGutter, codeFolding, foldService, indentOnInput, bracketMatching } = language;
        const { searchKeymap, highlightSelectionMatches, search: searchExt } = search;
        const { lintKeymap } = lint;
        const { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completeFromList, completeAnyWord } = autocomplete;
        const { json } = langJson;
        const { javascript } = langJavascript;
        const { oneDark } = theme;

        // ── JSONata StreamLanguage (with indent rules) ───────────────
        const JFUNCS = [
          { label: '$string', sig: '(arg, prettify?)→str', info: 'Cast arg to a string' },
          { label: '$length', sig: '(str)→num', info: 'Length of a string' },
          { label: '$substring', sig: '(str, start, length?)→str', info: 'Extract a substring' },
          { label: '$substringBefore', sig: '(str, chars)→str', info: 'Substring before first occurrence of chars' },
          { label: '$substringAfter', sig: '(str, chars)→str', info: 'Substring after first occurrence of chars' },
          { label: '$uppercase', sig: '(str)→str', info: 'Convert to uppercase' },
          { label: '$lowercase', sig: '(str)→str', info: 'Convert to lowercase' },
          { label: '$trim', sig: '(str)→str', info: 'Remove leading/trailing whitespace' },
          { label: '$pad', sig: '(str, width, char?)→str', info: 'Pad string to specified width' },
          { label: '$contains', sig: '(str, pattern)→bool', info: 'Test if string matches pattern' },
          { label: '$split', sig: '(str, separator, limit?)→arr', info: 'Split string into an array' },
          { label: '$join', sig: '(arr, separator?)→str', info: 'Join array of strings into one string' },
          { label: '$match', sig: '(str, pattern, limit?)→arr', info: 'Find all regex matches in string' },
          { label: '$replace', sig: '(str, pattern, replacement, limit?)→str', info: 'Replace occurrences of pattern' },
          { label: '$eval', sig: '(expr, context?)→any', info: 'Evaluate a JSONata expression string' },
          { label: '$base64encode', sig: '(str)→str', info: 'Base64 encode a string' },
          { label: '$base64decode', sig: '(str)→str', info: 'Decode a base64 string' },
          { label: '$encodeUrlComponent', sig: '(str)→str', info: 'Percent-encode a URL component' },
          { label: '$encodeUrl', sig: '(str)→str', info: 'Percent-encode a URL' },
          { label: '$decodeUrlComponent', sig: '(str)→str', info: 'Decode a percent-encoded URL component' },
          { label: '$decodeUrl', sig: '(str)→str', info: 'Decode a percent-encoded URL' },
          { label: '$number', sig: '(arg)→num', info: 'Cast arg to a number' },
          { label: '$abs', sig: '(num)→num', info: 'Absolute value' },
          { label: '$floor', sig: '(num)→num', info: 'Round down to nearest integer' },
          { label: '$ceil', sig: '(num)→num', info: 'Round up to nearest integer' },
          { label: '$round', sig: '(num, precision?)→num', info: 'Round to specified decimal places' },
          { label: '$power', sig: '(base, exponent)→num', info: 'Raise base to the power of exponent' },
          { label: '$sqrt', sig: '(num)→num', info: 'Square root' },
          { label: '$random', sig: '()→num', info: 'Random float between 0 and 1' },
          { label: '$formatNumber', sig: '(num, picture, options?)→str', info: 'Format a number using a picture string' },
          { label: '$formatBase', sig: '(num, radix?)→str', info: 'Format number in the given radix' },
          { label: '$formatInteger', sig: '(num, picture)→str', info: 'Format an integer using a picture string' },
          { label: '$parseInteger', sig: '(str, picture)→num', info: 'Parse integer using a picture string' },
          { label: '$count', sig: '(array)→num', info: 'Number of items in array' },
          { label: '$append', sig: '(array1, array2)→arr', info: 'Concatenate two arrays' },
          { label: '$sort', sig: '(array, function?)→arr', info: 'Sort array, optionally with comparator' },
          { label: '$reverse', sig: '(array)→arr', info: 'Reverse an array' },
          { label: '$shuffle', sig: '(array)→arr', info: 'Randomly shuffle an array' },
          { label: '$distinct', sig: '(array)→arr', info: 'Remove duplicate values from array' },
          { label: '$zip', sig: '(array1, array2, ...)→arr', info: 'Interleave multiple arrays into array of arrays' },
          { label: '$sum', sig: '(array)→num', info: 'Sum of a numeric array' },
          { label: '$max', sig: '(array)→num', info: 'Maximum value in a numeric array' },
          { label: '$min', sig: '(array)→num', info: 'Minimum value in a numeric array' },
          { label: '$average', sig: '(array)→num', info: 'Mean average of a numeric array' },
          { label: '$keys', sig: '(obj)→arr', info: "Array of an object's keys" },
          { label: '$lookup', sig: '(obj, key)→any', info: 'Look up a key in an object' },
          { label: '$spread', sig: '(obj)→arr', info: 'Spread object into array of single-key objects' },
          { label: '$merge', sig: '(array)→obj', info: 'Merge an array of objects into one' },
          { label: '$sift', sig: '(obj, function)→obj', info: 'Filter object key-value pairs with a function' },
          { label: '$each', sig: '(obj, function)→arr', info: 'Apply function to each key-value pair' },
          { label: '$error', sig: '(message?)→error', info: 'Deliberately throw an error' },
          { label: '$assert', sig: '(condition, message)→void', info: 'Throw an error if condition is false' },
          { label: '$boolean', sig: '(arg)→bool', info: 'Cast arg to a Boolean' },
          { label: '$not', sig: '(arg)→bool', info: 'Logical NOT' },
          { label: '$exists', sig: '(arg)→bool', info: 'Test if arg exists (is not undefined)' },
          { label: '$type', sig: '(value)→str', info: 'Return the type of a value as a string' },
          { label: '$now', sig: '(picture?, timezone?)→str', info: 'Current UTC date/time as ISO 8601 string' },
          { label: '$millis', sig: '()→num', info: 'Current timestamp in milliseconds since epoch' },
          { label: '$fromMillis', sig: '(number, picture?, timezone?)→str', info: 'Convert ms since epoch to date string' },
          { label: '$toMillis', sig: '(str, picture?)→num', info: 'Convert date string to ms since epoch' },
          { label: '$map', sig: '(array, function)→arr', info: 'Apply function to every element of array' },
          { label: '$filter', sig: '(array, function)→arr', info: 'Filter array elements that match function' },
          { label: '$reduce', sig: '(array, function, init?)→any', info: 'Reduce array to single value' },
          { label: '$single', sig: '(array, function)→any', info: 'Return single element matching function' },
        ];

        function getJsonataFunctionOptions() {
          const seen = new Map(JFUNCS.map(f => [f.label, f]));
          getCustomFunctionEntries().forEach(f => {
            seen.set(f.label, {
              label: f.label,
              sig: f.signature || '(...)',
              info: f.info || 'Custom workspace function'
            });
          });
          return [...seen.values()];
        }

        const jsonataCompletion = autocompletion({
          override: [ctx => {
            const word = ctx.matchBefore(/\$[a-zA-Z_]*/) || ctx.matchBefore(/\$/);
            if (!word && !ctx.explicit) return null;
            return {
              from: word ? word.from : ctx.pos,
              validFor: /^\$[a-zA-Z_]*$/,
              options: getJsonataFunctionOptions().map(f => ({
                label: f.label, type: 'function', detail: f.sig, info: f.info,
                apply: (view, _c, from, to) => {
                  const ins = f.label + '()';
                  view.dispatch({
                    changes: { from, to, insert: ins },
                    selection: { anchor: from + ins.length - 1 }  // cursor between ( and )
                  });
                }
              }))
            };
          }]
        });

        const basicSetup = [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap,
            indentWithTab, ...completionKeymap, ...lintKeymap])
        ];

        const setErrorLocationEffect = StateEffect.define();
        const clearErrorLocationEffect = StateEffect.define();
        const errorMarkerField = StateField.define({
          create() { return Decoration.none; },
          update(markers, tr) {
            markers = markers.map(tr.changes);
            for (const effect of tr.effects) {
              if (effect.is(clearErrorLocationEffect)) return Decoration.none;
              if (effect.is(setErrorLocationEffect)) {
                const lineNo = Math.max(1, effect.value?.line || 1);
                const line = tr.state.doc.line(Math.min(lineNo, tr.state.doc.lines));
                const builder = new RangeSetBuilder();
                builder.add(line.from, line.from, Decoration.line({ attributes: { class: 'cm-errLine' } }));
                return builder.finish();
              }
            }
            return markers;
          },
          provide: f => EditorView.decorations.from(f)
        });

        function errorMarkerExt() {
          return errorMarkerField;
        }

        function setEditorErrorLocation(view, loc) {
          if (!view) return;
          view.dispatch({ effects: setErrorLocationEffect.of(loc) });
        }

        function clearEditorErrorLocation(view) {
          if (!view) return;
          view.dispatch({ effects: clearErrorLocationEffect.of(null) });
        }

        const jsonataFn = langJsonata.jsonata;

        // ── Hover tooltip for JSONata built-ins ──────────────────────
        const jsonataHover = hoverTooltip((view, pos) => {
          const line = view.state.doc.lineAt(pos);
          const text = line.text;
          const col = pos - line.from;
          // walk left to find start of $identifier
          let s = col;
          while (s > 0 && /[$a-zA-Z0-9_]/.test(text[s - 1])) s--;
          // walk right to find end
          let e = col;
          while (e < text.length && /[a-zA-Z0-9_]/.test(text[e])) e++;
          const word = text.slice(s, e);
          if (!word.startsWith('$')) return null;
          const fn = getJsonataFunctionOptions().find(f => f.label === word);
          if (!fn) return null;
          return {
            pos: line.from + s, end: line.from + e, above: true,
            create() {
              const dom = document.createElement('div');
              dom.className = 'cm-fn-tooltip';
              dom.innerHTML =
                '<div class="cm-fn-tt-sig">' + esc(fn.label + fn.sig) + '</div>' +
                '<div class="cm-fn-tt-info">' + esc(fn.info) + '</div>';
              return { dom };
            }
          };
        }, { hideOnChange: true });

        const jsAutocomplete = autocompletion({
          override: [
            completeFromList([
              { label: 'implementation', type: 'property', apply: 'implementation: (value) => value' },
              { label: 'signature', type: 'property', apply: "signature: '<s:s>'" },
              { label: 'description', type: 'property', apply: "description: 'Custom workspace function'" },
              { label: 'slug', type: 'function', apply: 'slug: (value) => String(value).toLowerCase()' },
              { label: 'uppercaseWords', type: 'function', apply: 'uppercaseWords: (value) => String(value).toUpperCase()' }
            ]),
            completeAnyWord
          ]
        });

        function countTopLevelMembers(innerText) {
          const text = (innerText || '').trim();
          if (!text) return 0;
          let depth = 0;
          let count = 1;
          let inString = false;
          let escaped = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
              if (escaped) escaped = false;
              else if (ch === '\\') escaped = true;
              else if (ch === '"') inString = false;
              continue;
            }
            if (ch === '"') {
              inString = true;
              continue;
            }
            if (ch === '{' || ch === '[' || ch === '(') {
              depth++;
              continue;
            }
            if (ch === '}' || ch === ']' || ch === ')') {
              depth = Math.max(0, depth - 1);
              continue;
            }
            if (ch === ',' && depth === 0) count++;
          }
          return count;
        }

        function summariseFoldedRange(state, range) {
          const open = range.from > 0 ? state.sliceDoc(range.from - 1, range.from) : '';
          const close = range.to < state.doc.length ? state.sliceDoc(range.to, range.to + 1) : '';
          const inner = state.sliceDoc(range.from, range.to);
          if (open === '[' && close === ']') {
            const count = countTopLevelMembers(inner);
            return { kind: 'array', count, label: `${count} item${count === 1 ? '' : 's'}` };
          }
          if (open === '{' && close === '}') {
            const count = countTopLevelMembers(inner);
            return { kind: 'object', count, label: `${count} ${count === 1 ? 'key' : 'keys'}` };
          }
          if (open === '(' && close === ')') {
            return { kind: 'group', count: 0, label: 'group' };
          }
          return { kind: 'value', count: 0, label: 'collapsed' };
        }

        function findFoldOpen(state, lineStart, lineEnd, pairs) {
          const text = state.sliceDoc(lineStart, lineEnd);
          let inString = false;
          let escaped = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
              if (escaped) escaped = false;
              else if (ch === '\\') escaped = true;
              else if (ch === '"') inString = false;
              continue;
            }
            if (ch === '"') {
              inString = true;
              continue;
            }
            const close = pairs[ch];
            if (close) {
              return { pos: lineStart + i, open: ch, close };
            }
          }
          return null;
        }

        function findFoldClose(state, openPos, openCh, closeCh) {
          let depth = 1;
          let inString = false;
          let escaped = false;
          const text = state.doc.toString();
          for (let i = openPos + 1; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
              if (escaped) escaped = false;
              else if (ch === '\\') escaped = true;
              else if (ch === '"') inString = false;
              continue;
            }
            if (ch === '"') {
              inString = true;
              continue;
            }
            if (ch === openCh) {
              depth++;
              continue;
            }
            if (ch === closeCh) {
              depth--;
              if (depth === 0) return i;
            }
          }
          return -1;
        }

        function buildBracketFoldExtension({ pairs, multilineOnly = true } = {}) {
          if (!codeFolding || !foldService) return [];
          return [
            foldService.of((state, lineStart, lineEnd) => {
              const openInfo = findFoldOpen(state, lineStart, lineEnd, pairs);
              if (!openInfo) return null;
              const closePos = findFoldClose(state, openInfo.pos, openInfo.open, openInfo.close);
              if (closePos < 0 || closePos <= openInfo.pos + 1) return null;
              if (multilineOnly) {
                const openLine = state.doc.lineAt(openInfo.pos);
                const closeLine = state.doc.lineAt(closePos);
                if (closeLine.number <= openLine.number) return null;
              }
              return { from: openInfo.pos + 1, to: closePos };
            }),
            codeFolding({
              preparePlaceholder: (state, range) => summariseFoldedRange(state, range),
              placeholderDOM(_view, onclick, prepared) {
                const el = document.createElement('span');
                el.className = 'cm-foldSummary';
                el.setAttribute('title', 'Click to expand');
                el.innerHTML = `<strong>…</strong><span>${esc(prepared?.label || 'collapsed')}</span>`;
                el.addEventListener('click', onclick);
                return el;
              }
            })
          ];
        }

        function jsonFoldSummaryExt() {
          return buildBracketFoldExtension({ pairs: { '{': '}', '[': ']' }, multilineOnly: true });
        }

        function jsonataFoldSummaryExt() {
          return buildBracketFoldExtension({ pairs: { '{': '}', '[': ']', '(': ')' }, multilineOnly: true });
        }

        window._CM = { EditorView, EditorState, basicSetup, json, javascript, oneDark, searchExt, jsonataFn, jsonataCompletion, jsonataHover, jsAutocomplete, jsonFoldSummaryExt, jsonataFoldSummaryExt, errorMarkerExt, setEditorErrorLocation, clearEditorErrorLocation };
        // if a script was opened before CM finished loading, init now
        if (activeId && !inputEditor && !exprEditor) { const n = db.nodes.find(x => x.id === activeId); if (n) initCMEditors(n); }
        if (!activeId && !landingContextEditor && !landingBindingsEditor && !landingFunctionsEditor) initLandingEditors();
      }

      setupCodeMirror();
      Object.assign(window, runtimeActions);
      initTheme();
      renderTree();
      renderMain();
      setStat('Ready');
      slabel('No file linked');
      bootPersistence();

      function destroyEditors() {
        if (inputEditor) { inputEditor.destroy(); inputEditor = null; }
        if (outputEditor) { outputEditor.destroy(); outputEditor = null; }
        if (exprEditor) { exprEditor.destroy(); exprEditor = null; }
        if (landingContextEditor) { landingContextEditor.destroy(); landingContextEditor = null; }
        if (landingBindingsEditor) { landingBindingsEditor.destroy(); landingBindingsEditor = null; }
        if (landingFunctionsEditor) { landingFunctionsEditor.destroy(); landingFunctionsEditor = null; }
        destroyInspectValueEditor();
      }

      const cleanup = () => {
        if (disposed) return;
        disposed = true;
        if (activeCleanup === cleanup) activeCleanup = null;
        clearTimeout(saveTimer);
        clearTimeout(runTimer);
        document.removeEventListener('keydown', handleKeyDown);
        destroyEditors();
        Object.entries(runtimeActions).forEach(([key, fn]) => {
          if (window[key] === fn) delete window[key];
        });
      };

      activeCleanup = cleanup;
      return cleanup;
}
