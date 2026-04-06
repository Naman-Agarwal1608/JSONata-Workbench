import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../../store/appContext'
import { findNode } from '../../lib/workspace'

export function RenameModal({ open }: { open: boolean }) {
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
