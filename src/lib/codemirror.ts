import {
  EditorView,
  Decoration,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  rectangularSelection,
  crosshairCursor,
  hoverTooltip,
  type ViewUpdate,
} from "@codemirror/view";
import {
  EditorState,
  StateEffect,
  StateField,
  RangeSetBuilder,
  type Extension,
} from "@codemirror/state";
import {
  defaultKeymap,
  indentWithTab,
  history,
  historyKeymap,
} from "@codemirror/commands";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  foldGutter,
  codeFolding,
  foldService,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import {
  searchKeymap,
  highlightSelectionMatches,
  search as searchExt,
} from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  completeFromList,
  completeAnyWord,
} from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { jsonata as jsonataFn } from "@jsonhero/codemirror-lang-jsonata";
import jsonata from "jsonata";
import type { CustomFunctionEntry } from "../types/workspace";
import { buildScopedExpression, esc, getValueViewerConfig } from "./helpers";
import { registerCustomFunctions } from "./customFunctions";

export { EditorView, EditorState };

// ── JSONATA BUILT-INS ────────────────────────────────────────────
const JFUNCS: Array<{ label: string; sig: string; info: string }> = [
  {
    label: "$string",
    sig: "(arg, prettify?)→str",
    info: "Cast arg to a string",
  },
  { label: "$length", sig: "(str)→num", info: "Length of a string" },
  {
    label: "$substring",
    sig: "(str, start, length?)→str",
    info: "Extract a substring",
  },
  {
    label: "$substringBefore",
    sig: "(str, chars)→str",
    info: "Substring before first occurrence of chars",
  },
  {
    label: "$substringAfter",
    sig: "(str, chars)→str",
    info: "Substring after first occurrence of chars",
  },
  { label: "$uppercase", sig: "(str)→str", info: "Convert to uppercase" },
  { label: "$lowercase", sig: "(str)→str", info: "Convert to lowercase" },
  {
    label: "$trim",
    sig: "(str)→str",
    info: "Remove leading/trailing whitespace",
  },
  {
    label: "$pad",
    sig: "(str, width, char?)→str",
    info: "Pad string to specified width",
  },
  {
    label: "$contains",
    sig: "(str, pattern)→bool",
    info: "Test if string matches pattern",
  },
  {
    label: "$split",
    sig: "(str, separator, limit?)→arr",
    info: "Split string into an array",
  },
  {
    label: "$join",
    sig: "(arr, separator?)→str",
    info: "Join array of strings into one string",
  },
  {
    label: "$match",
    sig: "(str, pattern, limit?)→arr",
    info: "Find all regex matches in string",
  },
  {
    label: "$replace",
    sig: "(str, pattern, replacement, limit?)→str",
    info: "Replace occurrences of pattern",
  },
  {
    label: "$eval",
    sig: "(expr, context?)→any",
    info: "Evaluate a JSONata expression string",
  },
  { label: "$base64encode", sig: "(str)→str", info: "Base64 encode a string" },
  { label: "$base64decode", sig: "(str)→str", info: "Decode a base64 string" },
  {
    label: "$encodeUrlComponent",
    sig: "(str)→str",
    info: "Percent-encode a URL component",
  },
  { label: "$encodeUrl", sig: "(str)→str", info: "Percent-encode a URL" },
  {
    label: "$decodeUrlComponent",
    sig: "(str)→str",
    info: "Decode a percent-encoded URL component",
  },
  {
    label: "$decodeUrl",
    sig: "(str)→str",
    info: "Decode a percent-encoded URL",
  },
  { label: "$number", sig: "(arg)→num", info: "Cast arg to a number" },
  { label: "$abs", sig: "(num)→num", info: "Absolute value" },
  { label: "$floor", sig: "(num)→num", info: "Round down to nearest integer" },
  { label: "$ceil", sig: "(num)→num", info: "Round up to nearest integer" },
  {
    label: "$round",
    sig: "(num, precision?)→num",
    info: "Round to specified decimal places",
  },
  {
    label: "$power",
    sig: "(base, exponent)→num",
    info: "Raise base to the power of exponent",
  },
  { label: "$sqrt", sig: "(num)→num", info: "Square root" },
  { label: "$random", sig: "()→num", info: "Random float between 0 and 1" },
  {
    label: "$formatNumber",
    sig: "(num, picture, options?)→str",
    info: "Format a number using a picture string",
  },
  {
    label: "$formatBase",
    sig: "(num, radix?)→str",
    info: "Format number in the given radix",
  },
  {
    label: "$formatInteger",
    sig: "(num, picture)→str",
    info: "Format an integer using a picture string",
  },
  {
    label: "$parseInteger",
    sig: "(str, picture)→num",
    info: "Parse integer using a picture string",
  },
  { label: "$count", sig: "(array)→num", info: "Number of items in array" },
  {
    label: "$append",
    sig: "(array1, array2)→arr",
    info: "Concatenate two arrays",
  },
  {
    label: "$sort",
    sig: "(array, function?)→arr",
    info: "Sort array, optionally with comparator",
  },
  { label: "$reverse", sig: "(array)→arr", info: "Reverse an array" },
  { label: "$shuffle", sig: "(array)→arr", info: "Randomly shuffle an array" },
  {
    label: "$distinct",
    sig: "(array)→arr",
    info: "Remove duplicate values from array",
  },
  {
    label: "$zip",
    sig: "(array1, array2, ...)→arr",
    info: "Interleave multiple arrays into array of arrays",
  },
  { label: "$sum", sig: "(array)→num", info: "Sum of a numeric array" },
  {
    label: "$max",
    sig: "(array)→num",
    info: "Maximum value in a numeric array",
  },
  {
    label: "$min",
    sig: "(array)→num",
    info: "Minimum value in a numeric array",
  },
  {
    label: "$average",
    sig: "(array)→num",
    info: "Mean average of a numeric array",
  },
  { label: "$keys", sig: "(obj)→arr", info: "Array of an object's keys" },
  {
    label: "$lookup",
    sig: "(obj, key)→any",
    info: "Look up a key in an object",
  },
  {
    label: "$spread",
    sig: "(obj)→arr",
    info: "Spread object into array of single-key objects",
  },
  {
    label: "$merge",
    sig: "(array)→obj",
    info: "Merge an array of objects into one",
  },
  {
    label: "$sift",
    sig: "(obj, function)→obj",
    info: "Filter object key-value pairs with a function",
  },
  {
    label: "$each",
    sig: "(obj, function)→arr",
    info: "Apply function to each key-value pair",
  },
  {
    label: "$error",
    sig: "(message?)→error",
    info: "Deliberately throw an error",
  },
  {
    label: "$assert",
    sig: "(condition, message)→void",
    info: "Throw an error if condition is false",
  },
  { label: "$boolean", sig: "(arg)→bool", info: "Cast arg to a Boolean" },
  { label: "$not", sig: "(arg)→bool", info: "Logical NOT" },
  {
    label: "$exists",
    sig: "(arg)→bool",
    info: "Test if arg exists (is not undefined)",
  },
  {
    label: "$type",
    sig: "(value)→str",
    info: "Return the type of a value as a string",
  },
  {
    label: "$now",
    sig: "(picture?, timezone?)→str",
    info: "Current UTC date/time as ISO 8601 string",
  },
  {
    label: "$millis",
    sig: "()→num",
    info: "Current timestamp in milliseconds since epoch",
  },
  {
    label: "$fromMillis",
    sig: "(number, picture?, timezone?)→str",
    info: "Convert ms since epoch to date string",
  },
  {
    label: "$toMillis",
    sig: "(str, picture?)→num",
    info: "Convert date string to ms since epoch",
  },
  {
    label: "$map",
    sig: "(array, function)→arr",
    info: "Apply function to every element of array",
  },
  {
    label: "$filter",
    sig: "(array, function)→arr",
    info: "Filter array elements that match function",
  },
  {
    label: "$reduce",
    sig: "(array, function, init?)→any",
    info: "Reduce array to single value",
  },
  {
    label: "$single",
    sig: "(array, function)→any",
    info: "Return single element matching function",
  },
];

