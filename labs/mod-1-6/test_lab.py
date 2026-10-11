"""Tests for Lab 1.6.   pip install pytest && pytest labs/mod-1-6/test_lab.py -v

The tests start a small fake HTTP API on 127.0.0.1 (a thread, standard library only). It checks the bearer token, paginates with a cursor or an offset,
filters with updated_since, and can be told to answer with scripted errors first (429 with Retry-After, 500, ...).
"""
import json
import socket
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "ingest_lab.py")
TOKEN = "test-token"
ORDERS = [{"id": i, "status": "paid", "total_idr": 1000 * i, "updated_at": f"2026-01-01T00:{i // 60:02d}:{i % 60:02d}Z"} for i in range(1, 26)]


class FakeApi:
    def __init__(self):
        self.data = list(ORDERS)
        self.script = []        # scripted responses served BEFORE normal ones: (status, {headers})
        self.requests = []      # (path, query dict) of every request that arrived
        api = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                parsed = urllib.parse.urlparse(self.path)
                q = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}
                api.requests.append((parsed.path, q, self.headers.get("Authorization"), self.headers.get("Accept")))
                if api.script:
                    status, headers = api.script.pop(0)
                    self.send_response(status)
                    for k, v in headers.items():
                        self.send_header(k, v)
                    self.end_headers()
                    return
                if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                    self.send_response(401)
                    self.end_headers()
                    return
                rows = [r for r in api.data if "updated_since" not in q or r["updated_at"] > q["updated_since"]]
                limit = int(q.get("limit", 100))
                if parsed.path == "/orders":
                    start = int(q["cursor"]) if "cursor" in q else 0
                    page = rows[start:start + limit]
                    nxt = str(start + limit) if start + limit < len(rows) else None
                    body = {"data": page, "next_cursor": nxt}
                elif parsed.path == "/orders_offset":
                    offset = int(q.get("offset", 0))
                    body = {"data": rows[offset:offset + limit]}
                else:
                    self.send_response(404)
                    self.end_headers()
                    return
                raw = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=lambda: self.server.serve_forever(poll_interval=0.01), daemon=True).start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture()
def api():
    a = FakeApi()
    yield a
    a.stop()


class Sleeper:
    def __init__(self):
        self.waits = []

    def __call__(self, seconds):
        self.waits.append(seconds)


class TestBuildRequest:
    def test_url_header_and_sorted_params(self):
        req = lab.build_request("https://api.example.com/orders", "abc", {"limit": 50, "cursor": "x y", "updated_since": "2026-01-01T00:00:00Z"})
        assert req.full_url == "https://api.example.com/orders?cursor=x+y&limit=50&updated_since=2026-01-01T00%3A00%3A00Z"
        assert req.get_header("Authorization") == "Bearer abc" and req.get_header("Accept") == "application/json"

    def test_none_params_are_dropped_and_no_question_mark_without_params(self):
        assert lab.build_request("https://x/y", "t", {"a": None}).full_url == "https://x/y"
        assert lab.build_request("https://x/y", "t").full_url == "https://x/y"
        assert lab.build_request("https://x/y", "t", {"a": 1, "b": None}).full_url == "https://x/y?a=1"


class TestBackoff:
    def test_doubles_each_time(self):
        assert [lab.backoff_delay(n) for n in (1, 2, 3, 4)] == [1, 2, 4, 8]

    def test_is_capped(self):
        assert lab.backoff_delay(10) == 30 and lab.backoff_delay(10, cap=5) == 5

    def test_custom_base(self):
        assert lab.backoff_delay(3, base=0.5) == 2.0


