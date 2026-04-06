import { useEffect, useRef, useState } from 'react'
import { FOLDER_COLORS, useUIState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'

export function AddModal({ open }: { open: boolean }) {
  const state = useUIState()
  const actions = useWorkspaceActions()
  const { modal, pickedColor } = state
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
    actions.addNode(modal.type, name.trim(), modal.parentId, pickedColor)
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="addOv" onClick={e => { if (e.target === e.currentTarget) actions.closeModal() }}>
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
                  onClick={() => actions.setPickedColor(c)}
                />
              ))}
            </div>
          </div>
        )}
        <div className="mrow">
          <button className="hbtn" onClick={actions.closeModal}>Cancel</button>
          <button className="hbtn prim" onClick={confirmAdd}>Create</button>
        </div>
      </div>
    </div>
  )
}
