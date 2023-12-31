import {SyntaxNode, parseMixed} from "@lezer/common"
import {javascriptLanguage, javascript} from "@codemirror/lang-javascript"
import {delimitedIndent, indentNodeProp, TreeIndentContext, 
        foldNodeProp, foldInside, LRLanguage, LanguageSupport} from "@codemirror/language"
import {parser} from "./fryhcs-parser"
import {globalCompletion, localCompletionSource} from "./complete"
export {globalCompletion, localCompletionSource}

function indentBody(context: TreeIndentContext, node: SyntaxNode) {
  let base = context.baseIndentFor(node)
  let line = context.lineAt(context.pos, -1), to = line.from + line.text.length
  // Don't consider blank, deindented lines at the end of the
  // block part of the block
  if (/^\s*($|#)/.test(line.text) &&
      context.node.to < to + 100 &&
      !/\S/.test(context.state.sliceDoc(to, context.node.to)) &&
      context.lineIndent(context.pos, -1) <= base)
    return null
  // A normally deindenting keyword that appears at a higher
  // indentation than the block should probably be handled by the next
  // level
  if (/^\s*(else:|elif |except |finally:)/.test(context.textAfter) && context.lineIndent(context.pos, -1) > base)
    return null
  return base + context.unit
}

/// A language provider based on the [Lezer FryHCS
/// parser](https://github.com/frybox/lezer-fryhcs), extended with
/// highlighting and indentation information.
export const fryhcsLanguage = LRLanguage.define({
  name: "fryhcs",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Body: context => indentBody(context, context.node) ?? context.continue(),
        IfStatement: cx => /^\s*(else:|elif )/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        TryStatement: cx => /^\s*(except |finally:|else:)/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        "TupleExpression ComprehensionExpression ParamList ArgList ParenthesizedExpression": delimitedIndent({closing: ")"}),
        "DictionaryExpression DictionaryComprehensionExpression SetExpression SetComprehensionExpression": delimitedIndent({closing: "}"}),
        "ArrayExpression ArrayComprehensionExpression": delimitedIndent({closing: "]"}),
        "String FormatString": () => null,
        "FryStartTag FryEndTag FrySelfClosingElement FryScriptStartTag": cx => cx.column(cx.node.from) + cx.unit,
        "FryFragment FryPairedElement FryScriptElement": cx => {
            let after = /^(\s*)(<\/)?/.exec(cx.textAfter)!
            return cx.lineIndent(cx.node.from) + (after[2] ? 0 : cx.unit)
        },
        Script: context => {
          if (context.pos + /\s*/.exec(context.textAfter)![0].length >= context.node.to) {
            let endBody = null
            for (let cur: SyntaxNode | null = context.node, to = cur.to;;) {
              cur = cur.lastChild
              if (!cur || cur.to != to) break
              if (cur.type.name == "Body") endBody = cur
            }
            if (endBody) {
              let bodyIndent = indentBody(context, endBody)
              if (bodyIndent != null) return bodyIndent
            }
          }
          return context.continue()
        }
      }),
      foldNodeProp.add({
        "ArrayExpression DictionaryExpression SetExpression TupleExpression": foldInside,
        Body: (node, state) => ({from: node.from + 1, to: node.to - (node.to == state.doc.length ? 0 : 1)})
      })
    ],
    wrap: parseMixed((node, input) => {
      return node.name == "ScriptText" ? {parser: javascriptLanguage.parser} : null
    }),
  }),
  languageData: {
    closeBrackets: {
      brackets: ["(", "[", "{", "'", '"', "'''", '"""'],
      stringPrefixes: ["f", "fr", "rf", "r", "u", "b", "br", "rb",
                       "F", "FR", "RF", "R", "U", "B", "BR", "RB"]
    },
    commentTokens: {line: "#"},
    indentOnInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/
  }
})


/// FryHCS language support.
export function fryhcs() {
  return new LanguageSupport(fryhcsLanguage, [
    fryhcsLanguage.data.of({autocomplete: localCompletionSource}),
    fryhcsLanguage.data.of({autocomplete: globalCompletion}),
    javascript().support,
  ])
}
