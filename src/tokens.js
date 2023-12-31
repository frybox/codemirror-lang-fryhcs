import {ExternalTokenizer, ContextTracker} from "@lezer/lr"
import {
  newline as newlineToken, eof, newlineBracketed, blankLineStart, indent, dedent, printKeyword,
  ParenthesizedExpression, TupleExpression, ComprehensionExpression,
  PatternArgList, SequencePattern, MappingPattern, FormatString, TypeParamList,
  ArrayExpression, ArrayComprehensionExpression, ArgList, ParamList, importList, subscript,
  DictionaryExpression, DictionaryComprehensionExpression, SetExpression, SetComprehensionExpression,
  formatString1Content, formatString1Brace, formatString1End,
  formatString2Content, formatString2Brace, formatString2End,
  formatStringBContent, formatStringBBrace, formatStringBEnd,
  formatString1lContent, formatString1lBrace, formatString1lEnd,
  formatString2lContent, formatString2lBrace, formatString2lEnd,
  scriptText, startCloseScriptTag,
  ParenL, BraceL, BracketL
} from "./fryhcs-parser.terms.js"

const newline = 10, carriageReturn = 13, space = 32, tab = 9, hash = 35, parenOpen = 40, dot = 46,
      braceOpen = 123, singleQuote = 39, doubleQuote = 34, backslash = 92, bracketOpen = 91, bracketClose = 93

const bracketed = new Set([
  ParenthesizedExpression, TupleExpression, ComprehensionExpression, importList, ArgList, ParamList,
  ArrayExpression, ArrayComprehensionExpression, subscript,
  SetExpression, SetComprehensionExpression, FormatString,
  DictionaryExpression, DictionaryComprehensionExpression,
  SequencePattern, MappingPattern, PatternArgList, TypeParamList
])

function isLineBreak(ch) {
  return ch == newline || ch == carriageReturn
}

export const newlines = new ExternalTokenizer((input, stack) => {
  let prev
  if (input.next < 0) {
    input.acceptToken(eof)
  } else if (stack.context.depth < 0) {
    if (isLineBreak(input.next)) input.acceptToken(newlineBracketed, 1)
  } else if (((prev = input.peek(-1)) < 0 || isLineBreak(prev)) &&
             stack.canShift(blankLineStart)) {
    let spaces = 0
    while (input.next == space || input.next == tab) { input.advance(); spaces++ }
    if (input.next == newline || input.next == carriageReturn || input.next == hash)
      input.acceptToken(blankLineStart, -spaces)
  } else if (isLineBreak(input.next)) {
    input.acceptToken(newlineToken, 1)
  }
}, {contextual: true})

export const indentation = new ExternalTokenizer((input, stack) => {
  let cDepth = stack.context.depth
  if (cDepth < 0) return
  let prev = input.peek(-1), depth
  if (prev == newline || prev == carriageReturn) {
    let depth = 0, chars = 0
    for (;;) {
      if (input.next == space) depth++
      else if (input.next == tab) depth += 8 - (depth % 8)
      else break
      input.advance()
      chars++
    }
    if (depth != cDepth &&
        input.next != newline && input.next != carriageReturn && input.next != hash) {
      if (depth < cDepth) input.acceptToken(dedent, -chars)
      else input.acceptToken(indent)
    }
  }
})

function IndentLevel(parent, depth) {
  this.parent = parent
  // -1 means this is not an actual indent level but a set of brackets
  this.depth = depth
  this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4)
}

const topIndent = new IndentLevel(null, 0)

function countIndent(space) {
  let depth = 0
  for (let i = 0; i < space.length; i++)
    depth += space.charCodeAt(i) == tab ? 8 - (depth % 8) : 1
  return depth
}

export const trackIndent = new ContextTracker({
  start: topIndent,
  reduce(context, term) {
    return context.depth < 0 && bracketed.has(term) ? context.parent : context
  },
  shift(context, term, stack, input) {
    if (term == indent) return new IndentLevel(context, countIndent(input.read(input.pos, stack.pos)))
    if (term == dedent) return context.parent
    if (term == ParenL || term == BracketL || term == BraceL) return new IndentLevel(context, -1)
    return context
  },
  hash(context) { return context.hash }
})

export const legacyPrint = new ExternalTokenizer(input => {
  for (let i = 0; i < 5; i++) {
    if (input.next != "print".charCodeAt(i)) return
    input.advance()
  }
  if (/\w/.test(String.fromCharCode(input.next))) return
  for (let off = 0;; off++) {
    let next = input.peek(off)
    if (next == space || next == tab) continue
    if (next != parenOpen && next != dot && next != newline && next != carriageReturn && next != hash)
      input.acceptToken(printKeyword)
    return
  }
})

function formatString(quote, len, content, brace, end) {
  return new ExternalTokenizer(input => {
    let start = input.pos
    for (;;) {
      if (input.next < 0) {
        break
      } else if (input.next == braceOpen) {
        if (input.peek(1) == braceOpen) {
          input.advance(2)
        } else {
          if (input.pos == start) {
            input.acceptToken(brace, 1)
            return
          }
          break
        }
      } else if (input.next == backslash) {
        input.advance()
        if (input.next >= 0) input.advance()
      } else if (input.next == quote && (len == 1 || input.peek(1) == quote && input.peek(2) == quote)) {
        if (input.pos == start) {
          input.acceptToken(end, len)
          return
        }
        break
      } else {
        input.advance()
      }
    }
    if (input.pos > start) input.acceptToken(content)
  })
}

export const formatString1 = formatString(singleQuote, 1, formatString1Content, formatString1Brace, formatString1End)
export const formatString2 = formatString(doubleQuote, 1, formatString2Content, formatString2Brace, formatString2End)
export const formatStringB = formatString(bracketClose, 1, formatStringBContent, formatStringBBrace, formatStringBEnd)
export const formatString1l = formatString(singleQuote, 3, formatString1lContent, formatString1lBrace, formatString1lEnd)
export const formatString2l = formatString(doubleQuote, 3, formatString2lContent, formatString2lBrace, formatString2lEnd)


const lessThan = 60, greaterThan = 62, slash = 47, question = 63, bang = 33, dash = 45

function isSpace(ch) {
  return ch == 9 || ch == 10 || ch == 13 || ch == 32
}

function contentTokenizer(tag, textToken, endToken) {
  let lastState = 2 + tag.length
  return new ExternalTokenizer(input => {
    // state means:
    // - 0 nothing matched
    // - 1 '<' matched
    // - 2 '</' + possibly whitespace matched
    // - 3-(1+tag.length) part of the tag matched
    // - lastState whole tag + possibly whitespace matched
    for (let state = 0, matchedLen = 0, i = 0;; i++) {
      if (input.next < 0) {
        if (i) input.acceptToken(textToken)
        break
      }
      if (state == 0 && input.next == lessThan ||
          state == 1 && input.next == slash ||
          state >= 2 && state < lastState && input.next == tag.charCodeAt(state - 2)) {
        state++
        matchedLen++
      } else if ((state == 2 || state == lastState) && isSpace(input.next)) {
        matchedLen++
      } else if (state == lastState && input.next == greaterThan) {
        if (i > matchedLen)
          input.acceptToken(textToken, -matchedLen)
        else
          input.acceptToken(endToken, -(matchedLen - 2))
        break
      } else if ((input.next == 10 /* '\n' */ || input.next == 13 /* '\r' */) && i) {
        input.acceptToken(textToken, 1)
        break
      } else {
        state = matchedLen = 0
      }
      input.advance()
    }
  })
}

export const scriptTokens = contentTokenizer("script", scriptText, startCloseScriptTag)
