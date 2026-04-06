import { useEffect, useRef, useState } from 'react'
import { useUIState, useWorkspaceState } from '../../store/appContext'
import { useWorkspaceActions } from '../../hooks/useWorkspaceActions'
import { findNode } from '../../lib/workspace'

export function RenameModal({ open }: { open: boolean }) {
  const { modal } = useUIState()
  const { db } = useWorkspaceState()
  const actions = useWorkspaceActions()
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
    actions.renameNode(modal.id, name.trim())
  }

  return (
    <div className={`overlay${open ? ' open' : ''}`} id="rnOv" onClick={e => { if (e.target === e.currentTarget) actions.closeModal() }}>
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
          <button className="hbtn" onClick={actions.closeModal}>Cancel</button>
          <button className="hbtn prim" onClick={confirmRename}>Rename</button>
        </div>
      </div>
    </div>
  )
}