function getFunctionOptions(getEntries: () => CustomFunctionEntry[]) {
  const seen = new Map(JFUNCS.map((f) => [f.label, f]));
  getEntries().forEach((f) =>
    seen.set(f.label, {
      label: f.label,
      sig: f.signature ?? "(...)",
      info: f.info ?? "Custom workspace function",
    }),
  );
  return [...seen.values()];
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────────
const SEC_FIELDS = { name: "Fields", rank: 5 };
const SEC_VARS = { name: "Variables", rank: 10 };
const SEC_CUSTOM = { name: "Custom Functions", rank: 20 };
const SEC_BUILTIN = { name: "Functions", rank: 30 };

function makeApply(label: string) {
  return (view: EditorView, _c: unknown, from: number, to: number) => {
    const ins = label + "()";
    view.dispatch({
      changes: { from, to, insert: ins },
      selection: { anchor: from + ins.length - 1 },
    });
  };
}



const JSONATA_KEYWORDS = new Set([
  "true", "false", "null", "and", "or", "in", "not", "instance", "of",
]);

function extractExprIdentifiers(expr: string): string[] {
  const keys = new Set<string>();
  // Quoted object keys defined in the expression: "key":
  const quotedRe = /["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = quotedRe.exec(expr)) !== null) keys.add(m[1]);
  // Unquoted identifiers used as field references (not $-prefixed, not keywords)
  const identRe = /(?<!\$)\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  while ((m = identRe.exec(expr)) !== null) {
    if (!JSONATA_KEYWORDS.has(m[1])) keys.add(m[1]);
  }
  return [...keys];
}

export function createJsonataCompletion(
  getEntries: () => CustomFunctionEntry[],
  getBindingVars?: () => string[],
  getInputKeys?: () => string[],
): Extension {
  return autocompletion({
    override: [
      // ── $-prefixed: variables, custom functions, built-ins ──
      (ctx) => {
        const word = ctx.matchBefore(/\$[a-zA-Z_]*/) ?? ctx.matchBefore(/\$/);
        if (!word && !ctx.explicit) return null;

        const customEntries = getEntries();
        const customLabelSet = new Set(customEntries.map((f) => f.label));

        const builtinOptions = JFUNCS.filter(
          (f) => !customLabelSet.has(f.label),
        ).map((f) => ({
          label: f.label,
          type: "function",
          detail: f.sig,
          info: f.info,
          section: SEC_BUILTIN,
          apply: makeApply(f.label),
        }));

        const customOptions = customEntries.map((f) => ({
          label: f.label,
          type: "function",
          detail: f.signature ?? "(...)",
          info: f.info ?? "Custom workspace function",
          section: SEC_CUSTOM,
          apply: makeApply(f.label),
        }));

        const allFnLabels = new Set(
          [...builtinOptions, ...customOptions].map((f) => f.label),
        );
        const varNames = new Set<string>();
        if (getBindingVars) getBindingVars().forEach((v) => varNames.add(v));
        const re = /\$([A-Za-z_][A-Za-z0-9_]*)\s*:=/g;
        const docText = ctx.state.doc.toString();
        let m: RegExpExecArray | null;
        while ((m = re.exec(docText)) !== null) varNames.add("$" + m[1]);
        const varOptions = [...varNames]
          .filter((v) => !allFnLabels.has(v))
          .map((v) => ({
            label: v,
            type: "variable",
            section: SEC_VARS,
          }));

        return {
          from: word ? word.from : ctx.pos,
          validFor: /^\$[a-zA-Z_]*$/,
          options: [...varOptions, ...customOptions, ...builtinOptions],
        };
      },

      // ── plain identifiers: field keys from input JSON + expression itself ──
      (ctx) => {
        const word = ctx.matchBefore(/[a-zA-Z_][a-zA-Z0-9_]*/);
        if (!word && !ctx.explicit) return null;
        // Don't fire when the word is part of a $-prefixed identifier
        if (
          word &&
          word.from > 0 &&
          ctx.state.doc.sliceString(word.from - 1, word.from) === "$"
        )
          return null;
        const typingText = word ? ctx.state.doc.sliceString(word.from, word.to) : '';
        const inputKeys = getInputKeys ? getInputKeys() : [];
        const exprKeys = extractExprIdentifiers(ctx.state.doc.toString())
          .filter(k => k !== typingText);
        const allKeys = [...new Set([...inputKeys, ...exprKeys])];
        if (!allKeys.length) return null;
        return {
          from: word ? word.from : ctx.pos,
          validFor: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          options: allKeys.map((k) => ({
            label: k,
            type: "property",
            section: SEC_FIELDS,
          })),
        };
      },
    ],
  });
}

// ── HOVER TOOLTIP ────────────────────────────────────────────────
export interface HoverContext {
  inputData: unknown
  bindingValues: Record<string, unknown>
  customFns: CustomFunctionEntry[]
}

interface HoverTokenInfo {
  token: string
  tokenStart: number
  tokenEnd: number
  word: string
  wordStart: number
  wordEnd: number
}

function makeValueTooltip(
  label: string,
  value: unknown,
  span: { pos: number; end: number; above: boolean },
) {
  return {
    ...span,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-fn-tooltip'
      const title = document.createElement('div')
      title.className = 'cm-fn-tt-sig'
      title.textContent = label
      dom.appendChild(title)
      const editorHost = document.createElement('div')
      editorHost.className = 'cm-fn-tt-editorHost'
      dom.appendChild(editorHost)

      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
      const { doc, mode } = getValueViewerConfig(value)
      const editor = new EditorView({
        doc,
        parent: editorHost,
        extensions: buildEditorExtensions({
          mode,
          readOnly: true,
          theme,
        }),
      })

      return {
        dom,
        destroy() {
          editor.destroy()
        },
      }
    },
  }
}

function makeFnTooltip(
  fn: { label: string; sig: string; info: string },
  span: { pos: number; end: number; above: boolean },
) {
  return {
    ...span,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-fn-tooltip'
      dom.innerHTML =
        `<div class="cm-fn-tt-sig">${esc(fn.label + fn.sig)}</div>` +
        `<div class="cm-fn-tt-info">${esc(fn.info)}</div>`
      return { dom }
    },
  }
}

