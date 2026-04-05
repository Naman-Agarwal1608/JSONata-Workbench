export function createEditorsController({
  parseJSONText,
  getSettings,
  parseCustomFunctions,
  focusEditorLocation,
  clearEditorLocationHighlight,
  getCurrentTheme,
  schedSave,
  getDb,
  getActiveId,
  getRunExpr,
  getRenderErrorContext,
  getRunTimer,
  setRunTimer,
  getEditorsState,
  setEditorsState
}) {
  function createCMEditor(parent, doc, extensions) {
    if (!parent || !window._CM?.EditorView) return null
    parent.innerHTML = ''
    return new window._CM.EditorView({ doc: doc || '', extensions, parent })
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
    if (!window._CM) return []
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
    } = window._CM
    const extensions = [...basicSetup]
    if (withErrorMarkers && window._CM.errorMarkerExt) extensions.push(window._CM.errorMarkerExt())
    if (mode === 'json') {
      if (jsonFoldSummaryExt) extensions.push(jsonFoldSummaryExt())
      extensions.push(json())
    } else if (mode === 'javascript' && javascript) {
      extensions.push(javascript({ jsx: false, typescript: false }))
    } else if (mode === 'jsonata' && jsonataFn) {
      if (jsonataFoldSummaryExt) extensions.push(jsonataFoldSummaryExt())
      extensions.push(jsonataFn())
    }
    if (getCurrentTheme() === 'dark') extensions.push(oneDark)
    extensions.push(searchExt({ top: false }))
    if (autocomplete) extensions.push(autocomplete)
    if (hover) extensions.push(hover)
    if (updateListener) extensions.push(EditorView.updateListener.of(updateListener))
    if (domHandlers) extensions.push(EditorView.domEventHandlers(domHandlers))
    if (readOnly) extensions.push(EditorState.readOnly.of(true))
    return extensions
  }

  function setRunBadges(state, text = '') {
    const ss = document.getElementById('sstat')
    const ob = document.getElementById('obadge')
    const xb = document.getElementById('xbadge')
    const badgeClass = state ? `pbadge ${state}` : 'pbadge'
    const badgeText = state ? state.toUpperCase() : ''
    if (ss) ss.innerHTML = text
    if (ob) { ob.className = badgeClass; ob.textContent = badgeText }
    if (xb) { xb.className = badgeClass; xb.textContent = badgeText }
  }

  function validateLandingField(field) {
    const settings = getSettings()
    const { landingFunctionsEditor } = getEditorsState()
    if (field === 'globalContext') {
      const res = parseJSONText(settings.globalContext || '', 'Global context')
      const el = document.getElementById('globalContextErr')
      if (el) el.textContent = res.ok ? '' : res.message
    }
    if (field === 'bindings') {
      const res = parseJSONText(settings.bindings || '', 'Bindings', { requireObject: true })
      const el = document.getElementById('bindingsErr')
      if (el) el.textContent = res.ok ? '' : res.message
    }
    if (field === 'functions') {
      const res = parseCustomFunctions(settings.customFunctions || '')
      const el = document.getElementById('functionsErr')
      if (el) el.textContent = res.ok ? '' : res.message
      if (!res.ok && res.location && landingFunctionsEditor) focusEditorLocation(landingFunctionsEditor, res.location)
    }
  }

  function initLandingEditors() {
    if (!window._CM) return
    const { jsAutocomplete } = window._CM
    const settings = getSettings()
    const ctxEl = document.getElementById('globalContextCM')
    const bindingsEl = document.getElementById('bindingsCM')
    const fnEl = document.getElementById('functionsCM')
    const editors = getEditorsState()
    if (ctxEl) {
      editors.landingContextEditor = createCMEditor(ctxEl, settings.globalContext || '', buildEditorExtensions({
        mode: 'json',
        updateListener: v => {
          if (!v.docChanged) return
          getSettings().globalContext = v.state.doc.toString()
          schedSave()
          validateLandingField('globalContext')
        }
      }))
    }
    if (bindingsEl) {
      editors.landingBindingsEditor = createCMEditor(bindingsEl, settings.bindings || '', buildEditorExtensions({
        mode: 'json',
        updateListener: v => {
          if (!v.docChanged) return
          getSettings().bindings = v.state.doc.toString()
          schedSave()
          validateLandingField('bindings')
        }
      }))
    }
    if (fnEl) {
      editors.landingFunctionsEditor = createCMEditor(fnEl, settings.customFunctions || '', buildEditorExtensions({
        mode: 'javascript',
        withErrorMarkers: true,
        autocomplete: jsAutocomplete,
        updateListener: v => {
          if (!v.docChanged) return
          clearEditorLocationHighlight(editors.landingFunctionsEditor)
          getSettings().customFunctions = v.state.doc.toString()
          schedSave()
          validateLandingField('functions')
          if (editors.exprEditor) editors.exprEditor.dispatch({})
        }
      }))
    }
    setEditorsState(editors)
    validateLandingField('globalContext')
    validateLandingField('bindings')
    validateLandingField('functions')
  }

  function checkJSON(val) {
    const el = document.getElementById('jerr')
    if (!el) return
    if (!val.trim()) { el.textContent = ''; return }
    try {
      JSON.parse(val)
      el.textContent = ''
    } catch (e) {
      el.textContent = '⚠ ' + e.message.split('\n')[0]
    }
  }

  function onInputChange(val) {
    const node = getDb().nodes.find(x => x.id === getActiveId())
    if (node) {
      node.input = val
      schedSave()
    }
    checkJSON(val)
    scheduleRun()
  }

  function fmtJSON() {
    const { inputEditor } = getEditorsState()
    if (!inputEditor) return
    try {
      const v = JSON.stringify(JSON.parse(inputEditor.state.doc.toString()), null, 2)
      inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: v } })
    } catch { }
  }

  function minJSON() {
    const { inputEditor } = getEditorsState()
    if (!inputEditor) return
    try {
      const v = JSON.stringify(JSON.parse(inputEditor.state.doc.toString()))
      inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: v } })
    } catch { }
  }

  function clearInput() {
    const { inputEditor } = getEditorsState()
    if (!inputEditor) return
    inputEditor.dispatch({ changes: { from: 0, to: inputEditor.state.doc.length, insert: '' } })
  }

  function onExprChange(val) {
    const node = getDb().nodes.find(x => x.id === getActiveId())
    if (node) {
      node.expr = val
      schedSave()
    }
    scheduleRun()
  }

  function scheduleRun() {
    clearTimeout(getRunTimer())
    setRunTimer(setTimeout(() => getRunExpr()(), 600))
  }

  function initCMEditors(node) {
    if (!window._CM) return
    const { jsonataCompletion, jsonataHover } = window._CM
    const inputEl = document.getElementById('inputCM')
    const outEl = document.getElementById('outCM')
    if (!inputEl || !outEl) return
    const editors = getEditorsState()
    editors.inputEditor = createCMEditor(inputEl, node.input || '', buildEditorExtensions({
      mode: 'json',
      withErrorMarkers: true,
      updateListener: v => {
        if (!v.docChanged) return
        onInputChange(v.state.doc.toString())
      },
      domHandlers: {
        paste() {
          setTimeout(() => {
            const latest = getEditorsState().inputEditor
            if (!latest) return
            const val = latest.state.doc.toString()
            try {
              const fmt = JSON.stringify(JSON.parse(val), null, 2)
              if (fmt === val) return
              latest.dispatch({ changes: { from: 0, to: latest.state.doc.length, insert: fmt } })
            } catch { }
          }, 20)
        }
      }
    }))

    editors.outputEditor = createCMEditor(outEl, '', buildEditorExtensions({
      mode: 'json',
      withErrorMarkers: true,
      readOnly: true
    }))

    const exprEl = document.getElementById('exprCM')
    if (exprEl) {
      editors.exprEditor = createCMEditor(exprEl, node.expr || '', buildEditorExtensions({
        mode: 'jsonata',
        withErrorMarkers: true,
        autocomplete: jsonataCompletion,
        hover: jsonataHover,
        updateListener: v => {
          if (!v.docChanged) return
          clearEditorLocationHighlight(getEditorsState().exprEditor)
          onExprChange(v.state.doc.toString())
        }
      }))
    }

    setEditorsState(editors)
  }

  function setOutput(text, state, errorContext = null) {
    const { outputEditor } = getEditorsState()
    const outCM = document.getElementById('outCM')
    const ov = document.getElementById('outview')
    getRenderErrorContext()(errorContext)
    if (state === 'ok' && outputEditor) {
      if (outCM) { outCM.style.display = ''; outCM.className = 'cm-wrap' }
      if (ov) ov.style.display = 'none'
      outputEditor.dispatch({ changes: { from: 0, to: outputEditor.state.doc.length, insert: text } })
    } else {
      if (outCM) outCM.style.display = 'none'
      if (ov) {
        ov.style.display = ''
        ov.className = 'outview' + (state === 'err' ? ' err' : state === 'empty' ? ' empty' : '')
        ov.textContent = text
      }
    }
  }

  function destroyScriptEditors() {
    const editors = getEditorsState()
    if (editors.inputEditor) { editors.inputEditor.destroy(); editors.inputEditor = null }
    if (editors.outputEditor) { editors.outputEditor.destroy(); editors.outputEditor = null }
    if (editors.exprEditor) { editors.exprEditor.destroy(); editors.exprEditor = null }
    setEditorsState(editors)
  }

  function destroyLandingEditors() {
    const editors = getEditorsState()
    if (editors.landingContextEditor) { editors.landingContextEditor.destroy(); editors.landingContextEditor = null }
    if (editors.landingBindingsEditor) { editors.landingBindingsEditor.destroy(); editors.landingBindingsEditor = null }
    if (editors.landingFunctionsEditor) { editors.landingFunctionsEditor.destroy(); editors.landingFunctionsEditor = null }
    setEditorsState(editors)
  }

  return {
    createCMEditor,
    buildEditorExtensions,
    setRunBadges,
    initLandingEditors,
    validateLandingField,
    fmtJSON,
    minJSON,
    clearInput,
    scheduleRun,
    initCMEditors,
    setOutput,
    destroyScriptEditors,
    destroyLandingEditors
  }
}
