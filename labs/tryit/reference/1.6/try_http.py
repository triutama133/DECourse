import json
import urllib.error
import urllib.request

URL = "http://localhost:8765/orders?limit=3"

req = urllib.request.Request(URL, headers={"Authorization": "Bearer learner-token"})
with urllib.request.urlopen(req) as resp:
    body = json.load(resp)
    print(resp.status, [o["id"] for o in body["data"]])

try:
    urllib.request.urlopen(URL)
except urllib.error.HTTPError as e:
    print(e.code)
