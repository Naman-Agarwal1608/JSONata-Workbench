import { useEffect, useRef, useState } from 'react'
import { useAppContext, FOLDER_COLORS } from '../../store/appContext'

export function AddModal({ open }: { open: boolean }) {
  const { state, dispatch } = useAppContext()
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
