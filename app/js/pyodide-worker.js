// Module Web Worker (new Worker(url, { type: "module" })): runs a lab's pytest suite in Pyodide (Python in WebAssembly) off the main thread.
// Messages in:  { type: "run", id, files: {path: text}, args: [pytest args] }
// Messages out: { type: "status", text } while loading, then { type: "result", id, output, code } or { type: "error", id, message }
import { loadPyodide } from "../vendor/pyodide/pyodide.mjs";

const BASE = new URL("../vendor/pyodide/", self.location.href).href;
const WHEELS = ["iniconfig-2.3.1-py3-none-any.whl", "packaging-26.3-py3-none-any.whl", "pluggy-1.6.0-py3-none-any.whl", "pygments-2.21.0-py3-none-any.whl", "pytest-9.1.1-py3-none-any.whl"];
const PYTEST_ARGS = ["-q", "--no-header", "-p", "no:cacheprovider", "--color=no", "--tb=short"];

let booting = null;

async function boot() {
  self.postMessage({ type: "status", text: "loading-python" });
  const py = await loadPyodide({ indexURL: BASE });
  self.postMessage({ type: "status", text: "loading-pytest" });
  const site = py.runPython("import sysconfig; sysconfig.get_paths()['purelib']");
  for (const w of WHEELS) {
    const res = await fetch(BASE + "wheels/" + w);
    if (!res.ok) throw new Error("Could not load " + w);
    py.unpackArchive(await res.arrayBuffer(), "zip", { extractDir: site });
  }
  const runner = await (await fetch(new URL("browser-lab-runner.py", self.location.href).href)).text();
  py.runPython(runner);
  return py;
}

self.onmessage = async (ev) => {
  const m = ev.data;
  if (m.type !== "run") return;
  try {
    booting = booting || boot();
    const py = await booting;
    self.postMessage({ type: "status", text: "running" });
    py.runPython("reset()");
    for (const [path, text] of Object.entries(m.files)) {
      const full = "/lab/" + path;
      py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
      py.FS.writeFile(full, text);
    }
    const result = py.globals.get("run_lab")(py.toPy([...m.args, ...PYTEST_ARGS]));
    const [output, code] = result.toJs();
    result.destroy();
    self.postMessage({ type: "result", id: m.id, output, code });
  } catch (e) {
    booting = null;
    self.postMessage({ type: "error", id: m.id, message: String(e && e.message ? e.message : e) });
  }
};
