#!/usr/bin/env python3
"""A tiny fake orders API for the "Try it" exercises of Module 1.6. Standard library only.

    python3 labs/mod-1-6/fakeapi.py            # serves http://127.0.0.1:8765 until you press Ctrl+C

The token is  learner-token  (header  Authorization: Bearer learner-token).  Endpoints:

    GET /orders?limit=N&cursor=C        oldest first, cursor pagination:  {"data": [...], "next_cursor": "..." or null}
    GET /orders_offset?limit=N&offset=K newest first, offset pagination:  {"data": [...]}
    GET /arrive?n=3                     3 new orders arrive (a new order is placed in the shop while you are reading pages)
    GET /limited                        first call: 429 with "Retry-After: 2"; calls after you waited 2 seconds: 200 (then it is armed again)
    GET /orders/1                       one order with nested objects (for the flattening exercise)
    GET /reset                          back to the start: 25 orders, no rate limit

Everything is in memory: restart the server and it starts again with 25 orders.
"""
import json
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

TOKEN = "learner-token"
PORT = 8765
STATE = {}


def reset():
    STATE["orders"] = [{"id": i, "status": "paid" if i % 5 else "refunded", "total_idr": 1000 * i, "updated_at": f"2026-01-01T00:{i // 60:02d}:{i % 60:02d}Z"}
                       for i in range(1, 26)]
    STATE["limited_until"] = 0.0
    STATE["armed"] = True


reset()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("  " + (fmt % args) + "\n")

    def send_json(self, status, body, headers=None):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}
        path = parsed.path
        if path == "/reset":
            reset()
            return self.send_json(200, {"ok": True, "orders": len(STATE["orders"])})
        if self.headers.get("Authorization") != f"Bearer {TOKEN}":
            return self.send_json(401, {"error": "missing or wrong token: send  Authorization: Bearer learner-token"})
        orders = STATE["orders"]
        limit = int(q.get("limit", 10))
        if path == "/orders":
            start = int(q.get("cursor", 0))
            page = orders[start:start + limit]
            nxt = str(start + limit) if start + limit < len(orders) else None
            return self.send_json(200, {"data": page, "next_cursor": nxt})
        if path == "/orders_offset":
            newest_first = list(reversed(orders))
            offset = int(q.get("offset", 0))
            return self.send_json(200, {"data": newest_first[offset:offset + limit]})
        if path == "/arrive":
            n = int(q.get("n", 3))
            for _ in range(n):
                i = len(orders) + 1
                orders.append({"id": i, "status": "paid", "total_idr": 1000 * i, "updated_at": f"2026-01-01T01:{i // 60:02d}:{i % 60:02d}Z"})
            return self.send_json(200, {"arrived": n, "orders": len(orders)})
        if path == "/limited":
            now = time.time()
            if now < STATE["limited_until"]:                     # still inside the penalty: the server tells you how long to wait
                return self.send_json(429, {"error": "too many requests"}, {"Retry-After": str(int(STATE["limited_until"] - now) + 1)})
            if STATE["armed"]:                                   # first call: you are throttled for 2 seconds
                STATE["armed"] = False
                STATE["limited_until"] = now + 2
                return self.send_json(429, {"error": "too many requests"}, {"Retry-After": "2"})
            STATE["armed"] = True                                # the penalty is over: success, and the next fresh call is throttled again
            return self.send_json(200, {"ok": True, "message": "you waited long enough"})
        if path == "/orders/1":
            return self.send_json(200, {"id": 1, "status": "paid", "customer": {"id": 7, "name": "Budi", "address": {"city": "Jakarta", "zip": "10110"}},
                                        "items": [{"sku": "A1", "qty": 2}, {"sku": "B2", "qty": 1}], "total_idr": 1000})
        self.send_json(404, {"error": "not found"})


if __name__ == "__main__":
    print(f"fake orders API on http://127.0.0.1:{PORT}   token: {TOKEN}   (Ctrl+C to stop)")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
