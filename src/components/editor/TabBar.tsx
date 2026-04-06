import { useAppContext } from '../../store/appContext'
import { findNode } from '../../lib/workspace'
import './TabBar.css'

export function TabBar() {
  const { state, dispatch } = useAppContext()

  return (
    <div className="tabbar">
      {state.tabs.map(id => {
        const node = findNode(state.db, id)
        if (!node) return null
        return (
          <div
            key={id}
            className={`tab${id === state.activeId ? ' active' : ''}`}
            onClick={() => { if (state.activeId !== id) dispatch({ type: 'OPEN_SCRIPT', id }) }}
          >
            <span>{node.name}</span>
            <button
              className="tabx"
              onClick={e => {
                e.stopPropagation()
                dispatch({ type: 'CLOSE_TAB', id })
              }}
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}
