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
import type { EditorView, HoverContext } from '../../lib/codemirror'
import { extractJsonKeys, getValueViewerConfig, parseExecutionData } from '../../lib/helpers'
import { buildExecutionEnvironment } from '../../lib/execution'

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
    outputText, outputState, outputMode, runStatus,
    execCtx, execCtxExpanded, execCtxTab, inspectEntries,
    run, scheduleRun, toggleExecCtx, setExecCtxTab, openInspectValue, evaluateSelection,
  } = execution

  const [jsonErr, setJsonErr] = useState('')
  const [selectionTooltip, setSelectionTooltip] = useState<{
    label: string
    value: unknown
    top: number
    left: number
  } | null>(null)
  const selectionHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectionCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectionTooltipHoverRef = useRef(false)
  const selectionTooltipPinnedRef = useRef(false)

  const clearSelectionHoverTimer = useCallback(() => {
    if (selectionHoverTimerRef.current) {
      clearTimeout(selectionHoverTimerRef.current)
      selectionHoverTimerRef.current = null
    }
  }, [])

  const clearSelectionCloseTimer = useCallback(() => {
    if (selectionCloseTimerRef.current) {
      clearTimeout(selectionCloseTimerRef.current)
      selectionCloseTimerRef.current = null
    }
  }, [])

  const closeSelectionTooltip = useCallback(() => {
    clearSelectionHoverTimer()
    clearSelectionCloseTimer()
    selectionTooltipPinnedRef.current = false
    selectionTooltipHoverRef.current = false
    setSelectionTooltip(null)
  }, [clearSelectionCloseTimer, clearSelectionHoverTimer])

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
    const rawInput = inputEditorRef.current?.state.doc.toString().trim() || ''
    const rawGlobal = db.settings.globalContext || ''
    const dataResult = parseExecutionData(rawInput, rawGlobal)
    if (!dataResult.ok) return []
    return extractJsonKeys(dataResult.value)
  // inputEditorRef is a live ref — no dep needed for it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings.globalContext])

  // Live refs so hover always sees the latest values without remounting the editor
  const bindingsRawRef = useRef(db.settings.bindings)
  bindingsRawRef.current = db.settings.bindings
  const globalContextRef = useRef(db.settings.globalContext)
  globalContextRef.current = db.settings.globalContext
  const customFnsRawRef = useRef(db.settings.customFunctions)
  customFnsRawRef.current = db.settings.customFunctions
  const getHoverContext = useCallback((): HoverContext | null => {
    const envResult = buildExecutionEnvironment(
      inputEditorRef.current?.state.doc.toString() ?? '',
      globalContextRef.current || '',
      bindingsRawRef.current || '',
      customFnsRawRef.current || '',
    )
    if (!envResult.ok) return null
    return {
      inputData: envResult.value.data,
      bindingValues: envResult.value.bindings,
      customFns: envResult.value.customFns,
    }
  }, [])

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

  useEffect(() => {
    if (!selectionTooltip) return
    function closeOnPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('.selection-tooltip')) return
      closeSelectionTooltip()
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSelectionTooltip()
    }
    document.addEventListener('mousedown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeSelectionTooltip, selectionTooltip])

  async function showSelectionTooltip() {
    const exprView = exprEditorRef.current
    if (!exprView) return
    const mainSel = exprView.state.selection.main
    if (mainSel.empty) {
      closeSelectionTooltip()
      return
    }
    try {
      const result = await evaluateSelection()
      if (!result) {
        closeSelectionTooltip()
        return
      }
      const coords = exprView.coordsAtPos(result.to) ?? exprView.coordsAtPos(result.from)
      if (!coords) return
      setSelectionTooltip({
        label: result.label,
        value: result.value,
        top: coords.bottom + 8,
        left: Math.min(coords.left, window.innerWidth - 460),
      })
    } catch (error) {
      const selected = exprView.state.sliceDoc(mainSel.from, mainSel.to).trim()
      const coords = exprView.coordsAtPos(mainSel.to) ?? exprView.coordsAtPos(mainSel.from)
      if (!coords) return
      setSelectionTooltip({
        label: selected || 'Selection',
        value: error,
        top: coords.bottom + 8,
        left: Math.min(coords.left, window.innerWidth - 460),
      })
    }
  }

  useEffect(() => {
    const exprView = exprEditorRef.current
    if (!exprView) return

    function scheduleCloseSelectionTooltip() {
      if (selectionTooltipPinnedRef.current) return
      clearSelectionCloseTimer()
      selectionCloseTimerRef.current = setTimeout(() => {
        if (!selectionTooltipHoverRef.current && !selectionTooltipPinnedRef.current) closeSelectionTooltip()
      }, 220)
    }

    function onMouseMove(e: MouseEvent) {
      const view = exprEditorRef.current
      if (!view) return
      if (!selectionTooltipHoverRef.current && !selectionTooltipPinnedRef.current) clearSelectionCloseTimer()
      const mainSel = view.state.selection.main
      if (mainSel.empty) {
        closeSelectionTooltip()
        return
      }
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null || pos < mainSel.from || pos > mainSel.to) {
        if (!selectionTooltipHoverRef.current && !selectionTooltipPinnedRef.current) scheduleCloseSelectionTooltip()
        return
      }
      clearSelectionHoverTimer()
      selectionHoverTimerRef.current = setTimeout(() => {
        void showSelectionTooltip()
      }, 180)
    }

    function onMouseLeave(e: MouseEvent) {
      const related = e.relatedTarget as HTMLElement | null
      if (related?.closest('.selection-tooltip')) return
      scheduleCloseSelectionTooltip()
    }

    function onMouseDown() {
      closeSelectionTooltip()
    }

    exprView.dom.addEventListener('mousemove', onMouseMove)
    exprView.dom.addEventListener('mouseleave', onMouseLeave)
    exprView.dom.addEventListener('mousedown', onMouseDown)
    return () => {
      clearSelectionHoverTimer()
      clearSelectionCloseTimer()
      exprView.dom.removeEventListener('mousemove', onMouseMove)
      exprView.dom.removeEventListener('mouseleave', onMouseLeave)
      exprView.dom.removeEventListener('mousedown', onMouseDown)
    }
  }, [clearSelectionCloseTimer, clearSelectionHoverTimer, closeSelectionTooltip, evaluateSelection])

  const badgeClass = runStatus.kind !== 'idle' ? runStatus.kind : ''
  const badgeText = runStatus.kind !== 'idle' ? runStatus.text : ''
  const statusText = runStatus.kind !== 'idle' ? runStatus.text : 'Ready'
  const durationText = runStatus.kind !== 'idle' && typeof runStatus.durationMs === 'number'
    ? `${runStatus.durationMs} ms`
    : ''
  const selectionViewer = selectionTooltip ? getValueViewerConfig(selectionTooltip.value) : null

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
                  getHoverContext={getHoverContext}
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
                  mode={outputMode}
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
      {selectionTooltip && (
        <div
          className="selection-tooltip cm-tooltip cm-tooltip-hover"
          style={{ position: 'fixed', top: selectionTooltip.top, left: selectionTooltip.left, zIndex: 60 }}
          onMouseEnter={() => {
            selectionTooltipHoverRef.current = true
            selectionTooltipPinnedRef.current = true
            if (selectionCloseTimerRef.current) {
              clearTimeout(selectionCloseTimerRef.current)
              selectionCloseTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            selectionTooltipHoverRef.current = false
          }}
        >
          <div className="cm-fn-tooltip">
            <div className="cm-fn-tt-sig">{selectionTooltip.label}</div>
            <div className="cm-fn-tt-editorHost">
              {selectionViewer && (
                <CodeMirrorEditor
                  key={`selection-tooltip-${theme}-${selectionTooltip.label}-${selectionViewer.mode}-${selectionViewer.doc.slice(0, 80)}`}
                  initialValue={selectionViewer.doc}
                  mode={selectionViewer.mode}
                  readOnly
                  theme={theme}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
