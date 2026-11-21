#!/usr/bin/env python3
"""DataForge Real-Life Data Engineer Job Simulator CLI & Local Verifier (JOB1:).

Covers 4 Distinct Industry Stories × 4 Progressive Difficulty Levels (16 Production Missions):
  1. kopiku     (☕ KopiKu Roastery & Omni-Channel Retail: easy, normal, hard, expert)
  2. paynusa    (💳 PayNusa Financial Ledger, Privacy & Fraud ML: easy, normal, hard, expert)
  3. gokirim    (🚚 GoKirim Express Logistics & IoT Telemetry: easy, normal, hard, expert)
  4. cloudpulse (🧬 CloudPulse & MedFlow AI Healthcare Lakehouse & RAG: easy, normal, hard, expert)

Usage:
  python3 scripts/job_sim.py list
  python3 scripts/job_sim.py init <story>-<level> <workspace_dir>
  python3 scripts/job_sim.py verify <story>-<level> <workspace_dir>
  python3 scripts/job_sim.py --self-test
"""
import hashlib
import hmac
import importlib.util
import json
import math
import platform
import re
import sys
import tempfile
from pathlib import Path

MISSIONS = {
    "kopiku-easy": ("mission_kopiku_easy.py", "ingest_kopiku_daily"),
    "kopiku-normal": ("mission_kopiku_normal.py", "attribute_scd2_and_rollup"),
    "kopiku-hard": ("mission_kopiku_hard.py", "compact_cdc_and_salt_skew"),
    "kopiku-expert": ("mission_kopiku_expert.py", "enforce_rls_and_finops_guard"),
    "paynusa-easy": ("mission_paynusa_easy.py", "ingest_verified_ledger"),
    "paynusa-normal": ("mission_paynusa_normal.py", "build_vault_and_shred_pii"),
    "paynusa-hard": ("mission_paynusa_hard.py", "reconcile_multifact_and_watermark"),
    "paynusa-expert": ("mission_paynusa_expert.py", "build_asof_fraud_features_and_dr_check"),
    "gokirim-easy": ("mission_gokirim_easy.py", "clean_iot_gps_pings"),
    "gokirim-normal": ("mission_gokirim_normal.py", "sessionize_shifts_and_nest_trips"),
    "gokirim-hard": ("mission_gokirim_hard.py", "process_event_time_windows"),
    "gokirim-expert": ("mission_gokirim_expert.py", "compute_olap_surge_and_audit_iac"),
    "cloudpulse-easy": ("mission_cloudpulse_easy.py", "ingest_cursor_pages_safely"),
    "cloudpulse-normal": ("mission_cloudpulse_normal.py", "resolve_mdm_patients_and_strangler_parity"),
    "cloudpulse-hard": ("mission_cloudpulse_hard.py", "compact_lakehouse_and_vacuum_gdpr"),
    "cloudpulse-expert": ("mission_cloudpulse_expert.py", "sync_rag_index_and_retrieve"),
}


def _sha256(val: str) -> str:
    return hashlib.sha256(val.encode("utf-8")).hexdigest()


def _hmac_hex(secret: str, msg: str) -> str:
    return hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()


def make_job_token(mission_id: str, passed: int) -> str:
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    os_name = platform.system().lower()[:7] or "linux"
    fields = ["JOB1", mission_id, str(passed), py, os_name]
    chk = _sha256("|".join(fields))[:6]
    return ":".join(fields + [chk])


