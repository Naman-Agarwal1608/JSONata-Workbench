import { useUIState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { CodeMirrorEditor } from '../ui/CodeMirrorEditor'

export function ValueInspectorModal({ open }: { open: boolean }) {
  const state = useUIState()
  const actions = useWorkspaceActions()
  const { modal, theme } = state

  const entry = modal.kind === 'value-inspector' ? modal.entry : null
  const valueText = (() => {
    if (!entry) return ''
    if (entry.value === undefined) return '(undefined)'
    try { return JSON.stringify(entry.value, null, 2) } catch { return String(entry.value) }
  })()

  let useJsonMode = false
  if (valueText && valueText !== '(undefined)') {
    try { JSON.parse(valueText); useJsonMode = true } catch { /* not json */ }
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="valOv" onClick={e => { if (e.target === e.currentTarget) actions.closeModal() }}>
      <div className="modal xmodal">
        <div className="xmodal-head">
          <div className="xmodal-copy">
            <div className="mtitle">{entry?.label ?? 'Value Inspector'}</div>
            <small>{entry?.meta ?? 'Read-only value preview'}</small>
          </div>
          <button className="hbtn" onClick={actions.closeModal}>Close</button>
        </div>
        <div className="xmodal-body">
          <div className="cm-wrap">
            {open && entry ? (
              <CodeMirrorEditor
                key={`val-${entry.label}-${theme}`}
                initialValue={valueText}
                mode={useJsonMode ? 'json' : 'plain'}
                readOnly
                theme={theme}
              />
            ) : (
              <div className="cm-loading">Loading viewer…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
