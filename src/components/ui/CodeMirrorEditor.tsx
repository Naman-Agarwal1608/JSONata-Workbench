import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CustomFunctionEntry } from '../../types/workspace'
import type { EditorView, HoverContext } from '../../lib/codemirror'
import './CodeMirrorEditor.css'

interface CodeMirrorEditorProps {
  initialValue?: string
  mode?: 'json' | 'javascript' | 'jsonata' | 'plain'
  readOnly?: boolean
  withErrorMarkers?: boolean
  theme: 'dark' | 'light'
  onUpdate?: (value: string) => void
  onPaste?: (value: string, view: EditorView) => void
  getCustomFunctionEntries?: () => CustomFunctionEntry[]
  getBindingVars?: () => string[]
  getInputKeys?: () => string[]
  getHoverContext?: () => HoverContext | null
  editorRef?: React.RefObject<EditorView | null>
}

type CodeMirrorRuntime = typeof import('../../lib/codemirror')

let codeMirrorRuntimePromise: Promise<CodeMirrorRuntime> | null = null

function loadCodeMirrorRuntime(): Promise<CodeMirrorRuntime> {
  if (!codeMirrorRuntimePromise) {
    codeMirrorRuntimePromise = import('../../lib/codemirror')
  }
  return codeMirrorRuntimePromise
}

export function CodeMirrorEditor({
  initialValue = '',
  mode = 'plain',
  readOnly,
  withErrorMarkers,
  theme,
  onUpdate,
  onPaste,
  getCustomFunctionEntries,
  getBindingVars,
  getInputKeys,
  getHoverContext,
  editorRef,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<CodeMirrorRuntime | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const applyingExternalChangeRef = useRef(false)
  const initialValueRef = useRef(initialValue)
  const [runtimeState, setRuntimeState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { initialValueRef.current = initialValue }, [initialValue])

  // Use refs for callbacks so editor callbacks stay current without forcing recreation.
  const onUpdateRef = useRef(onUpdate)
  const onPasteRef = useRef(onPaste)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onPasteRef.current = onPaste }, [onPaste])

  const destroyView = useCallback(() => {
    viewRef.current?.destroy()
    viewRef.current = null
    if (editorRef) editorRef.current = null
  }, [editorRef])

  useEffect(() => {
    let cancelled = false
    setRuntimeState('loading')
    void loadCodeMirrorRuntime()
      .then(runtime => {
        if (cancelled) return
        runtimeRef.current = runtime
        setRuntimeState('ready')
      })
      .catch(() => {
        if (cancelled) return
        runtimeRef.current = null
        setRuntimeState('error')
      })

    return () => {
      cancelled = true
      destroyView()
    }
  }, [destroyView])

  const structuralConfig = useMemo(() => ({
    mode,
    readOnly: !!readOnly,
    withErrorMarkers: !!withErrorMarkers,
    theme,
    getCustomFunctionEntries,
    getBindingVars,
    getInputKeys,
    getHoverContext,
    hasPasteHandler: !!onPaste,
  }), [
    mode,
    readOnly,
    withErrorMarkers,
    theme,
    getCustomFunctionEntries,
    getBindingVars,
    getInputKeys,
    getHoverContext,
    onPaste,
  ])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime || runtimeState !== 'ready' || !containerRef.current) return

    destroyView()
    const { EditorView, buildEditorExtensions } = runtime
    const nextView = new EditorView({
      doc: initialValueRef.current,
      extensions: buildEditorExtensions({
        mode: structuralConfig.mode,
        readOnly: structuralConfig.readOnly,
        withErrorMarkers: structuralConfig.withErrorMarkers,
        theme: structuralConfig.theme,
        getCustomFunctionEntries: structuralConfig.getCustomFunctionEntries,
        getBindingVars: structuralConfig.getBindingVars,
        getInputKeys: structuralConfig.getInputKeys,
        getHoverContext: structuralConfig.getHoverContext,
        updateListener: update => {
          if (!update.docChanged) return
          if (applyingExternalChangeRef.current) return
          onUpdateRef.current?.(update.state.doc.toString())
        },
        domHandlers: structuralConfig.hasPasteHandler ? {
          paste() {
            setTimeout(() => {
              const liveView = viewRef.current
              if (!liveView) return
              const val = liveView.state.doc.toString()
              onPasteRef.current?.(val, liveView)
            }, 20)
          },
        } : undefined,
      }),
      parent: containerRef.current,
    })

    viewRef.current = nextView
    if (editorRef) editorRef.current = nextView

    return () => {
      if (viewRef.current === nextView) {
        destroyView()
      } else {
        nextView.destroy()
      }
    }
  }, [destroyView, editorRef, runtimeState, structuralConfig])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentValue = view.state.doc.toString()
    if (currentValue === initialValue) return

    applyingExternalChangeRef.current = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: initialValue },
    })
    queueMicrotask(() => {
      applyingExternalChangeRef.current = false
    })
  }, [initialValue])

  return (
    <div className="cm-editorHost">
      <div ref={containerRef} className="cm-editorMount" />
      {runtimeState === 'loading' && <div className="cm-loading">Loading editor…</div>}
      {runtimeState === 'error' && <div className="cm-loadError">Editor failed to load.</div>}
    </div>
  )
}