def _load_fn(work_dir: Path, filename: str, fn_name: str):
    p = work_dir / filename
    if not p.exists():
        raise FileNotFoundError(f"Missing {p}. Run: python3 scripts/job_sim.py init <mission_id> {work_dir}")
    spec = importlib.util.spec_from_file_location(f"jobsim_{filename[:-3]}", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    fn = getattr(mod, fn_name, None)
    if not callable(fn):
        raise AttributeError(f"Function '{fn_name}' not found in {p}")
    return fn


def run_mission_checks(mission_id: str, work_dir: Path, fn=None) -> tuple[int, list[str]]:
    if mission_id not in MISSIONS:
        raise ValueError(f"Unknown mission '{mission_id}'. Valid missions: {', '.join(MISSIONS)}")
    filename, fn_name = MISSIONS[mission_id]
    if fn is None:
        fn = _load_fn(work_dir, filename, fn_name)
    checks = []
    errors = []

    def check(cond: bool, desc: str, detail: str = ""):
        if cond:
            checks.append(desc)
        else:
            errors.append(f"FAIL: {desc}" + (f" ({detail})" if detail else ""))

    if mission_id == "kopiku-easy":
        rows = [
            {"order_id": "O-2", "store_id": "S1", "order_date": "2026-02-01", "status": "paid", "gross_raw": "Rp 50.000", "discount_raw": "5.000", "updated_at": "2026-02-01T08:00:00"},
            {"order_id": "O-2", "store_id": "S1", "order_date": "2026-02-01", "status": "delivered", "gross_raw": "Rp 50.000", "discount_raw": "0", "updated_at": "2026-02-01T10:00:00"},
            {"order_id": "O-1", "store_id": "S2", "order_date": "2026-02-01", "status": "refunded", "gross_raw": 30000, "discount_raw": 0, "updated_at": "2026-02-01T09:00:00"},
            {"order_id": "O-3", "store_id": "", "order_date": "2026-02-01", "status": "paid", "gross_raw": "20000", "discount_raw": "0", "updated_at": "2026-02-01T09:00:00"},
            {"order_id": "O-4", "store_id": "S1", "order_date": "2026-02-01", "status": "paid", "gross_raw": "-10000", "discount_raw": "0", "updated_at": "2026-02-01T09:00:00"},
            {"order_id": "O-5", "store_id": "S1", "order_date": "2026-02-01", "status": "weird", "gross_raw": "25000", "discount_raw": "0", "updated_at": "2026-02-01T09:00:00"},
            {"order_id": "O-9", "store_id": "S1", "order_date": "2026-01-31", "status": "paid", "gross_raw": "99000", "discount_raw": "0", "updated_at": "2026-01-31T09:00:00"},
        ]
        res = fn(rows, "2026-02-01")
        check(isinstance(res, dict) and [r["order_id"] for r in res.get("clean_rows", [])] == ["O-1", "O-2"], "deduplicates O-2 to latest state and filters to batch_date", str(res))
        check(res.get("total_net_idr") == 50000, "computes integer net_idr=50000 (excluding refunded O-1 and taking latest O-2 with 0 discount)", str(res.get("total_net_idr")))
        check(len(res.get("dlq", [])) == 3, "routes missing_key (O-3), invalid_amount (O-4), and invalid_status (O-5) to dlq", str(res.get("dlq")))

    elif mission_id == "kopiku-normal":
        changes = [
            {"store_id": "S14", "city": "Bandung", "effective_from": "2025-01-01"},
            {"store_id": "S14", "city": "Jakarta", "effective_from": "2026-01-15"},
        ]
        orders = [
            {"order_id": "1", "store_id": "S14", "order_date": "2025-11-10", "status": "paid", "gross_idr": 100000, "discount_idr": 10000, "tax_idr": 9000},
            {"order_id": "2", "store_id": "S14", "order_date": "2026-01-20", "status": "delivered", "gross_idr": 200000, "discount_idr": 0, "tax_idr": 20000},
            {"order_id": "3", "store_id": "S14", "order_date": "2026-01-21", "status": "refunded", "gross_idr": 50000, "discount_idr": 0, "tax_idr": 5000},
        ]
        res = fn(orders, changes)
        check(len(res.get("scd2_dim_store", [])) == 2 and res["scd2_dim_store"][0]["valid_to"] == "2026-01-15", "builds SCD Type 2 store intervals [2025-01-01, 2026-01-15) and [2026-01-15, 9999-12-31)", str(res))
        check(res.get("revenue_by_historical_city") == {"Bandung": 81000, "Jakarta": 180000}, "point-in-time SCD2 join attributes 2025 order to Bandung (81000) and Jan-20 order to Jakarta (180000)", str(res.get("revenue_by_historical_city")))
        check(res.get("naive_current_city_revenue") == {"Jakarta": 261000}, "demonstrates how naive is_current=True overwrites Bandung's historical revenue into Jakarta (261000)", str(res.get("naive_current_city_revenue")))

    elif mission_id == "kopiku-hard":
        cdc = [
            {"order_id": "O1", "sku_id": "KOPI-FLASH-01", "lsn": 10, "op": "c", "qty": 1, "unit_price_idr": 20000},
            {"order_id": "O1", "sku_id": "KOPI-FLASH-01", "lsn": 25, "op": "u", "qty": 2, "unit_price_idr": 20000},
            {"order_id": "O2", "sku_id": "KOPI-FLASH-01", "lsn": 30, "op": "d", "qty": 1, "unit_price_idr": 20000},
            {"order_id": "O2", "sku_id": "KOPI-FLASH-01", "lsn": 15, "op": "c", "qty": 1, "unit_price_idr": 20000},  # out-of-order older create!
            {"order_id": "O3", "sku_id": "KOPI-FLASH-01", "lsn": 12, "op": "c", "qty": 1, "unit_price_idr": 20000},
            {"order_id": "O4", "sku_id": "KOPI-FLASH-01", "lsn": 14, "op": "c", "qty": 1, "unit_price_idr": 20000},
            {"order_id": "O5", "sku_id": "KOPI-FLASH-01", "lsn": 16, "op": "c", "qty": 1, "unit_price_idr": 20000},
            {"order_id": "O6", "sku_id": "REGULAR-02", "lsn": 18, "op": "c", "qty": 1, "unit_price_idr": 15000},
        ]
        res = fn(cdc, {"KOPI-FLASH-01"}, num_salts=2)
        check([r["order_id"] for r in res.get("active_orders", [])] == ["O1", "O3", "O4", "O5", "O6"], "compacts CDC by LSN and suppresses O2 whose highest LSN=30 is a delete tombstone", str(res))
        check(res["active_orders"][0]["line_total_idr"] == 40000, "uses winning LSN=25 qty=2 for O1 (line_total_idr=40000)", str(res["active_orders"][0]))
        check(res.get("partition_counts", {}).get("KOPI-FLASH-01#0") == 2 and res.get("partition_counts", {}).get("KOPI-FLASH-01#1") == 2, "salts hot SKU evenly across 2 salted buckets (2 rows each instead of 4 in 1 bucket)", str(res.get("partition_counts")))

    elif mission_id == "kopiku-expert":
        rows = [
            {"order_id": "O1", "store_id": "S01", "customer_email": "Budi@Gmail.com", "net_idr": 50000},
            {"order_id": "O2", "store_id": "S99", "customer_email": "sari@yahoo.com", "net_idr": 75000},
        ]
        ent = {"FRANCHISE_A": ["S01"]}
        r_tenant = fn(rows, ent, "FRANCHISE_A", "FRANCHISE_OWNER", query_days=7, total_days=365, raw_table_gb=1000.0)
        r_admin = fn(rows, ent, "HQ", "ADMIN_AUDITOR", query_days=7, total_days=365, raw_table_gb=1000.0)
        check(len(r_tenant.get("visible_rows", [])) == 1 and r_tenant["visible_rows"][0]["store_id"] == "S01", "enforces Row-Level Security so FRANCHISE_A never sees store S99", str(r_tenant))
        check(r_tenant["visible_rows"][0]["customer_email"] == "***@gmail.com" and r_admin["visible_rows"][0]["customer_email"] == "Budi@Gmail.com", "masks customer PII email for franchise tenant while preserving unmasked email for ADMIN_AUDITOR", str(r_tenant))
        check(r_tenant.get("savings_pct", 0) > 99.0 and r_tenant.get("optimized_scan_gb") == 2.88, "computes partition + rollup scan reduction (1000 GB -> 2.88 GB, 99.71% saved)", str(r_tenant))

    elif mission_id == "paynusa-easy":
        sec = "paynusa_sec"
        now = 1700000500
        s1 = "sha256=" + _hmac_hex(sec, f"1700000450.TX1.charge.M1.100000")
        s2 = "sha256=" + _hmac_hex(sec, f"1700000460.TX2.refund.M1.25000")
        s_stale = "sha256=" + _hmac_hex(sec, f"1700000000.TX3.charge.M1.50000")
        wh = [
            {"tx_id": "TX1", "timestamp": 1700000450, "event_type": "charge", "merchant_id": "M1", "amount_idr": 100000, "signature": s1},
            {"tx_id": "TX1", "timestamp": 1700000450, "event_type": "charge", "merchant_id": "M1", "amount_idr": 100000, "signature": s1},
            {"tx_id": "TX2", "timestamp": 1700000460, "event_type": "refund", "merchant_id": "M1", "amount_idr": 25000, "signature": s2},
            {"tx_id": "TX3", "timestamp": 1700000000, "event_type": "charge", "merchant_id": "M1", "amount_idr": 50000, "signature": s_stale},
            {"tx_id": "TX4", "timestamp": 1700000480, "event_type": "charge", "merchant_id": "M1", "amount_idr": 50000, "signature": "sha256=forged"},
        ]
        res = fn(wh, sec, now, tolerance_sec=300)
        check(res.get("total_debit_idr") == 125000 and res.get("total_credit_idr") == 125000, "double-entry ledger balances debits == credits == 125000 and deduplicates TX1 retry", str(res))
        check(res.get("net_merchant_balances") == {"M1": 75000}, "computes M1 net balance = 100000 charge - 25000 refund = 75000", str(res.get("net_merchant_balances")))
        check(res.get("rejected_ids") == ["TX3", "TX4"], "rejects stale replay TX3 and forged HMAC signature TX4", str(res.get("rejected_ids")))

    elif mission_id == "paynusa-normal":
        accs = [
            {"account_id": "A1", "nik": "3201123456780001", "phone": "+62 812-3456-7890", "risk_tier": "LOW"},
            {"account_id": "A2", "nik": "3201999988880002", "phone": "0811-2222-3333", "risk_tier": "HIGH"},
        ]
        txs = [{"tx_id": "T1", "from": "A1", "to": "A2", "amount_idr": 500000}, {"tx_id": "T2", "from": "A2", "to": "A1", "amount_idr": 150000}]
        res = fn(accs, txs, ["a2"], "bank_salt_2026")
        check(res.get("shredded_count") == 1 and res.get("total_transfer_volume_idr") == 650000, "crypto-shreds A2 while keeping regulatory transfer ledger sum intact (650000)", str(res))
        a2_row = next((r for r in res.get("sat_account_pii", []) if r["account_id"] == "A2"), {})
        check(a2_row.get("is_shredded") is True and a2_row.get("pii_token") is None and a2_row.get("phone_masked") == "ERASED", "erases A2 pii_token and masks phone to 'ERASED'", str(a2_row))
        check("3201123456780001" not in json.dumps(res) and "7890" in json.dumps(res), "strips all raw NIKs while preserving last-4 masked phone for active account A1", str(res))

    elif mission_id == "paynusa-hard":
        txs = [
            {"tx_id": "T1", "account_id": "A1", "amount_idr": 100000, "event_ts": 1000},
            {"tx_id": "T2", "account_id": "A1", "amount_idr": 200000, "event_ts": 2000},
            {"tx_id": "T3_LATE", "account_id": "A1", "amount_idr": 50000, "event_ts": 900},  # watermark is 2000-900=1100 -> late!
        ]
        cbs = [
            {"cb_id": "CB1", "account_id": "A1", "cb_amount_idr": 30000},
            {"cb_id": "CB2", "account_id": "A1", "cb_amount_idr": 20000},
        ]
        res = fn(["A1"], txs, cbs, watermark_delay_sec=900)
        s0 = (res.get("account_summaries") or [{}])[0]
        check(s0.get("transfer_sum_idr") == 300000 and s0.get("chargeback_sum_idr") == 50000 and s0.get("net_exposure_idr") == 250000, "pre-aggregates transfers (300000) and chargebacks (50000) without 2x2 fan-out inflation", str(s0))
        check(res.get("late_dlq_tx_ids") == ["T3_LATE"] and res.get("final_watermark") == 1100, "routes T3_LATE (event_ts=900 < watermark=1100) to late_dlq_tx_ids", str(res))

    elif mission_id == "paynusa-expert":
        txs = [
            {"tx_id": "TX1", "account_id": "A1", "tx_ts": 1000, "amount_idr": 90000},
            {"tx_id": "TX2", "account_id": "A1", "tx_ts": 2000, "amount_idr": 120000},
        ]
        risk = [
            {"account_id": "A1", "updated_at": 800, "risk_score": 15},
            {"account_id": "A1", "updated_at": 1500, "risk_score": 95},
        ]
        res = fn(txs, risk, primary_last_commit_ts=5000, dr_replica_commit_ts=4400, rpo_limit_sec=900)
        tf = res.get("training_features", [])
        check(len(tf) == 2 and tf[0]["pit_risk_score"] == 15 and tf[1]["pit_risk_score"] == 95, "point-in-time ASOF join assigns risk_score=15 at tx_ts=1000 and 95 at tx_ts=2000", str(tf))
        check(res.get("leaked_tx_ids") == ["TX1"], "flags TX1 where a naive latest-state join would have leaked future risk_score=95", str(res.get("leaked_tx_ids")))
        check(res.get("replication_lag_sec") == 600 and res.get("dr_rpo_ok") is True, "verifies 600s DR replica lag meets the 900s (15-min) RPO target", str(res))

    elif mission_id == "gokirim-easy":
        pings = [
            {"ping_id": "P1", "courier_id": "C1", "local_epoch": 1700025200, "tz": "WIB", "lat": -6.2, "lon": 106.8, "speed_kmh": 40.0},
            {"ping_id": "P1_DUP", "courier_id": "C1", "local_epoch": 1700028800, "tz": "WITA", "lat": -6.2, "lon": 106.8, "speed_kmh": 40.0},  # exact same UTC (1700000000)!
            {"ping_id": "P2_GLITCH", "courier_id": "C1", "local_epoch": 1700025300, "tz": "WIB", "lat": 999.0, "lon": 106.8, "speed_kmh": 30.0},
            {"ping_id": "P3_SPEED", "courier_id": "C1", "local_epoch": 1700025400, "tz": "WIB", "lat": -6.2, "lon": 106.8, "speed_kmh": 240.0},
        ]
        res = fn(pings)
        check(len(res.get("valid_pings", [])) == 1 and res["valid_pings"][0]["utc_ts"] == 1700000000, "normalizes WIB/WITA to UTC epoch 1700000000 and deduplicates identical (courier_id, utc_ts)", str(res))
        check(res.get("dlq_ping_ids") == ["P2_GLITCH", "P3_SPEED"], "quarantines 999.0 lat glitch and 240 km/h impossible speed to dlq_ping_ids", str(res.get("dlq_ping_ids")))

    elif mission_id == "gokirim-normal":
        pings = [
            {"courier_id": "C1", "utc_ts": 1000},
            {"courier_id": "C1", "utc_ts": 1600},
            {"courier_id": "C1", "utc_ts": 4000},  # gap = 2400 > 1800 -> new session C1-S2!
            {"courier_id": "C1", "utc_ts": 4500},
        ]
        stops = [
            {"trip_id": "TR1", "courier_id": "C1", "stop_seq": 2, "hub_id": "H2", "delivered_count": 5},
            {"trip_id": "TR1", "courier_id": "C1", "stop_seq": 1, "hub_id": "H1", "delivered_count": 3},
        ]
        res = fn(pings, stops, gap_threshold_sec=1800)
        sess = res.get("sessions", [])
        check(len(sess) == 2 and sess[0]["duration_sec"] == 600 and sess[1]["duration_sec"] == 500, "splits courier pings into 2 active sessions across >1800s break (durations 600s and 500s)", str(sess))
        nt = (res.get("nested_trips") or [{}])[0]
        check(nt.get("total_delivered") == 8 and [s["stop_seq"] for s in nt.get("stops", [])] == [1, 2], "nests ordered stops array into trip struct and sums total_delivered=8", str(nt))

    elif mission_id == "gokirim-hard":
        evs = [
            {"event_id": "E1", "courier_id": "C1", "geohash": "qqgu", "event_ts": 610, "arrival_ts": 612},
            {"event_id": "E2", "courier_id": "C2", "geohash": "qqgu", "event_ts": 3100, "arrival_ts": 3101},
            {"event_id": "E3_TUNNEL", "courier_id": "C3", "geohash": "qqgu", "event_ts": 850, "arrival_ts": 3105},  # watermark=3100-2400=700 -> 850>=700 so accepted into [600,900)!
            {"event_id": "E4_TOO_LATE", "courier_id": "C4", "geohash": "qqgu", "event_ts": 500, "arrival_ts": 3106},  # 500 < 700 -> late!
        ]
        res = fn(evs, window_size_sec=300, watermark_delay_sec=2400)
        aggs = res.get("window_aggregates", [])
        check(len(aggs) == 2 and aggs[0]["window_start"] == 600 and aggs[0]["active_couriers"] == 2, "places E3_TUNNEL (event_ts=850 arriving at 3105) into historical event-time window [600, 900) alongside E1", str(aggs))
        check(res.get("late_event_ids") == ["E4_TOO_LATE"] and res.get("final_watermark") == 700, "drops E4_TOO_LATE (event_ts=500 < watermark=700)", str(res))

    elif mission_id == "gokirim-expert":
        cells = [
            {"geohash": "qqgu", "orders_requested": 30, "couriers_available": 10},  # ratio=3.0 -> 1.0 + 2.0*0.5 = 2.0
            {"geohash": "qqgv", "orders_requested": 5, "couriers_available": 10},   # ratio=0.5 -> 1.0
        ]
        tf = [
            {"name": "s3_lake", "public_access": False, "kms_encrypted": True, "iam_wildcard": False, "uses_static_keys": False},
            {"name": "bad_role", "public_access": False, "kms_encrypted": False, "iam_wildcard": True, "uses_static_keys": True},
        ]
        res = fn(cells, tf)
        check(res.get("surge_index") == {"qqgu": 2.0, "qqgv": 1.0}, "computes pre-aggregated OLAP surge multipliers per geohash cell", str(res.get("surge_index")))
        check(res.get("iac_compliant") is False and res.get("iac_violations") == [{"resource": "bad_role", "issues": ["missing_kms", "iam_wildcard", "static_keys"]}], "audits Terraform resources and flags missing_kms, iam_wildcard, and static_keys", str(res))

    elif mission_id == "cloudpulse-easy":
        pages = [
            {"cursor": "C0", "next_cursor": "C1", "status_code": 200, "records": [{"record_id": "R1", "patient_id": "P1", "updated_at": "2026-01-01"}]},
            {"cursor": "C1", "next_cursor": "C2", "status_code": 200, "records": [{"record_id": "R2", "patient_id": "P2", "updated_at": "2026-01-02"}]},
            {"cursor": "C2", "next_cursor": "C3", "status_code": 429, "records": [{"record_id": "R3", "patient_id": "P3", "updated_at": "2026-01-03"}]},
        ]
        res = fn(pages, initial_cursor="C1")
        check(res.get("pages_processed") == 1 and [r["record_id"] for r in res.get("records", [])] == ["R2"], "resumes cleanly from initial_cursor='C1' (skipping C0)", str(res))
        check(res.get("committed_cursor") == "C2" and res.get("stopped_on_error") is True, "halts on HTTP 429 at page C2 without advancing committed_cursor to C3", str(res))

    elif mission_id == "cloudpulse-normal":
        patients = [
            {"record_id": "csv_1", "nik": "317101", "source": "CSV", "full_name": "B. Santoso", "city": "Depok", "updated_at": "2026-02-10"},
            {"record_id": "erp_1", "nik": "317101", "source": "ERP", "full_name": "Budi Santoso", "city": "Jakarta", "updated_at": "2026-01-05"},
            {"record_id": "crm_1", "nik": "317101", "source": "CRM", "full_name": "Santoso, Budi", "city": "Bogor", "updated_at": "2026-02-01"},
        ]
        res = fn(patients, {"CL1": 500000, "CL2": 300000}, {"CL1": 500000, "CL2": 280000})
        g0 = (res.get("golden_patients") or [{}])[0]
        check(g0.get("full_name") == "Budi Santoso" and g0.get("winning_source") == "ERP" and g0.get("merged_record_ids") == ["crm_1", "csv_1", "erp_1"], "MDM survivorship picks authoritative ERP record over newer CSV/CRM rows", str(g0))
        check(res.get("ready_to_cutover") is False and len(res.get("strangler_drift", [])) == 1 and res["strangler_drift"][0]["delta_idr"] == 20000, "blocks Strangler Fig cutover when CL2 has +20000 parity drift", str(res))

    elif mission_id == "cloudpulse-hard":
        files = [
            {"file_id": "f1", "partition_dt": "2026-02-01", "size_mb": 30, "row_count": 100, "patient_ids": ["P1", "P2"]},
            {"file_id": "f2", "partition_dt": "2026-02-01", "size_mb": 40, "row_count": 150, "patient_ids": ["P3"]},
            {"file_id": "f3", "partition_dt": "2026-02-01", "size_mb": 50, "row_count": 200, "patient_ids": ["P9_ERASE"]},
        ]
        res = fn(files, ["P9_ERASE"], target_file_mb=128)
        p0 = (res.get("partitions") or [{}])[0]
        check(res.get("total_files_before") == 3 and res.get("total_files_after") == 1 and p0.get("surviving_rows") == 449, "bin-packs 3 small files (120 MB total) into 1 compacted 128 MB file with 449 surviving rows", str(res))
        check(res.get("gdpr_tainted_files") == ["f3"], "flags f3 for physical GDPR VACUUM snapshot expiration", str(res.get("gdpr_tainted_files")))

    elif mission_id == "cloudpulse-expert":
        h1 = _sha256("Diabetes SOP v1")
        existing = {
            "D1": {"tenant_id": "HOSP_A", "content_hash": h1, "text": "Diabetes SOP v1"},
            "D2": {"tenant_id": "HOSP_A", "content_hash": _sha256("Old Cardiology Note"), "text": "Old Cardiology Note"},
            "D_OLD": {"tenant_id": "HOSP_A", "content_hash": _sha256("Obsolete"), "text": "Obsolete"},
        }
        curr = [
            {"doc_id": "D1", "tenant_id": "HOSP_A", "text": "Diabetes SOP v1"},
            {"doc_id": "D2", "tenant_id": "HOSP_A", "text": "Updated Cardiology diabetes protocol"},
            {"doc_id": "D3", "tenant_id": "HOSP_B", "text": "Secret diabetes protocol for Hospital B"},
        ]
        res = fn(curr, existing, query_tenant="HOSP_A", query_terms=["diabetes", "cardiology"], top_k=3)
        check(res.get("embedded_doc_ids") == ["D2", "D3"] and res.get("skipped_unchanged_ids") == ["D1"] and res.get("deleted_doc_ids") == ["D_OLD"], "skips unchanged SHA-256 doc D1, embeds only modified/new D2 & D3, and deletes obsolete D_OLD", str(res))
        ret = res.get("retrieved_docs", [])
        check([r["doc_id"] for r in ret] == ["D2", "D1"] and all(r["tenant_id"] == "HOSP_A" for r in ret), "enforces multi-tenant isolation (HOSP_B's D3 is never leaked to HOSP_A) and ranks D2 (score 2) above D1 (score 1)", str(ret))

    if errors:
        raise AssertionError("\n".join(errors))
    return len(checks), checks


def _extract_from_js(field: str) -> dict[str, str]:
    """starterCode (what init writes) or referenceCode (a solution, used by the self-test and the hidden check)."""
    js_path = Path(__file__).resolve().parents[1] / "app" / "js" / "job-sim-data.js"
    txt = js_path.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'missionId:\s*"([^"]+)"[\s\S]*?' + field + r':\s*`((?:\\.|[^`\\])*)`', txt):
        out[m.group(1)] = m.group(2).replace("\\`", "`").replace("\\${", "${").replace("\\\\", "\\")
    return out


