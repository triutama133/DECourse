#!/usr/bin/env python3
"""Local web server for DataForge. Usage: python3 server.py  (PORT env var overrides 3000)"""
import atexit
import http.server
import json
import mimetypes
import os
import shutil
import signal
import socketserver
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PORT = int(os.environ.get("PORT", "3000"))
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "127.0.0.1:11434").removeprefix("http://").removeprefix("https://").rstrip("/")

mimetypes.add_type("application/wasm", ".wasm")  # sql.js and Pyodide load .wasm files
mimetypes.add_type("application/javascript", ".mjs")  # Pyodide loads a JavaScript module

_tutor_proc = None


def _ollama_bin():
    env_bin = os.environ.get("OLLAMA_BIN")
    if env_bin:
        return env_bin
    found = shutil.which("ollama")
    if found:
        return found
    for candidate in (os.path.expanduser("~/.local/bin/ollama"), "/usr/local/bin/ollama"):
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return "ollama"


def _ollama_up():
    try:
        with urllib.request.urlopen(f"http://{OLLAMA_HOST}/api/version", timeout=1.5) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError, TimeoutError):
        return False


def _stop_tutor():
    global _tutor_proc
    proc = _tutor_proc
    if proc is None:
        return False
    _tutor_proc = None
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    return True


atexit.register(_stop_tutor)
for _sig in (signal.SIGINT, signal.SIGTERM):
    signal.signal(_sig, lambda *_a: sys.exit(0))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _same_machine(self):
        host_hdr = (self.headers.get("Host") or "").strip().lower()
        hostname = host_hdr.rsplit(":", 1)[0] if not host_hdr.startswith("[") else host_hdr.split("]", 1)[0] + "]"
        ok_host = hostname in ("localhost", "127.0.0.1", "[::1]")
        origin = self.headers.get("Origin")
        if not origin:
            return ok_host
        try:
            return ok_host and urllib.parse.urlparse(origin).netloc.lower() == host_hdr
        except ValueError:
            return False

    def _send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=UTF-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_tutor(self, method):
        global _tutor_proc
        parsed = urllib.parse.urlsplit(self.path)
        if not parsed.path.startswith("/api/tutor/"):
            return False
        if not self._same_machine():
            self._send_json(403, {"ok": False, "error": "forbidden"})
            return True
        action = parsed.path[len("/api/tutor/"):]
        if action == "status" and method == "GET":
            self._send_json(200, {"ok": True, "running": _ollama_up(), "managed": _tutor_proc is not None and _tutor_proc.poll() is None})
            return True
        if action == "start" and method == "POST":
            if _ollama_up():
                self._send_json(200, {"ok": True, "running": True, "managed": _tutor_proc is not None, "started": False})
                return True
            exe = _ollama_bin()
            try:
                subprocess.run([exe, "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False)
            except (OSError, subprocess.SubprocessError):
                self._send_json(200, {"ok": False, "error": "not-installed"})
                return True
            origins = f"http://localhost:{PORT},http://127.0.0.1:{PORT}"
            env = dict(os.environ)
            env["OLLAMA_HOST"] = OLLAMA_HOST
            env["OLLAMA_ORIGINS"] = ",".join(x for x in (env.get("OLLAMA_ORIGINS", ""), origins) if x)
            if "igpu=1" in parsed.query:
                env["OLLAMA_IGPU_ENABLE"] = "1"
            try:
                _tutor_proc = subprocess.Popen([exe, "serve"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except OSError:
                _tutor_proc = None
                self._send_json(200, {"ok": False, "error": "not-installed"})
                return True
            for _ in range(40):
                if _ollama_up():
                    self._send_json(200, {"ok": True, "running": True, "managed": True, "started": True})
                    return True
                if _tutor_proc.poll() is not None:
                    _tutor_proc = None
                    break
                time.sleep(0.5)
            self._send_json(200, {"ok": False, "error": "did-not-start"})
            return True
        if action == "stop" and method == "POST":
            stopped = _stop_tutor()
            self._send_json(200, {"ok": True, "stopped": stopped})
            return True
        self._send_json(404, {"ok": False, "error": "unknown"})
        return True

    def do_GET(self):
        if self._handle_tutor("GET"):
            return
        super().do_GET()

    def do_POST(self):
        if self._handle_tutor("POST"):
            return
        self.send_error(405, "Method Not Allowed")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableTCPServer(("", PORT), Handler) as httpd:
        print(f"DataForge is running at http://localhost:{PORT}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)
