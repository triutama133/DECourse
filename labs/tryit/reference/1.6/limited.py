import time
import urllib.error
import urllib.request

req = urllib.request.Request("http://localhost:8765/limited", headers={"Authorization": "Bearer learner-token"})
try:
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    wait = float(e.headers["Retry-After"])
    print(e.code, wait)
    time.sleep(wait)
    with urllib.request.urlopen(req) as r:
        print(r.status)
