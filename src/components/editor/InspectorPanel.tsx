import type { ExecContext, InspectEntry } from '../../types/workspace'
import { summariseValue, esc } from '../../lib/helpers'
import './InspectorPanel.css'

interface InspectorPanelProps {
  execCtx: ExecContext | null
  execCtxExpanded: boolean
  execCtxTab: 'values' | 'scope' | 'functions'
  inspectEntries: Map<string, InspectEntry>
  onToggle: () => void
  onSetTab: (tab: 'values' | 'scope' | 'functions') => void
  onInspectValue: (id: string) => void
}

export function InspectorPanel({
  execCtx, execCtxExpanded, execCtxTab, inspectEntries,
  onToggle, onSetTab, onInspectValue,
}: InspectorPanelProps) {
  const metaText = (() => {
    if (!execCtx) return execCtxExpanded ? 'No execution yet' : 'Collapsed'
    if (execCtx.status === 'error' && execCtx.location) return `Failed at line ${execCtx.location.line}, col ${execCtx.location.column ?? 1}`
    if (execCtx.status === 'error') return 'Execution failed'
    const count = inspectEntries.size
    return count ? `${count} value${count === 1 ? '' : 's'}` : 'No values resolved'
  })()

  return (
    <div className={`ctxshell${execCtxExpanded ? ' expanded' : ''}`}>
      <button className="ctxshell-head" type="button" onClick={onToggle}>
        <span className="ctxshell-title">Inspector</span>
        <span className="ctxshell-meta">{metaText}</span>
        <span className="ctxshell-caret">▾</span>
      </button>

      {execCtxExpanded && (
        <div className={`errctx${execCtxExpanded ? ' open' : ''}`}>
          {!execCtx ? (
            <div className="errctx-grid">
              <section className="errctx-card">
                <div className="errctx-head">Inspector</div>
                <div className="errctx-body">
                  <div className="errctx-item"><small>Run an expression to inspect resolved values, scope, and error details.</small></div>
                </div>
              </section>
            </div>
          ) : (
            <>
              <div className="errctx-tabs">
                {(['values', 'scope', 'functions'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`errctx-tab${execCtxTab === tab ? ' active' : ''}`}
                    type="button"
                    onClick={() => onSetTab(tab)}
                  >
                    {tab === 'values' ? 'Execution Context' : tab === 'scope' ? 'Available Scope' : 'Custom Functions'}
                  </button>
                ))}
              </div>

              {/* Values tab */}
              <div className={`errctx-panel${execCtxTab === 'values' ? ' active' : ''}`}>
                <div className="errctx-grid">
                  {execCtx.status === 'error' && (
                    <section className="errctx-card">
                      <div className="errctx-head">Execution Failure</div>
                      <div className="errctx-body">
                        <div className="errctx-row">
                          <span className="errctx-k">Location</span>
                          <span className="errctx-v">
                            {execCtx.location ? `line ${execCtx.location.line}, col ${execCtx.location.column ?? 1}` : 'Unknown'}
                          </span>
                        </div>
                        <div className="errctx-item"><small>{execCtx.message || 'Execution failed'}</small></div>
                        {execCtx.snippet && <pre className="errctx-pre">{execCtx.snippet}</pre>}
                      </div>
                    </section>
                  )}
                  <section className="errctx-card">
                    <div className="errctx-head">Resolved Values</div>
                    <div className="errctx-body errctx-list">
                      {[...inspectEntries.entries()].map(([id, entry]) => (
                        <button
                          key={id}
                          className="errctx-item clickable"
                          type="button"
                          onClick={() => onInspectValue(id)}
                        >
                          <strong><code>{esc(entry.label)}</code></strong>
                          <small>{summariseValue(entry.value)}{entry.meta ? ` · ${entry.meta}` : ''}</small>
                        </button>
                      ))}
                      {inspectEntries.size === 0 && (
                        <div className="errctx-item"><small>No prior top-level variable values could be resolved.</small></div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {/* Scope tab */}
              <div className={`errctx-panel${execCtxTab === 'scope' ? ' active' : ''}`}>
                <div className="errctx-grid">
                  <section className="errctx-card">
                    <div className="errctx-head">Available Scope</div>
                    <div className="errctx-body">
                      <div className="errctx-list">
                        {execCtx.bindings.length ? (
                          execCtx.bindings.map(name => (
                            <div key={name} className="errctx-item"><code>${name}</code></div>
                          ))
                        ) : (
                          <div className="errctx-item"><small>No bindings provided.</small></div>
                        )}
                      </div>
                      {execCtx.functionsError && (
                        <div className="errctx-item"><small>{execCtx.functionsError}</small></div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {/* Functions tab */}
              <div className={`errctx-panel${execCtxTab === 'functions' ? ' active' : ''}`}>
                <div className="errctx-grid">
                  <section className="errctx-card">
                    <div className="errctx-head">Custom Functions</div>
                    <div className="errctx-body">
                      <div className="errctx-list">
                        {execCtx.customFunctions.length ? (
                          execCtx.customFunctions.map(fn => (
                            <div key={fn.label} className="errctx-item">
                              <strong><code>{fn.label}</code></strong>
                              <small>{fn.info}</small>
                            </div>
                          ))
                        ) : (
                          <div className="errctx-item"><small>No custom functions registered.</small></div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