class TestGetJson:
    def test_a_normal_request(self, api):
        page = lab.get_json(api.url + "/orders", TOKEN, {"limit": 3})
        assert [r["id"] for r in page["data"]] == [1, 2, 3] and page["next_cursor"] == "3"
        assert api.requests[0][2] == f"Bearer {TOKEN}" and api.requests[0][3] == "application/json"

    def test_a_wrong_token_is_not_retried(self, api):
        sleeper = Sleeper()
        with pytest.raises(lab.ApiError) as e:
            lab.get_json(api.url + "/orders", "wrong", sleep=sleeper)
        assert e.value.status == 401 and len(api.requests) == 1 and sleeper.waits == []

    def test_a_missing_page_is_not_retried(self, api):
        with pytest.raises(lab.ApiError) as e:
            lab.get_json(api.url + "/nope", TOKEN, sleep=Sleeper())
        assert e.value.status == 404 and len(api.requests) == 1

    def test_server_errors_are_retried_with_exponential_backoff(self, api):
        api.script = [(500, {}), (503, {})]
        sleeper = Sleeper()
        page = lab.get_json(api.url + "/orders", TOKEN, {"limit": 2}, sleep=sleeper)
        assert len(page["data"]) == 2 and sleeper.waits == [1, 2] and len(api.requests) == 3

    def test_rate_limit_honours_retry_after(self, api):
        api.script = [(429, {"Retry-After": "7"}), (429, {"Retry-After": "2"})]
        sleeper = Sleeper()
        lab.get_json(api.url + "/orders", TOKEN, {"limit": 1}, sleep=sleeper)
        assert sleeper.waits == [7, 2]

    def test_a_429_without_retry_after_falls_back_to_backoff(self, api):
        api.script = [(429, {})]
        sleeper = Sleeper()
        lab.get_json(api.url + "/orders", TOKEN, {"limit": 1}, sleep=sleeper)
        assert sleeper.waits == [1]

    def test_gives_up_after_the_retries_and_raises_the_last_error(self, api):
        api.script = [(500, {})] * 10
        sleeper = Sleeper()
        with pytest.raises(lab.ApiError) as e:
            lab.get_json(api.url + "/orders", TOKEN, retries=2, sleep=sleeper)
        assert e.value.status == 500 and len(api.requests) == 3 and sleeper.waits == [1, 2]   # no sleep after the final attempt

    def test_connection_errors_are_retried_too(self):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()                     # nothing listens on this port
        sleeper = Sleeper()
        with pytest.raises(lab.ApiError) as e:
            lab.get_json(f"http://127.0.0.1:{port}/orders", TOKEN, retries=2, sleep=sleeper)
        assert e.value.status == 0 and sleeper.waits == [1, 2]


class TestPagination:
    def test_cursor_pagination_reads_everything_exactly_once(self, api):
        records = lab.fetch_all_cursor(api.url + "/orders", TOKEN, limit=10)
        assert [r["id"] for r in records] == list(range(1, 26))
        assert len(api.requests) == 3 and "cursor" not in api.requests[0][1] and api.requests[1][1]["cursor"] == "10"

    def test_since_is_sent_and_filters(self, api):
        records = lab.fetch_all_cursor(api.url + "/orders", TOKEN, since="2026-01-01T00:00:20Z", limit=10)
        assert [r["id"] for r in records] == [21, 22, 23, 24, 25]
        assert all(q["updated_since"] == "2026-01-01T00:00:20Z" for _, q, _, _ in api.requests)

    def test_since_none_is_left_out(self, api):
        lab.fetch_all_cursor(api.url + "/orders", TOKEN)
        assert "updated_since" not in api.requests[0][1]

    def test_a_retry_in_the_middle_does_not_duplicate_or_lose_records(self, api):
        records = lab.fetch_all_cursor(api.url + "/orders", TOKEN, limit=10, sleep=Sleeper())
        api.requests.clear()
        api.script = [(500, {})]          # the first request of the second run fails once, then everything works
        again = lab.fetch_all_cursor(api.url + "/orders", TOKEN, limit=10, sleep=Sleeper())
        assert again == records

    def test_offset_pagination_stops_on_a_short_page(self, api):
        records = lab.fetch_all_offset(api.url + "/orders_offset", TOKEN, limit=10)
        assert [r["id"] for r in records] == list(range(1, 26))
        assert [q.get("offset") for _, q, _, _ in api.requests] == ["0", "10", "20"]

    def test_offset_pagination_with_an_exact_multiple_needs_one_more_request(self, api):
        api.data = api.data[:20]
        records = lab.fetch_all_offset(api.url + "/orders_offset", TOKEN, limit=10)
        assert len(records) == 20 and len(api.requests) == 3


