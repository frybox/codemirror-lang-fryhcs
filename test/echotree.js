const {parser} = await import("../dist/index.js")

const code = `
from fryhcs import Element, html

def index():
    return html(App, title="My Page")

def App():
    return (
    <div ref=(root)>
      你好
    </div>
    <script root init={5}>
      root.innerHTML = "你好，fryhcs！"
    </script>)
`

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
