# JSONata Workbench

`JSONata Workbench` is a local-first JSONata workspace for writing, organizing, and testing JSONata expressions against shared or per-script JSON input.

It runs as a `React 18 + Vite + TypeScript` app with a browser-based workbench feel and no backend required.

## What It Does

- organize JSONata scripts into collections
- edit JSON input and JSONata expressions side-by-side
- define global context and bindings
- register reusable custom functions
- inspect results and intermediate resolved values
- save a linked workspace file with auto-save
- import/export workspace snapshots
- run as a static frontend app and deploy to GitHub Pages

## Main Features

### Workspace Structure

- folder/script tree in the left sidebar
- tabbed editing for open scripts
- per-script input JSON and expression storage
- root landing page for global workspace configuration

### Shared Execution Inputs

- `Global Context`
  Used as the default input document when a script does not provide its own input JSON.

- `Bindings`
  Passed into JSONata as variables such as `$limit` or `$currency`.

- `Custom Functions`
  Define reusable JavaScript-backed functions once and call them from any expression as `$name(...)`.

### Editors

The workbench uses `CodeMirror 6` for all editors.

- JSON editor support for input, output, bindings, and global context
- JSONata editor for expressions
- JavaScript editor for custom functions
- autocomplete for JSONata built-ins and custom functions
- hover help for JSONata functions
- search support
- code folding
- collapsed JSON summaries such as object key counts and array item counts
- line highlighting for detected error locations

### Output And Inspector

- formatted JSON output panel
- automatic error reporting with line/column when available
- bottom `Inspector` panel with tabbed views:
  - `Execution Context`
  - `Available Scope`
  - `Custom Functions`
- resolved values can be opened in a read-only value inspector modal

### Persistence And File Flows

- `Link file`
  Links the workspace to a real JSON file on disk

- `Save`
  Saves to the linked file

- `Export`
  Writes a snapshot copy without changing the linked file

- `Import`
  Loads a workspace JSON file into memory as the current workspace

- auto-save after edits once a file is linked

### UI

- dark mode and light mode
- collapsible left sidebar
- hover-to-open sidebar when collapsed
- landing page for workspace-wide settings

## How Evaluation Works

When you run a script:

1. the app picks per-script input JSON if present
2. otherwise it falls back to `Global Context`
3. `Bindings` are passed into JSONata as variables
4. `Custom Functions` are registered
5. the JSONata expression is evaluated
6. the output panel renders the result
7. the inspector builds execution context details

## Example: Bindings

```json
{
  "limit": 3,
  "currency": "USD"
}
```

This makes `$limit` and `$currency` available in expressions.

## Example: Custom Functions

```js
{
  slug: (value) => String(value).trim().toLowerCase().replace(/\s+/g, '-'),
  formatMoney: {
    implementation: (value, currency) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
      }).format(Number(value || 0)),
    description: 'Format a number as currency'
  }
}
```

Then use them in JSONata:

```jsonata
$slug("Hello World")
```

```jsonata
$formatMoney(19.99, $currency)
```

## Project Structure

```
src/
  components/
    WorkbenchApp.tsx        root component, mounts providers and layout shell
    editor/
      WorkspaceView.tsx     three-panel script editor (input / expression / output)
      TabBar.tsx            open-script tab strip
      InspectorPanel.tsx    execution inspector with values / scope / functions tabs
    landing/
      LandingView.tsx       workspace settings page (global context, bindings, functions)
    layout/
      Header.tsx            top bar with save, import/export, theme toggle
      Sidebar.tsx           collapsible collections sidebar
      SidebarTree.tsx       recursive folder/script tree
      ContextMenu.tsx       right-click context menu
    modals/
      AddModal.tsx          create collection or script
      RenameModal.tsx       rename any node
      DeleteModal.tsx       delete with cascade count warning
      ValueInspectorModal.tsx  read-only value detail view
      index.tsx             renders all four modals
    ui/
      CodeMirrorEditor.tsx  CodeMirror 6 wrapper (uncontrolled, stable callback refs)
  hooks/
    useExecution.ts         JSONata evaluation, run status, and inspector state
    usePersistence.ts       file linking, auto-save, import/export (File System Access API + IndexedDB)
    useResizablePanels.ts   drag-to-resize panel layout
    useSidebar.ts           sidebar open/collapse with hover-to-reveal
  lib/
    codemirror.ts           CM6 extensions — JSON, JSONata, JS modes, autocomplete, hover, folding
    customFunctions.ts      custom function parsing and JSONata registration
    helpers.ts              uid, JSON parsing, error location formatting, expression utilities
    workspace.ts            pure workspace DB helpers (tree queries, normalization)
  store/
    appContext.tsx           useReducer state, Context provider, typed action union
  types/
    workspace.ts            shared TypeScript interfaces and discriminated union types
  workbench/
    styles.css              all app styles
```

### Demo Workspace

- [public/jsonata-demo-workspace.json](public/jsonata-demo-workspace.json)

The app loads the demo workspace by default when no linked workspace file is available.

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Build Output

Vite writes the production app to:

- `dist/`

That output is a static frontend build suitable for GitHub Pages.

## Deployment

This repo includes a GitHub Actions workflow:

- [.github/workflows/build-and-deploy.yml](.github/workflows/build-and-deploy.yml)

On pushes to `main`, it:

1. installs dependencies
2. runs the production build
3. uploads `dist/` as a workflow artifact
4. deploys the app to GitHub Pages

### GitHub Pages Setup

In the GitHub repo settings:

1. open `Settings`
2. open `Pages`
3. set `Source` to `GitHub Actions`

After that, pushes to `main` should deploy automatically.

## Dependencies

Main runtime dependencies:

- `react`, `react-dom`
- `jsonata`
- `@jsonhero/codemirror-lang-jsonata`
- `@codemirror/*`

Build/dev dependencies:

- `vite`
- `@vitejs/plugin-react`
- `typescript`

## Browser Notes

For the full linked-file save flow, use a Chromium-based browser such as:

- Chrome
- Edge

That flow depends on the File System Access API.

Without it, the core app still works, but linked file save behavior is limited.

## Known Technical Debt

- the `CodeMirror` bundle is still relatively large
- there is currently no automated smoke-test suite

## License

This project is licensed under the `MIT` License.

See [LICENSE](/Users/namanagarwal/Code/Jsonata%20Collections/LICENSE).
