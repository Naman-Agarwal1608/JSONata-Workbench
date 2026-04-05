import { callRuntime } from '../lib/runtimeBridge'

export function Header() {
  return (
    <div className="hdr">
      <div className="logo" onClick={() => callRuntime('goHome')}>
        <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--surf3)" />
          <path d="M18 20h18a8 8 0 0 1 8 8v16H26a8 8 0 0 1-8-8V20Z" fill="var(--acc)" />
          <path d="M28 24h18v20a8 8 0 0 1-8 8H28V24Z" fill="var(--blue)" fillOpacity=".92" />
          <path d="M24 18h16a6 6 0 0 1 6 6v4H30a6 6 0 0 1-6-6v-4Z" fill="var(--ok)" />
        </svg>
        <div>jsonata<span>.workbench</span></div>
      </div>
      <div className="hgap" />
      <div className="spill">
        <div className="sdot" id="sdot" />
        <span id="slabel">—</span>
      </div>
      <button className="hbtn" id="themeBtn" onClick={() => callRuntime('toggleTheme')}>Theme</button>
      <button className="hbtn" onClick={() => callRuntime('pickFile')}>📂 Link file</button>
      <button className="hbtn" onClick={() => callRuntime('saveNow')}>💾 Save</button>
      <button className="hbtn" onClick={() => callRuntime('exportFile')}>Export</button>
      <button className="hbtn" onClick={() => callRuntime('importFile')}>Import</button>
    </div>
  )
}