# Fields compared in the hidden case. None = compare the whole value; a list = for a list of dicts,
# compare only these fields of each dict (the ones the mission rules define).
HIDDEN_FIELDS = {
    "kopiku-easy": {"clean_rows": ["order_id", "net_idr"], "dlq": ["order_id", "reason"], "total_net_idr": None},
    "kopiku-normal": {"scd2_dim_store": ["store_id", "city", "valid_to"], "revenue_by_historical_city": None, "naive_current_city_revenue": None},
    "kopiku-hard": {"active_orders": ["order_id", "line_total_idr", "salted_sku_key"], "partition_counts": None, "max_partition_rows": None},
    "kopiku-expert": {"visible_rows": ["order_id", "customer_email"], "optimized_scan_gb": None, "savings_pct": None},
    "paynusa-easy": {"total_debit_idr": None, "total_credit_idr": None, "net_merchant_balances": None, "rejected_ids": None},
    "paynusa-normal": {"shredded_count": None, "total_transfer_volume_idr": None, "sat_account_pii": ["account_id", "is_shredded"]},
    "paynusa-hard": {"account_summaries": None, "late_dlq_tx_ids": None, "final_watermark": None},
    "paynusa-expert": {"training_features": ["tx_id", "pit_risk_score"], "leaked_tx_ids": None, "replication_lag_sec": None, "dr_rpo_ok": None},
    "gokirim-easy": {"valid_pings": ["ping_id", "utc_ts"], "dlq_ping_ids": None},
    "gokirim-normal": {"sessions": None, "nested_trips": ["trip_id", "total_delivered"]},
    "gokirim-hard": {"window_aggregates": None, "late_event_ids": None, "final_watermark": None},
    "gokirim-expert": {"surge_index": None, "iac_compliant": None, "iac_violations": None},
    "cloudpulse-easy": {"pages_processed": None, "records": ["record_id"], "committed_cursor": None, "stopped_on_error": None},
    "cloudpulse-normal": {"golden_patients": ["nik", "full_name", "winning_source"], "ready_to_cutover": None, "strangler_drift": None},
    "cloudpulse-hard": {"total_files_before": None, "total_files_after": None, "partitions": None, "gdpr_tainted_files": None},
    "cloudpulse-expert": {"embedded_doc_ids": None, "skipped_unchanged_ids": None, "deleted_doc_ids": None, "retrieved_docs": None},
}


