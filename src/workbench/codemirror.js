import * as view from '@codemirror/view'
import * as state from '@codemirror/state'
import * as commands from '@codemirror/commands'
import * as language from '@codemirror/language'
import * as search from '@codemirror/search'
import * as lint from '@codemirror/lint'
import * as autocomplete from '@codemirror/autocomplete'
import * as langJson from '@codemirror/lang-json'
import * as langJavascript from '@codemirror/lang-javascript'
import * as theme from '@codemirror/theme-one-dark'
import * as langJsonata from '@jsonhero/codemirror-lang-jsonata'

export function setupCodeMirrorBridge({
  esc,
  getCustomFunctionEntries,
  getActiveId,
  getEditorsState,
  initCMEditors,
  initLandingEditors
}) {
  const { EditorView, Decoration, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, highlightActiveLine, keymap, rectangularSelection, crosshairCursor, hoverTooltip } = view
  const { EditorState, StateEffect, StateField, RangeSetBuilder } = state
  const { defaultKeymap, indentWithTab, history, historyKeymap } = commands
  const { defaultHighlightStyle, syntaxHighlighting, foldGutter, codeFolding, foldService, indentOnInput, bracketMatching } = language
  const { searchKeymap, highlightSelectionMatches, search: searchExt } = search
  const { lintKeymap } = lint
  const { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completeFromList, completeAnyWord } = autocomplete
  const { json } = langJson
  const { javascript } = langJavascript
  const { oneDark } = theme

  const JFUNCS = [
    { label: '$string', sig: '(arg, prettify?)→str', info: 'Cast arg to a string' },
    { label: '$length', sig: '(str)→num', info: 'Length of a string' },
    { label: '$substring', sig: '(str, start, length?)→str', info: 'Extract a substring' },
    { label: '$substringBefore', sig: '(str, chars)→str', info: 'Substring before first occurrence of chars' },
    { label: '$substringAfter', sig: '(str, chars)→str', info: 'Substring after first occurrence of chars' },
    { label: '$uppercase', sig: '(str)→str', info: 'Convert to uppercase' },
    { label: '$lowercase', sig: '(str)→str', info: 'Convert to lowercase' },
    { label: '$trim', sig: '(str)→str', info: 'Remove leading/trailing whitespace' },
    { label: '$pad', sig: '(str, width, char?)→str', info: 'Pad string to specified width' },
    { label: '$contains', sig: '(str, pattern)→bool', info: 'Test if string matches pattern' },
    { label: '$split', sig: '(str, separator, limit?)→arr', info: 'Split string into an array' },
    { label: '$join', sig: '(arr, separator?)→str', info: 'Join array of strings into one string' },
    { label: '$match', sig: '(str, pattern, limit?)→arr', info: 'Find all regex matches in string' },
    { label: '$replace', sig: '(str, pattern, replacement, limit?)→str', info: 'Replace occurrences of pattern' },
    { label: '$eval', sig: '(expr, context?)→any', info: 'Evaluate a JSONata expression string' },
    { label: '$base64encode', sig: '(str)→str', info: 'Base64 encode a string' },
    { label: '$base64decode', sig: '(str)→str', info: 'Decode a base64 string' },
    { label: '$encodeUrlComponent', sig: '(str)→str', info: 'Percent-encode a URL component' },
    { label: '$encodeUrl', sig: '(str)→str', info: 'Percent-encode a URL' },
    { label: '$decodeUrlComponent', sig: '(str)→str', info: 'Decode a percent-encoded URL component' },
    { label: '$decodeUrl', sig: '(str)→str', info: 'Decode a percent-encoded URL' },
    { label: '$number', sig: '(arg)→num', info: 'Cast arg to a number' },
    { label: '$abs', sig: '(num)→num', info: 'Absolute value' },
    { label: '$floor', sig: '(num)→num', info: 'Round down to nearest integer' },
    { label: '$ceil', sig: '(num)→num', info: 'Round up to nearest integer' },
    { label: '$round', sig: '(num, precision?)→num', info: 'Round to specified decimal places' },
    { label: '$power', sig: '(base, exponent)→num', info: 'Raise base to the power of exponent' },
    { label: '$sqrt', sig: '(num)→num', info: 'Square root' },
    { label: '$random', sig: '()→num', info: 'Random float between 0 and 1' },
    { label: '$formatNumber', sig: '(num, picture, options?)→str', info: 'Format a number using a picture string' },
    { label: '$formatBase', sig: '(num, radix?)→str', info: 'Format number in the given radix' },
    { label: '$formatInteger', sig: '(num, picture)→str', info: 'Format an integer using a picture string' },
    { label: '$parseInteger', sig: '(str, picture)→num', info: 'Parse integer using a picture string' },
    { label: '$count', sig: '(array)→num', info: 'Number of items in array' },
    { label: '$append', sig: '(array1, array2)→arr', info: 'Concatenate two arrays' },
    { label: '$sort', sig: '(array, function?)→arr', info: 'Sort array, optionally with comparator' },
    { label: '$reverse', sig: '(array)→arr', info: 'Reverse an array' },
    { label: '$shuffle', sig: '(array)→arr', info: 'Randomly shuffle an array' },
    { label: '$distinct', sig: '(array)→arr', info: 'Remove duplicate values from array' },
    { label: '$zip', sig: '(array1, array2, ...)→arr', info: 'Interleave multiple arrays into array of arrays' },
    { label: '$sum', sig: '(array)→num', info: 'Sum of a numeric array' },
    { label: '$max', sig: '(array)→num', info: 'Maximum value in a numeric array' },
    { label: '$min', sig: '(array)→num', info: 'Minimum value in a numeric array' },
    { label: '$average', sig: '(array)→num', info: 'Mean average of a numeric array' },
    { label: '$keys', sig: '(obj)→arr', info: "Array of an object's keys" },
    { label: '$lookup', sig: '(obj, key)→any', info: 'Look up a key in an object' },
    { label: '$spread', sig: '(obj)→arr', info: 'Spread object into array of single-key objects' },
    { label: '$merge', sig: '(array)→obj', info: 'Merge an array of objects into one' },
    { label: '$sift', sig: '(obj, function)→obj', info: 'Filter object key-value pairs with a function' },
    { label: '$each', sig: '(obj, function)→arr', info: 'Apply function to each key-value pair' },
    { label: '$error', sig: '(message?)→error', info: 'Deliberately throw an error' },
    { label: '$assert', sig: '(condition, message)→void', info: 'Throw an error if condition is false' },
    { label: '$boolean', sig: '(arg)→bool', info: 'Cast arg to a Boolean' },
    { label: '$not', sig: '(arg)→bool', info: 'Logical NOT' },
    { label: '$exists', sig: '(arg)→bool', info: 'Test if arg exists (is not undefined)' },
    { label: '$type', sig: '(value)→str', info: 'Return the type of a value as a string' },
    { label: '$now', sig: '(picture?, timezone?)→str', info: 'Current UTC date/time as ISO 8601 string' },
    { label: '$millis', sig: '()→num', info: 'Current timestamp in milliseconds since epoch' },
    { label: '$fromMillis', sig: '(number, picture?, timezone?)→str', info: 'Convert ms since epoch to date string' },
    { label: '$toMillis', sig: '(str, picture?)→num', info: 'Convert date string to ms since epoch' },
    { label: '$map', sig: '(array, function)→arr', info: 'Apply function to every element of array' },
    { label: '$filter', sig: '(array, function)→arr', info: 'Filter array elements that match function' },
    { label: '$reduce', sig: '(array, function, init?)→any', info: 'Reduce array to single value' },
    { label: '$single', sig: '(array, function)→any', info: 'Return single element matching function' }
  ]

  function getJsonataFunctionOptions() {
    const seen = new Map(JFUNCS.map(f => [f.label, f]))
    getCustomFunctionEntries().forEach(f => {
      seen.set(f.label, {
        label: f.label,
        sig: f.signature || '(...)',
        info: f.info || 'Custom workspace function'
      })
    })
    return [...seen.values()]
  }

  const jsonataCompletion = autocompletion({
    override: [ctx => {
      const word = ctx.matchBefore(/\$[a-zA-Z_]*/) || ctx.matchBefore(/\$/)
      if (!word && !ctx.explicit) return null
      return {
        from: word ? word.from : ctx.pos,
        validFor: /^\$[a-zA-Z_]*$/,
        options: getJsonataFunctionOptions().map(f => ({
          label: f.label,
          type: 'function',
          detail: f.sig,
          info: f.info,
          apply: (view, _c, from, to) => {
            const ins = f.label + '()'
            view.dispatch({
              changes: { from, to, insert: ins },
              selection: { anchor: from + ins.length - 1 }
            })
          }
        }))
      }
    }]
  })

  const basicSetup = [
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
      ...lintKeymap
    ])
  ]

  const setErrorLocationEffect = StateEffect.define()
  const clearErrorLocationEffect = StateEffect.define()
  const errorMarkerField = StateField.define({
    create() { return Decoration.none },
    update(markers, tr) {
      markers = markers.map(tr.changes)
      for (const effect of tr.effects) {
        if (effect.is(clearErrorLocationEffect)) return Decoration.none
        if (effect.is(setErrorLocationEffect)) {
          const lineNo = Math.max(1, effect.value?.line || 1)
          const line = tr.state.doc.line(Math.min(lineNo, tr.state.doc.lines))
          const builder = new RangeSetBuilder()
          builder.add(line.from, line.from, Decoration.line({ attributes: { class: 'cm-errLine' } }))
          return builder.finish()
        }
      }
      return markers
    },
    provide: f => EditorView.decorations.from(f)
  })

  function errorMarkerExt() {
    return errorMarkerField
  }

  function setEditorErrorLocation(view, loc) {
    if (!view) return
    view.dispatch({ effects: setErrorLocationEffect.of(loc) })
  }

  function clearEditorErrorLocation(view) {
    if (!view) return
    view.dispatch({ effects: clearErrorLocationEffect.of(null) })
  }

  const jsonataFn = langJsonata.jsonata

  const jsonataHover = hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos)
    const text = line.text
    const col = pos - line.from
    let s = col
    while (s > 0 && /[$a-zA-Z0-9_]/.test(text[s - 1])) s--
    let e = col
    while (e < text.length && /[a-zA-Z0-9_]/.test(text[e])) e++
    const word = text.slice(s, e)
    if (!word.startsWith('$')) return null
    const fn = getJsonataFunctionOptions().find(f => f.label === word)
    if (!fn) return null
    return {
      pos: line.from + s,
      end: line.from + e,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'cm-fn-tooltip'
        dom.innerHTML =
          '<div class="cm-fn-tt-sig">' + esc(fn.label + fn.sig) + '</div>' +
          '<div class="cm-fn-tt-info">' + esc(fn.info) + '</div>'
        return { dom }
      }
    }
  }, { hideOnChange: true })

  const jsAutocomplete = autocompletion({
    override: [
      completeFromList([
        { label: 'implementation', type: 'property', apply: 'implementation: (value) => value' },
        { label: 'signature', type: 'property', apply: "signature: '<s:s>'" },
        { label: 'description', type: 'property', apply: "description: 'Custom workspace function'" },
        { label: 'slug', type: 'function', apply: 'slug: (value) => String(value).toLowerCase()' },
        { label: 'uppercaseWords', type: 'function', apply: 'uppercaseWords: (value) => String(value).toUpperCase()' }
      ]),
      completeAnyWord
    ]
  })

  function countTopLevelMembers(innerText) {
    const text = (innerText || '').trim()
    if (!text) return 0
    let depth = 0
    let count = 1
    let inString = false
    let escaped = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{' || ch === '[' || ch === '(') {
        depth++
        continue
      }
      if (ch === '}' || ch === ']' || ch === ')') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (ch === ',' && depth === 0) count++
    }
    return count
  }

  function summariseFoldedRange(state, range) {
    const open = range.from > 0 ? state.sliceDoc(range.from - 1, range.from) : ''
    const close = range.to < state.doc.length ? state.sliceDoc(range.to, range.to + 1) : ''
    const inner = state.sliceDoc(range.from, range.to)
    if (open === '[' && close === ']') {
      const count = countTopLevelMembers(inner)
      return { kind: 'array', count, label: `${count} item${count === 1 ? '' : 's'}` }
    }
    if (open === '{' && close === '}') {
      const count = countTopLevelMembers(inner)
      return { kind: 'object', count, label: `${count} ${count === 1 ? 'key' : 'keys'}` }
    }
    if (open === '(' && close === ')') {
      return { kind: 'group', count: 0, label: 'group' }
    }
    return { kind: 'value', count: 0, label: 'collapsed' }
  }

  function findFoldOpen(state, lineStart, lineEnd, pairs) {
    const text = state.sliceDoc(lineStart, lineEnd)
    let inString = false
    let escaped = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      const close = pairs[ch]
      if (close) return { pos: lineStart + i, open: ch, close }
    }
    return null
  }

  function findFoldClose(state, openPos, openCh, closeCh) {
    let depth = 1
    let inString = false
    let escaped = false
    const text = state.doc.toString()
    for (let i = openPos + 1; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === openCh) depth++
      else if (ch === closeCh) {
        depth--
        if (depth === 0) return i
      }
    }
    return -1
  }

  function buildBracketFoldExtension({ pairs, multilineOnly = true } = {}) {
    if (!codeFolding || !foldService) return []
    return [
      foldService.of((state, lineStart, lineEnd) => {
        const openInfo = findFoldOpen(state, lineStart, lineEnd, pairs)
        if (!openInfo) return null
        const closePos = findFoldClose(state, openInfo.pos, openInfo.open, openInfo.close)
        if (closePos < 0 || closePos <= openInfo.pos + 1) return null
        if (multilineOnly) {
          const openLine = state.doc.lineAt(openInfo.pos)
          const closeLine = state.doc.lineAt(closePos)
          if (closeLine.number <= openLine.number) return null
        }
        return { from: openInfo.pos + 1, to: closePos }
      }),
      codeFolding({
        preparePlaceholder: (state, range) => summariseFoldedRange(state, range),
        placeholderDOM(_view, onclick, prepared) {
          const el = document.createElement('span')
          el.className = 'cm-foldSummary'
          el.setAttribute('title', 'Click to expand')
          el.innerHTML = `<strong>…</strong><span>${esc(prepared?.label || 'collapsed')}</span>`
          el.addEventListener('click', onclick)
          return el
        }
      })
    ]
  }

  function jsonFoldSummaryExt() {
    return buildBracketFoldExtension({ pairs: { '{': '}', '[': ']' }, multilineOnly: true })
  }

  function jsonataFoldSummaryExt() {
    return buildBracketFoldExtension({ pairs: { '{': '}', '[': ']', '(': ')' }, multilineOnly: true })
  }

  window._CM = {
    EditorView,
    EditorState,
    basicSetup,
    json,
    javascript,
    oneDark,
    searchExt,
    jsonataFn,
    jsonataCompletion,
    jsonataHover,
    jsAutocomplete,
    jsonFoldSummaryExt,
    jsonataFoldSummaryExt,
    errorMarkerExt,
    setEditorErrorLocation,
    clearEditorErrorLocation
  }

  const editors = getEditorsState()
  if (getActiveId() && !editors.inputEditor && !editors.exprEditor) initCMEditors()
  if (!getActiveId() && !editors.landingContextEditor && !editors.landingBindingsEditor && !editors.landingFunctionsEditor) {
    initLandingEditors()
  }
}
