import { useEffect, useRef } from 'react'
import { EditorView, buildEditorExtensions } from '../../lib/codemirror'
import type { CustomFunctionEntry } from '../../types/workspace'
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
  editorRef?: React.RefObject<EditorView | null>
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
  editorRef,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Use refs for callbacks so the editor doesn't need to be recreated on prop changes
  const onUpdateRef = useRef(onUpdate)
  const onPasteRef = useRef(onPaste)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onPasteRef.current = onPaste }, [onPaste])

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      doc: initialValue,
      extensions: buildEditorExtensions({
        mode,
        readOnly,
        withErrorMarkers,
        theme,
        getCustomFunctionEntries,
        updateListener: update => {
          if (update.docChanged) onUpdateRef.current?.(update.state.doc.toString())
        },
        domHandlers: onPaste ? {
          paste() {
            setTimeout(() => {
              const val = view.state.doc.toString()
              onPasteRef.current?.(val, view)
            }, 20)
          },
        } : undefined,
      }),
      parent: containerRef.current,
    })

    if (editorRef) editorRef.current = view

    return () => {
      view.destroy()
      if (editorRef) editorRef.current = null
    }
  // Intentionally omit all deps — remounting is handled by the parent via `key`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
}
