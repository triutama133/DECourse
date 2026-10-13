import json
import urllib.request

BASE = "http://localhost:8765"
HEADERS = {"Authorization": "Bearer learner-token"}


def get(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=HEADERS)) as r:
        return json.load(r)


ids, cursor, first = [], None, True
while True:
    path = "/orders?limit=10" + (f"&cursor={cursor}" if cursor else "")
    page = get(path)
    ids += [o["id"] for o in page["data"]]
    if first:
        get("/arrive?n=3")
        first = False
    cursor = page["next_cursor"]
    if cursor is None:
        break
print(len(ids), len(set(ids)))
