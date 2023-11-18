const {fryhcsLanguage} = await import("../dist/index.js")

const code1 = `
from fryhcs import Element, html

def index():
    return html(App, title="My Page")

def App():
    return (
    <div ref=(root)>
      你好
    </div>
    <script root init={5}>
      import {parseMixed} from "@lezer/common"
      root.innerHTML = "你好，fryhcs！"
    </script>)
`

const code2 = `
from fryhcs import Element, html
from flask import Flask

app = Flask(__name__)

@app.get("/")
def index():
  return html(App, title="My Editor")

def App():
  return (
    <div ref=(root)>
      你好
    </div>
    <script root init={25}>
      import {EditorView, }
  )
`

const code3 = `
from fryhcs import Element, html
from flask import Flask

app = Flask(__name__)

@app.get("/")
def index():
  return html(App, title="My Editor")

def App():
  return (
    <div ref=(root)>
      你好
    </div>,
    <script root init={25}>
      import {EditorView, basicSetup} from "codemirror"
      import {fryhcs} from "codemirror-lang-fryhcs"

      const editor = new EditorView({
        extensions: [
          basicSetup,
          fryhcs(),
        ],
        parent: root,
      })
    </script>
  )
`

const code = code3

const parser = fryhcsLanguage.parser
const tree = parser.parse(code)

const echonode = (node, indent) => {
    console.log(indent + node.name)
    let child = node.firstChild
    while (child) {
        echonode(child, "  "+indent)
        child = child.nextSibling
    }
}

echonode(tree.topNode, "")