// Find the position after the closing ')' that matches the '(' at openPos.
// Returns -1 if not found. Handles nesting and string literals.
function findMatchingParen(text: string, openPos: number): number {
  let depth = 1
  let inStr: '' | '"' | "'" | '`' = ''
  let escaped = false
  for (let i = openPos + 1; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === inStr) inStr = ''
    } else {
      if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue }
      if (ch === '(') depth++
      else if (ch === ')') { depth--; if (depth === 0) return i + 1 }
    }
  }
  return -1
}

function findObjectValueExpression(
  docText: string,
  wordStart: number,
  wordEnd: number,
): { expr: string; start: number; end: number } | null {
  let cursor = wordEnd
  const quote = wordStart > 0 ? docText[wordStart - 1] : ""
  if ((quote === '"' || quote === "'") && docText[wordEnd] === quote) cursor = wordEnd + 1

  while (cursor < docText.length && /\s/.test(docText[cursor])) cursor++
  if (docText[cursor] !== ":") return null
  if (docText[cursor + 1] === "=") return null
  cursor++
  while (cursor < docText.length && /\s/.test(docText[cursor])) cursor++
  if (docText[cursor] === "=") return null
  if (cursor >= docText.length) return null

  const valueStart = cursor
  let paren = 0
  let brace = 0
  let bracket = 0
  let inStr: '' | '"' | "'" | '`' = ''
  let escaped = false

  for (let i = valueStart; i < docText.length; i++) {
    const ch = docText[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === inStr) inStr = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === "(") paren++
    else if (ch === ")" && paren > 0) paren--
    else if (ch === "{") brace++
    else if (ch === "}" && brace > 0) brace--
    else if (ch === "[") bracket++
    else if (ch === "]" && bracket > 0) bracket--
    else if ((ch === "," || ch === "}") && paren === 0 && brace === 0 && bracket === 0) {
      const expr = docText.slice(valueStart, i).trim()
      return expr ? { expr, start: valueStart, end: i } : null
    }
  }

  const expr = docText.slice(valueStart).trim()
  return expr ? { expr, start: valueStart, end: docText.length } : null
}

