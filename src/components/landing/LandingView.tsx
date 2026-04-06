import { useRef, useState } from 'react'
import { CodeMirrorEditor } from '../ui/CodeMirrorEditor'
import { useAppContext } from '../../store/appContext'
import './LandingView.css'
import { parseJSONText } from '../../lib/helpers'
import { parseCustomFunctions } from '../../lib/customFunctions'
import { setEditorErrorLocation } from '../../lib/codemirror'
import type { EditorView } from '../../lib/codemirror'

export function LandingView() {
  const { state, dispatch, schedSave, importFile } = useAppContext()
  const { theme, db, dbEpoch } = state
  const settings = db.settings

  const functionsEditorRef = useRef<EditorView | null>(null)

  const [globalContextErr, setGlobalContextErr] = useState('')
  const [bindingsErr, setBindingsErr] = useState('')
  const [functionsErr, setFunctionsErr] = useState('')

  function onGlobalContextChange(val: string) {
    dispatch({ type: 'UPDATE_SETTINGS', key: 'globalContext', value: val })
    schedSave()
    const res = parseJSONText(val, 'Global context')
    setGlobalContextErr(res.ok ? '' : (res.message ?? ''))
  }

  function onBindingsChange(val: string) {
    dispatch({ type: 'UPDATE_SETTINGS', key: 'bindings', value: val })
    schedSave()
    const res = parseJSONText(val, 'Bindings', { requireObject: true })
    setBindingsErr(res.ok ? '' : (res.message ?? ''))
  }

  function onFunctionsChange(val: string) {
    dispatch({ type: 'UPDATE_SETTINGS', key: 'customFunctions', value: val })
    schedSave()
    const res = parseCustomFunctions(val)
    if (!res.ok && res.location && functionsEditorRef.current) {
      setEditorErrorLocation(functionsEditorRef.current, res.location)
    }
    setFunctionsErr(res.ok ? '' : (res.message ?? ''))
  }

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-copy">
          <div className="landing-kicker">Workspace</div>
          <h2>Configure shared JSONata execution data.</h2>
          <p>
            These values apply across the workspace. Global context is used whenever a script's Input JSON is empty.
            Bindings are passed as JSONata variables and can be referenced as <code>$name</code> inside expressions.
          </p>
          <div className="landing-actions">
            <button
              className="hbtn prim"
              onClick={() => dispatch({ type: 'OPEN_ADD_MODAL', modalType: 'folder', parentId: null })}
            >
              New Collection
            </button>
            <button className="hbtn" onClick={importFile}>
              Import Workspace
            </button>
          </div>
        </div>
      </div>

      <div className="landing-top">
        <section className="landing-card context">
          <div className="landing-card-body">
            <div className="landing-label">Global Context</div>
            <h3>Default input document</h3>
            <p>Use this for shared sample data or a reusable context object. Per-script Input JSON overrides it.</p>
          </div>
          <div className="landing-editor-shell">
            <div className="landing-panel">
              <div className="phead">
                <span className="ptitle">Global Context</span>
                <span className="pbadge">JSON</span>
              </div>
              <div className="cm-wrap">
                <CodeMirrorEditor
                  key={`ctx-${theme}-${dbEpoch}`}
                  initialValue={settings.globalContext}
                  mode="json"
                  theme={theme}
                  onUpdate={onGlobalContextChange}
                />
              </div>
            </div>
            <div className="landing-foot">
              <span className="landing-note">Accepts any valid JSON value.</span>
              {globalContextErr && <span className="landing-err">{globalContextErr}</span>}
            </div>
          </div>
        </section>

        <section className="landing-card bindings">
          <div className="landing-card-body">
            <div className="landing-label">Bindings</div>
            <h3>Shared variables</h3>
            <p>
              Provide a JSON object of variables. For example, <code>{'{"limit": 3}'}</code> becomes available as <code>$limit</code>.
            </p>
          </div>
          <div className="landing-editor-shell">
            <div className="landing-panel">
              <div className="phead">
                <span className="ptitle">Bindings</span>
                <span className="pbadge">JSON</span>
              </div>
              <div className="cm-wrap">
                <CodeMirrorEditor
                  key={`bindings-${theme}-${dbEpoch}`}
                  initialValue={settings.bindings}
                  mode="json"
                  theme={theme}
                  onUpdate={onBindingsChange}
                />
              </div>
            </div>
            <div className="landing-foot">
              <span className="landing-note">Must be a JSON object.</span>
              {bindingsErr && <span className="landing-err">{bindingsErr}</span>}
            </div>
          </div>
        </section>
      </div>

      <section className="landing-card functions">
        <div className="landing-card-body">
          <div className="landing-label">Custom Functions</div>
          <h3>Reusable JSONata extensions</h3>
          <p>
            Define JavaScript functions once and use them in any script as <code>$name()</code>. Export an object whose keys are function names.
          </p>
        </div>
        <div className="landing-editor-shell">
          <div className="landing-panel">
            <div className="phead">
              <span className="ptitle">Custom Functions</span>
              <span className="pbadge">JS</span>
            </div>
            <div className="cm-wrap">
              <CodeMirrorEditor
                key={`functions-${theme}-${dbEpoch}`}
                initialValue={settings.customFunctions}
                mode="javascript"
                withErrorMarkers
                theme={theme}
                editorRef={functionsEditorRef}
                onUpdate={onFunctionsChange}
              />
            </div>
          </div>
          <div className="landing-foot">
            <span className="landing-note">
              Example: <code>{'({ slug: (s) => String(s).toLowerCase() })'}</code>
            </span>
            {functionsErr && <span className="landing-err">{functionsErr}</span>}
          </div>
        </div>
      </section>
    </div>
  )
}
