#!/usr/bin/env python3
"""
DataForge Local Web Server (Python)
Usage: python3 server.py
"""
import http.server
import socketserver
import os
import sys

PORT = 3000
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 60)
        print(f"🚀 DataForge Web App is running at: http://localhost:{PORT}")
        print("   Press Ctrl+C to stop.")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)