class TestCheckpoint:
    def test_missing_file_means_no_checkpoint(self, tmp_path):
        assert lab.Checkpoint(tmp_path / "state" / "cp.json").load() is None

    def test_save_and_load(self, tmp_path):
        cp = lab.Checkpoint(tmp_path / "state" / "cp.json")
        cp.save("2026-01-01T00:00:10Z")
        assert cp.load() == "2026-01-01T00:00:10Z"
        assert json.loads((tmp_path / "state" / "cp.json").read_text()) == {"value": "2026-01-01T00:00:10Z"}

    def test_saving_again_replaces_the_value_and_leaves_no_temp_files(self, tmp_path):
        cp = lab.Checkpoint(tmp_path / "cp.json")
        cp.save(1)
        cp.save(2)
        assert cp.load() == 2 and [p.name for p in tmp_path.iterdir()] == ["cp.json"]

    def test_path_may_be_text_or_path(self, tmp_path):
        cp = lab.Checkpoint(str(tmp_path / "cp.json"))
        cp.save("x")
        assert cp.load() == "x"


class TestFlatten:
    def test_nested_dicts_become_columns(self):
        rec = {"id": 1, "customer": {"name": "Sari", "address": {"city": "Jakarta"}}, "total": 5}
        assert lab.flatten_record(rec) == {"id": 1, "customer_name": "Sari", "customer_address_city": "Jakarta", "total": 5}

    def test_lists_stay_one_column_as_json_text(self):
        flat = lab.flatten_record({"id": 1, "items": [{"sku": "B", "qty": 1}, {"sku": "A", "qty": 2}]})
        assert flat["items"] == '[{"qty": 1, "sku": "B"}, {"qty": 2, "sku": "A"}]'

    def test_none_and_custom_separator(self):
        assert lab.flatten_record({"a": {"b": None}}, sep=".") == {"a.b": None}

    def test_the_input_is_not_modified(self):
        rec = {"a": {"b": 1}}
        lab.flatten_record(rec)
        assert rec == {"a": {"b": 1}}


class TestSchemaDrift:
    EXPECTED = {"id": "int", "total_idr": "int", "status": "str"}

    def test_no_drift(self):
        recs = [{"id": 1, "total_idr": 5, "status": "paid"}, {"id": 2, "total_idr": 6, "status": None}]
        assert lab.detect_schema_drift(self.EXPECTED, recs) == {"new_columns": [], "missing_columns": [], "type_changes": {}}

    def test_new_and_missing_columns(self):
        recs = [{"id": 1, "total_idr": 5, "channel": "app"}, {"id": 2, "total_idr": 6, "coupon": "X"}]
        d = lab.detect_schema_drift(self.EXPECTED, recs)
        assert d["new_columns"] == ["channel", "coupon"] and d["missing_columns"] == ["status"]

    def test_a_type_change_is_reported_with_every_type_seen(self):
        recs = [{"id": 1, "total_idr": 5}, {"id": 2, "total_idr": "Rp 6.000"}, {"id": 3, "total_idr": 7.5}, {"id": 4, "total_idr": None}]
        d = lab.detect_schema_drift({"id": "int", "total_idr": "int"}, recs)
        assert d["type_changes"] == {"total_idr": ("int", ["float", "int", "str"])}


