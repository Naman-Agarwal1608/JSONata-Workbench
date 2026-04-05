import { ctxDo } from '../lib/runtimeBridge'

export function ContextMenu() {
  return (
    <div className="ctxm" id="ctxm">
      <div className="citem" id="ctx-af" onClick={() => ctxDo('af')}>
        <span className="ci">📁</span>New Subfolder
      </div>
      <div className="citem" id="ctx-as" onClick={() => ctxDo('as')}>
        <span className="ci">＋</span>New Script
      </div>
      <div className="csep" />
      <div className="citem" onClick={() => ctxDo('rn')}>
        <span className="ci">✎</span>Rename
      </div>
      <div className="citem danger" onClick={() => ctxDo('del')}>
        <span className="ci">🗑</span>Delete
      </div>
    </div>
  )
}