function getHoverTokenInfo(
  docText: string,
  lineText: string,
  lineFrom: number,
  pos: number,
): HoverTokenInfo | null {
  const col = pos - lineFrom
  const identChar = /[$a-zA-Z0-9_]/
  let anchor = col
  if (anchor > 0 && lineText[anchor] === ".") anchor--
  if (anchor < lineText.length - 1 && lineText[anchor] === ".") anchor++
  if (anchor < 0 || anchor >= lineText.length) return null

  let wordLineStart = anchor
  while (wordLineStart > 0 && identChar.test(lineText[wordLineStart - 1])) wordLineStart--
  let wordLineEnd = anchor
  while (wordLineEnd < lineText.length && identChar.test(lineText[wordLineEnd])) wordLineEnd++
  if (wordLineStart === wordLineEnd) return null

  const word = lineText.slice(wordLineStart, wordLineEnd)
  if (!word || !/^[$a-zA-Z_]/.test(word)) return null

  let tokenLineStart = wordLineStart
  while (tokenLineStart > 0) {
    const dotIdx = tokenLineStart - 1
    if (lineText[dotIdx] !== ".") break
    let segStart = dotIdx
    while (segStart > 0 && identChar.test(lineText[segStart - 1])) segStart--
    if (segStart === dotIdx) break
    tokenLineStart = segStart
  }

  let tokenStart = lineFrom + tokenLineStart
  let tokenEnd = lineFrom + wordLineEnd

  // If followed by '(', include the full call. This covers both $fn(...) and path.fn(...).
  if (docText[tokenEnd] === "(") {
    const close = findMatchingParen(docText, tokenEnd)
    if (close !== -1) tokenEnd = close
  }
  const wordStart = lineFrom + wordLineStart
  const wordEnd = lineFrom + wordLineEnd

  return {
    token: docText.slice(tokenStart, tokenEnd),
    tokenStart,
    tokenEnd,
    word,
    wordStart,
    wordEnd,
  }
}

