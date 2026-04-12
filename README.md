# JSONata Workbench

`JSONata Workbench` is a local-first JSONata workspace for writing, organizing, and testing JSONata expressions against shared or per-script JSON input.

It runs as a static `React 18 + Vite + TypeScript` app with no backend.

## Live Demo

- GitHub Pages: `https://naman-agarwal1608.github.io/JSONata-Workbench/`


## What It Does

- organize JSONata scripts into collections
- edit input JSON, JSONata expressions, and output side-by-side
- define global context, bindings, and reusable custom functions
- inspect results and resolved values in a dedicated inspector
- inspect hovered expressions and selected subexpressions inline
- auto-save to a linked workspace file
- import and export workspace snapshots
- run as a static frontend app and deploy to GitHub Pages

## Main Features

### Workspace Structure

- folder/script tree in the left sidebar
- tabbed editing for open scripts
- per-script input JSON and expression storage
- landing page for workspace-wide execution settings
- collapsible sidebar with hover-to-open behavior when collapsed

### Shared Execution Inputs

- `Global Context`
  Used as the default input document when a script does not provide its own input JSON.

- `Bindings`
  Passed into JSONata as variables such as `$limit` or `$currency`.

- `Custom Functions`
  Define reusable JavaScript-backed functions once and call them from any expression as `$name(...)`.

### Editors

The workbench uses `CodeMirror 6` everywhere.

- JSON editors for input, output, global context, bindings, and value inspection
- JSONata editor for expressions
- JavaScript editor for custom functions
- autocomplete for JSONata built-ins and workspace custom functions
- hover tooltips for JSONata functions and live runtime values
- selection tooltip inspection for evaluating a selected subexpression in context
- search support
- code folding
- collapsed JSON summaries such as object key counts and array item counts
- line highlighting for detected error locations
- lazy-loaded editor runtime with chunk-split CodeMirror bundles

### Execution Experience

- live auto-run while editing
- manual run with `Cmd/Ctrl + Enter`
- execution timing shown in the bottom status bar
- `Running…` feedback while a queued run is pending
- formatted JSON output
- error reporting with line/column when available
- shared execution environment across full run, hover inspection, and selection inspection

### Inspector

The bottom `Inspector` panel includes tabbed views for:

- `Execution Context`
- `Available Scope`
- `Custom Functions`

Resolved values can be opened in a read-only value inspector modal.

In-editor inspection also supports:

- hover a path, variable, or function call to inspect its current value
- select part of an expression and hover over that selection to evaluate it in scoped context
- collapsible JSON viewers inside tooltips for structured results

### Persistence And File Flows

- `Link file`
  Links the workspace to a real JSON file on disk.

- `Save`
  Saves to the linked file.

- `Export`
  Writes a snapshot copy without changing the linked file.

- `Import`
  Loads a workspace JSON file into memory as the current workspace.

- auto-save after edits once a file is linked

### UI

- dark mode and light mode
- resizable editor/output split
- landing page for workspace-wide settings
- explicit sidebar collapse button plus hover-open when collapsed

## How Evaluation Works

When you run a script:

1. the app uses per-script input JSON if present
2. otherwise it falls back to `Global Context`
3. `Bindings` are passed into JSONata as variables
4. `Custom Functions` are registered
5. the JSONata expression is compiled and evaluated
6. the output panel renders the result
7. the inspector builds execution context details

Hover and selection inspection use the same execution environment rules:

1. parse per-script input JSON if valid
2. otherwise fall back to `Global Context`
3. require valid `Bindings`
4. register `Custom Functions`
5. evaluate the hovered or selected expression inside reconstructed top-level scope when possible

## Examples

### Example: Bindings

```json
{
  "limit": 3,
  "currency": "USD"
}
```

This makes `$limit` and `$currency` available in expressions.

### Example: Custom Functions

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

```text
src/
  components/
    WorkbenchApp.tsx
    editor/
      InspectorPanel.tsx
      TabBar.tsx
      WorkspaceView.tsx
    landing/
      LandingView.tsx
    layout/
      ContextMenu.tsx
      Header.tsx
      Sidebar.tsx
      SidebarTree.tsx
    modals/
      AddModal.tsx
      DeleteModal.tsx
      RenameModal.tsx
      ValueInspectorModal.tsx
      index.tsx
    ui/
      CodeMirrorEditor.tsx
  hooks/
    useExecution.ts
    usePersistence.ts
    useResizablePanels.ts
    useSidebar.ts
    useWorkspaceActions.ts
  lib/
    codemirror.ts
    customFunctions.ts
    execution.ts
    helpers.ts
    workspace.ts
  main.tsx
  store/
    appContext.tsx
  styles/
    global.css
    shell.css
    ui.css
  types/
    workspace.ts
public/
  jsonata-demo-workspace.json
.github/workflows/
  build-and-deploy.yml
```

### Notes On The Current Structure

- The app is fully React-based now.
- The previous monolithic workbench stylesheet has been split into:
  - `src/styles/global.css`
  - `src/styles/shell.css`
  - `src/styles/ui.css`
- Editor/runtime behavior is split into hooks and utility modules instead of one large browser script.
- `src/lib/execution.ts` centralizes shared execution-environment building for runs and inline inspection.
- `src/components/ui/CodeMirrorEditor.tsx` lazy-loads the editor runtime and manages editor lifecycle explicitly.

## Demo Workspace

- [public/jsonata-demo-workspace.json](/Users/namanagarwal/Code/Jsonata%20Collections/public/jsonata-demo-workspace.json)

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

That output is a static frontend build suitable for GitHub Pages or any static hosting.

The production build splits editor/runtime code into separate chunks:

- main app shell
- JSONata runtime
- CodeMirror core
- CodeMirror language/editor extensions

This keeps the initial app bundle smaller and avoids one monolithic editor chunk.

## Deployment

This repo includes a GitHub Actions workflow:

- [.github/workflows/build-and-deploy.yml](/Users/namanagarwal/Code/Jsonata%20Collections/.github/workflows/build-and-deploy.yml)

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

- the `CodeMirror` chunk is still relatively large
- execution context building still does extra work after each run
- there is currently no automated smoke-test suite

## License

This project is licensed under the `MIT` License.

See [LICENSE](/Users/namanagarwal/Code/Jsonata%20Collections/LICENSE).
