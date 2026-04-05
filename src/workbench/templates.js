export function renderLandingView() {
  return `
      <div class="landing">
        <div class="landing-hero">
          <div class="landing-copy">
            <div class="landing-kicker">Workspace</div>
            <h2>Configure shared JSONata execution data.</h2>
            <p>These values apply across the workspace. Global context is used whenever a script's Input JSON is empty. Bindings are passed as JSONata variables and can be referenced as <code>$name</code> inside expressions.</p>
            <div class="landing-actions">
              <button class="hbtn prim" onclick="openAddModal('folder',null)">New Collection</button>
              <button class="hbtn" onclick="importFile()">Import Workspace</button>
            </div>
          </div>
        </div>
        <div class="landing-top">
          <section class="landing-card context">
            <div class="landing-card-body">
              <div class="landing-label">Global Context</div>
              <h3>Default input document</h3>
              <p>Use this for shared sample data or a reusable context object. Per-script Input JSON overrides it.</p>
            </div>
            <div class="landing-editor-shell">
              <div class="landing-panel">
                <div class="phead">
                  <span class="ptitle">Global Context</span>
                  <span class="pbadge">JSON</span>
                </div>
                <div class="cm-wrap" id="globalContextCM"><div class="cm-loading">Loading editor…</div></div>
              </div>
              <div class="landing-foot">
                <span class="landing-note">Accepts any valid JSON value.</span>
                <span class="landing-err" id="globalContextErr"></span>
              </div>
            </div>
          </section>
          <section class="landing-card bindings">
            <div class="landing-card-body">
              <div class="landing-label">Bindings</div>
              <h3>Shared variables</h3>
              <p>Provide a JSON object of variables. For example, <code>{"limit": 3}</code> becomes available as <code>$limit</code>.</p>
            </div>
            <div class="landing-editor-shell">
              <div class="landing-panel">
                <div class="phead">
                  <span class="ptitle">Bindings</span>
                  <span class="pbadge">JSON</span>
                </div>
                <div class="cm-wrap" id="bindingsCM"><div class="cm-loading">Loading editor…</div></div>
              </div>
              <div class="landing-foot">
                <span class="landing-note">Must be a JSON object.</span>
                <span class="landing-err" id="bindingsErr"></span>
              </div>
            </div>
          </section>
        </div>
        <section class="landing-card functions">
          <div class="landing-card-body">
            <div class="landing-label">Custom Functions</div>
            <h3>Reusable JSONata extensions</h3>
            <p>Define JavaScript functions once and use them in any script as <code>$name()</code>. Export an object whose keys are function names.</p>
          </div>
          <div class="landing-editor-shell">
            <div class="landing-panel">
              <div class="phead">
                <span class="ptitle">Custom Functions</span>
                <span class="pbadge">JS</span>
              </div>
              <div class="cm-wrap" id="functionsCM"><div class="cm-loading">Loading editor…</div></div>
            </div>
            <div class="landing-foot">
              <span class="landing-note">Example: <code>({ slug: (s) => String(s).toLowerCase() })</code></span>
              <span class="landing-err" id="functionsErr"></span>
            </div>
          </div>
        </section>
      </div>`
}

export function renderWorkspaceView(node, esc, breadcrumb) {
  return `
    <div class="tabbar" id="tabbar"></div>
    <div class="editor">
      <div class="etoolbar">
        <input class="ename" id="ename" value="${esc(node.name)}" placeholder="Untitled" />
        <span class="bctag" title="${esc(breadcrumb(node.id))}">${esc(breadcrumb(node.id))}</span>
        <button class="hbtn prim" onclick="runExpr()">▶ Run <small style="opacity:.55;font-size:10px">⌘↵</small></button>
      </div>
      <div class="panels">
        <div class="panels-top" id="panelsTop">
          <div class="panel" id="panelInput">
            <div class="phead">
              <span class="ptitle">Input JSON</span>
              <span id="jerr" class="jerr"></span>
            </div>
            <div class="jtoolbar">
              <button class="jbtn" onclick="fmtJSON()">Format</button>
              <button class="jbtn" onclick="minJSON()">Minify</button>
              <button class="jbtn" onclick="clearInput()">Clear</button>
            </div>
            <div class="cm-wrap" id="inputCM"><div class="cm-loading">Loading editor…</div></div>
          </div>
          <div class="rsz-h" id="hrsz"></div>
          <div class="panel" id="panelExpr">
            <div class="phead">
              <span class="ptitle">Expression</span>
              <span class="pbadge" id="xbadge"></span>
            </div>
            <div class="cm-wrap" id="exprCM"><div class="cm-loading">Loading editor…</div></div>
          </div>
        </div>
        <div class="rsz-v" id="vrsz"></div>
        <div class="panel" id="panelOut" style="border-top:1px solid var(--bdr)">
          <div class="phead">
            <span class="ptitle">Output</span>
            <span class="pbadge" id="obadge"></span>
          </div>
          <div class="cm-wrap" id="outCM" style="display:none"></div>
          <div class="outview empty" id="outview">Run the expression to see results…</div>
          <div class="ctxshell" id="ctxshell">
            <button class="ctxshell-head" type="button" onclick="toggleExecContext()">
              <span class="ctxshell-title">Inspector</span>
              <span class="ctxshell-meta" id="ctxMeta">Collapsed</span>
              <span class="ctxshell-caret">▾</span>
            </button>
            <div class="errctx" id="errctx"></div>
          </div>
        </div>
      </div>
      <div class="sbar"><span id="sstat">Ready</span></div>
    </div>`
}