class TestIncrementalLoad:
    def run(self, api, tmp_path, run_id="run1", today="2026-02-01", **kw):
        return lab.incremental_load(api.url + "/orders", TOKEN, tmp_path / "state" / "cp.json", tmp_path / "landing", run_id, today, **kw)

    def lines(self, path):
        return [json.loads(l) for l in Path(path).read_text().splitlines()]

    def test_first_run_loads_everything_and_sets_the_checkpoint(self, api, tmp_path):
        r = self.run(api, tmp_path, limit=10)
        assert r["fetched"] == 25 and r["checkpoint"] == "2026-01-01T00:00:25Z"
        assert r["written"] == str(tmp_path / "landing" / "dt=2026-02-01" / "orders_run1.jsonl")
        rows = self.lines(r["written"])
        assert [x["id"] for x in rows] == list(range(1, 26))
        assert all(x["_run_id"] == "run1" and x["_source"] == api.url + "/orders" and x["_ingested_at"].endswith("+00:00") for x in rows)
        assert lab.Checkpoint(tmp_path / "state" / "cp.json").load() == "2026-01-01T00:00:25Z"

    def test_second_run_with_no_new_data_does_nothing(self, api, tmp_path):
        self.run(api, tmp_path)
        before = sorted(p.name for p in (tmp_path / "landing").rglob("*") if p.is_file())
        r = self.run(api, tmp_path, run_id="run2")
        assert r == {"fetched": 0, "written": None, "checkpoint": "2026-01-01T00:00:25Z"}
        assert sorted(p.name for p in (tmp_path / "landing").rglob("*") if p.is_file()) == before

    def test_only_new_records_are_loaded_next_time(self, api, tmp_path):
        self.run(api, tmp_path)
        api.data.append({"id": 26, "status": "paid", "total_idr": 26000, "updated_at": "2026-01-01T00:00:26Z"})
        api.data.append({"id": 3, "status": "refunded", "total_idr": 3000, "updated_at": "2026-01-01T00:00:27Z"})   # an old order changed
        r = self.run(api, tmp_path, run_id="run2")
        rows = self.lines(r["written"])
        assert [(x["id"], x["status"]) for x in rows] == [(26, "paid"), (3, "refunded")] and r["checkpoint"] == "2026-01-01T00:00:27Z"

    def test_duplicates_in_one_fetch_keep_the_latest_version(self, api, tmp_path):
        api.data = [dict(ORDERS[0]), dict(ORDERS[0], status="refunded", updated_at="2026-01-01T00:09:00Z")]
        rows = self.lines(self.run(api, tmp_path)["written"])
        assert len(rows) == 1 and rows[0]["status"] == "refunded"

    def test_a_crash_before_the_checkpoint_is_repaired_by_rerunning(self, api, tmp_path, monkeypatch):
        calls = {"n": 0}
        real_save = lab.Checkpoint.save

        def failing_save(self, value):
            calls["n"] += 1
            raise OSError("disk full")

        monkeypatch.setattr(lab.Checkpoint, "save", failing_save)
        with pytest.raises(OSError):
            self.run(api, tmp_path, run_id="runA")
        assert lab.Checkpoint(tmp_path / "state" / "cp.json").load() is None           # the checkpoint did not move
        monkeypatch.setattr(lab.Checkpoint, "save", real_save)
        r = self.run(api, tmp_path, run_id="runA")                                       # same run id: the same file is overwritten, no duplicate
        files = [p for p in (tmp_path / "landing").rglob("*.jsonl")]
        assert len(files) == 1 and r["fetched"] == 25 and len(self.lines(r["written"])) == 25

    def test_a_failed_fetch_changes_nothing(self, api, tmp_path):
        api.script = [(500, {})] * 20
        with pytest.raises(lab.ApiError):
            self.run(api, tmp_path, retries=1, sleep=Sleeper())
        assert not (tmp_path / "landing").exists() and lab.Checkpoint(tmp_path / "state" / "cp.json").load() is None

    def test_no_temp_files_are_left_behind(self, api, tmp_path):
        self.run(api, tmp_path)
        assert [p.name for p in (tmp_path / "landing" / "dt=2026-02-01").iterdir()] == ["orders_run1.jsonl"]
