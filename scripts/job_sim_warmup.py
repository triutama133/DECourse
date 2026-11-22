#!/usr/bin/env python3
"""Warm-up week of the job simulator: three small tasks per company for Level 0 learners.

Task 1 cleans one value (Module 0.0), task 2 counts with a loop and a dict (Module 0.0), task 3 is one SQL query
(Module 0.3). They are verified like the real missions, through scripts/job_sim.py (init, verify, JOB1 tokens):
visible checks, a hidden second dataset compared with the reference, copies of the reference refused.

This file is the single source. The app reads app/js/job-sim-warmup.js, which is generated from it:

    python3 scripts/job_sim_warmup.py --write-js      # after editing a task
    python3 scripts/job_sim_warmup.py --check-js      # CI: the generated file is up to date
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS_PATH = ROOT / "app" / "js" / "job-sim-warmup.js"


def T(id_, en):
    return {"id": id_, "en": en}


# kind: "value" = fn(x) -> value, checked over a list of inputs; "dict" = fn(rows) -> dict; "sql" = fn() -> SQL text
# run on SQLite tables.
TASKS = {
    # ------------------------------------------------------------------ KopiKu
    "kopiku-w1": {
        "story": "kopiku", "n": 1, "module": "mod-0-0", "from": "sari", "kind": "value",
        "file": "warmup_kopiku_1.py", "fn": "parse_rupiah", "sig": "parse_rupiah(text) -> int | None",
        "title": T("Harga yang diketik sesuka hati", "Prices typed any way you like"),
        "brief": T("Setiap cabang mengetik harga dengan caranya sendiri: 'Rp 25.000', '25000', ' rp25.000 '. Laporan saya butuh angka. Bisa buatkan satu fungsi yang mengubah semuanya menjadi rupiah?",
                   "Every branch types prices its own way: 'Rp 25.000', '25000', ' rp25.000 '. My report needs numbers. Can you write one function that turns all of them into rupiah?"),
        "rules": {
            "en": ["`text` is a string, an int or `None`.",
                   "An int is returned as it is when it is 0 or more; a negative int gives `None`.",
                   "A string: remove spaces at both ends and a leading `Rp` in any case (`Rp`, `rp`, `RP`) with any spaces after it. Dots are thousands separators: remove them. What is left must be digits only; return it as an int.",
                   "Anything else (empty text, `None`, letters, a minus sign) gives `None`."],
            "id": ["`text` adalah string, int, atau `None`.",
                   "Int dikembalikan apa adanya jika 0 atau lebih; int negatif memberi `None`.",
                   "String: buang spasi di kedua ujung dan awalan `Rp` dalam huruf apa pun (`Rp`, `rp`, `RP`) beserta spasi setelahnya. Titik adalah pemisah ribuan: buang. Sisanya harus hanya angka; kembalikan sebagai int.",
                   "Selain itu (teks kosong, `None`, huruf, tanda minus) memberi `None`."]},
        "reference": '''def parse_rupiah(text):
    if text is None:
        return None
    if isinstance(text, int) and not isinstance(text, bool):
        return text if text >= 0 else None
    if not isinstance(text, str):
        return None
    s = text.strip()
    if s.lower().startswith("rp"):
        s = s[2:].strip()
    s = s.replace(".", "")
    if s == "" or not s.isdigit():
        return None
    return int(s)
''',
        "visible": [("Rp 25.000", 25000), ("25000", 25000), (" rp25.000 ", 25000), (15000, 15000),
                    ("", None), (None, None), ("abc", None), ("-5.000", None)],
        "hidden": ["Rp 1.250.000", "RP 0", "12,5", "Rp", 0, -1, "Rp 7.500 ", "  rp   900", "Rp -3.000", "1.000.000"],
    },
    "kopiku-w2": {
        "story": "kopiku", "n": 2, "module": "mod-0-0", "from": "rina", "kind": "dict",
        "file": "warmup_kopiku_2.py", "fn": "count_by_status", "sig": "count_by_status(rows) -> dict",
        "title": T("Berapa pesanan per status?", "How many orders per status?"),
        "brief": T("Sebelum rapat jam sepuluh, saya perlu tahu berapa pesanan per status dari ekspor kasir. Statusnya ditulis tidak rapi: huruf besar-kecil campur, ada spasi, ada yang kosong.",
                   "Before the ten o'clock meeting I need the number of orders per status from the till export. The statuses are messy: mixed case, stray spaces, some empty."),
        "rules": {
            "en": ["`rows` is a list of dicts. Most have a key `status`; some do not, and some have `None` or an empty string there.",
                   "Count each status after `.strip().lower()`, so `' Paid'` and `'paid'` are the same status.",
                   "Skip rows without a usable status (missing key, `None`, or empty after strip).",
                   "Return a dict from status to count, for example `{'paid': 2, 'cancelled': 1}`."],
            "id": ["`rows` adalah list berisi dict. Sebagian besar punya kunci `status`; sebagian tidak, dan sebagian berisi `None` atau string kosong.",
                   "Hitung setiap status setelah `.strip().lower()`, jadi `' Paid'` dan `'paid'` adalah status yang sama.",
                   "Lewati baris tanpa status yang bisa dipakai (kunci tidak ada, `None`, atau kosong setelah strip).",
                   "Kembalikan dict dari status ke jumlah, misalnya `{'paid': 2, 'cancelled': 1}`."]},
        "reference": '''def count_by_status(rows):
    counts = {}
    for row in rows:
        status = row.get("status")
        if status is None:
            continue
        status = str(status).strip().lower()
        if status == "":
            continue
        counts[status] = counts.get(status, 0) + 1
    return counts
''',
        "visible": [([{"status": "paid"}, {"status": " Paid"}, {"status": "CANCELLED"}, {"status": ""}, {"order_id": "x"},
                      {"status": None}, {"status": "delivered"}], {"paid": 2, "cancelled": 1, "delivered": 1})],
        "hidden": [[{"status": "Refunded "}, {"status": "shipped"}, {"status": "SHIPPED"}, {"status": "   "}, {},
                    {"status": "paid"}, {"status": "refunded"}, {"status": "Shipped"}]],
    },
    "kopiku-w3": {
        "story": "kopiku", "n": 3, "module": "mod-0-3", "from": "dewi", "kind": "sql",
        "file": "warmup_kopiku_3.py", "fn": "revenue_per_store_sql", "sig": "revenue_per_store_sql() -> str",
        "title": T("Omzet per cabang", "Revenue per branch"),
        "brief": T("Saya butuh omzet per cabang untuk laporan bulanan, hanya dari pesanan yang benar-benar dibayar atau terkirim. Pesanan yang batal atau dikembalikan bukan omzet.",
                   "I need revenue per branch for the monthly report, only from orders that were actually paid or delivered. Cancelled or refunded orders are not revenue."),
        "tables": {"orders": ["order_id TEXT", "store_id TEXT", "status TEXT", "total_idr INTEGER"]},
        "rules": {
            "en": ["Return the text of ONE SQL query (SQLite) on the table `orders(order_id, store_id, status, total_idr)`.",
                   "Only orders whose `status` is `'paid'` or `'delivered'` count as revenue.",
                   "Columns: `store_id`, `revenue_idr` (the sum of `total_idr`). A store with no such orders does not appear.",
                   "Order by `revenue_idr` from high to low; on a tie, by `store_id` A to Z."],
            "id": ["Kembalikan teks SATU query SQL (SQLite) pada tabel `orders(order_id, store_id, status, total_idr)`.",
                   "Hanya pesanan dengan `status` `'paid'` atau `'delivered'` yang dihitung sebagai omzet.",
                   "Kolom: `store_id`, `revenue_idr` (jumlah `total_idr`). Cabang tanpa pesanan seperti itu tidak muncul.",
                   "Urutkan berdasarkan `revenue_idr` dari besar ke kecil; jika sama, berdasarkan `store_id` A ke Z."]},
        "reference": '''def revenue_per_store_sql():
    return """
        SELECT store_id, SUM(total_idr) AS revenue_idr
        FROM orders
        WHERE status IN ('paid', 'delivered')
        GROUP BY store_id
        ORDER BY revenue_idr DESC, store_id
    """
''',
        "visible": {"orders": [("O1", "S1", "paid", 50000), ("O2", "S1", "delivered", 20000), ("O3", "S2", "paid", 30000),
                               ("O4", "S2", "cancelled", 99000), ("O5", "S3", "refunded", 40000)]},
        "visible_expected": [("S1", 70000), ("S2", 30000)],
        "hidden": {"orders": [("A1", "S9", "delivered", 15000), ("A2", "S4", "paid", 10000), ("A3", "S4", "delivered", 5000),
                              ("A4", "S7", "cancelled", 80000), ("A5", "S2", "paid", 15000), ("A6", "S7", "paid", 1000),
                              ("A7", "S8", "refunded", 30000)]},
    },
    # ------------------------------------------------------------------ PayNusa
    "paynusa-w1": {
        "story": "paynusa", "n": 1, "module": "mod-0-0", "from": "maya", "kind": "value",
        "file": "warmup_paynusa_1.py", "fn": "parse_idr", "sig": "parse_idr(text) -> int | None",
        "title": T("Nominal dari rekening koran bank", "Amounts from the bank statement"),
        "brief": T("Rekening koran bank menulis nominal dengan format Indonesia: '1.500.000,00'. Sistem kita menyimpan rupiah sebagai bilangan bulat. Tolong buat pengubahnya, dan jangan pernah menebak kalau formatnya aneh.",
                   "The bank statement writes amounts in Indonesian format: '1.500.000,00'. Our system stores rupiah as whole numbers. Please write the converter, and never guess when the format is odd."),
        "rules": {
            "en": ["`text` is a string or `None`. Remove spaces at both ends, then a leading `Rp` or `IDR` (any case) with the spaces after it.",
                   "Dots are thousands separators: remove them. A comma starts the decimal part.",
                   "Rupiah have no cents here: a decimal part is allowed only if it is all zeros (`,00` or `,0`); then drop it. Any other decimal part gives `None`.",
                   "What is left must be digits only: return it as an int. Empty text, `None`, letters or a minus sign give `None`."],
            "id": ["`text` adalah string atau `None`. Buang spasi di kedua ujung, lalu awalan `Rp` atau `IDR` (huruf apa pun) beserta spasi setelahnya.",
                   "Titik adalah pemisah ribuan: buang. Koma memulai bagian desimal.",
                   "Di sini rupiah tidak punya sen: bagian desimal hanya boleh jika semuanya nol (`,00` atau `,0`); lalu buang. Bagian desimal lain memberi `None`.",
                   "Sisanya harus hanya angka: kembalikan sebagai int. Teks kosong, `None`, huruf, atau tanda minus memberi `None`."]},
        "reference": '''def parse_idr(text):
    if not isinstance(text, str):
        return None
    s = text.strip()
    for prefix in ("idr", "rp"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):].strip()
            break
    s = s.replace(".", "")
    if "," in s:
        whole, decimals = s.split(",", 1)
        if decimals == "" or not decimals.isdigit() or int(decimals) != 0:
            return None
        s = whole
    if s == "" or not s.isdigit():
        return None
    return int(s)
''',
        "visible": [("1.500.000,00", 1500000), ("IDR 250.000", 250000), ("Rp 75.000,0", 75000), ("1500000", 1500000),
                    ("12.500,50", None), ("", None), (None, None), ("satu juta", None)],
        "hidden": ["IDR 0,00", "rp 3.000.000", "1,5", "-2.000", "  9.999  ", "Idr12.000,00", "7.000,", "RP 1.000,000", "abc,00", "45"],
    },
    "paynusa-w2": {
        "story": "paynusa", "n": 2, "module": "mod-0-0", "from": "fajar", "kind": "dict",
        "file": "warmup_paynusa_2.py", "fn": "daily_success_totals", "sig": "daily_success_totals(transactions) -> dict",
        "title": T("Total transaksi sukses per hari", "Successful transactions per day"),
        "brief": T("Treasury ingin total nominal transaksi yang sukses per tanggal. Transaksi gagal atau pending tidak boleh ikut dihitung, dan statusnya kadang ditulis dengan huruf besar.",
                   "Treasury wants the total amount of successful transactions per date. Failed or pending transactions must not be counted, and the status is sometimes in capitals."),
        "rules": {
            "en": ["`transactions` is a list of dicts with keys `date` (text, `'2026-03-01'`), `status` and `amount_idr` (an int).",
                   "Only transactions whose `status`, after `.strip().lower()`, is `'success'` count.",
                   "Return a dict from date to the sum of `amount_idr` of its successful transactions.",
                   "A date with no successful transaction does not appear in the dict."],
            "id": ["`transactions` adalah list dict dengan kunci `date` (teks, `'2026-03-01'`), `status`, dan `amount_idr` (int).",
                   "Hanya transaksi yang `status`-nya, setelah `.strip().lower()`, adalah `'success'` yang dihitung.",
                   "Kembalikan dict dari tanggal ke jumlah `amount_idr` transaksi suksesnya.",
                   "Tanggal tanpa transaksi sukses tidak muncul di dict."]},
        "reference": '''def daily_success_totals(transactions):
    totals = {}
    for tx in transactions:
        if str(tx.get("status") or "").strip().lower() != "success":
            continue
        totals[tx["date"]] = totals.get(tx["date"], 0) + tx["amount_idr"]
    return totals
''',
        "visible": [([{"date": "2026-03-01", "status": "success", "amount_idr": 100000},
                      {"date": "2026-03-01", "status": "SUCCESS ", "amount_idr": 50000},
                      {"date": "2026-03-01", "status": "failed", "amount_idr": 999000},
                      {"date": "2026-03-02", "status": "pending", "amount_idr": 20000},
                      {"date": "2026-03-02", "status": "success", "amount_idr": 70000},
                      {"date": "2026-03-03", "status": "failed", "amount_idr": 10000}],
                     {"2026-03-01": 150000, "2026-03-02": 70000})],
        "hidden": [[{"date": "2026-04-10", "status": "Success", "amount_idr": 1},
                    {"date": "2026-04-09", "status": "success", "amount_idr": 25000},
                    {"date": "2026-04-10", "status": "pending", "amount_idr": 5000},
                    {"date": "2026-04-11", "status": None, "amount_idr": 7000},
                    {"date": "2026-04-09", "status": " success", "amount_idr": 5000},
                    {"date": "2026-04-12", "status": "failed", "amount_idr": 1}]],
    },
    "paynusa-w3": {
        "story": "paynusa", "n": 3, "module": "mod-0-3", "from": "putri", "kind": "sql",
        "file": "warmup_paynusa_3.py", "fn": "merchants_with_failures_sql", "sig": "merchants_with_failures_sql() -> str",
        "title": T("Merchant yang sering gagal", "Merchants that keep failing"),
        "brief": T("Tim risiko ingin daftar merchant yang transaksinya gagal dua kali atau lebih. Satu kegagalan biasa; dua atau lebih perlu dicek.",
                   "The risk team wants the merchants whose transactions failed two or more times. One failure is normal; two or more needs a look."),
        "tables": {"transactions": ["tx_id TEXT", "merchant_id TEXT", "status TEXT", "amount_idr INTEGER"]},
        "rules": {
            "en": ["Return the text of ONE SQL query (SQLite) on `transactions(tx_id, merchant_id, status, amount_idr)`.",
                   "Count, per merchant, the transactions whose `status` is `'failed'`.",
                   "Keep only merchants with at least 2 failed transactions. Columns: `merchant_id`, `failures`.",
                   "Order by `failures` from high to low; on a tie, by `merchant_id` A to Z."],
            "id": ["Kembalikan teks SATU query SQL (SQLite) pada `transactions(tx_id, merchant_id, status, amount_idr)`.",
                   "Hitung, per merchant, transaksi yang `status`-nya `'failed'`.",
                   "Pertahankan hanya merchant dengan minimal 2 transaksi gagal. Kolom: `merchant_id`, `failures`.",
                   "Urutkan berdasarkan `failures` dari besar ke kecil; jika sama, berdasarkan `merchant_id` A ke Z."]},
        "reference": '''def merchants_with_failures_sql():
    return """
        SELECT merchant_id, COUNT(*) AS failures
        FROM transactions
        WHERE status = 'failed'
        GROUP BY merchant_id
        HAVING COUNT(*) >= 2
        ORDER BY failures DESC, merchant_id
    """
''',
        "visible": {"transactions": [("T1", "M1", "failed", 1000), ("T2", "M1", "failed", 2000), ("T3", "M1", "success", 3000),
                                     ("T4", "M2", "failed", 1000), ("T5", "M2", "success", 5000), ("T6", "M3", "failed", 100),
                                     ("T7", "M3", "failed", 100), ("T8", "M3", "failed", 100)]},
        "visible_expected": [("M3", 3), ("M1", 2)],
        "hidden": {"transactions": [("X1", "Z9", "failed", 1), ("X2", "Z9", "failed", 1), ("X3", "A1", "failed", 1),
                                    ("X4", "A1", "failed", 1), ("X5", "B2", "failed", 1), ("X6", "B2", "success", 1),
                                    ("X7", "C3", "success", 1), ("X8", "C3", "success", 1)]},
    },
    # ------------------------------------------------------------------ GoKirim
    "gokirim-w1": {
        "story": "gokirim", "n": 1, "module": "mod-0-0", "from": "agus", "kind": "value",
        "file": "warmup_gokirim_1.py", "fn": "is_valid_ping", "sig": "is_valid_ping(ping) -> bool",
        "title": T("Koordinat yang mustahil", "Impossible coordinates"),
        "brief": T("Sebagian GPS kurir mengirim koordinat yang tidak mungkin ada di bumi. Sebelum masuk peta, setiap titik harus dicek dulu.",
                   "Some couriers' GPS units send coordinates that cannot exist on Earth. Before anything reaches the map, every point has to be checked."),
        "rules": {
            "en": ["`ping` is a dict with keys `lat` and `lon` (either may be missing or `None`).",
                   "A ping is valid when both are numbers (`int` or `float`, but not `True`/`False` and not text such as `'6.2'`).",
                   "...and `lat` is between -90 and 90, and `lon` is between -180 and 180, both ends included.",
                   "Return `True` for a valid ping, `False` otherwise."],
            "id": ["`ping` adalah dict dengan kunci `lat` dan `lon` (salah satunya bisa tidak ada atau `None`).",
                   "Ping valid jika keduanya angka (`int` atau `float`, tetapi bukan `True`/`False` dan bukan teks seperti `'6.2'`).",
                   "...dan `lat` di antara -90 dan 90, serta `lon` di antara -180 dan 180, kedua ujung termasuk.",
                   "Kembalikan `True` untuk ping valid, `False` jika tidak."]},
        "reference": '''def is_valid_ping(ping):
    lat, lon = ping.get("lat"), ping.get("lon")
    for v in (lat, lon):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return False
    return -90 <= lat <= 90 and -180 <= lon <= 180
''',
        "visible": [({"lat": -6.2, "lon": 106.8}, True), ({"lat": 999.0, "lon": 106.8}, False), ({"lat": -6.2}, False),
                    ({"lat": "6.2", "lon": "106.8"}, False), ({"lat": 90, "lon": -180}, True), ({"lat": None, "lon": 1}, False)],
        "hidden": [{"lat": 0, "lon": 0}, {"lat": -90.0, "lon": 180.0}, {"lat": 90.0001, "lon": 0}, {"lat": 10, "lon": -180.5},
                   {"lat": True, "lon": 5}, {}, {"lat": 3.5, "lon": 98.6}, {"lat": -8.65, "lon": "115.2"}],
    },
    "gokirim-w2": {
        "story": "gokirim", "n": 2, "module": "mod-0-0", "from": "yuli", "kind": "dict",
        "file": "warmup_gokirim_2.py", "fn": "delivered_per_courier", "sig": "delivered_per_courier(stops) -> dict",
        "title": T("Paket terkirim per kurir", "Parcels delivered per courier"),
        "brief": T("Insentif kurir dihitung dari jumlah paket yang benar-benar terkirim. Kurir yang hari ini belum mengirim apa pun tetap harus muncul dengan angka nol, kalau tidak, ia dikira tidak bekerja.",
                   "Courier bonuses are based on parcels actually delivered. A courier who delivered nothing today must still appear with zero; otherwise it looks as if they did not work."),
        "rules": {
            "en": ["`stops` is a list of dicts with keys `courier_id` and `status`.",
                   "Skip stops whose `courier_id` is missing, `None` or empty.",
                   "Count, per courier, the stops whose `status` after `.strip().lower()` is `'delivered'`.",
                   "Every courier that appears in `stops` is in the result, with `0` if none of their stops was delivered. Return a dict from courier to count."],
            "id": ["`stops` adalah list dict dengan kunci `courier_id` dan `status`.",
                   "Lewati stop yang `courier_id`-nya tidak ada, `None`, atau kosong.",
                   "Hitung, per kurir, stop yang `status`-nya setelah `.strip().lower()` adalah `'delivered'`.",
                   "Setiap kurir yang muncul di `stops` ada di hasil, dengan `0` jika tidak ada stop-nya yang terkirim. Kembalikan dict dari kurir ke jumlah."]},
        "reference": '''def delivered_per_courier(stops):
    counts = {}
    for stop in stops:
        courier = stop.get("courier_id")
        if not courier:
            continue
        counts.setdefault(courier, 0)
        if str(stop.get("status") or "").strip().lower() == "delivered":
            counts[courier] += 1
    return counts
''',
        "visible": [([{"courier_id": "C1", "status": "delivered"}, {"courier_id": "C1", "status": "Delivered "},
                      {"courier_id": "C2", "status": "failed"}, {"courier_id": "", "status": "delivered"},
                      {"courier_id": "C3", "status": "DELIVERED"}, {"status": "delivered"}],
                     {"C1": 2, "C2": 0, "C3": 1})],
        "hidden": [[{"courier_id": "K7", "status": "returned"}, {"courier_id": "K7", "status": None},
                    {"courier_id": None, "status": "delivered"}, {"courier_id": "K1", "status": " delivered"},
                    {"courier_id": "K1", "status": "delivered"}, {"courier_id": "K1", "status": "in transit"},
                    {"courier_id": "K9", "status": "Delivered"}]],
    },
    "gokirim-w3": {
        "story": "gokirim", "n": 3, "module": "mod-0-3", "from": "rizky", "kind": "sql",
        "file": "warmup_gokirim_3.py", "fn": "late_by_city_sql", "sig": "late_by_city_sql() -> str",
        "title": T("Pengiriman terlambat per kota", "Late deliveries per city"),
        "brief": T("Saya mau lihat per kota: berapa pengiriman yang sudah selesai, dan berapa yang terlambat dari janji. Pengiriman yang belum selesai belum punya waktu aktual, jadi jangan dihitung.",
                   "Per city I want to see how many deliveries finished, and how many were later than promised. Deliveries still on the road have no actual time yet, so leave them out."),
        "tables": {"deliveries": ["delivery_id TEXT", "city TEXT", "promised_min INTEGER", "actual_min INTEGER"]},
        "rules": {
            "en": ["Return the text of ONE SQL query (SQLite) on `deliveries(delivery_id, city, promised_min, actual_min)`.",
                   "Ignore deliveries whose `actual_min` is NULL (not finished yet).",
                   "Columns: `city`, `deliveries` (finished deliveries) and `late` (finished deliveries with `actual_min` greater than `promised_min`). A city with no finished delivery does not appear.",
                   "Order by `city` A to Z."],
            "id": ["Kembalikan teks SATU query SQL (SQLite) pada `deliveries(delivery_id, city, promised_min, actual_min)`.",
                   "Abaikan pengiriman yang `actual_min`-nya NULL (belum selesai).",
                   "Kolom: `city`, `deliveries` (pengiriman selesai), dan `late` (pengiriman selesai dengan `actual_min` lebih besar dari `promised_min`). Kota tanpa pengiriman selesai tidak muncul.",
                   "Urutkan berdasarkan `city` A ke Z."]},
        "reference": '''def late_by_city_sql():
    return """
        SELECT city,
               COUNT(*) AS deliveries,
               SUM(CASE WHEN actual_min > promised_min THEN 1 ELSE 0 END) AS late
        FROM deliveries
        WHERE actual_min IS NOT NULL
        GROUP BY city
        ORDER BY city
    """
''',
        "visible": {"deliveries": [("D1", "Surabaya", 60, 55), ("D2", "Surabaya", 60, 75), ("D3", "Surabaya", 45, None),
                                   ("D4", "Malang", 90, 90), ("D5", "Malang", 30, 31), ("D6", "Kediri", 40, None)]},
        "visible_expected": [("Malang", 2, 1), ("Surabaya", 2, 1)],
        "hidden": {"deliveries": [("E1", "Denpasar", 30, 20), ("E2", "Denpasar", 30, 30), ("E3", "Ambon", 120, 200),
                                  ("E4", "Ambon", 120, None), ("E5", "Jayapura", 60, None), ("E6", "Bandung", 45, 46),
                                  ("E7", "Bandung", 45, 47), ("E8", "Ambon", 100, 99)]},
    },
    # ------------------------------------------------------------------ CloudPulse
    "cloudpulse-w1": {
        "story": "cloudpulse", "n": 1, "module": "mod-0-0", "from": "dimas", "kind": "value",
        "file": "warmup_cloudpulse_1.py", "fn": "normalize_nik", "sig": "normalize_nik(text) -> str | None",
        "title": T("NIK yang ditulis berbeda-beda", "NIKs written in different ways"),
        "brief": T("Klinik mengetik NIK pasien dengan spasi, titik, atau tanda hubung. Supaya pasien yang sama bisa dicocokkan, semua NIK harus disimpan dalam satu bentuk.",
                   "Clinics type patient NIKs with spaces, dots or dashes. To match the same patient across systems, every NIK must be stored in one form."),
        "rules": {
            "en": ["`text` is a string or `None`. An Indonesian NIK has exactly 16 digits.",
                   "Remove every space, dot and dash (`-`) anywhere in the text.",
                   "If what is left is exactly 16 digits, return it as a string (keep leading zeros).",
                   "Otherwise (`None`, letters, too few or too many digits) return `None`."],
            "id": ["`text` adalah string atau `None`. NIK Indonesia terdiri dari tepat 16 angka.",
                   "Buang semua spasi, titik, dan tanda hubung (`-`) di mana pun dalam teks.",
                   "Jika sisanya tepat 16 angka, kembalikan sebagai string (pertahankan nol di depan).",
                   "Selain itu (`None`, huruf, angka terlalu sedikit atau terlalu banyak) kembalikan `None`."]},
        "reference": '''def normalize_nik(text):
    if not isinstance(text, str):
        return None
    digits = text.replace(" ", "").replace(".", "").replace("-", "")
    if len(digits) == 16 and digits.isdigit():
        return digits
    return None
''',
        "visible": [("3273 0101 0190 0001", "3273010101900001"), ("3273.0101.0190.0001", "3273010101900001"),
                    ("3273-010101-900001", "3273010101900001"), ("327301010190000", None), (None, None), ("32730101019000AB", None)],
        "hidden": ["0102030405060708", " 0102-0304-0506-0708 ", "12345678901234567", "", "1234 5678 9012 345X", "9.9.9.9.9.9.9.9.9.9.9.9.9.9.9.9"],
    },
    "cloudpulse-w2": {
        "story": "cloudpulse", "n": 2, "module": "mod-0-0", "from": "ratna", "kind": "dict",
        "file": "warmup_cloudpulse_2.py", "fn": "unique_visits_per_clinic", "sig": "unique_visits_per_clinic(visits) -> dict",
        "title": T("Kunjungan per klinik, tanpa duplikat", "Visits per clinic, without duplicates"),
        "brief": T("Sistem klinik kadang mengirim kunjungan yang sama dua kali. Saya butuh jumlah kunjungan per klinik, dan satu kunjungan hanya boleh dihitung sekali.",
                   "The clinic systems sometimes send the same visit twice. I need the number of visits per clinic, and each visit must count only once."),
        "rules": {
            "en": ["`visits` is a list of dicts with keys `visit_id` and `clinic_id`.",
                   "Skip rows where either is missing, `None` or empty.",
                   "The same `visit_id` can appear more than once: count it once per clinic.",
                   "Return a dict from clinic to the number of distinct visits."],
            "id": ["`visits` adalah list dict dengan kunci `visit_id` dan `clinic_id`.",
                   "Lewati baris yang salah satunya tidak ada, `None`, atau kosong.",
                   "`visit_id` yang sama bisa muncul lebih dari sekali: hitung sekali per klinik.",
                   "Kembalikan dict dari klinik ke jumlah kunjungan yang berbeda."]},
        "reference": '''def unique_visits_per_clinic(visits):
    seen = {}
    for v in visits:
        visit, clinic = v.get("visit_id"), v.get("clinic_id")
        if not visit or not clinic:
            continue
        seen.setdefault(clinic, set()).add(visit)
    return {clinic: len(ids) for clinic, ids in seen.items()}
''',
        "visible": [([{"visit_id": "V1", "clinic_id": "K1"}, {"visit_id": "V1", "clinic_id": "K1"}, {"visit_id": "V2", "clinic_id": "K1"},
                      {"visit_id": "V3", "clinic_id": "K2"}, {"visit_id": "", "clinic_id": "K2"}, {"visit_id": "V4"}],
                     {"K1": 2, "K2": 1})],
        "hidden": [[{"visit_id": "A", "clinic_id": "Z"}, {"visit_id": "A", "clinic_id": "Z"}, {"visit_id": "A", "clinic_id": "Z"},
                    {"visit_id": "B", "clinic_id": None}, {"visit_id": "C", "clinic_id": "Y"}, {"visit_id": "D", "clinic_id": "Y"},
                    {"clinic_id": "Y"}, {"visit_id": "C", "clinic_id": "Y"}]],
    },
    "cloudpulse-w3": {
        "story": "cloudpulse", "n": 3, "module": "mod-0-3", "from": "kevin", "kind": "sql",
        "file": "warmup_cloudpulse_3.py", "fn": "patients_without_2026_visit_sql", "sig": "patients_without_2026_visit_sql() -> str",
        "title": T("Pasien yang belum kembali tahun ini", "Patients who have not come back this year"),
        "brief": T("Tim klinis ingin menghubungi pasien yang belum berkunjung sama sekali sejak 1 Januari 2026. Hati-hati: sebagian kunjungan adalah pasien walk-in yang belum terdaftar, jadi `patient_id`-nya kosong.",
                   "The clinical team wants to contact patients with no visit at all since 1 January 2026. Careful: some visits are walk-ins who are not registered yet, so their `patient_id` is empty."),
        "tables": {"patients": ["patient_id INTEGER", "name TEXT"], "visits": ["visit_id TEXT", "patient_id INTEGER", "visit_date TEXT"]},
        "rules": {
            "en": ["Return the text of ONE SQL query (SQLite) on `patients(patient_id, name)` and `visits(visit_id, patient_id, visit_date)`; dates are text like `'2026-02-14'`.",
                   "A patient counts as visited when they have at least one visit with `visit_date` on or after `'2026-01-01'`.",
                   "Return the patients who have NOT visited, with columns `patient_id` and `name`, ordered by `patient_id`.",
                   "Some visits have `patient_id` NULL (walk-ins). They belong to no patient, and must not change who appears."],
            "id": ["Kembalikan teks SATU query SQL (SQLite) pada `patients(patient_id, name)` dan `visits(visit_id, patient_id, visit_date)`; tanggal berupa teks seperti `'2026-02-14'`.",
                   "Pasien dianggap sudah berkunjung jika punya minimal satu kunjungan dengan `visit_date` pada atau setelah `'2026-01-01'`.",
                   "Kembalikan pasien yang BELUM berkunjung, dengan kolom `patient_id` dan `name`, urut berdasarkan `patient_id`.",
                   "Sebagian kunjungan punya `patient_id` NULL (walk-in). Mereka bukan milik pasien mana pun, dan tidak boleh mengubah siapa yang muncul."]},
        "reference": '''def patients_without_2026_visit_sql():
    return """
        SELECT p.patient_id, p.name
        FROM patients AS p
        WHERE NOT EXISTS (
            SELECT 1 FROM visits AS v
            WHERE v.patient_id = p.patient_id
              AND v.visit_date >= '2026-01-01'
        )
        ORDER BY p.patient_id
    """
''',
        "visible": {"patients": [(1, "Budi"), (2, "Sari"), (3, "Andi"), (4, "Rina")],
                    "visits": [("V1", 1, "2026-02-14"), ("V2", 2, "2025-12-30"), ("V3", 2, "2026-01-01"), ("V4", 3, "2025-06-01"),
                               ("V5", None, "2026-03-03")]},
        "visible_expected": [(3, "Andi"), (4, "Rina")],
        "hidden": {"patients": [(10, "Dewi"), (11, "Agus"), (12, "Made"), (13, "Yuli"), (14, "Kevin")],
                   "visits": [("W1", None, "2026-01-05"), ("W2", 11, "2025-12-31"), ("W3", 12, "2026-07-01"), ("W4", 12, "2024-01-01"),
                              ("W5", 14, "2026-01-01"), ("W6", None, "2025-01-01"), ("W7", 99, "2026-02-02")]},
    },
}


# ------------------------------------------------------------------------------------------ helpers

def starter(mid):
    t = TASKS[mid]
    rules = "\n".join(f"{i}. {r.replace('`', '')}" for i, r in enumerate(t["rules"]["en"], 1))
    args = t["sig"].split("(", 1)[1].split(")", 1)[0]
    extra = ""
    if t["kind"] == "sql":
        tables = "\n".join(f"  {name}({', '.join(c.split()[0] for c in cols)})" for name, cols in t["tables"].items())
        extra = f"\nTables:\n{tables}\n\nWrite the query as text and return it; the checker runs it on SQLite.\n"
    return (f'"""Warm-up task {mid}: {t["title"]["en"]}\n\nThe rules (also on the ticket):\n\n{rules}\n{extra}"""\n\n\n'
            f"def {t['fn']}({args}):\n    raise NotImplementedError(\"TODO: write this function from the rules above\")\n")


def _run_sql(sql, tables_spec, data):
    con = sqlite3.connect(":memory:")
    try:
        for name, cols in tables_spec.items():
            con.execute(f"CREATE TABLE {name} ({', '.join(cols)})")
            rows = data.get(name, [])
            if rows:
                con.executemany(f"INSERT INTO {name} VALUES ({', '.join('?' * len(cols))})", rows)
        return [tuple(r) for r in con.execute(sql).fetchall()]
    finally:
        con.close()


def apply(mid, fn, dataset):
    """Run fn on a dataset the way the task defines it; returns a JSON-comparable result."""
    t = TASKS[mid]
    if t["kind"] == "value":
        return [fn(x) for x in dataset]
    if t["kind"] == "dict":
        return fn(dataset)
    sql = fn()
    if not isinstance(sql, str) or not sql.strip():
        raise AssertionError(f"{t['fn']}() must return the SQL query as text")
    return _run_sql(sql, t["tables"], dataset)


def visible_checks(mid, fn):
    """(passed, details); raises AssertionError listing the failed checks."""
    t = TASKS[mid]
    ok, errors = [], []

    def check(cond, desc, got=None):
        (ok.append(desc) if cond else errors.append(f"FAIL: {desc}" + (f"\n      got: {got!r}" if got is not None or not cond else "")))

    def safe(f, *a):
        try:
            return f(*a), None
        except Exception as e:  # noqa: BLE001 - a crash is a failed check, with the reason
            return None, f"{type(e).__name__}: {e}"

    if t["kind"] == "value":
        for given, want in t["visible"]:
            got, err = safe(fn, given)
            check(err is None and got == want and type(got) is type(want), f"{t['fn']}({given!r}) returns {want!r}", err or got)
    elif t["kind"] == "dict":
        for given, want in t["visible"]:
            got, err = safe(fn, given)
            if err:
                errors.append(f"FAIL: {t['fn']} crashed on the example data: {err}")
                continue
            check(isinstance(got, dict), "returns a dict", got)
            if isinstance(got, dict):
                for k, v in want.items():
                    check(got.get(k) == v, f"{k!r} is {v}", got.get(k))
                extra = sorted(set(got) - set(want), key=str)
                check(not extra, "no other keys", extra or None)
    else:
        got, err = safe(apply, mid, fn, t["visible"])
        if err:
            errors.append(f"FAIL: the query does not run on the example tables: {err}")
        else:
            want = t["visible_expected"]
            cols = len(want[0]) if want else 0
            check(all(len(r) == cols for r in got), f"returns {cols} columns", got[:1] or None)
            check(sorted(got) == sorted(want), "returns the right rows", got)
            check(got == want, "in the right order", got)
    if errors:
        raise AssertionError("\n".join(errors))
    return len(ok), ok


def hidden_diffs(mid, fn, ref_fn):
    """Compare fn with the reference on the hidden dataset; [] when they agree."""
    import copy
    t = TASKS[mid]
    datasets = t["hidden"] if t["kind"] == "dict" else [t["hidden"]]   # "dict" tasks list one or more row lists
    for data in datasets:
        expected = apply(mid, ref_fn, copy.deepcopy(data))
        try:
            got = apply(mid, fn, copy.deepcopy(data))
        except Exception as e:  # noqa: BLE001
            return [f"FAIL: hidden dataset crashed your code: {type(e).__name__}: {e}"]
        if json.dumps(got, sort_keys=True, default=str) != json.dumps(expected, sort_keys=True, default=str):
            return ["FAIL: hidden dataset: your result differs from the expected one (re-read every rule; the example data does not cover every case)"]
    return []


def sql_cheat(mid):
    """A 'solution' that returns the visible answer as literal rows: it must fail on the hidden data."""
    rows = TASKS[mid]["visible_expected"]
    values = ", ".join("(" + ", ".join(repr(v) for v in r) + ")" for r in rows)
    return f"def {TASKS[mid]['fn']}():\n    return \"VALUES {values}\"\n"


def js_text():
    out = {}
    for mid, t in TASKS.items():
        out.setdefault(t["story"], []).append({
            "missionId": mid, "n": t["n"], "module": t["module"], "from": t["from"], "title": t["title"], "brief": t["brief"],
            "spec": {"file": t["file"], "functionSig": t["sig"], "rules": t["rules"], "starterCode": starter(mid)},
        })
    body = json.dumps(out, ensure_ascii=False, indent=1)
    return ("/* Generated by scripts/job_sim_warmup.py --write-js. Do not edit by hand: edit the Python file and regenerate.\n"
            "   The warm-up week of the job simulator: three small tasks per company for Level 0 (reference solutions\n"
            "   stay in the Python file and are not shipped to the browser). */\n"
            f"window.JOB_SIM_WARMUP = {body};\n")


if __name__ == "__main__":
    if "--write-js" in sys.argv:
        JS_PATH.write_text(js_text(), encoding="utf-8")
        print(f"wrote {JS_PATH.relative_to(ROOT)} ({len(TASKS)} tasks)")
    elif "--check-js" in sys.argv:
        same = JS_PATH.exists() and JS_PATH.read_text(encoding="utf-8") == js_text()
        print("job-sim-warmup.js is up to date" if same else "job-sim-warmup.js is OUT OF DATE: run python3 scripts/job_sim_warmup.py --write-js")
        sys.exit(0 if same else 1)
    else:
        print(__doc__)