export function createJsonataHover(
  getEntries: () => CustomFunctionEntry[],
  getHoverContext?: () => HoverContext | null,
): Extension {
  return hoverTooltip(
    (view, pos) => {
      const line = view.state.doc.lineAt(pos)
      const docText = view.state.doc.toString()
      const tokenInfo = getHoverTokenInfo(docText, line.text, line.from, pos)
      if (!tokenInfo) return null

      const { token, tokenStart, tokenEnd, word, wordStart, wordEnd } = tokenInfo
      const fnLabel = (token.match(/^\$[A-Za-z_][A-Za-z0-9_]*/) ?? [word])[0]
      const wordSpan = { pos: wordStart, end: wordEnd, above: true }
      const fullSpan = { pos: tokenStart, end: tokenEnd, above: true }

      const ctx = getHoverContext?.()

      // No context — fall back to function signature only
      if (!ctx) {
        const fn = getFunctionOptions(getEntries).find(f => f.label === fnLabel)
        return fn ? makeFnTooltip(fn, wordSpan) : null
      }

      // Evaluate the full token (including args if present) in real time
      return (async () => {
        try {
          const keyValueExpr = findObjectValueExpression(docText, wordStart, wordEnd)
          const targetExpr = keyValueExpr?.expr ?? token
          const targetStart = keyValueExpr?.start ?? tokenStart
          const targetEnd = keyValueExpr?.end ?? tokenEnd
          const hoverExpr = buildScopedExpression(docText, targetExpr, targetStart)
          const expr = jsonata(hoverExpr)
          registerCustomFunctions(
            expr as Parameters<typeof registerCustomFunctions>[0],
            ctx.customFns,
          )
          const value = await expr.evaluate(ctx.inputData as object, ctx.bindingValues)
          // Bare function reference — show signature instead
          if (value === undefined || typeof value === 'function') {
            const fn = getFunctionOptions(getEntries).find(f => f.label === fnLabel)
            return fn ? makeFnTooltip(fn, wordSpan) : null
          }
          const labelSource = keyValueExpr ? `${word}: ${targetExpr}` : targetExpr
          const label = labelSource.length > 60 ? labelSource.slice(0, 57) + '…' : labelSource
          const span = keyValueExpr ? { pos: wordStart, end: wordEnd, above: true } : fullSpan
          return makeValueTooltip(label, value, span)
        } catch {
          const fn = getFunctionOptions(getEntries).find(f => f.label === fnLabel)
          return fn ? makeFnTooltip(fn, wordSpan) : null
        }
      })()
    },
    { hideOnChange: true, hoverTime: 100 },
  )
}

