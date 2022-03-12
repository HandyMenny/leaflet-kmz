import { terser } from "rollup-plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import commonJS from '@rollup/plugin-commonjs';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';

let plugin = require('../package.json');

let input = "src/index.js";
let output = {
  file: "dist/" + plugin.name + "-src.js",
  format: "umd",
  sourcemap: true,
  name: plugin.name
};

let external = ['leaflet-pointable'];
let plugins = [
  webWorkerLoader(),
  resolve(),
  commonJS({
    include: ['../node_modules/**', '**/node_modules/@xmldom/xmldom/lib/*.js']
  })
];

export default [{
    input: "src/worker-util.js",
    output: Object.assign({}, output, {
      file: "dist/worker-util.js"
    }),
    plugins: plugins,
    external: external,
  },
  {
    input: input,
    output: output,
    plugins: plugins,
    external: external,
  },
  {
    //terse web-worker before importing
    input: "src/worker-util.js",
    output: Object.assign({}, output, {
      file: "dist/worker-util.js"
    }),
    plugins: plugins.concat(terser()),
    external: external,
  },
  {
    input: input,
    output: Object.assign({}, output, {
      file: "dist/" + plugin.name + ".js"
    }),
    plugins: plugins.concat(terser()),
    external: external
  }
];
