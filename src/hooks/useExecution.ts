import { useEffect, useRef, useState } from 'react'
import jsonata from 'jsonata'
import type { ExecContext, InspectEntry, RunStatus, WorkspaceDB, WorkspaceNode } from '../types/workspace'
import type { EditorView } from '../lib/codemirror'
import { setEditorErrorLocation, clearEditorErrorLocation } from '../lib/codemirror'
import { parseJSONText, summariseValue, getExpressionSnippet, getJsonataErrorLocation, formatErrorLocation, splitTopLevelStatements, uid } from '../lib/helpers'
import { parseCustomFunctions, registerCustomFunctions } from '../lib/customFunctions'
import { getSettings } from '../lib/workspace'

interface UseExecutionOptions {
  node: WorkspaceNode
  db: WorkspaceDB
  inputEditorRef: React.RefObject<EditorView | null>
  exprEditorRef: React.RefObject<EditorView | null>
  onOpenInspectValue: (entry: InspectEntry) => void
}

export interface ExecutionResult {
  outputText: string
  outputState: 'ok' | 'err' | 'empty'
  runStatus: RunStatus
  execCtx: ExecContext | null
  execCtxExpanded: boolean
  execCtxTab: 'values' | 'scope' | 'functions'
  inspectEntries: Map<string, InspectEntry>
  run: () => Promise<void>
  scheduleRun: () => void
  toggleExecCtx: (force?: boolean) => void
  setExecCtxTab: (tab: 'values' | 'scope' | 'functions') => void
  openInspectValue: (id: string) => void
}

const AUTO_RUN_DEBOUNCE_MS = 250

function formatDurationMs(ms: number): number {
  return ms < 10 ? Number(ms.toFixed(2)) : ms < 100 ? Number(ms.toFixed(1)) : Math.round(ms)
}

async function getVariableSnapshots(
  expr: string,
  loc: { line?: number } | null,
  data: unknown,
  bindings: Record<string, unknown>,
  customFns: ReturnType<typeof parseCustomFunctions>['value'],
): Promise<Array<{ name: string; value: unknown; line: number }>> {
  const statements = splitTopLevelStatements(expr)
  const snapshots: Array<{ name: string; value: unknown; line: number }> = []
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (stmt.endLine >= (loc?.line ?? Infinity)) break
    const match = stmt.text.match(/^\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s*:=\s*([\s\S]+)$/)
    if (!match) continue
    const varName = match[1]
    const prefix = statements.slice(0, i + 1).map(s => s.text).join(';\n')
    try {
      const compiled = jsonata(`(\n${prefix};\n${varName}\n)`)
      registerCustomFunctions(compiled as Parameters<typeof registerCustomFunctions>[0], customFns ?? [])
      const value = await compiled.evaluate(data as object, bindings)
      snapshots.push({ name: varName, value, line: stmt.startLine })
      if (snapshots.length >= 8) break
    } catch { /* skip */ }
  }
  return snapshots
}

async function buildExecutionContext({
  expr, data = {}, bindings, customFns, functionsError, error = null, location = null, resultValue = undefined,
}: {
  expr: string; data?: unknown; bindings?: Record<string, unknown>
  customFns?: ReturnType<typeof parseCustomFunctions>['value']
  functionsError?: ReturnType<typeof parseCustomFunctions> | null
  error?: Error | null; location?: { line?: number } | null; resultValue?: unknown
}): Promise<ExecContext> {
  let variableSnapshots: ExecContext['variableSnapshots'] = []
  try { variableSnapshots = await getVariableSnapshots(expr, location, data, bindings ?? {}, customFns ?? []) } catch { /* ignore */ }
  return {
    status: error ? 'error' : 'ok',
    message: error ? (error.message || String(error)) : '',
    location: location as ExecContext['location'],
    snippet: location ? getExpressionSnippet(expr, location as { line: number; column?: number }) : '',
    variableSnapshots,
    resultValue,
    bindings: Object.keys(bindings ?? {}),
    customFunctions: (customFns ?? []).map(fn => ({ label: fn.label, info: fn.info ?? 'Custom workspace function' })),
    functionsError: functionsError?.ok === false ? (functionsError.message ?? '') : '',
  }
}