// ── JS AUTOCOMPLETE ──────────────────────────────────────────────
const jsAutocomplete: Extension = autocompletion({
  override: [
    completeFromList([
      {
        label: "implementation",
        type: "property",
        apply: "implementation: (value) => value",
      },
      { label: "signature", type: "property", apply: "signature: '<s:s>'" },
      {
        label: "description",
        type: "property",
        apply: "description: 'Custom workspace function'",
      },
      {
        label: "slug",
        type: "function",
        apply: "slug: (value) => String(value).toLowerCase()",
      },
      {
        label: "uppercaseWords",
        type: "function",
        apply: "uppercaseWords: (value) => String(value).toUpperCase()",
      },
    ]),
    completeAnyWord,
  ],
});

// ── BASIC SETUP ──────────────────────────────────────────────────
const basicSetup: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    indentWithTab,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];

// ── ERROR MARKER ─────────────────────────────────────────────────
const setErrorLocationEffect = StateEffect.define<{ line?: number } | null>();
const clearErrorLocationEffect = StateEffect.define<null>();

export const errorMarkerField = StateField.define<
  ReturnType<typeof Decoration.none>
>({
  create() {
    return Decoration.none;
  },
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(clearErrorLocationEffect)) return Decoration.none;
      if (effect.is(setErrorLocationEffect)) {
        const lineNo = Math.max(1, effect.value?.line ?? 1);
        const line = tr.state.doc.line(Math.min(lineNo, tr.state.doc.lines));
        const builder = new RangeSetBuilder<
          ReturnType<typeof Decoration.line>
        >();
        builder.add(
          line.from,
          line.from,
          Decoration.line({ attributes: { class: "cm-errLine" } }),
        );
        return builder.finish();
      }
    }
    return markers;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function setEditorErrorLocation(
  view: EditorView | null,
  loc: { line?: number } | null,
): void {
  view?.dispatch({ effects: setErrorLocationEffect.of(loc) });
}

export function clearEditorErrorLocation(view: EditorView | null): void {
  view?.dispatch({ effects: clearErrorLocationEffect.of(null) });
}

// ── FOLD HELPERS ─────────────────────────────────────────────────
function countTopLevelMembers(innerText: string): number {
  const text = (innerText ?? "").trim();
  if (!text) return 0;
  let depth = 0,
    count = 1,
    inString = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (ch === "," && depth === 0) count++;
  }
  return count;
}

function summariseFoldedRange(
  state: EditorState,
  range: { from: number; to: number },
): { kind: string; count: number; label: string } {
  const open = range.from > 0 ? state.sliceDoc(range.from - 1, range.from) : "";
  const close =
    range.to < state.doc.length ? state.sliceDoc(range.to, range.to + 1) : "";
  const inner = state.sliceDoc(range.from, range.to);
  if (open === "[" && close === "]") {
    const count = countTopLevelMembers(inner);
    return {
      kind: "array",
      count,
      label: `${count} item${count === 1 ? "" : "s"}`,
    };
  }
  if (open === "{" && close === "}") {
    const count = countTopLevelMembers(inner);
    return {
      kind: "object",
      count,
      label: `${count} ${count === 1 ? "key" : "keys"}`,
    };
  }
  if (open === "(" && close === ")")
    return { kind: "group", count: 0, label: "group" };
  return { kind: "value", count: 0, label: "collapsed" };
}

function findFoldOpen(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
  pairs: Record<string, string>,
) {
  const text = state.sliceDoc(lineStart, lineEnd);
  let inString = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    const close = pairs[ch];
    if (close) return { pos: lineStart + i, open: ch, close };
  }
  return null;
}

