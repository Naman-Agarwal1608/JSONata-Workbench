import {
  esc,
  extractStackLineCol,
  formatErrorLocation,
  getExpressionSnippet,
  getJsonataErrorLocation,
  getOffsetFromLineCol,
  parseJSONText,
  splitTopLevelStatements,
  summariseValue,
  uid
} from './helpers.js'
import { renderLandingView, renderWorkspaceView } from './templates.js'
import { setupCodeMirrorBridge } from './codemirror.js'
import { createPersistenceController } from './persistence.js'
import { createExecutionController } from './execution.js'
import { createTreeController } from './tree.js'
import { createModalController } from './modals.js'
import { createEditorsController } from './editors.js'
import { createLayoutController } from './layout.js'
import { createWorkspaceHelpers, normalizeDB } from './workspace.js'
import { createCustomFunctionsController } from './custom-functions.js'

let activeCleanup = null
let activeInstanceId = 0

export function initWorkbench() {
  activeCleanup?.()
  const instanceId = ++activeInstanceId
  let disposed = false
  let persistence
  let executionController
  let treeController
  let modalController
  let editorsController
  let layoutController
  let customFunctionsController

  function pickFile(...args) { return persistence.pickFile(...args) }
  function saveNow(...args) { return persistence.saveNow(...args) }
  function exportFile(...args) { return persistence.exportFile(...args) }
  function importFile(...args) { return persistence.importFile(...args) }
  function bootPersistence(...args) { return persistence.bootPersistence(...args) }
  function schedSave(...args) { return persistence.schedSave(...args) }
  function runExpr(...args) { return executionController.runExpr(...args) }
  function toggleExecContext(...args) { return executionController.toggleExecContext(...args) }
  function renderTree(...args) { return treeController.renderTree(...args) }
  function renderTabs(...args) { return treeController.renderTabs(...args) }
  function openScript(...args) { return treeController.openScript(...args) }
  function closeTab(...args) { return treeController.closeTab(...args) }
  function openAddModal(...args) { return modalController.openAddModal(...args) }
  function confirmAdd(...args) { return modalController.confirmAdd(...args) }
  function openRename(...args) { return modalController.openRename(...args) }
  function openDeleteModal(...args) { return modalController.openDeleteModal(...args) }
  function confirmRename(...args) { return modalController.confirmRename(...args) }
  function confirmDelete(...args) { return modalController.confirmDelete(...args) }
  function closeOv(...args) { return modalController.closeOv(...args) }
  function pickC(...args) { return modalController.pickC(...args) }
  function showCtx(...args) { return modalController.showCtx(...args) }
  function ctxDo(...args) { return modalController.ctxDo(...args) }
  function fmtJSON(...args) { return editorsController.fmtJSON(...args) }
  function minJSON(...args) { return editorsController.minJSON(...args) }
  function clearInput(...args) { return editorsController.clearInput(...args) }
  function initCMEditors(...args) { return editorsController.initCMEditors(...args) }
  function initLandingEditors(...args) { return editorsController.initLandingEditors(...args) }
  function setOutput(...args) { return editorsController.setOutput(...args) }
  function setRunBadges(...args) { return editorsController.setRunBadges(...args) }
  function buildEditorExtensions(...args) { return editorsController.buildEditorExtensions(...args) }
  function createCMEditor(...args) { return editorsController.createCMEditor(...args) }
  function destroyScriptEditors(...args) { return editorsController.destroyScriptEditors(...args) }
  function destroyLandingEditors(...args) { return editorsController.destroyLandingEditors(...args) }
  function scheduleRun(...args) { return editorsController.scheduleRun(...args) }
  function initResizers(...args) { return layoutController.initResizers(...args) }
  function parseCustomFunctions(...args) { return customFunctionsController.parseCustomFunctions(...args) }
  function getCustomFunctionEntries(...args) { return customFunctionsController.getCustomFunctionEntries(...args) }
  function registerCustomFunctions(...args) { return customFunctionsController.registerCustomFunctions(...args) }

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

  // ── APP CONSTANTS / STATE ────────────────────────────────────
      const COLS = ['#e8b84b', '#e07b40', '#4db887', '#5b9cf6', '#b07ef8', '#e05252', '#38c4c4', '#f07090', '#a0d060'];
      const SK = 'jcv5';
      const THEME_KEY = `${SK}:theme`;
      const workspaceHelpers = createWorkspaceHelpers({ getDb: () => db });
      const { getSettings, hasWorkspaceContent, kids, findNode, allDesc, folderColor, breadcrumb } = workspaceHelpers;
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
      let runTimer = null;

      // Split-pane sizing state.
      let rszLeft = 50; // % width of input panel in top row
      let rszTop = 60;  // % height of top row

      // Live editor instances.
      let inputEditor = null, outputEditor = null, exprEditor = null;
      let landingContextEditor = null, landingBindingsEditor = null, landingFunctionsEditor = null;
      let inspectValueEditor = null;

      // UI theme preference.
      let currentTheme = 'dark';
      function resetWorkspaceViewState() {
        activeId = null;
        tabs = [];
        ctxId = null;
        rnId = null;
        delId = null;
        closeOv();
      }
      function sdot(s) { const d = document.getElementById('sdot'); d.className = 'sdot' + (s ? ' ' + s : ''); }
      function slabel(t) { document.getElementById('slabel').textContent = t; }
      persistence = createPersistenceController({
        normalizeDB,
        hasWorkspaceContent,
        loadDefaultWorkspace,
        resetWorkspaceViewState,
        renderAll,
        slabel,
        sdot,
        getDb: () => db,
        setDb: next => { db = next; },
        getStorageKey: () => SK,
        getThemeKey: () => THEME_KEY,
        isCurrent
      });

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
        const inspectValueId = executionController?.getInspectValueId?.();
        if (inspectValueId && document.getElementById('valOv')?.classList.contains('open')) {
          executionController.openInspectValue(inspectValueId);
        }
      }
      function initTheme() {
        let stored = 'dark';
        try { stored = localStorage.getItem(THEME_KEY) || 'dark'; } catch { }
        applyTheme(stored, { rerender: false });
      }
      function toggleTheme() {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
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

      customFunctionsController = createCustomFunctionsController({
        extractStackLineCol,
        formatErrorLocation,
        getSettings
      });

      editorsController = createEditorsController({
        parseJSONText,
        getSettings,
        parseCustomFunctions,
        focusEditorLocation,
        clearEditorLocationHighlight,
        getCurrentTheme: () => currentTheme,
        schedSave,
        getDb: () => db,
        getActiveId: () => activeId,
        getRunExpr: () => runExpr,
        getRenderErrorContext: () => renderErrorContext,
        getRunTimer: () => runTimer,
        setRunTimer: next => { runTimer = next; },
        getEditorsState: () => ({
          inputEditor,
          outputEditor,
          exprEditor,
          landingContextEditor,
          landingBindingsEditor,
          landingFunctionsEditor,
          inspectValueEditor
        }),
        setEditorsState: next => {
          inputEditor = next.inputEditor
          outputEditor = next.outputEditor
          exprEditor = next.exprEditor
          landingContextEditor = next.landingContextEditor
          landingBindingsEditor = next.landingBindingsEditor
          landingFunctionsEditor = next.landingFunctionsEditor
          inspectValueEditor = next.inspectValueEditor
        }
      });

      layoutController = createLayoutController({
        getLeftSize: () => rszLeft,
        setLeftSize: next => { rszLeft = next; },
        getTopSize: () => rszTop,
        setTopSize: next => { rszTop = next; }
      });

      function renderErrorContext(ctx) {
        executionController.renderErrorContext(ctx);
      }

      // ── RENDER ALL ────────────────────────────────────────────────
      function renderAll() { renderTree(); renderMain(); }

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

        main.innerHTML = renderWorkspaceView(node, esc, breadcrumb);

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

      function setStat(html) { const el = document.getElementById('sstat'); if (el) el.innerHTML = html; }

      // ── MODALS ────────────────────────────────────────────────────
      document.querySelectorAll('.overlay').forEach(ov => {
        ov.addEventListener('click', e => {
          if (e.target === ov) closeOv();
        });
      });
      document.addEventListener('click', () => document.getElementById('ctxm').classList.remove('open'));

      executionController = createExecutionController({
        esc,
        uid,
        summariseValue,
        parseJSONText,
        splitTopLevelStatements,
        getExpressionSnippet,
        getJsonataErrorLocation,
        formatErrorLocation,
        getSettings,
        parseCustomFunctions,
        registerCustomFunctions,
        getActiveId: () => activeId,
        findNode,
        getEditors: () => ({
          inputEditor,
          outputEditor,
          exprEditor,
          landingFunctionsEditor,
          inspectValueEditor,
          setInspectValueEditor: next => { inspectValueEditor = next; }
        }),
        focusEditorLocation,
        clearEditorLocationHighlight,
        createCMEditor,
        buildEditorExtensions,
        setOutput,
        setRunBadges
      });

      modalController = createModalController({
        uid,
        closeInspectValue: () => executionController.closeInspectValue(),
        allDesc,
        renderTree: () => renderTree(),
        renderMain,
        renderTabs: () => renderTabs(),
        schedSave,
        getDb: () => db,
        setDb: next => { db = next; },
        getActiveId: () => activeId,
        setActiveId: next => { activeId = next; },
        getTabs: () => tabs,
        setTabs: next => { tabs = next; },
        getPickedCol: () => pickedCol,
        setPickedCol: next => { pickedCol = next; },
        getAddCtx: () => addCtx,
        setAddCtx: next => { addCtx = next; },
        getCtxId: () => ctxId,
        setCtxId: next => { ctxId = next; },
        getRnId: () => rnId,
        setRnId: next => { rnId = next; },
        getDelId: () => delId,
        setDelId: next => { delId = next; },
        getColors: () => COLS
      });

      treeController = createTreeController({
        esc,
        kids,
        folderColor,
        renderMain,
        renderTree: () => renderTree(),
        schedSave,
        getActiveId: () => activeId,
        setActiveId: next => { activeId = next; },
        getTabs: () => tabs,
        setTabs: next => { tabs = next; },
        openAddModal,
        openRename,
        openDeleteModal,
        onNodeOpen: showCtx
      });

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

      setupCodeMirrorBridge({
        esc,
        getCustomFunctionEntries,
        getActiveId: () => activeId,
        getEditorsState: () => ({
          inputEditor,
          exprEditor,
          landingContextEditor,
          landingBindingsEditor,
          landingFunctionsEditor
        }),
        initCMEditors: () => {
          const node = db.nodes.find(x => x.id === activeId);
          if (node) initCMEditors(node);
        },
        initLandingEditors
      });
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
        executionController.destroyInspectValueEditor();
      }

      const cleanup = () => {
        if (disposed) return;
        disposed = true;
        if (activeCleanup === cleanup) activeCleanup = null;
        persistence.clearPendingSave();
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
