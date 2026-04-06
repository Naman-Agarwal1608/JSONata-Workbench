import { useAppContext } from '../../store/appContext'
import { findNode, allDescIds } from '../../lib/workspace'

export function DeleteModal({ open }: { open: boolean }) {
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