# ---------------------------------------------------------------------------------------------
# Hidden cases: a second, different dataset per mission. The verifier runs the reference solution
# on it and compares the listed keys, so code that hard-codes the visible answers fails.
def _hidden_case(mission_id: str):
    if mission_id == "kopiku-easy":
        rows = [
            {"order_id": "B-7", "store_id": "S4", "order_date": "2026-03-09", "status": " Shipped ", "gross_raw": "Rp 120.000", "discount_raw": "20.000", "updated_at": "2026-03-09T07:00:00"},
            {"order_id": "B-7", "store_id": "S4", "order_date": "2026-03-09", "status": "cancelled", "gross_raw": "Rp 120.000", "discount_raw": "0", "updated_at": "2026-03-09T06:00:00"},
            {"order_id": "B-2", "store_id": "S9", "order_date": "2026-03-09", "status": "paid", "gross_raw": 45000, "discount_raw": 5000, "updated_at": "2026-03-09T08:30:00"},
            {"order_id": "B-3", "store_id": "S9", "order_date": "2026-03-09", "status": "paid", "gross_raw": "abc", "discount_raw": "0", "updated_at": "2026-03-09T08:31:00"},
            {"order_id": "B-4", "store_id": "S9", "order_date": "2026-03-09", "status": "paid", "gross_raw": "30000", "discount_raw": "40000", "updated_at": "2026-03-09T08:32:00"},
            {"order_id": "", "store_id": "S9", "order_date": "2026-03-09", "status": "paid", "gross_raw": "30000", "discount_raw": "0", "updated_at": "2026-03-09T08:33:00"},
            {"order_id": "B-9", "store_id": "S9", "order_date": "2026-03-08", "status": "paid", "gross_raw": "77000", "discount_raw": "0", "updated_at": "2026-03-08T08:00:00"},
        ]
        return (rows, "2026-03-09"), {}, ["clean_rows", "dlq", "total_net_idr"]
    if mission_id == "kopiku-normal":
        changes = [
            {"store_id": "S7", "city": "Medan", "effective_from": "2025-06-01"},
            {"store_id": "S7", "city": "Surabaya", "effective_from": "2026-02-01"},
            {"store_id": "S8", "city": "Bali", "effective_from": "2025-01-01"},
        ]
        orders = [
            {"order_id": "a", "store_id": "S7", "order_date": "2026-01-31", "status": "paid", "gross_idr": 300000, "discount_idr": 30000, "tax_idr": 27000},
            {"order_id": "b", "store_id": "S7", "order_date": "2026-02-01", "status": "shipped", "gross_idr": 100000, "discount_idr": 0, "tax_idr": 10000},
            {"order_id": "c", "store_id": "S8", "order_date": "2026-02-05", "status": "delivered", "gross_idr": 50000, "discount_idr": 5000, "tax_idr": 4500},
            {"order_id": "d", "store_id": "S8", "order_date": "2026-02-06", "status": "cancelled", "gross_idr": 90000, "discount_idr": 0, "tax_idr": 9000},
        ]
        return (orders, changes), {}, ["scd2_dim_store", "revenue_by_historical_city", "naive_current_city_revenue"]
    if mission_id == "kopiku-hard":
        cdc = [
            {"order_id": "Q1", "sku_id": "HOT", "lsn": 5, "op": "c", "qty": 1, "unit_price_idr": 30000},
            {"order_id": "Q1", "sku_id": "HOT", "lsn": 9, "op": "u", "qty": 3, "unit_price_idr": 30000},
            {"order_id": "Q2", "sku_id": "HOT", "lsn": 7, "op": "c", "qty": 2, "unit_price_idr": 30000},
            {"order_id": "Q3", "sku_id": "HOT", "lsn": 8, "op": "c", "qty": 1, "unit_price_idr": 30000},
            {"order_id": "Q3", "sku_id": "HOT", "lsn": 6, "op": "d", "qty": 1, "unit_price_idr": 30000},
            {"order_id": "Q4", "sku_id": "HOT", "lsn": 11, "op": "c", "qty": 1, "unit_price_idr": 30000},
            {"order_id": "Q5", "sku_id": "COLD", "lsn": 12, "op": "c", "qty": 4, "unit_price_idr": 12500},
            {"order_id": "Q6", "sku_id": "COLD", "lsn": 13, "op": "c", "qty": 1, "unit_price_idr": 12500},
            {"order_id": "Q6", "sku_id": "COLD", "lsn": 14, "op": "d", "qty": 1, "unit_price_idr": 12500},
        ]
        return (cdc, {"HOT"}), {"num_salts": 3}, ["active_orders", "partition_counts", "max_partition_rows"]
    if mission_id == "kopiku-expert":
        rows = [
            {"order_id": "X1", "store_id": "S02", "customer_email": "Rina.Putri@Outlook.co.id", "net_idr": 40000},
            {"order_id": "X2", "store_id": "S03", "customer_email": "andi@kopiku.id", "net_idr": 65000},
            {"order_id": "X3", "store_id": "S77", "customer_email": "dewi@gmail.com", "net_idr": 15000},
        ]
        ent = {"FRANCHISE_B": ["S02", "S03"], "FRANCHISE_C": ["S77"]}
        return (rows, ent, "FRANCHISE_B", "FRANCHISE_OWNER"), {"query_days": 30, "total_days": 730, "raw_table_gb": 2400.0}, ["visible_rows", "optimized_scan_gb", "savings_pct"]
    if mission_id == "paynusa-easy":
        import hmac as _h
        sec, now = "pn_secret_b", 1800000300

        def sig(ts, tx, et, m, amt):
            return "sha256=" + _h.new(sec.encode(), f"{ts}.{tx}.{et}.{m}.{amt}".encode(), hashlib.sha256).hexdigest()
        wh = [
            {"tx_id": "K1", "timestamp": 1800000200, "event_type": "charge", "merchant_id": "M7", "amount_idr": 80000, "signature": sig(1800000200, "K1", "charge", "M7", 80000)},
            {"tx_id": "K2", "timestamp": 1800000210, "event_type": "charge", "merchant_id": "M8", "amount_idr": 60000, "signature": sig(1800000210, "K2", "charge", "M8", 60000)},
            {"tx_id": "K3", "timestamp": 1800000220, "event_type": "refund", "merchant_id": "M8", "amount_idr": 10000, "signature": sig(1800000220, "K3", "refund", "M8", 10000)},
            {"tx_id": "K3", "timestamp": 1800000220, "event_type": "refund", "merchant_id": "M8", "amount_idr": 10000, "signature": sig(1800000220, "K3", "refund", "M8", 10000)},
            {"tx_id": "K4", "timestamp": 1800000230, "event_type": "charge", "merchant_id": "M7", "amount_idr": 99000, "signature": sig(1800000230, "K4", "charge", "M7", 1)},
        ]
        return (wh, sec, now), {"tolerance_sec": 120}, ["total_debit_idr", "total_credit_idr", "net_merchant_balances", "rejected_ids"]
    if mission_id == "paynusa-normal":
        accs = [
            {"account_id": "B1", "nik": "3174000011112222", "phone": "0812-9999-1234", "risk_tier": "MEDIUM"},
            {"account_id": "B2", "nik": "3174000033334444", "phone": "+62 857 1111 5678", "risk_tier": "LOW"},
            {"account_id": "B3", "nik": "3174000055556666", "phone": "0813 2222 9012", "risk_tier": "HIGH"},
        ]
        txs = [{"tx_id": "U1", "from": "B1", "to": "B3", "amount_idr": 700000}, {"tx_id": "U2", "from": "B3", "to": "B2", "amount_idr": 125000}, {"tx_id": "U3", "from": "B2", "to": "B1", "amount_idr": 5000}]
        return (accs, txs, ["B3", "b1"], "salt_hidden_9"), {}, ["shredded_count", "total_transfer_volume_idr", "sat_account_pii"]
    if mission_id == "paynusa-hard":
        txs = [
            {"tx_id": "V1", "account_id": "A7", "amount_idr": 40000, "event_ts": 5000},
            {"tx_id": "V2", "account_id": "A8", "amount_idr": 10000, "event_ts": 5200},
            {"tx_id": "V3", "account_id": "A7", "amount_idr": 60000, "event_ts": 7000},
            {"tx_id": "V4_LATE", "account_id": "A8", "amount_idr": 5000, "event_ts": 6400},
            {"tx_id": "V5_OK", "account_id": "A8", "amount_idr": 2500, "event_ts": 6600},
        ]
        cbs = [{"cb_id": "D1", "account_id": "A7", "cb_amount_idr": 7000}, {"cb_id": "D2", "account_id": "A7", "cb_amount_idr": 3000}, {"cb_id": "D3", "account_id": "A7", "cb_amount_idr": 1000}]
        return (["A7", "A8"], txs, cbs), {"watermark_delay_sec": 500}, ["account_summaries", "late_dlq_tx_ids", "final_watermark"]
    if mission_id == "paynusa-expert":
        txs = [
            {"tx_id": "W1", "account_id": "Z1", "tx_ts": 100, "amount_idr": 10000},
            {"tx_id": "W2", "account_id": "Z1", "tx_ts": 700, "amount_idr": 20000},
            {"tx_id": "W3", "account_id": "Z2", "tx_ts": 900, "amount_idr": 30000},
            {"tx_id": "W4", "account_id": "Z1", "tx_ts": 1300, "amount_idr": 40000},
        ]
        risk = [
            {"account_id": "Z1", "updated_at": 50, "risk_score": 10},
            {"account_id": "Z1", "updated_at": 600, "risk_score": 40},
            {"account_id": "Z1", "updated_at": 1200, "risk_score": 80},
            {"account_id": "Z2", "updated_at": 950, "risk_score": 70},
        ]
        return (txs, risk), {"primary_last_commit_ts": 9000, "dr_replica_commit_ts": 7800, "rpo_limit_sec": 900}, ["training_features", "leaked_tx_ids", "replication_lag_sec", "dr_rpo_ok"]
    if mission_id == "gokirim-easy":
        pings = [
            {"ping_id": "G1", "courier_id": "K9", "local_epoch": 1800032400, "tz": "WIT", "lat": -2.5, "lon": 140.7, "speed_kmh": 35.0},
            {"ping_id": "G2", "courier_id": "K9", "local_epoch": 1800025260, "tz": "WIB", "lat": -2.5, "lon": 140.7, "speed_kmh": 36.0},
            {"ping_id": "G2_DUP", "courier_id": "K9", "local_epoch": 1800028860, "tz": "WITA", "lat": -2.5, "lon": 140.7, "speed_kmh": 36.0},
            {"ping_id": "G3_LON", "courier_id": "K9", "local_epoch": 1800025400, "tz": "WIB", "lat": -2.5, "lon": 400.0, "speed_kmh": 20.0},
            {"ping_id": "G4_NEG", "courier_id": "K8", "local_epoch": 1800025500, "tz": "WIB", "lat": -6.1, "lon": 106.9, "speed_kmh": -5.0},
            {"ping_id": "G5", "courier_id": "K8", "local_epoch": 1800025600, "tz": "WIB", "lat": -6.1, "lon": 106.9, "speed_kmh": 0.0},
        ]
        return (pings,), {}, ["valid_pings", "dlq_ping_ids"]
    if mission_id == "gokirim-normal":
        pings = [
            {"courier_id": "D2", "utc_ts": 100}, {"courier_id": "D1", "utc_ts": 50}, {"courier_id": "D2", "utc_ts": 400},
            {"courier_id": "D2", "utc_ts": 3000}, {"courier_id": "D1", "utc_ts": 1000}, {"courier_id": "D2", "utc_ts": 3900},
        ]
        stops = [
            {"trip_id": "T9", "courier_id": "D2", "stop_seq": 3, "hub_id": "H3", "delivered_count": 1},
            {"trip_id": "T9", "courier_id": "D2", "stop_seq": 1, "hub_id": "H1", "delivered_count": 4},
            {"trip_id": "T8", "courier_id": "D1", "stop_seq": 1, "hub_id": "H5", "delivered_count": 2},
            {"trip_id": "T9", "courier_id": "D2", "stop_seq": 2, "hub_id": "H2", "delivered_count": 6},
        ]
        return (pings, stops), {"gap_threshold_sec": 1000}, ["sessions", "nested_trips"]
    if mission_id == "gokirim-hard":
        evs = [
            {"event_id": "F1", "courier_id": "R1", "geohash": "qqgx", "event_ts": 1200, "arrival_ts": 1201},
            {"event_id": "F2", "courier_id": "R2", "geohash": "qqgx", "event_ts": 1250, "arrival_ts": 1252},
            {"event_id": "F3", "courier_id": "R1", "geohash": "qqgx", "event_ts": 1290, "arrival_ts": 1291},
            {"event_id": "F4", "courier_id": "R3", "geohash": "qqgy", "event_ts": 2000, "arrival_ts": 2001},
            {"event_id": "F5_LATE", "courier_id": "R4", "geohash": "qqgx", "event_ts": 1100, "arrival_ts": 2002},
            {"event_id": "F6_OK", "courier_id": "R5", "geohash": "qqgx", "event_ts": 1230, "arrival_ts": 2003},
        ]
        return (evs,), {"window_size_sec": 120, "watermark_delay_sec": 800}, ["window_aggregates", "late_event_ids", "final_watermark"]
    if mission_id == "gokirim-expert":
        cells = [
            {"geohash": "aa01", "orders_requested": 12, "couriers_available": 4},
            {"geohash": "aa02", "orders_requested": 9, "couriers_available": 0},
            {"geohash": "aa03", "orders_requested": 7, "couriers_available": 7},
            {"geohash": "aa04", "orders_requested": 50, "couriers_available": 5},
        ]
        tf = [
            {"name": "open_bucket", "public_access": True, "kms_encrypted": True, "iam_wildcard": False, "uses_static_keys": False},
            {"name": "good_role", "public_access": False, "kms_encrypted": True, "iam_wildcard": False, "uses_static_keys": False},
            {"name": "ci_user", "public_access": False, "kms_encrypted": True, "iam_wildcard": False, "uses_static_keys": True},
        ]
        return (cells, tf), {}, ["surge_index", "iac_compliant", "iac_violations"]
    if mission_id == "cloudpulse-easy":
        pages = [
            {"cursor": "A0", "next_cursor": "A1", "status_code": 200, "records": [{"record_id": "S1", "patient_id": "P1", "updated_at": "2026-02-01"}]},
            {"cursor": "A1", "next_cursor": "A2", "status_code": 200, "records": [{"record_id": "S2", "patient_id": "P2", "updated_at": "2026-02-02"}, {"record_id": "S3", "patient_id": "P3", "updated_at": "2026-02-02"}]},
            {"cursor": "A2", "next_cursor": None, "status_code": 200, "records": [{"record_id": "S4", "patient_id": "P4", "updated_at": "2026-02-03"}]},
        ]
        return (pages,), {"initial_cursor": None}, ["pages_processed", "records", "committed_cursor", "stopped_on_error"]
    if mission_id == "cloudpulse-normal":
        patients = [
            {"record_id": "crm_9", "nik": "320555", "source": "CRM", "full_name": "Sari Wulandari", "city": "Bandung", "updated_at": "2026-03-01"},
            {"record_id": "csv_9", "nik": "320555", "source": "CSV", "full_name": "S. Wulandari", "city": "Cimahi", "updated_at": "2026-03-05"},
            {"record_id": "csv_4", "nik": "320777", "source": "CSV", "full_name": "Agus", "city": "Garut", "updated_at": "2026-01-02"},
        ]
        return (patients, {"K1": 100000, "K2": 250000, "K3": 75000}, {"K1": 100000, "K2": 250000, "K3": 70000}), {}, ["golden_patients", "ready_to_cutover", "strangler_drift"]
    if mission_id == "cloudpulse-hard":
        files = [
            {"file_id": "g1", "partition_dt": "2026-03-01", "size_mb": 60, "row_count": 300, "patient_ids": ["Q1"]},
            {"file_id": "g2", "partition_dt": "2026-03-01", "size_mb": 70, "row_count": 350, "patient_ids": ["Q2", "Q_ERASE"]},
            {"file_id": "g3", "partition_dt": "2026-03-02", "size_mb": 10, "row_count": 40, "patient_ids": ["Q3"]},
            {"file_id": "g4", "partition_dt": "2026-03-01", "size_mb": 20, "row_count": 90, "patient_ids": ["Q4"]},
        ]
        return (files, ["Q_ERASE"]), {"target_file_mb": 100}, ["total_files_before", "total_files_after", "partitions", "gdpr_tainted_files"]
    if mission_id == "cloudpulse-expert":
        existing = {
            "K1": {"tenant_id": "HOSP_C", "content_hash": _sha256("Asthma inhaler guide"), "text": "Asthma inhaler guide"},
            "K2": {"tenant_id": "HOSP_C", "content_hash": _sha256("Fever triage"), "text": "Fever triage"},
        }
        curr = [
            {"doc_id": "K1", "tenant_id": "HOSP_C", "text": "Asthma inhaler guide"},
            {"doc_id": "K2", "tenant_id": "HOSP_C", "text": "Fever triage for asthma children"},
            {"doc_id": "K4", "tenant_id": "HOSP_C", "text": "Dengue fever asthma fever checklist"},
            {"doc_id": "K5", "tenant_id": "HOSP_D", "text": "asthma fever asthma notes of another hospital"},
        ]
        return (curr, existing), {"query_tenant": "HOSP_C", "query_terms": ["asthma", "fever"], "top_k": 2}, ["embedded_doc_ids", "skipped_unchanged_ids", "deleted_doc_ids", "retrieved_docs"]
    raise ValueError(mission_id)


