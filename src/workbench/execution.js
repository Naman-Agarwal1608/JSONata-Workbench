import jsonata from 'jsonata'

export function createExecutionController({
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
  getActiveId,
  findNode,
  getEditors,
  focusEditorLocation,
  clearEditorLocationHighlight,
  createCMEditor,
  buildEditorExtensions,
  setOutput,
  setRunBadges
}) {
  let inspectValueStore = new Map()
  let inspectValueId = null
  let execCtxExpanded = false
  let execCtxTab = 'values'

  async function getVariableSnapshots(expr, loc, data, bindings, customFns) {
    const statements = splitTopLevelStatements(expr)
    const snapshots = []
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      if (stmt.endLine >= (loc?.line || Infinity)) break
      const match = stmt.text.match(/^\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s*:=\s*([\s\S]+)$/)
      if (!match) continue
      const varName = match[1]
      const prefix = statements.slice(0, i + 1).map(s => s.text).join(';\n')
      try {
        const compiled = jsonata(`(\n${prefix};\n${varName}\n)`)
        registerCustomFunctions(compiled, customFns)
        const value = await compiled.evaluate(data, bindings)
        snapshots.push({ name: varName, value, line: stmt.startLine })
        if (snapshots.length >= 8) break
      } catch { }
    }
    return snapshots
  }

  async function buildExecutionContext({
    expr,
    data = {},
    bindings,
    customFns,
    functionsError,
    error = null,
    location = null,
    resultValue = undefined
  }) {
    const effectiveLoc = location || null
    let variableSnapshots = []
    try {
      variableSnapshots = await getVariableSnapshots(expr, effectiveLoc, data, bindings || {}, customFns || [])
    } catch (e) {
      console.error('Variable snapshot build failed:', e)
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
    }
  }

  function updateExecContextUI(ctx) {
    const shell = document.getElementById('ctxshell')
    const body = document.getElementById('errctx')
    const meta = document.getElementById('ctxMeta')
    if (!shell || !body || !meta) return
    shell.classList.toggle('expanded', !!execCtxExpanded)
    body.classList.toggle('open', !!execCtxExpanded)
    if (!ctx) {
      meta.textContent = execCtxExpanded ? 'No execution yet' : 'Collapsed'
      return
    }
    if (ctx.status === 'error' && ctx.location) meta.textContent = `Failed at line ${ctx.location.line}, col ${ctx.location.column || 1}`
    else if (ctx.status === 'error') meta.textContent = 'Execution failed'
    else {
      const count = ctx.variableSnapshots.length + (ctx.resultValue !== undefined ? 1 : 0)
      meta.textContent = count ? `${count} value${count === 1 ? '' : 's'}` : 'No values resolved'
    }
  }

  function toggleExecContext(force) {
    execCtxExpanded = typeof force === 'boolean' ? force : !execCtxExpanded
    updateExecContextUI(window.__lastExecContext || null)
  }

  function setExecContextTab(tab) {
    execCtxTab = tab || 'values'
    renderErrorContext(window.__lastExecContext || null)
  }

  function formatInspectableValue(value) {
    if (value === undefined) return '(undefined)'
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  function destroyInspectValueEditor() {
    const { inspectValueEditor } = getEditors()
    if (inspectValueEditor) {
      inspectValueEditor.destroy()
      getEditors().setInspectValueEditor(null)
    }
  }

  function openInspectValue(id) {
    const entry = inspectValueStore.get(id)
    if (!entry) return
    inspectValueId = id
    document.getElementById('valTitle').textContent = entry.label || 'Value Inspector'
    document.getElementById('valMeta').textContent = entry.meta || 'Read-only value preview'
    const host = document.getElementById('valCM')
    if (!host) return
    host.innerHTML = ''
    destroyInspectValueEditor()
    const text = formatInspectableValue(entry.value)
    if (window._CM) {
      let useJson = false
      if (text !== '(undefined)') {
        try { JSON.parse(text); useJson = true } catch { }
      }
      const editor = createCMEditor(host, text, buildEditorExtensions({
        mode: useJson ? 'json' : 'plain',
        readOnly: true
      }))
      getEditors().setInspectValueEditor(editor)
    } else {
      host.innerHTML = `<pre class="outview" style="display:block">${esc(text)}</pre>`
    }
    document.getElementById('valOv').classList.add('open')
  }

  function renderErrorContext(ctx) {
    const root = document.getElementById('errctx')
    if (!root) return
    window.__lastExecContext = ctx || null
    inspectValueStore = new Map()
    if (!ctx) {
      root.innerHTML = '<div class="errctx-grid"><section class="errctx-card"><div class="errctx-head">Inspector</div><div class="errctx-body"><div class="errctx-item"><small>Run an expression to inspect resolved values, scope, and error details.</small></div></div></section></div>'
      updateExecContextUI(null)
      return
    }
    const mkValueItem = (label, value, meta) => {
      const id = uid()
      inspectValueStore.set(id, { label, value, meta })
      return `
      <button class="errctx-item clickable" data-inspect-id="${id}" type="button">
        <strong><code>${esc(label)}</code></strong>
        <small>${esc(summariseValue(value))}${meta ? ` · ${esc(meta)}` : ''}</small>
      </button>
    `
    }
    const resultValue = ctx.resultValue !== undefined ? mkValueItem('$result', ctx.resultValue, ctx.status === 'error' ? 'last computed result' : 'expression result') : ''
    const variableSnapshots = ctx.variableSnapshots?.length
      ? ctx.variableSnapshots.map(v => mkValueItem(v.name, v.value, `line ${v.line}`)).join('')
      : '<div class="errctx-item"><small>No prior top-level variable values could be resolved.</small></div>'
    const bindings = ctx.bindings.length
      ? ctx.bindings.map(name => `<div class="errctx-item"><code>$${esc(name)}</code></div>`).join('')
      : '<div class="errctx-item"><small>No bindings provided.</small></div>'
    const customFns = ctx.customFunctions.length
      ? ctx.customFunctions.map(fn => `<div class="errctx-item"><strong><code>${esc(fn.label)}</code></strong><small>${esc(fn.info)}</small></div>`).join('')
      : '<div class="errctx-item"><small>No custom functions registered.</small></div>'
    const activeTab = ['values', 'scope', 'functions'].includes(execCtxTab) ? execCtxTab : 'values'
    const errorBlock = ctx.status === 'error' ? `
      <section class="errctx-card">
        <div class="errctx-head">Execution Failure</div>
        <div class="errctx-body">
          <div class="errctx-row"><span class="errctx-k">Location</span><span class="errctx-v">${ctx.location ? `line ${ctx.location.line}, col ${ctx.location.column || 1}` : 'Unknown'}</span></div>
          <div class="errctx-item"><small>${esc(ctx.message || 'Execution failed')}</small></div>
          ${ctx.snippet ? `<pre class="errctx-pre">${esc(ctx.snippet)}</pre>` : ''}
        </div>
      </section>` : ''
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
    </div>`
    root.querySelectorAll('[data-ctx-tab]').forEach(el => {
      el.addEventListener('click', () => setExecContextTab(el.getAttribute('data-ctx-tab')))
    })
    root.querySelectorAll('[data-inspect-id]').forEach(el => {
      el.addEventListener('click', () => openInspectValue(el.getAttribute('data-inspect-id')))
    })
    if (ctx.status === 'error') execCtxExpanded = true
    updateExecContextUI(ctx)
  }

  async function runExpr() {
    const { exprEditor, inputEditor, landingFunctionsEditor } = getEditors()
    if (!exprEditor) return
    if (!window._CM) {
      renderErrorContext(null)
      setOutput('JSONata still loading… wait a moment.', 'err')
      return
    }
    const expr = exprEditor.state.doc.toString().trim()
    if (!expr) {
      clearEditorLocationHighlight(exprEditor)
      setOutput('Enter an expression in the middle panel…', 'empty')
      setRunBadges('', 'Ready')
      return
    }

    const settings = getSettings()
    const bindingsRaw = (settings.bindings || '').trim()
    const bindingsResult = parseJSONText(bindingsRaw, 'Bindings', { requireObject: true })
    if (!bindingsResult.ok) {
      clearEditorLocationHighlight(exprEditor)
      setOutput(bindingsResult.message, 'err', null)
      execCtxExpanded = true
      const ctx = await buildExecutionContext({
        expr,
        bindings: {},
        customFns: [],
        functionsError: { ok: false, message: bindingsResult.message },
        error: new Error(bindingsResult.message)
      })
      renderErrorContext(ctx)
      setRunBadges('err', '<span class="err">✗ Invalid bindings</span>')
      return
    }

    const functionsResult = parseCustomFunctions(settings.customFunctions || '')
    const customFns = functionsResult.ok ? functionsResult.value : []
    if (!functionsResult.ok && functionsResult.location && landingFunctionsEditor) {
      focusEditorLocation(landingFunctionsEditor, functionsResult.location)
    }

    let data = {}
    const rawInput = (inputEditor ? inputEditor.state.doc.toString() : '').trim()
    const rawGlobal = (settings.globalContext || '').trim()
    const sourceLabel = rawInput ? 'JSON input' : 'Global context'
    const dataRaw = rawInput || rawGlobal
    if (dataRaw) {
      try {
        data = JSON.parse(dataRaw)
      } catch (e) {
        clearEditorLocationHighlight(exprEditor)
        const msg = sourceLabel + ' error:\n' + e.message
        setOutput(msg, 'err', null)
        execCtxExpanded = true
        const ctx = await buildExecutionContext({
          expr,
          bindings: bindingsResult.value,
          customFns,
          functionsError: functionsResult,
          error: new Error(msg)
        })
        renderErrorContext(ctx)
        setRunBadges('err', `<span class="err">✗ Invalid ${esc(sourceLabel.toLowerCase())}</span>`)
        return
      }
    }

    try {
      const compiled = jsonata(expr)
      registerCustomFunctions(compiled, customFns)
      const result = await compiled.evaluate(data, bindingsResult.value)
      const out = result === undefined ? '(undefined — expression returned no value)' : JSON.stringify(result, null, 2)
      clearEditorLocationHighlight(exprEditor)
      setOutput(out, 'ok', null)
      buildExecutionContext({
        expr,
        data,
        bindings: bindingsResult.value,
        customFns,
        functionsError: functionsResult,
        resultValue: result
      }).then(ctx => {
        const latestExpr = getEditors().exprEditor?.state.doc.toString().trim()
        if (latestExpr && expr === latestExpr) renderErrorContext(ctx)
      })
      const warn = !functionsResult.ok ? ' · custom functions ignored' : ''
      setRunBadges('ok', '<span class="ok">✓ OK</span> · ' + new Date().toLocaleTimeString() + warn)
    } catch (e) {
      const loc = getJsonataErrorLocation(e, expr)
      if (loc) focusEditorLocation(exprEditor, loc)
      const msg = (e.message || String(e)) + formatErrorLocation(loc)
      setOutput(msg, 'err', null)
      execCtxExpanded = true
      buildExecutionContext({
        error: e,
        expr,
        data,
        location: loc,
        bindings: bindingsResult.value,
        customFns,
        functionsError: functionsResult
      }).then(ctx => {
        const latestExpr = getEditors().exprEditor?.state.doc.toString().trim()
        if (latestExpr && expr === latestExpr) renderErrorContext(ctx)
      })
      setRunBadges('err', '<span class="err">✗ ' + esc(msg || 'Error') + '</span>')
    }
  }

  function closeInspectValue() {
    inspectValueId = null
    destroyInspectValueEditor()
  }

  return {
    runExpr,
    toggleExecContext,
    renderErrorContext,
    openInspectValue,
    closeInspectValue,
    destroyInspectValueEditor,
    getInspectValueId: () => inspectValueId
  }
}
