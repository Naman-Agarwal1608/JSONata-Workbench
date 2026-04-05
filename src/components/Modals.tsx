import { callRuntime } from '../lib/runtimeBridge'

export function Modals() {
  return (
    <>
      <div className="overlay" id="addOv">
        <div className="modal">
          <div className="mtitle" id="addTitle">New</div>
          <div className="field">
            <label>Name</label>
            <input id="addName" />
          </div>
          <div className="field" id="colorField">
            <label>Color</label>
            <div className="swatches" id="swatches" />
          </div>
          <div className="mrow">
            <button className="hbtn" onClick={() => callRuntime('closeOv')}>Cancel</button>
            <button className="hbtn prim" onClick={() => callRuntime('confirmAdd')}>Create</button>
          </div>
        </div>
      </div>

      <div className="overlay" id="rnOv">
        <div className="modal">
          <div className="mtitle">Rename</div>
          <div className="field">
            <label>Name</label>
            <input id="rnName" />
          </div>
          <div className="mrow">
            <button className="hbtn" onClick={() => callRuntime('closeOv')}>Cancel</button>
            <button className="hbtn prim" onClick={() => callRuntime('confirmRename')}>Rename</button>
          </div>
        </div>
      </div>

      <div className="overlay" id="delOv">
        <div className="modal">
          <div className="mtitle">Delete</div>
          <div id="delMsg" style={{ fontSize: '12px', lineHeight: '1.7', color: 'var(--tx2)' }} />
          <div className="mrow">
            <button className="hbtn" onClick={() => callRuntime('closeOv')}>Cancel</button>
            <button
              className="hbtn prim"
              style={{ background: 'var(--err)', borderColor: 'var(--err)', color: '#fff' }}
              onClick={() => callRuntime('confirmDelete')}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="overlay" id="valOv">
        <div className="modal xmodal">
          <div className="xmodal-head">
            <div className="xmodal-copy">
              <div className="mtitle" id="valTitle">Value Inspector</div>
              <small id="valMeta">Read-only value preview</small>
            </div>
            <button className="hbtn" onClick={() => callRuntime('closeOv')}>Close</button>
          </div>
          <div className="xmodal-body">
            <div className="cm-wrap" id="valCM">
              <div className="cm-loading">Loading viewer…</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