def _project(value, fields):
    if fields and isinstance(value, list):
        return [{f: (d.get(f) if isinstance(d, dict) else None) for f in fields} for d in value]
    return value


def _reference_fn(mission_id: str, tmp_dir: Path):
    filename, fn_name = MISSIONS[mission_id]
    (tmp_dir / filename).write_text(_extract_from_js("referenceCode")[mission_id] + "\n", encoding="utf-8")
    return _load_fn(tmp_dir, filename, fn_name)


def run_hidden_check(mission_id: str, fn) -> list[str]:
    """Run the learner's function and the reference on a dataset the learner has not seen; return the differences."""
    import copy
    args, kwargs, _ = _hidden_case(mission_id)
    with tempfile.TemporaryDirectory() as tmp:
        ref = _reference_fn(mission_id, Path(tmp))
        expected = ref(*copy.deepcopy(args), **copy.deepcopy(kwargs))
    try:
        got = fn(*copy.deepcopy(args), **copy.deepcopy(kwargs))
    except Exception as e:  # noqa: BLE001 - any crash is a failed check
        return [f"FAIL: hidden dataset crashed your function: {type(e).__name__}: {e}"]
    if not isinstance(got, dict):
        return ["FAIL: hidden dataset: the function must return a dict"]
    diffs = []
    for key, fields in HIDDEN_FIELDS[mission_id].items():
        if _project(got.get(key), fields) != _project(expected.get(key), fields):
            diffs.append(f"FAIL: hidden dataset: '{key}' differs from the expected result (re-read the rules for '{key}'; the visible data does not cover every case)")
    return diffs


