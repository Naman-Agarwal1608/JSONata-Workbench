import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeMirrorEditor } from '../ui/CodeMirrorEditor'
import { TabBar } from './TabBar'
import { InspectorPanel } from './InspectorPanel'
import './WorkspaceView.css'
import { usePersistenceContext, useUIState, useWorkspaceState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { useExecution } from '../../hooks/useExecution'
import { useResizablePanels } from '../../hooks/useResizablePanels'
import { breadcrumb, findNode } from '../../lib/workspace'
import { parseCustomFunctions } from '../../lib/customFunctions'
import type { EditorView } from '../../lib/codemirror'
import { extractJsonKeys } from '../../lib/codemirror'

export function WorkspaceView() {
  const { db } = useWorkspaceState()
  const { activeId, theme } = useUIState()
  const { schedSave } = usePersistenceContext()
  const actions = useWorkspaceActions()

  const node = findNode(db, activeId!)!
  const inputEditorRef = useRef<EditorView | null>(null)
  const exprEditorRef = useRef<EditorView | null>(null)

  const { rszLeft, rszTop, hRszRef, vRszRef, panelsTopRef, panelsRef } = useResizablePanels()
  const [inspectorH, setInspectorH] = useState(260)
  const inspectorHRef = useRef(inspectorH)
  inspectorHRef.current = inspectorH
  const iRszRef = useRef<HTMLDivElement>(null)
  const outPanelRef = useRef<HTMLDivElement>(null)
  const breadcrumbText = useMemo(() => breadcrumb(db, activeId!), [db, activeId])

  const execution = useExecution({
    node,
    db,
    inputEditorRef,
    exprEditorRef,
    onOpenInspectValue: actions.openValueInspector,
  })
  const {
    outputText, outputState, runStatus,
    execCtx, execCtxExpanded, execCtxTab, inspectEntries,
    run, scheduleRun, toggleExecCtx, setExecCtxTab, openInspectValue,
  } = execution

  const [jsonErr, setJsonErr] = useState('')

  const getCustomFunctionEntries = useCallback(() => {
    const result = parseCustomFunctions(db.settings.customFunctions || '')
    return result.ok ? (result.value ?? []) : []
  }, [db.settings.customFunctions])

  const getBindingVars = useCallback(() => {
    try {
      const obj = JSON.parse(db.settings.bindings || '')
      if (obj && typeof obj === 'object' && !Array.isArray(obj))
        return Object.keys(obj).map(k => '$' + k)
    } catch { /* invalid JSON, return empty */ }
    return []
  }, [db.settings.bindings])

  const getInputKeys = useCallback(() => {
    const raw = (inputEditorRef.current?.state.doc.toString().trim() || db.settings.globalContext || '').trim()
    if (!raw) return []
    try { return extractJsonKeys(JSON.parse(raw)) } catch { return [] }
  // inputEditorRef is a live ref — no dep needed for it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings.globalContext])

  function handleInputUpdate(val: string) {
    actions.updateNodeField(activeId!, 'input', val)
    schedSave()
    setJsonErr(!val.trim() ? '' : (() => { try { JSON.parse(val); return '' } catch (e) { return '⚠ ' + (e instanceof Error ? e.message.split('\n')[0] : '') } })())
    scheduleRun()
  }

  function handleInputPaste(val: string, view: EditorView) {
    try {
      const fmt = JSON.stringify(JSON.parse(val), null, 2)
      if (fmt !== val) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fmt } })
    } catch { /* not valid json, leave as-is */ }
  }

  function handleExprUpdate(val: string) {
    actions.updateNodeField(activeId!, 'expr', val)
    schedSave()
    scheduleRun()
  }

  function fmtJSON() {
    const view = inputEditorRef.current
    if (!view) return
    try {
      const fmt = JSON.stringify(JSON.parse(view.state.doc.toString()), null, 2)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fmt } })
    } catch { /* ignore */ }
  }

  function minJSON() {
    const view = inputEditorRef.current
    if (!view) return
    try {
      const min = JSON.stringify(JSON.parse(view.state.doc.toString()))
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: min } })
    } catch { /* ignore */ }
  }

  function clearInput() {
    const view = inputEditorRef.current
    if (!view) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } })
  }

  // Inspector drag-to-resize
  useEffect(() => {
    const el = iRszRef.current
    if (!el) return
    function onDown(e: MouseEvent) {
      e.preventDefault()
      const startY = e.clientY
      const startH = inspectorHRef.current
      el!.classList.add('dragging')
      function onMove(ev: MouseEvent) {
        const totalH = outPanelRef.current?.getBoundingClientRect().height ?? 400
        setInspectorH(Math.max(120, Math.min(totalH - 80, startH + (startY - ev.clientY))))
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        el!.classList.remove('dragging')
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [execCtxExpanded])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [run])

  const badgeClass = runStatus.kind !== 'idle' ? runStatus.kind : ''
  const badgeText = runStatus.kind !== 'idle' ? runStatus.text : ''
  const statusText = runStatus.kind !== 'idle' ? runStatus.text : 'Ready'
  const durationText = runStatus.kind !== 'idle' && typeof runStatus.durationMs === 'number'
    ? `${runStatus.durationMs} ms`
    : ''

  return (
    <>
      <TabBar />
      <div className="editor">
        <div className="etoolbar">
          <input
            className="ename"
            defaultValue={node.name}
            placeholder="Untitled"
            onChange={e => {
              actions.updateNodeField(activeId!, 'name', e.target.value)
              schedSave()
            }}
          />
          <span className="bctag" title={breadcrumbText}>{breadcrumbText}</span>
          <button className="hbtn prim" onClick={run}>
            ▶ Run <small style={{ opacity: .55, fontSize: 10 }}>⌘↵</small>
          </button>
        </div>

        <div className="panels" ref={panelsRef}>
          <div
            className="panels-top"
            ref={panelsTopRef}
            style={{ flexGrow: rszTop, flexShrink: 1, flexBasis: 0 }}
          >
            <div className="panel" id="panelInput" style={{ flexGrow: rszLeft, flexShrink: 1, flexBasis: 0 }}>
              <div className="phead">
                <span className="ptitle">Input JSON</span>
                {jsonErr && <span className="jerr">{jsonErr}</span>}
              </div>
              <div className="jtoolbar">
                <button className="jbtn" onClick={fmtJSON}>Format</button>
                <button className="jbtn" onClick={minJSON}>Minify</button>
                <button className="jbtn" onClick={clearInput}>Clear</button>
              </div>
              <div className="cm-wrap">
                <CodeMirrorEditor
                  key={`input-${activeId}-${theme}`}
                  initialValue={node.input}
                  mode="json"
                  withErrorMarkers
                  theme={theme}
                  editorRef={inputEditorRef}
                  onUpdate={handleInputUpdate}
                  onPaste={handleInputPaste}
                />
              </div>
            </div>

            <div className="rsz-h" ref={hRszRef} />

            <div className="panel" id="panelExpr" style={{ flexGrow: 100 - rszLeft, flexShrink: 1, flexBasis: 0 }}>
              <div className="phead">
                <span className="ptitle">Expression</span>
                {badgeClass && (
                  <span className={`pbadge ${badgeClass}`}>{badgeText}</span>
                )}
              </div>
              <div className="cm-wrap">
                <CodeMirrorEditor
                  key={`expr-${activeId}-${theme}`}
                  initialValue={node.expr}
                  mode="jsonata"
                  withErrorMarkers
                  theme={theme}
                  editorRef={exprEditorRef}
                  getCustomFunctionEntries={getCustomFunctionEntries}
                  getBindingVars={getBindingVars}
                  getInputKeys={getInputKeys}
                  onUpdate={handleExprUpdate}
                />
              </div>
            </div>
          </div>

          <div className="rsz-v" ref={vRszRef} />

          <div
            ref={outPanelRef}
            className="panel"
            id="panelOut"
            style={{ flexGrow: 100 - rszTop, flexShrink: 1, flexBasis: 0, borderTop: '1px solid var(--bdr)' }}
          >
            <div className="phead">
              <span className="ptitle">Output</span>
              {badgeClass && (
                <span className={`pbadge ${badgeClass}`}>{badgeText}</span>
              )}
            </div>

            {outputState === 'ok' ? (
              <div className="cm-wrap">
                <CodeMirrorEditor
                  key={`out-${activeId}-${theme}-${outputText.slice(0, 20)}`}
                  initialValue={outputText}
                  mode="json"
                  readOnly
                  withErrorMarkers
                  theme={theme}
                />
              </div>
            ) : (
              <div className={`outview${outputState === 'err' ? ' err' : outputState === 'empty' ? ' empty' : ''}`}>
                {outputText}
              </div>
            )}

            {execCtxExpanded && <div className="rsz-v" ref={iRszRef} />}
            <InspectorPanel
              execCtx={execCtx}
              execCtxExpanded={execCtxExpanded}
              height={inspectorH}
              execCtxTab={execCtxTab}
              inspectEntries={inspectEntries}
              onToggle={toggleExecCtx}
              onSetTab={setExecCtxTab}
              onInspectValue={openInspectValue}
            />
          </div>
        </div>

        <div className="sbar">
          <span>{statusText}</span>
          {durationText && <span>{durationText}</span>}
        </div>
      </div>
    </>
  )
}
