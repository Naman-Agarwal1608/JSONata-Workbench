# JSONata Workbench

`JSONata Workbench` is a local-first JSONata workspace for writing, organizing, and testing JSONata expressions against shared or per-script JSON input.

It started as a single standalone HTML file and now runs as a small `Vue 3 + Vite + TypeScript` project, while keeping the same browser-based workbench feel.

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

### App Shell

- [src/App.vue](/Users/namanagarwal/Code/Jsonata%20Collections/src/App.vue)
- [src/components/WorkbenchApp.vue](/Users/namanagarwal/Code/Jsonata%20Collections/src/components/WorkbenchApp.vue)

The Vue app shell mounts the workbench, provides the header/layout shell, and owns the sidebar collapse interaction.

### Workbench Runtime Modules

- [src/workbench/runtime.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/runtime.js)
  Composition root for workbench state, controller wiring, and boot/cleanup

- [src/workbench/helpers.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/helpers.js)
  Shared utility helpers

- [src/workbench/workspace.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/workspace.js)
  Workspace normalization and tree/data helpers

- [src/workbench/custom-functions.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/custom-functions.js)
  Custom function parsing and registration

- [src/workbench/templates.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/templates.js)
  Main HTML template renderers

- [src/workbench/codemirror.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/codemirror.js)
  CodeMirror bootstrap, autocomplete, hover, and folding bridge

- [src/workbench/editors.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/editors.js)
  Editor creation, landing editors, output rendering, and input/expression editor flow

- [src/workbench/execution.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/execution.js)
  Expression execution and inspector context building

- [src/workbench/persistence.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/persistence.js)
  File linking, save, export, import, and boot persistence

- [src/workbench/tree.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/tree.js)
  Sidebar tree and tab behavior

- [src/workbench/modals.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/modals.js)
  Add/rename/delete dialogs and context menu actions

- [src/workbench/layout.js](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/layout.js)
  Resizable panel layout behavior

- [src/workbench/styles.css](/Users/namanagarwal/Code/Jsonata%20Collections/src/workbench/styles.css)
  Main workbench styling

### Demo Workspace

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

That output is a static frontend build suitable for GitHub Pages.

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

- `vue`
- `jsonata`
- `@jsonhero/codemirror-lang-jsonata`
- `@codemirror/*`

Build/dev dependencies:

- `vite`
- `@vitejs/plugin-vue`
- `typescript`

## Browser Notes

For the full linked-file save flow, use a Chromium-based browser such as:

- Chrome
- Edge

That flow depends on the File System Access API.

Without it, the core app still works, but linked file save behavior is limited.

## Current State

The project is no longer in a “legacy iframe migration” stage. The Vue/Vite app is the real application, and the original monolithic workbench logic has already been split into smaller source modules.

The remaining work, if any, is normal product or architecture work rather than migration.

## Known Technical Debt

- the `CodeMirror` bundle is still relatively large
- the workbench runtime still uses an imperative DOM-driven model internally
- there is currently no automated smoke-test suite

## License

This project is licensed under the `MIT` License.

See [LICENSE](/Users/namanagarwal/Code/Jsonata%20Collections/LICENSE).