function findFoldClose(
  state: EditorState,
  openPos: number,
  openCh: string,
  closeCh: string,
): number {
  let depth = 1,
    inString = false,
    escaped = false;
  const text = state.doc.toString();
  for (let i = openPos + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function buildBracketFoldExtension({
  pairs,
  multilineOnly = true,
}: {
  pairs: Record<string, string>;
  multilineOnly?: boolean;
}): Extension[] {
  return [
    foldService.of((state, lineStart, lineEnd) => {
      const openInfo = findFoldOpen(state, lineStart, lineEnd, pairs);
      if (!openInfo) return null;
      const closePos = findFoldClose(
        state,
        openInfo.pos,
        openInfo.open,
        openInfo.close,
      );
      if (closePos < 0 || closePos <= openInfo.pos + 1) return null;
      if (multilineOnly) {
        const openLine = state.doc.lineAt(openInfo.pos);
        const closeLine = state.doc.lineAt(closePos);
        if (closeLine.number <= openLine.number) return null;
      }
      return { from: openInfo.pos + 1, to: closePos };
    }),
    codeFolding({
      preparePlaceholder: (state, range) => summariseFoldedRange(state, range),
      placeholderDOM(
        _view: EditorView,
        onclick: () => void,
        prepared: { label?: string } | null,
      ) {
        const el = document.createElement("span");
        el.className = "cm-foldSummary";
        el.setAttribute("title", "Click to expand");
        el.innerHTML = `<strong>…</strong><span>${esc(prepared?.label ?? "collapsed")}</span>`;
        el.addEventListener("click", onclick);
        return el;
      },
    }),
  ];
}

export function jsonFoldSummaryExt(): Extension[] {
  return buildBracketFoldExtension({
    pairs: { "{": "}", "[": "]" },
    multilineOnly: true,
  });
}

export function jsonataFoldSummaryExt(): Extension[] {
  return buildBracketFoldExtension({
    pairs: { "{": "}", "[": "]", "(": ")" },
    multilineOnly: true,
  });
}

// ── BUILD EDITOR EXTENSIONS ──────────────────────────────────────
export interface EditorExtensionOptions {
  mode?: "json" | "javascript" | "jsonata" | "plain";
  readOnly?: boolean;
  withErrorMarkers?: boolean;
  theme?: "dark" | "light";
  updateListener?: (update: ViewUpdate) => void;
  domHandlers?: Record<
    string,
    (event: Event, view: EditorView) => boolean | void
  >;
  getCustomFunctionEntries?: () => CustomFunctionEntry[];
  getBindingVars?: () => string[];
  getInputKeys?: () => string[];
  getHoverContext?: () => HoverContext | null;
}

export function buildEditorExtensions(
  opts: EditorExtensionOptions = {},
): Extension[] {
  const {
    mode = "plain",
    readOnly,
    withErrorMarkers,
    theme = "dark",
    updateListener,
    domHandlers,
    getCustomFunctionEntries,
    getBindingVars,
    getInputKeys,
    getHoverContext,
  } = opts;
  const extensions: Extension[] = [...basicSetup];

  if (withErrorMarkers) extensions.push(errorMarkerField);

  if (mode === "json") {
    extensions.push(...jsonFoldSummaryExt(), json());
  } else if (mode === "javascript") {
    extensions.push(
      javascript({ jsx: false, typescript: false }),
      jsAutocomplete,
    );
  } else if (mode === "jsonata") {
    extensions.push(...jsonataFoldSummaryExt(), jsonataFn());
    const getEntries = getCustomFunctionEntries ?? (() => []);
    extensions.push(
      createJsonataCompletion(getEntries, getBindingVars, getInputKeys),
      createJsonataHover(getEntries, getHoverContext),
    );
  }

  if (theme === "dark") extensions.push(oneDark);
  extensions.push(searchExt({ top: false }));
  if (updateListener)
    extensions.push(EditorView.updateListener.of(updateListener));
  if (domHandlers) extensions.push(EditorView.domEventHandlers(domHandlers));
  if (readOnly) extensions.push(EditorState.readOnly.of(true));

  return extensions;
}