export function useExecution({ node, db, inputEditorRef, exprEditorRef, onOpenInspectValue }: UseExecutionOptions): ExecutionResult {
  const [outputText, setOutputText] = useState('Run the expression to see results…')
  const [outputState, setOutputState] = useState<'ok' | 'err' | 'empty'>('empty')
  const [runStatus, setRunStatus] = useState<RunStatus>({ kind: 'idle' })
  const [execCtx, setExecCtx] = useState<ExecContext | null>(null)
  const [execCtxExpanded, setExecCtxExpanded] = useState(false)
  const [execCtxTab, setExecCtxTabState] = useState<'values' | 'scope' | 'functions'>('values')
  const [inspectEntries, setInspectEntries] = useState(() => new Map<string, InspectEntry>())

  const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const execCtxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const execCtxTokenRef = useRef(0)
  // Stable refs so async run() always has the latest
  const nodeRef = useRef(node)
  const dbRef = useRef(db)
  useEffect(() => { nodeRef.current = node }, [node])
  useEffect(() => { dbRef.current = db }, [db])

  function setOutput(text: string, state: 'ok' | 'err' | 'empty') {
    setOutputText(text)
    setOutputState(state)
  }

  function scheduleExecutionContext(task: () => Promise<ExecContext>, expr: string): void {
    execCtxTokenRef.current += 1
    const token = execCtxTokenRef.current
    if (execCtxTimerRef.current) clearTimeout(execCtxTimerRef.current)
    execCtxTimerRef.current = setTimeout(() => {
      task().then(ctx => {
        const latestExpr = exprEditorRef.current?.state.doc.toString().trim()
        if (token === execCtxTokenRef.current && latestExpr && latestExpr === expr) {
          setExecCtx(ctx)
          setInspectEntries(buildInspectEntries(ctx))
        }
      }).catch(() => { /* ignore */ })
    }, 0)
  }

  async function run(): Promise<void> {
    const exprView = exprEditorRef.current
    if (!exprView) return
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current)
      runTimerRef.current = null
    }

    const expr = exprView.state.doc.toString().trim()
    if (!expr) {
      clearEditorErrorLocation(exprView)
      setOutput('Enter an expression in the middle panel…', 'empty')
      setRunStatus({ kind: 'idle' })
      setExecCtx(null)
      return
    }

    const settings = getSettings(dbRef.current)
    const bindingsResult = parseJSONText(settings.bindings || '', 'Bindings', { requireObject: true })
    if (!bindingsResult.ok) {
      clearEditorErrorLocation(exprView)
      setOutput(bindingsResult.message ?? 'Invalid bindings', 'err')
      setExecCtxExpanded(true)
      scheduleExecutionContext(
        () => buildExecutionContext({ expr, bindings: {}, customFns: [], error: new Error(bindingsResult.message) }),
        expr,
      )
      setRunStatus({ kind: 'err', text: '✗ Invalid bindings' })
      return
    }

    const functionsResult = parseCustomFunctions(settings.customFunctions || '')
    const customFns = functionsResult.ok ? (functionsResult.value ?? []) : []

    let data: unknown = {}
    const rawInput = (inputEditorRef.current ? inputEditorRef.current.state.doc.toString() : '').trim()
    const rawGlobal = (settings.globalContext || '').trim()
    const sourceLabel = rawInput ? 'JSON input' : 'Global context'
    const dataRaw = rawInput || rawGlobal
    if (dataRaw) {
      try { data = JSON.parse(dataRaw) } catch (e) {
        clearEditorErrorLocation(exprView)
        const msg = sourceLabel + ' error:\n' + (e instanceof Error ? e.message : String(e))
        setOutput(msg, 'err')
        setExecCtxExpanded(true)
        scheduleExecutionContext(
          () => buildExecutionContext({
            expr, bindings: bindingsResult.value as Record<string, unknown>, customFns, functionsError: functionsResult, error: new Error(msg),
          }),
          expr,
        )
        setRunStatus({ kind: 'err', text: `✗ Invalid ${sourceLabel.toLowerCase()}` })
        return
      }
    }

    const startedAt = performance.now()
    setRunStatus({ kind: 'busy', text: 'Running…' })
    try {
      const compiled = jsonata(expr)
      registerCustomFunctions(compiled as Parameters<typeof registerCustomFunctions>[0], customFns)
      const result = await compiled.evaluate(data as object, bindingsResult.value as Record<string, unknown>)
      const durationMs = formatDurationMs(performance.now() - startedAt)
      const out = result === undefined ? '(undefined — expression returned no value)' : JSON.stringify(result, null, 2)
      clearEditorErrorLocation(exprView)
      setOutput(out, 'ok')
      const warn = !functionsResult.ok ? ' · custom functions ignored' : ''
      setRunStatus({ kind: 'ok', text: '✓ OK' + warn, durationMs })
      scheduleExecutionContext(
        () => buildExecutionContext({
          expr, data, bindings: bindingsResult.value as Record<string, unknown>,
          customFns, functionsError: functionsResult, resultValue: result,
        }),
        expr,
      )
    } catch (e) {
      const durationMs = formatDurationMs(performance.now() - startedAt)
      const err = e as Error & { position?: number }
      const loc = getJsonataErrorLocation(err, expr)
      if (loc) setEditorErrorLocation(exprView, loc)
      const msg = (err.message || String(err)) + formatErrorLocation(loc)
      setOutput(msg, 'err')
      setExecCtxExpanded(true)
      scheduleExecutionContext(
        () => buildExecutionContext({
          error: err, expr, data, location: loc,
          bindings: bindingsResult.value as Record<string, unknown>,
          customFns, functionsError: functionsResult,
        }),
        expr,
      )
      setRunStatus({ kind: 'err', text: '✗ ' + (msg || 'Error'), durationMs })
    }
  }

  function buildInspectEntries(ctx: ExecContext): Map<string, InspectEntry> {
    const map = new Map<string, InspectEntry>()
    if (ctx.resultValue !== undefined) {
      const id = uid(); map.set(id, { label: '$result', value: ctx.resultValue, meta: ctx.status === 'error' ? 'last computed result' : 'expression result' })
    }
    ctx.variableSnapshots.forEach(v => {
      const id = uid(); map.set(id, { label: v.name, value: v.value, meta: `line ${v.line}` })
    })
    return map
  }

  function scheduleRun(): void {
    if (runTimerRef.current) clearTimeout(runTimerRef.current)
    setRunStatus({ kind: 'busy', text: 'Running…' })
    runTimerRef.current = setTimeout(run, AUTO_RUN_DEBOUNCE_MS)
  }

  function toggleExecCtx(force?: boolean): void {
    setExecCtxExpanded(prev => typeof force === 'boolean' ? force : !prev)
  }

  function setExecCtxTab(tab: 'values' | 'scope' | 'functions'): void {
    setExecCtxTabState(tab)
  }

  function openInspectValue(id: string): void {
    const entry = inspectEntries.get(id)
    if (!entry) return
    onOpenInspectValue(entry)
  }

  // auto-run on mount if there's already content
  useEffect(() => {
    if (node.expr?.trim()) scheduleRun()
    return () => {
      if (runTimerRef.current) clearTimeout(runTimerRef.current)
      if (execCtxTimerRef.current) clearTimeout(execCtxTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // expand inspector on error
  useEffect(() => {
    if (execCtx?.status === 'error') setExecCtxExpanded(true)
  }, [execCtx])

  return {
    outputText, outputState, runStatus,
    execCtx, execCtxExpanded, execCtxTab, inspectEntries,
    run, scheduleRun, toggleExecCtx, setExecCtxTab, openInspectValue,
  }
}