def _norm(code: str) -> str:
    return re.sub(r"\s+", "", re.sub(r"#[^\n]*", "", code))


def cmd_list():
    print("DataForge Real-Life Data Engineer Job Simulator — 16 Production Missions:")
    for mid, (fname, fn) in MISSIONS.items():
        print(f"  - {mid:<18} -> {fname} :: {fn}()")


def cmd_init(mission_id: str, work_dir: Path):
    if mission_id not in MISSIONS:
        print(f"Unknown mission '{mission_id}'. Run 'python3 scripts/job_sim.py list'.")
        sys.exit(1)
    work_dir.mkdir(parents=True, exist_ok=True)
    fname, fn = MISSIONS[mission_id]
    target = work_dir / fname
    starters = _extract_from_js("starterCode")
    if not target.exists():
        target.write_text(starters.get(mission_id, f"def {fn}(*args, **kwargs):\n    raise NotImplementedError\n") + "\n", encoding="utf-8")
        print(f"Initialized the starter file (rules inside, function still empty): {target}")
    else:
        print(f"File already exists (not overwritten): {target}")
    print(f"Next step: review/edit {target} and run:\n  python3 scripts/job_sim.py verify {mission_id} {work_dir}")


def verify_mission(mission_id: str, work_dir: Path) -> tuple[int, list[str]]:
    """Visible checks, then a hidden dataset compared with the reference. Raises AssertionError on failure."""
    if mission_id not in MISSIONS:
        raise ValueError(f"Unknown mission '{mission_id}'. Run 'python3 scripts/job_sim.py list'.")
    filename, fn_name = MISSIONS[mission_id]
    path = work_dir / filename
    if path.exists() and _norm(path.read_text(encoding="utf-8")) == _norm(_extract_from_js("referenceCode")[mission_id]):
        raise AssertionError("FAIL: this file is the course's reference solution. Write your own version from the rules.")
    fn = _load_fn(work_dir, filename, fn_name)
    passed, details = run_mission_checks(mission_id, work_dir, fn=fn)
    hidden = run_hidden_check(mission_id, fn)
    if hidden:
        raise AssertionError("\n".join(hidden))
    return passed + 1, details + ["gives the same answers as the reference on a hidden dataset"]


