import json
import os
import time
import urllib.request

BASE = "http://localhost:8765"
HEADERS = {"Authorization": "Bearer learner-token"}


def get(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=HEADERS)) as r:
        return json.load(r)


def save_checkpoint(cursor):
    with open("checkpoint.tmp", "w") as f:
        json.dump({"cursor": cursor}, f)
    os.replace("checkpoint.tmp", "checkpoint.json")


seen = set()
if os.path.exists("out.jsonl"):
    seen = {json.loads(l)["id"] for l in open("out.jsonl") if l.strip()}
cursor = json.load(open("checkpoint.json"))["cursor"] if os.path.exists("checkpoint.json") else None
while True:
    page = get("/orders?limit=5" + (f"&cursor={cursor}" if cursor else ""))
    with open("out.jsonl", "a") as out:
        for o in page["data"]:
            if o["id"] not in seen:
                out.write(json.dumps(o) + "\n")
                seen.add(o["id"])
    cursor = page["next_cursor"]
    save_checkpoint(cursor)
    time.sleep(1)
    if cursor is None:
        break
