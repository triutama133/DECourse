#!/usr/bin/env python3
"""Local web server for DataForge. Usage: python3 server.py  (PORT env var overrides 3000)"""
import http.server
import mimetypes
import os
import socketserver
import sys

PORT = int(os.environ.get("PORT", "3000"))
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")

mimetypes.add_type("application/wasm", ".wasm")  # sql.js loads a .wasm file


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"DataForge is running at http://localhost:{PORT}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)