def cmd_verify(mission_id: str, work_dir: Path):
    try:
        passed, details = verify_mission(mission_id, work_dir)
    except Exception as e:
        print(f"❌ Verification FAILED for {mission_id}:\n{e}")
        sys.exit(1)
    for d in details:
        print(f"  ✓ PASS: {d}")
    tok = make_job_token(mission_id, passed)
    print(f"\n🎉 All {passed} production checks passed for {mission_id}!")
    print(f"Paste this JOB1 proof token in the DataForge Job Simulator:\n\n  {tok}\n")


def cmd_self_test():
    """Every reference passes; every starter, every copied reference and every 'replay the first answer' cheat fails."""
    refs, starters = _extract_from_js("referenceCode"), _extract_from_js("starterCode")
    assert len(refs) == 16 and len(starters) == 16, f"Expected 16 references and starters, found {len(refs)} and {len(starters)}"
    bad = 0
    for mid, (fname, fn_name) in MISSIONS.items():
        results = {}
        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            # the reference, with a comment added so it is not an exact copy
            (tdir / fname).write_text(refs[mid] + "\n\nVERSION = 'mine'\n", encoding="utf-8")
            try:
                passed, _ = verify_mission(mid, tdir)
                results["reference passes"] = True
            except Exception as e:  # noqa: BLE001
                results["reference passes"] = False
                print(e)
            # the starter must fail
            (tdir / fname).write_text(starters[mid] + "\n", encoding="utf-8")
            try:
                verify_mission(mid, tdir)
                results["starter fails"] = False
            except Exception:  # noqa: BLE001
                results["starter fails"] = True
            # an exact copy of the reference must be refused
            (tdir / fname).write_text(refs[mid] + "\n", encoding="utf-8")
            try:
                verify_mission(mid, tdir)
                results["copy refused"] = False
            except AssertionError as e:
                results["copy refused"] = "reference solution" in str(e)
            # hard-coding: remember the first answer and return it for every later call
            cheat = refs[mid] + (
                f"\n\n_real = {fn_name}\n_first = []\n\n"
                f"def {fn_name}(*a, **k):\n    if not _first:\n        _first.append(_real(*a, **k))\n    return _first[0]\n"
            )
            (tdir / fname).write_text(cheat, encoding="utf-8")
            try:
                verify_mission(mid, tdir)
                results["hard-coded answers fail"] = False
            except Exception:  # noqa: BLE001
                results["hard-coded answers fail"] = True
        ok = all(results.values())
        bad += not ok
        print(f"  {'✓' if ok else '✗'} {mid:<18} " + ", ".join(f"{k}: {'yes' if v else 'NO'}" for k, v in results.items()))
    if bad:
        print(f"SELF_TEST_FAILED ({bad} missions)")
        sys.exit(1)
    print("SELF_TEST_ALL_16_JOB_SIM_MISSIONS_OK")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "list":
        cmd_list()
    elif args[0] == "--self-test":
        cmd_self_test()
    elif args[0] == "init" and len(args) >= 3:
        cmd_init(args[1], Path(args[2]).expanduser())
    elif args[0] == "verify" and len(args) >= 3:
        cmd_verify(args[1], Path(args[2]).expanduser())
    else:
        print(__doc__)
        sys.exit(1)
