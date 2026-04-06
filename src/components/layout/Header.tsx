import { useAppContext } from '../../store/appContext'
import './Header.css'

export function Header() {
  const { state, dispatch, pickFile, saveNow, exportFile, importFile } = useAppContext()
  const { theme, statusLabel, statusDot } = state

  return (
    <div className="hdr">
      <div className="logo" onClick={() => dispatch({ type: 'GO_HOME' })}>
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
        <div className={`sdot${statusDot ? ' ' + statusDot : ''}`} />
        <span>{statusLabel}</span>
      </div>
      <button
        className="hbtn"
        onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
      >
        {theme === 'light' ? '☀ Light' : '☾ Dark'}
      </button>
      <button className="hbtn" onClick={pickFile}>📂 Link file</button>
      <button className="hbtn" onClick={() => saveNow(true)}>💾 Save</button>
      <button className="hbtn" onClick={exportFile}>Export</button>
      <button className="hbtn" onClick={importFile}>Import</button>
    </div>
  )
}
