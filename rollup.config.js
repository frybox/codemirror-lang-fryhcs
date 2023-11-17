import {lezer} from "@lezer/generator/rollup"
import typescript from "rollup-plugin-ts"
import {nodeResolve} from "@rollup/plugin-node-resolve"

export default {
  input: "./src/fryhcs.ts",
  output: [{
    format: "cjs",
    file: "./dist/index.cjs"
  }, {
    format: "es",
    file: "./dist/index.js"
  }],
  external(id) { return id != "tslib" && !/^(\.?\/|\w:)/.test(id) },
  plugins: [
    lezer(),
    typescript(),
    nodeResolve(),
  ]
}

