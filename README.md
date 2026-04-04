# JSONata Workbench

`JSONata Workbench` is a standalone browser-based workspace for writing, organizing, and testing JSONata expressions.

It is designed to stay simple:

- one main HTML file
- no build step
- local browser usage
- optional file-backed auto-save

Open the app file in a browser and it works as-is.

## Project Files

- `jsonata-workbench.html`
  Main application. This is the only file you need to open in the browser.

- `jsonata-demo-workspace.json`
  Sample workspace demonstrating common JSONata patterns, built-in functions, bindings, custom functions, transformations, and grouped examples.

## What The App Does

The app gives you a local JSONata workspace with:

- a collection tree for organizing scripts
- tabbed script editing
- per-script JSON input
- JSONata expression editing with autocomplete and hover help
- execution output
- an inspector panel for execution context and debugging
- workspace-wide global context, bindings, and custom functions
- import, export, linked-file save, and auto-save support

## Main Concepts

### Collections And Scripts

The left sidebar is a tree of folders and scripts.

- folders are for organizing related examples or transformations
- scripts contain an expression and optional per-script input JSON
- scripts open in tabs

### Per-Script Input

Each script can define its own `Input JSON`.

- if the script input is non-empty, that input is used for evaluation
- if the script input is empty, the app falls back to the global context

### Global Context

The landing page contains `Global Context`.

Use it for shared sample data that multiple scripts can evaluate against.

### Bindings

The landing page also contains `Bindings`.

These are passed into JSONata as variables, so:

```json
{ "limit": 3, "currency": "USD" }
```

makes `$limit` and `$currency` available inside expressions.

### Custom Functions

You can define reusable JavaScript functions once on the landing page and use them in any expression as JSONata functions.

Example:

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

Then call them in JSONata as:

```jsonata
$slug("Hello World")
```

or

```jsonata
$formatMoney(19.99, $currency)
```

## Editor Features

The app uses CodeMirror for all editor surfaces.

### JSON Editors

The JSON editors support:

- line numbers
- search
- code folding
- collapsed object/array summaries such as item/key counts
- formatting/minify actions in the input panel

### Expression Editor

The JSONata expression editor supports:

- JSONata language mode
- built-in function autocomplete
- custom function autocomplete
- hover help for supported functions
- folding for multiline object, array, and grouped expression blocks
- line highlighting on parse/runtime errors where location info is available

### Value Inspector

The inspector popup opens values in a read-only editor, with JSON folding when the value is JSON-shaped.

## Execution Flow

When a script is open:

1. the expression is evaluated against either per-script input or global context
2. bindings are injected as JSONata variables
3. custom functions are registered before evaluation
4. output is shown in the bottom output panel

The app also supports explicit run via the `Run` button or keyboard shortcut.

## Inspector Panel

The bottom `Inspector` panel is intended to help understand evaluation results and failures.

It includes tabbed views for:

- `Execution Context`
  Shows resolved values including `$result` and top-level variable snapshots where available.

- `Available Scope`
  Shows available bindings and any custom-function registration issues.

- `Custom Functions`
  Shows registered custom workspace functions.

On failures, the inspector expands automatically and shows:

- the error message
- line/column when available
- a snippet around the failing expression location

You can click resolved values to open them in the value inspector popup.

## File Workflows

The app separates import/export from linked-file save.

### Import

`Import` loads a workspace JSON file into memory as the current workspace.

- it does not automatically keep that file linked for future saves
- after import, the workspace is treated as an unsaved draft until you save or link a file

### Link File

`Link file` attaches the workspace to a real JSON file on disk.

Once linked:

- edits are auto-saved back to that file
- explicit `Save` writes back to the linked file

### Save

`Save` writes to the linked file.

If no file is linked yet, the app prompts for a save location.

### Export

`Export` writes a snapshot copy of the current workspace to another file without changing the current linked file.

## Auto-Save

The workspace supports debounced auto-save.

- edits to scripts, global context, bindings, and custom functions mark the workspace dirty
- if a file is linked, changes save automatically
- if no file is linked, the workspace remains unsaved until you choose a save target

## Themes

The app supports:

- dark mode
- light mode

The selected theme is stored locally in browser storage.

## Demo Workspace

The included `jsonata-demo-workspace.json` groups examples under a single root collection and covers:

- basic selection
- summaries and aggregations
- arrays and mapping
- grouping and object construction
- variables and reusable expressions
- custom functions
- built-in function demos
- predicates and assertions
- output transformation patterns
- per-script input override

## Browser Requirements

For the best experience, use a Chromium-based browser such as:

- Chrome
- Edge

This matters because linked-file save workflows rely on the File System Access API.

## External Dependencies

The app is intentionally self-contained as a local HTML file, but it loads runtime libraries from CDNs:

- JSONata
- CodeMirror 6
- JSONata CodeMirror language package
- Google Fonts

So an internet connection is required unless those dependencies are later vendored locally.

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter`
  Run the current expression

- `Cmd/Ctrl + S`
  Save the current workspace

- `Escape`
  Close open overlays/modals

## Design Goals

This project deliberately favors:

- zero build tooling
- local-first use
- inspectable source
- a single standalone app file

Rather than:

- frameworks
- bundlers
- server-side setup
- complex project structure

## Limitations

- built-in JSONata autocomplete metadata is curated in the app rather than dynamically provided by the JSONata runtime
- runtime dependencies are CDN-backed
- this is optimized for practical local work, not for multi-user or cloud collaboration

## Running It

The simplest flow is:

1. open `jsonata-workbench.html`
2. import `jsonata-demo-workspace.json`
3. link or save a workspace file if you want persistent auto-save

That is the intended usage model.
