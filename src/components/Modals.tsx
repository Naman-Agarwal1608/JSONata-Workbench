import { useEffect, useRef, useState } from 'react'
import { useAppContext, FOLDER_COLORS } from '../store/appContext'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { findNode, allDescIds } from '../lib/workspace'
import { uid } from '../lib/helpers'

export function Modals() {
  const { state, dispatch } = useAppContext()
  const { modal, pickedColor, db, theme } = state

  const addOpen = modal.kind === 'add'
  const rnOpen = modal.kind === 'rename'
  const delOpen = modal.kind === 'delete'
  const valOpen = modal.kind === 'value-inspector'

  return (
    <>
      <AddModal open={addOpen} />
      <RenameModal open={rnOpen} />
      <DeleteModal open={delOpen} />
      <ValueInspectorModal open={valOpen} />
    </>
  )
}

function AddModal({ open }: { open: boolean }) {
  const { state, dispatch } = useAppContext()
  const { modal, pickedColor, db } = state
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setName(''); setTimeout(() => inputRef.current?.focus(), 60) }
  }, [open])

  if (modal.kind !== 'add' && !open) return (
    <div className="overlay" id="addOv" />
  )
  const isFolder = modal.kind === 'add' && modal.type === 'folder'
  const title = modal.kind === 'add'
    ? (modal.type === 'folder' ? (modal.parentId ? 'New Subfolder' : 'New Collection') : 'New Script')
    : 'New'

  function confirmAdd() {
    if (!name.trim() || modal.kind !== 'add') return
    dispatch({
      type: 'ADD_NODE',
      nodeType: modal.type,
      name: name.trim(),
      parentId: modal.parentId,
      color: pickedColor,
    })
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="addOv" onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_MODAL' }) }}>
      <div className="modal">
        <div className="mtitle">{title}</div>
        <div className="field">
          <label>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmAdd() }}
          />
        </div>
        {isFolder && (
          <div className="field">
            <label>Color</label>
            <div className="swatches">
              {FOLDER_COLORS.map(c => (
                <div
                  key={c}
                  className={`sw${c === pickedColor ? ' sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => dispatch({ type: 'SET_PICKED_COLOR', color: c })}
                />
              ))}
            </div>
          </div>
        )}
        <div className="mrow">
          <button className="hbtn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancel</button>
          <button className="hbtn prim" onClick={confirmAdd}>Create</button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({ open }: { open: boolean }) {
  const { state, dispatch } = useAppContext()
  const { modal, db } = state
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && modal.kind === 'rename') {
      const node = findNode(db, modal.id)
      setName(node?.name ?? '')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  function confirmRename() {
    if (!name.trim() || modal.kind !== 'rename') return
    dispatch({ type: 'RENAME_NODE', id: modal.id, name: name.trim() })
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="rnOv" onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_MODAL' }) }}>
      <div className="modal">
        <div className="mtitle">Rename</div>
        <div className="field">
          <label>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmRename() }}
          />
        </div>
        <div className="mrow">
          <button className="hbtn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancel</button>
          <button className="hbtn prim" onClick={confirmRename}>Rename</button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ open }: { open: boolean }) {
  const { state, dispatch } = useAppContext()
  const { modal, db } = state

  const delMsg = (() => {
    if (modal.kind !== 'delete') return ''
    const node = findNode(db, modal.id)
    if (!node) return ''
    const desc = allDescIds(db, modal.id).length
    return desc
      ? `Delete "${node.name}" and ${desc} item(s) inside it? This cannot be undone.`
      : `Delete "${node.name}"? This cannot be undone.`
  })()

  function confirmDelete() {
    if (modal.kind !== 'delete') return
    dispatch({ type: 'DELETE_NODE', id: modal.id })
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="delOv" onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_MODAL' }) }}>
      <div className="modal">
        <div className="mtitle">Delete</div>
        <div style={{ fontSize: '12px', lineHeight: '1.7', color: 'var(--tx2)' }}>{delMsg}</div>
        <div className="mrow">
          <button className="hbtn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancel</button>
          <button
            className="hbtn prim"
            style={{ background: 'var(--err)', borderColor: 'var(--err)', color: '#fff' }}
            onClick={confirmDelete}
            onKeyDown={e => { if (e.key === 'Enter') confirmDelete() }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function ValueInspectorModal({ open }: { open: boolean }) {
  const { state, dispatch } = useAppContext()
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
    <div className={`overlay${open ? ' open' : ''}`} id="valOv" onClick={e => { if (e.target === e.currentTarget) dispatch({ type: 'CLOSE_MODAL' }) }}>
      <div className="modal xmodal">
        <div className="xmodal-head">
          <div className="xmodal-copy">
            <div className="mtitle">{entry?.label ?? 'Value Inspector'}</div>
            <small>{entry?.meta ?? 'Read-only value preview'}</small>
          </div>
          <button className="hbtn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Close</button>
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
