# Vendored: Pyodide and pure-Python wheels

Used by the "Run in your browser" labs (Python runs in WebAssembly in a Web Worker; nothing is sent to a server).

| File | Source | License |
|---|---|---|
| `pyodide.mjs` (browser worker), `pyodide.js` (Node verifier), `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` | npm package `pyodide` 314.0.7 (CPython 3.14.2 for WebAssembly) | MPL-2.0 (Pyodide), PSF-2.0 (CPython) |
| `wheels/pytest-*.whl`, `pluggy`, `iniconfig`, `packaging`, `pygments` | PyPI, pure-Python wheels, unmodified | MIT, MIT, MIT, Apache-2.0/BSD-2-Clause, BSD-2-Clause |

Homepage: https://pyodide.org . To update, replace the files with a newer `npm pack pyodide` release and run
`node scripts/verify_browser_labs.js`.
