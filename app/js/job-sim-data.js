// Real-Life Data Engineer Job Simulator — 4 Distinct Industry Stories × 4 Difficulty Levels (16 Production Missions)
// Grounded in O'Reilly's "Fundamentals of Data Engineering" (Reis & Housley), 1,130 TalentHub DE postings,
// DataTalksClub Zoomcamp, DataEngineering101 and the Google Business Intelligence certificate.

window.JOB_SIM_DATA = {
  stories: [
    {
      id: "kopiku",
      icon: "☕",
      badge: { id: "Cerita 1 · Retail & E-Commerce", en: "Story 1 · Retail & E-Commerce" },
      title: { id: "KopiKu Roastery & Omni-Channel Retail", en: "KopiKu Roastery & Omni-Channel Retail" },
      companyProfile: {
        id: "120 cabang kafe + aplikasi pesan-antar mobile (18 juta transaksi, PostgreSQL OLTP → BigQuery / Databricks Lakehouse).",
        en: "120 café branches + mobile ordering app (18M transactions, PostgreSQL OLTP → BigQuery / Databricks Lakehouse)."
      },
      summary: {
        id: "Bangun platform data retail dari nol: selamatkan database kasir yang macet setiap Senin pagi, rancang Star Schema & SCD Type 2 di Cloud Warehouse, atasi data skew saat Flash Sale 11.11 dengan Kafka CDC & Spark Salting, hingga pangkas tagihan BigQuery $38.000/bulan dan amankan portal franchise multi-tenant.",
        en: "Build a retail data platform from scratch: rescue a checkout DB that crashes every Monday morning, architect a Cloud Warehouse Star Schema & SCD Type 2, survive the 11.11 Flash Sale with Kafka CDC & Spark Key Salting, and slash a $38,000/mo BigQuery bill while securing a multi-tenant franchise portal."
      },
      starResumeBullets: [
        "Architected an idempotent Python & Pydantic ingestion gate with Dead-Letter Quarantine (DLQ) and integer-Rupiah normalization across 120 retail branches, eliminating 100% of float rounding drift and OLTP reporting lockups.",
        "Designed a date-partitioned, store-clustered BigQuery Kimball Star Schema with SCD Type 2 store/customer history, a unified Semantic Revenue Layer, and watermark-driven Reverse ETL CRM syncs scanning <4% of table bytes.",
        "Engineered a low-latency Debezium WAL CDC to Delta Lake/Iceberg pipeline (`QUALIFY ROW_NUMBER() = 1` by LSN) and resolved a 42:1 Apache Spark 11.11 flash-sale executor straggler down to <1.4:1 via 8-way key salting.",
        "Reduced monthly cloud warehouse spend by 78% ($38k to $8.2k/mo) using partition filter enforcement and pre-aggregated BI rollup marts while enforcing zero-leakage Multi-Tenant Row-Level Security (RLS) across 85 franchise partners."
      ],
      levels: [
        {
          level: "easy",
          missionId: "kopiku-easy",
          difficultyBadge: { id: "🟢 Level 1: EASY (Junior DE · Hari ke-1)", en: "🟢 Level 1: EASY (Junior DE · Day 1)" },
          title: {
            id: "Misi 1.1: Database Kasir Macet Senin Pukul 09.00 &Kekacauan CSV 120 Cabang",
            en: "Mission 1.1: The Monday 09:00 AM Checkout Crash & 120-Branch CSV Chaos"
          },
          lifecycle: "Generation → Ingestion → Storage",
          undercurrents: ["Software Engineering", "DataOps", "Data Management"],
          incidentTicket: {
            from: "CTO & VP of Operations (#incident-checkout-p1)",
            sla: { id: "Harian sebelum 06:00 WIB · 0% selisih uang · Idempoten saat di-rerun", en: "Daily by 06:00 WIB · 0% money drift · Idempotent on re-run" },
            brief: {
              id: "Setiap Senin pukul 09.00, tim Marketing menjalankan query analitik berat langsung di PostgreSQL kasir utama hingga aplikasi kasir freeze 22 menit. Selain itu, 120 cabang mengunggah CSV harian dengan format harga campuran ('Rp 25.000', '25000.00', nilai negatif), kode promo NULL, dan duplikat pengiriman ulang.",
              en: "Every Monday at 09:00 AM, Marketing runs heavy analytical queries directly against the primary checkout PostgreSQL DB, freezing café registers for 22 minutes. Meanwhile, 120 branches upload daily CSVs with mixed currency strings ('Rp 25.000', '25000.00', negative totals), NULL promo codes, and duplicate retry rows."
            }
          },
          padmGate: {
            question: {
              id: "Sebelum menulis kode (siklus hidup Reis & Housley), arsitektur dan kontrak grain mana yang paling tepat untuk menyelesaikan insiden ini sesuai anggaran?",
              en: "Before writing code (Reis & Housley lifecycle), which architecture and grain contract best resolves this incident within budget?"
            },
            options: [
              {
                text: {
                  id: "A. Pasang klaster Apache Kafka + Flink 24/7 di semua 120 cabang dan biarkan analis tetap men-query database kasir utama dengan indeks tambahan.",
                  en: "A. Deploy a 24/7 Apache Kafka + Flink cluster across all 120 cafés and let analysts keep querying the primary checkout DB with extra indexes."
                },
                correct: false,
                feedback: {
                  id: "❌ Over-engineered & berbahaya: SLA bisnis hanya butuh laporan harian pukul 06.00 pagi. Membiarkan query analitik berat di DB kasir OLTP tetap akan mengunci transaksi pelanggan.",
                  en: "❌ Over-engineered & dangerous: The business SLA only requires daily data by 06:00 AM. Keeping heavy analytical scans on the primary OLTP checkout DB still risks lock contention."
                }
              },
              {
                text: {
                  id: "B. Pisahkan beban analitik dari OLTP ke staging kolumnar (Parquet/DuckDB), tetapkan grain 1 baris per order_id unik (status terbaru), normalisasi harga ke integer Rupiah, karantina baris rusak ke DLQ JSONL, dan ganti partisi tanggal secara idempoten.",
                  en: "B. Offload analytics from OLTP to a columnar staging layer (Parquet/DuckDB), lock grain at 1 row per unique order_id (latest updated_at), normalize money to integer Rupiah, route malformed rows to a JSONL DLQ, and replace daily partitions idempotently."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Memisahkan OLTP dari OLAP melindungi kasir, integer Rupiah mencegah selisih pecahan float, DLQ menjaga pipeline tidak mati karena 1 baris kotor, dan deduplikasi (order_id, updated_at) menjamin sifat idempoten.",
                  en: "✅ Spot on! Separating OLTP from OLAP protects checkout, integer Rupiah eliminates float drift, a DLQ prevents 1 bad row from halting the batch, and deduplicating by (order_id, updated_at) guarantees idempotency."
                }
              },
              {
                text: {
                  id: "C. Gunakan pd.to_numeric(errors='coerce') untuk mengubah harga rusak menjadi 0.0 float dan jalankan INSERT INTO setiap pagi.",
                  en: "C. Use pd.to_numeric(errors='coerce') to turn malformed prices into 0.0 floats and run plain INSERT INTO every morning."
                },
                correct: false,
                feedback: {
                  id: "❌ Bug diam-diam fatal: errors='coerce' mengubah baris rusak menjadi Rp 0 tanpa peringatan (merusak rata-rata), float menimbulkan selisih sen, dan INSERT INTO polos menggandakan omzet saat job di-rerun.",
                  en: "❌ Fatal silent bug: errors='coerce' silently turns corrupt rows into Rp 0 (corrupting averages), floats introduce rounding drift, and plain INSERT INTO doubles revenue on any retry."
                }
              }
            ]
          },
          spec: {
            file: "mission_kopiku_easy.py",
            functionSig: "ingest_kopiku_daily(raw_rows: list[dict], batch_date: str) -> dict",
            rules: {
              id: [
                "Terima list dict `raw_rows` dengan kunci: `order_id`, `store_id`, `order_date`, `status`, `gross_raw`, `discount_raw`, `updated_at`.",
                "Hanya proses baris yang `order_date == batch_date`. Bersihkan string uang (misal `'Rp 25.000'`, `'25000'`, `25000`) menjadi integer Rupiah (`gross_idr`, `discount_idr`).",
                "Kirim ke `dlq` (`[{'order_id': ..., 'reason': ...}]`) jika: `order_id` atau `store_id` kosong (`'missing_key'`), uang gagal diurai atau `gross_idr <= 0` atau `discount_idr < 0` atau `discount_idr > gross_idr` (`'invalid_amount'`), atau `status.strip().lower()` tidak ada di `{'paid','shipped','delivered','refunded','cancelled'}` (`'invalid_status'`).",
                "Deduplikasi baris valid yang memiliki `order_id` sama dengan memilih `updated_at` terbesar (terbaru).",
                "Hitung `net_idr = gross_idr - discount_idr` HANYA untuk status aktif `{'paid', 'shipped', 'delivered'}` (untuk `'refunded'` atau `'cancelled'`, `net_idr = 0`). Kembalikan `{'clean_rows': [...urut order_id...], 'dlq': [...], 'total_net_idr': int}`."
              ],
              en: [
                "Accept a list of dicts `raw_rows` with keys: `order_id`, `store_id`, `order_date`, `status`, `gross_raw`, `discount_raw`, `updated_at`.",
                "Process only rows where `order_date == batch_date`. Parse currency strings (e.g. `'Rp 25.000'`, `'25000'`, `25000`) into integer Rupiah (`gross_idr`, `discount_idr`).",
                "Route to `dlq` (`[{'order_id': ..., 'reason': ...}]`) if: `order_id` or `store_id` is empty (`'missing_key'`), currency fails to parse or `gross_idr <= 0` or `discount_idr < 0` or `discount_idr > gross_idr` (`'invalid_amount'`), or `status.strip().lower()` is not in `{'paid','shipped','delivered','refunded','cancelled'}` (`'invalid_status'`).",
                "Deduplicate valid rows sharing the same `order_id` by keeping the one with the latest `updated_at` string.",
                "Compute `net_idr = gross_idr - discount_idr` ONLY for active statuses `{'paid', 'shipped', 'delivered'}` (for `'refunded'` or `'cancelled'`, `net_idr = 0`). Return `{'clean_rows': [...sorted by order_id...], 'dlq': [...], 'total_net_idr': int}`."
              ]
            },
            starterCode: `"""Mission kopiku-easy: Mission 1.1: The Monday 09:00 AM Checkout Crash & 120-Branch CSV Chaos

The rules (also on the mission page):

1. Accept a list of dicts raw_rows with keys: order_id, store_id, order_date, status,
   gross_raw, discount_raw, updated_at.
2. Process only rows where order_date == batch_date. Parse currency strings (e.g. 'Rp
   25.000', '25000', 25000) into integer Rupiah (gross_idr, discount_idr).
3. Route to dlq ([{'order_id': ..., 'reason': ...}]) if: order_id or store_id is empty
   ('missing_key'), currency fails to parse or gross_idr <= 0 or discount_idr < 0 or
   discount_idr > gross_idr ('invalid_amount'), or status.strip().lower() is not in
   {'paid','shipped','delivered','refunded','cancelled'} ('invalid_status').
4. Deduplicate valid rows sharing the same order_id by keeping the one with the latest
   updated_at string.
5. Compute net_idr = gross_idr - discount_idr ONLY for active statuses {'paid',
   'shipped', 'delivered'} (for 'refunded' or 'cancelled', net_idr = 0). Return
   {'clean_rows': [...sorted by order_id...], 'dlq': [...], 'total_net_idr': int}.

Check your work: python3 scripts/job_sim.py verify kopiku-easy <this folder>
"""


def ingest_kopiku_daily(raw_rows, batch_date):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `import re

VALID_STATUSES = {"paid", "shipped", "delivered", "refunded", "cancelled"}
ACTIVE_STATUSES = {"paid", "shipped", "delivered"}

def _parse_idr(val):
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, int):
        return val
    s = str(val).strip()
    s = re.sub(r"^[Rr][Pp]\\s*", "", s).replace(".", "").replace(",", "")
    if not re.match(r"^-?\\d+$", s):
        return None
    return int(s)

def ingest_kopiku_daily(raw_rows, batch_date):
    dedup, dlq = {}, []
    for r in raw_rows:
        if str(r.get("order_date", "")).strip() != str(batch_date).strip():
            continue
        oid = str(r.get("order_id") or "").strip()
        sid = str(r.get("store_id") or "").strip()
        if not oid or not sid:
            dlq.append({"order_id": oid or "UNKNOWN", "reason": "missing_key"})
            continue
        status = str(r.get("status") or "").strip().lower()
        if status not in VALID_STATUSES:
            dlq.append({"order_id": oid, "reason": "invalid_status"})
            continue
        gross = _parse_idr(r.get("gross_raw"))
        disc = _parse_idr(r.get("discount_raw", 0))
        if gross is None or disc is None or gross <= 0 or disc < 0 or disc > gross:
            dlq.append({"order_id": oid, "reason": "invalid_amount"})
            continue
        ts = str(r.get("updated_at") or "")
        net = (gross - disc) if status in ACTIVE_STATUSES else 0
        rec = {"order_id": oid, "store_id": sid, "order_date": batch_date, "status": status,
               "gross_idr": gross, "discount_idr": disc, "net_idr": net, "updated_at": ts}
        if oid not in dedup or ts >= dedup[oid]["updated_at"]:
            dedup[oid] = rec
    clean = [dedup[k] for k in sorted(dedup)]
    return {"clean_rows": clean, "dlq": dlq, "total_net_idr": sum(x["net_idr"] for x in clean)}`
          }
        },
        {
          level: "normal",
          missionId: "kopiku-normal",
          difficultyBadge: { id: "🟡 Level 2: NORMAL (Mid-Level DE · Cloud Warehouse & dbt)", en: "🟡 Level 2: NORMAL (Mid-Level DE · Cloud Warehouse & dbt)" },
          title: {
            id: "Misi 1.2: Cabang #14 Pindah Kota (Bug Overwrite SCD1) & Selisih ROAS 18%",
            en: "Mission 1.2: The Relocated Café Store #14 (SCD1 Overwrite Bug) & 18% ROAS Drift"
          },
          lifecycle: "Storage → Transformation → Serving",
          undercurrents: ["Data Architecture", "Data Management", "DataOps"],
          incidentTicket: {
            from: "VP of Finance & Head of Growth (#data-warehouse-alerts)",
            sla: { id: "Atribusi historis 100% akurat (SCD Type 2) · Satu rumus Semantic Net Revenue", en: "100% accurate point-in-time attribution (SCD Type 2) · Unified Semantic Net Revenue" },
            brief: {
              id: "Cabang Kafe #14 pindah dari Bandung ke Jakarta pada 15 Januari 2026. Karena pipeline lama memakai UPDATE langsung (SCD Type 1), seluruh pendapatan Bandung tahun 2025 mendadak berpindah menjadi pendapatan Jakarta di laporan tahunan! Selain itu, tim Marketing dan Finance berselisih 18% soal angka omzet karena Marketing lupa mengurangi pajak dan pesanan refund.",
              en: "Café Store #14 relocated from Bandung to Jakarta on 2026-01-15. Because the legacy script ran an in-place UPDATE (SCD Type 1), all of Bandung's 2025 historical revenue suddenly shifted to Jakarta in the annual board report! Meanwhile, Marketing and Finance revenue numbers disagree by 18% because Marketing's SQL forgets to exclude refunded orders and tax."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara memperbaiki atribusi kota historis sekaligus menyatukan angka Finance, BI, dan Reverse ETL CRM?",
              en: "How should you fix the historical city attribution while unifying Finance, BI, and Reverse ETL CRM numbers?"
            },
            options: [
              {
                text: {
                  id: "A. Buat tabel dim_store baru untuk setiap tahun (dim_store_2025, dim_store_2026) dan biarkan tiap tim menulis rumus pendapatan sendiri di Tableau.",
                  en: "A. Create a separate dim_store table for every year (dim_store_2025, dim_store_2026) and let each department write its own revenue formula in Tableau."
                },
                correct: false,
                feedback: {
                  id: "❌ Memecah tabel per tahun merusak query lintas tahun, dan membiarkan rumus tersebar di BI menjamin selisih 18% tetap terjadi.",
                  en: "❌ Splitting tables by year breaks cross-year queries, and keeping metric math inside BI dashboards guarantees the 18% metric drift continues."
                }
              },
              {
                text: {
                  id: "B. Bangun dimensi SCD Type 2 (valid_from, valid_to, is_current), lakukan point-in-time join (order_ts >= valid_from AND order_ts < valid_to), kunci satu definisi Semantic Layer net_revenue_idr, dan kirim delta Reverse ETL ber-kunci idempoten.",
                  en: "B. Build an SCD Type 2 store dimension (valid_from, valid_to, is_current), join orders point-in-time (order_ts >= valid_from AND order_ts < valid_to), codify one Semantic Layer net_revenue_idr metric, and emit watermarked Reverse ETL deltas."
                },
                correct: true,
                feedback: {
                  id: "✅ Sempurna! SCD Type 2 menjaga pesanan sebelum 15 Januari tetap tercatat di Bandung dan sejak 15 Januari di Jakarta, sementara Semantic Layer mengunci satu sumber kebenaran.",
                  en: "✅ Spot on! SCD Type 2 keeps pre-Jan-15 orders attributed to Bandung and Jan-15+ orders to Jakarta, while the Semantic Layer enforces a single source of truth."
                }
              },
              {
                text: {
                  id: "C. Join fact_orders ke dim_store dengan WHERE dim_store.is_current = TRUE untuk semua laporan historis.",
                  en: "C. Join fact_orders to dim_store using WHERE dim_store.is_current = TRUE for all historical reports."
                },
                correct: false,
                feedback: {
                  id: "❌ Jebakan klasik SCD2! Memfilter is_current = TRUE saat menghitung laporan historis sama saja dengan kembali ke SCD Type 1 (mengatribusikan masa lalu ke kota hari ini).",
                  en: "❌ Classic SCD2 trap! Filtering is_current = TRUE on historical fact rows attributes past orders to today's city—recreating the exact SCD Type 1 bug."
                }
              }
            ]
          },
          spec: {
            file: "mission_kopiku_normal.py",
            functionSig: "attribute_scd2_and_rollup(orders: list[dict], store_changes: list[dict]) -> dict",
            rules: {
              id: [
                "`store_changes` berisi riwayat perubahan cabang: `[{'store_id': 'S14', 'city': 'Bandung', 'effective_from': '2025-01-01'}, {'store_id': 'S14', 'city': 'Jakarta', 'effective_from': '2026-01-15'}]`.",
                "Bangun baris `scd2_dim_store` terurut `(store_id, valid_from)` dengan kunci: `store_id`, `city`, `valid_from`, `valid_to` (tanggal `effective_from` versi berikutnya untuk cabang tersebut, atau `'9999-12-31'` jika versi terakhir), dan `is_current` (`True` hanya pada versi terakhir).",
                "Untuk setiap pesanan di `orders` (`order_id`, `store_id`, `order_date`, `status`, `gross_idr`, `discount_idr`, `tax_idr`), hitung Semantic `net_revenue_idr = gross_idr - discount_idr - tax_idr` hanya jika `status.strip().lower() in {'paid', 'shipped', 'delivered'}` (selain itu `0`).",
                "Lakukan **Point-in-Time Join** (`valid_from <= order_date < valid_to`) untuk menemukan kota cabang pada detik pesanan terjadi (jika tidak cocok, gunakan `'Unknown'`).",
                "Kembalikan `{'scd2_dim_store': [...], 'revenue_by_historical_city': {city: total_net_idr}, 'naive_current_city_revenue': {city: total_net_idr}}` (di mana `naive_current_city_revenue` menunjukkan angka yang salah jika memakai kota `is_current=True`)."
              ],
              en: [
                "`store_changes` contains store history events: `[{'store_id': 'S14', 'city': 'Bandung', 'effective_from': '2025-01-01'}, {'store_id': 'S14', 'city': 'Jakarta', 'effective_from': '2026-01-15'}]`.",
                "Build `scd2_dim_store` sorted by `(store_id, valid_from)` with keys: `store_id`, `city`, `valid_from`, `valid_to` (the `effective_from` of the next version for that store, or `'9999-12-31'` for the latest), and `is_current` (`True` only on the latest version).",
                "For each order in `orders` (`order_id`, `store_id`, `order_date`, `status`, `gross_idr`, `discount_idr`, `tax_idr`), compute Semantic `net_revenue_idr = gross_idr - discount_idr - tax_idr` strictly when `status.strip().lower() in {'paid', 'shipped', 'delivered'}` (otherwise `0`).",
                "Perform a **Point-in-Time Join** (`valid_from <= order_date < valid_to`) to attribute each order to the store's city on `order_date` (fallback `'Unknown'`).",
                "Return `{'scd2_dim_store': [...], 'revenue_by_historical_city': {city: total_net_idr}, 'naive_current_city_revenue': {city: total_net_idr}}` (where `naive_current_city_revenue` shows what a broken `is_current=True` join would report)."
              ]
            },
            starterCode: `"""Mission kopiku-normal: Mission 1.2: The Relocated Café Store #14 (SCD1 Overwrite Bug) & 18% ROAS Drift

The rules (also on the mission page):

1. store_changes contains store history events: [{'store_id': 'S14', 'city': 'Bandung',
   'effective_from': '2025-01-01'}, {'store_id': 'S14', 'city': 'Jakarta',
   'effective_from': '2026-01-15'}].
2. Build scd2_dim_store sorted by (store_id, valid_from) with keys: store_id, city,
   valid_from, valid_to (the effective_from of the next version for that store, or
   '9999-12-31' for the latest), and is_current (True only on the latest version).
3. For each order in orders (order_id, store_id, order_date, status, gross_idr,
   discount_idr, tax_idr), compute Semantic net_revenue_idr = gross_idr - discount_idr
   - tax_idr strictly when status.strip().lower() in {'paid', 'shipped', 'delivered'}
   (otherwise 0).
4. Perform a **Point-in-Time Join** (valid_from <= order_date < valid_to) to attribute
   each order to the store's city on order_date (fallback 'Unknown').
5. Return {'scd2_dim_store': [...], 'revenue_by_historical_city': {city:
   total_net_idr}, 'naive_current_city_revenue': {city: total_net_idr}} (where
   naive_current_city_revenue shows what a broken is_current=True join would report).

Check your work: python3 scripts/job_sim.py verify kopiku-normal <this folder>
"""


def attribute_scd2_and_rollup(orders, store_changes):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `ACTIVE_STATUSES = {"paid", "shipped", "delivered"}

def attribute_scd2_and_rollup(orders, store_changes):
    by_store = {}
    for ch in store_changes:
        sid = str(ch["store_id"]).strip()
        by_store.setdefault(sid, []).append({
            "store_id": sid,
            "city": str(ch["city"]).strip(),
            "valid_from": str(ch["effective_from"]).strip(),
        })
    scd2_dim = []
    current_city_map = {}
    for sid in sorted(by_store):
        vers = sorted(by_store[sid], key=lambda x: x["valid_from"])
        for i, v in enumerate(vers):
            is_last = (i == len(vers) - 1)
            valid_to = "9999-12-31" if is_last else vers[i + 1]["valid_from"]
            row = {
                "store_id": sid,
                "city": v["city"],
                "valid_from": v["valid_from"],
                "valid_to": valid_to,
                "is_current": is_last,
            }
            scd2_dim.append(row)
            if is_last:
                current_city_map[sid] = v["city"]

    hist_rev, naive_rev = {}, {}
    for o in orders:
        status = str(o.get("status", "")).strip().lower()
        if status not in ACTIVE_STATUSES:
            continue
        net = int(o["gross_idr"]) - int(o["discount_idr"]) - int(o["tax_idr"])
        sid = str(o["store_id"]).strip()
        dt = str(o["order_date"]).strip()
        pit_city = "Unknown"
        for d in scd2_dim:
            if d["store_id"] == sid and d["valid_from"] <= dt < d["valid_to"]:
                pit_city = d["city"]
                break
        curr_city = current_city_map.get(sid, "Unknown")
        hist_rev[pit_city] = hist_rev.get(pit_city, 0) + net
        naive_rev[curr_city] = naive_rev.get(curr_city, 0) + net

    return {
        "scd2_dim_store": scd2_dim,
        "revenue_by_historical_city": hist_rev,
        "naive_current_city_revenue": naive_rev,
    }`
          }
        },
        {
          level: "hard",
          missionId: "kopiku-hard",
          difficultyBadge: { id: "🔴 Level 3: HARD (Senior DE · Kafka CDC & Spark Skew Salting)", en: "🔴 Level 3: HARD (Senior DE · Kafka CDC & Spark Skew Salting)" },
          title: {
            id: "Misi 1.3: Flash Sale 11.11 Out-of-Order CDC & Executor Spark Macet di 199/200 Task",
            en: "Mission 1.3: 11.11 Flash-Sale Out-of-Order CDC & Spark Straggler Stuck at 199/200 Tasks"
          },
          lifecycle: "Ingestion (CDC) → Transformation (Distributed Spark)",
          undercurrents: ["Orchestration", "DataOps", "Software Engineering"],
          incidentTicket: {
            from: "Principal Platform Engineer (#war-room-11-11)",
            sla: { id: "Kompaksi CDC akurat per LSN · Rasio skew partisi Spark < 1.5:1", en: "LSN-ordered CDC compaction · Spark partition skew ratio < 1.5:1" },
            brief: {
              id: "Saat puncak Flash Sale 11.11, stream Debezium CDC mengirim event INSERT ('c'), UPDATE ('u'), dan DELETE ('d') tidak berurutan (out-of-order) akibat retry partisi Kafka. Lebih parah lagi, job PySpark yang men-join pesanan ke dim_sku macet 55 menit di Task 199/200 karena 82% pesanan membeli SKU promo 'KOPI-FLASH-01' sehingga 1 executor kehabisan memori (OOM).",
              en: "During the 11.11 Flash Sale peak, Debezium CDC events ('c' create, 'u' update, 'd' delete) arrive out of order across retries. Worse, the PySpark job joining orders to dim_sku hangs for 55 minutes at Task 199/200 because 82% of all orders hit the hot promo SKU 'KOPI-FLASH-01', causing a 42:1 partition skew and Executor OOM."
            }
          },
          padmGate: {
            question: {
              id: "Strategi ganda apa yang menyelesaikan event CDC yang datang terlambat sekaligus menghilangkan sumbatan 1 task straggler di Spark?",
              en: "Which dual strategy resolves out-of-order CDC tombstones while eliminating the single-task Spark shuffle straggler?"
            },
            options: [
              {
                text: {
                  id: "A. Gunakan waktu kedatangan Kafka (processing time) untuk urutan CDC dan naikkan jumlah partisi shuffle Spark dari 200 ke 2000.",
                  en: "A. Use Kafka arrival time (processing time) for CDC ordering and bump spark.sql.shuffle.partitions from 200 to 2000."
                },
                correct: false,
                feedback: {
                  id: "❌ Salah: Waktu kedatangan Kafka bisa terbalik saat retry (membuat baris yang sudah dihapus hidup lagi!), dan menambah jumlah partisi shuffle tidak memecah kunci 'KOPI-FLASH-01' yang memiliki hash sama.",
                  en: "❌ Incorrect: Processing time inverts during retries (resurrecting deleted rows!), and adding more shuffle partitions still hashes every 'KOPI-FLASH-01' row into a single partition."
                }
              },
              {
                text: {
                  id: "B. Kompaksi log CDC berdasarkan Log Sequence Number (LSN) tertinggi per order_id (membuang baris jika LSN tertinggi adalah op='d'), dan pecah kunci SKU panas dengan Key Salting (sku_id#0..sku_id#(N-1)) sambil mereplikasi dimensi yang di-salt.",
                  en: "B. Compact CDC events by highest database Log Sequence Number (LSN) per order_id (dropping the key if the winning LSN has op='d'), and break the hot SKU join skew using N-way Key Salting (sku_id#0..sku_id#(N-1)) with a replicated salted dimension."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat sekali! LSN dari WAL database adalah urutan kebenaran mutlak, dan Key Salting menyebar 82% trafik 'KOPI-FLASH-01' secara merata ke N task paralel.",
                  en: "✅ Spot on! The database WAL LSN is the monotonic source of truth, and N-way Key Salting spreads the 82% 'KOPI-FLASH-01' hot key evenly across N parallel tasks."
                }
              },
              {
                text: {
                  id: "C. Buang semua pesanan 'KOPI-FLASH-01' agar job Spark selesai cepat lalu hitung manual di Excel.",
                  en: "C. Filter out all 'KOPI-FLASH-01' orders so the Spark job finishes fast, then add them manually in Excel."
                },
                correct: false,
                feedback: {
                  id: "❌ Menghapus 82% transaksi dari pipeline produksi merusak seluruh laporan hilir.",
                  en: "❌ Dropping 82% of transactions from a production pipeline breaks every downstream table."
                }
              }
            ]
          },
          spec: {
            file: "mission_kopiku_hard.py",
            functionSig: "compact_cdc_and_salt_skew(cdc_events: list[dict], hot_keys: set[str], num_salts: int = 4) -> dict",
            rules: {
              id: [
                "`cdc_events` berisi dict: `{'order_id': str, 'sku_id': str, 'lsn': int, 'op': 'c'|'u'|'d', 'qty': int, 'unit_price_idr': int}`.",
                "Kompaksi CDC per `order_id` dengan memilih event yang memiliki `lsn` tertinggi. Jika event pemenang memiliki `op == 'd'` (delete tombstone), pesanan tersebut telah dihapus dan TIDAK boleh masuk ke tabel aktif.",
                "Untuk setiap pesanan aktif yang bertahan (diurutkan berdasarkan `order_id`), hitung `line_total_idr = qty * unit_price_idr`.",
                "Terapkan **Deterministic Key Salting**: jika `sku_id in hot_keys`, beri `salted_sku_key = f'{sku_id}#{idx % num_salts}'` di mana `idx` adalah urutan ke-0, 1, 2... kemunculan pesanan aktif untuk `sku_id` panas tersebut (round-robin deterministik). Jika `sku_id` bukan hot key, `salted_sku_key = f'{sku_id}#0'`.",
                "Kembalikan `{'active_orders': [...], 'partition_counts': {salted_sku_key: count}, 'max_partition_rows': int}`."
              ],
              en: [
                "`cdc_events` contains dicts: `{'order_id': str, 'sku_id': str, 'lsn': int, 'op': 'c'|'u'|'d', 'qty': int, 'unit_price_idr': int}`.",
                "Compact CDC per `order_id` by picking the event with the highest integer `lsn`. If the winning event has `op == 'd'` (delete tombstone), that order was deleted and must NOT appear in active orders.",
                "For each surviving active order (sorted by `order_id`), compute `line_total_idr = qty * unit_price_idr`.",
                "Apply **Deterministic Key Salting**: if `sku_id in hot_keys`, assign `salted_sku_key = f'{sku_id}#{idx % num_salts}'` where `idx` is the 0-based occurrence counter of surviving orders for that hot `sku_id` (deterministic round-robin). Otherwise assign `salted_sku_key = f'{sku_id}#0'`.",
                "Return `{'active_orders': [...], 'partition_counts': {salted_sku_key: count}, 'max_partition_rows': int}`."
              ]
            },
            starterCode: `"""Mission kopiku-hard: Mission 1.3: 11.11 Flash-Sale Out-of-Order CDC & Spark Straggler Stuck at 199/200 Tasks

The rules (also on the mission page):

1. cdc_events contains dicts: {'order_id': str, 'sku_id': str, 'lsn': int, 'op':
   'c'|'u'|'d', 'qty': int, 'unit_price_idr': int}.
2. Compact CDC per order_id by picking the event with the highest integer lsn. If the
   winning event has op == 'd' (delete tombstone), that order was deleted and must NOT
   appear in active orders.
3. For each surviving active order (sorted by order_id), compute line_total_idr = qty *
   unit_price_idr.
4. Apply **Deterministic Key Salting**: if sku_id in hot_keys, assign salted_sku_key =
   f'{sku_id}#{idx % num_salts}' where idx is the 0-based occurrence counter of
   surviving orders for that hot sku_id (deterministic round-robin). Otherwise assign
   salted_sku_key = f'{sku_id}#0'.
5. Return {'active_orders': [...], 'partition_counts': {salted_sku_key: count},
   'max_partition_rows': int}.

Check your work: python3 scripts/job_sim.py verify kopiku-hard <this folder>
"""


def compact_cdc_and_salt_skew(cdc_events, hot_keys, num_salts=4):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def compact_cdc_and_salt_skew(cdc_events, hot_keys, num_salts=4):
    latest_by_order = {}
    for ev in cdc_events:
        oid = str(ev["order_id"])
        lsn = int(ev["lsn"])
        if oid not in latest_by_order or lsn >= int(latest_by_order[oid]["lsn"]):
            latest_by_order[oid] = ev

    hot_set = set(hot_keys)
    hot_counters = {}
    active_orders = []
    part_counts = {}

    for oid in sorted(latest_by_order):
        ev = latest_by_order[oid]
        if str(ev.get("op", "")).lower() == "d":
            continue
        sku = str(ev["sku_id"])
        if sku in hot_set:
            idx = hot_counters.get(sku, 0)
            hot_counters[sku] = idx + 1
            salted = f"{sku}#{idx % int(num_salts)}"
        else:
            salted = f"{sku}#0"
        total = int(ev["qty"]) * int(ev["unit_price_idr"])
        row = {
            "order_id": oid,
            "sku_id": sku,
            "salted_sku_key": salted,
            "lsn": int(ev["lsn"]),
            "line_total_idr": total,
        }
        active_orders.append(row)
        part_counts[salted] = part_counts.get(salted, 0) + 1

    return {
        "active_orders": active_orders,
        "partition_counts": part_counts,
        "max_partition_rows": max(part_counts.values()) if part_counts else 0,
    }`
          }
        },
        {
          level: "expert",
          missionId: "kopiku-expert",
          difficultyBadge: { id: "🟣 Level 4: EXPERT (Staff DE · FinOps Rescue & Multi-Tenant RLS)", en: "🟣 Level 4: EXPERT (Staff DE · FinOps Rescue & Multi-Tenant RLS)" },
          title: {
            id: "Misi 1.4: Krisis Tagihan BigQuery $38.000/Bulan & Isolasi Portal 85 Mitra Franchise",
            en: "Mission 1.4: The $38,000/Month BigQuery Bill Shock & 85-Franchise Multi-Tenant RLS Portal"
          },
          lifecycle: "Serving → All 6 Undercurrents (FinOps & Security)",
          undercurrents: ["Security", "Data Architecture", "DataOps"],
          incidentTicket: {
            from: "CFO & Chief Information Security Officer (#c-suite-escalation)",
            sla: { id: "Pangkas biaya cloud >75% · 0 kebocoran data lintas-tenant franchise", en: "Cut cloud spend >75% · Zero cross-tenant franchise data leakage" },
            brief: {
              id: "Tagihan BigQuery bulan ini melonjak ke $38.000 karena dashboard Looker memindai tabel fakta mentah tanpa filter partisi setiap 60 detik. Di saat bersamaan, KopiKu meluncurkan Portal Analitik Mitra untuk 85 pemilik franchise eksternal: Mitra Franchise A TIDAK BOLEH melihat omzet cabang milik Mitra Franchise B, dan email pelanggan harus disamarkan kecuali untuk peran 'ADMIN_AUDITOR'.",
              en: "This month's BigQuery bill spiked to $38,000 because Looker dashboards query the unpartitioned raw fact table with SELECT * every 60 seconds. Simultaneously, KopiKu is launching an external Partner Analytics Portal for 85 franchise owners: Franchise Partner A must NEVER see stores owned by Franchise Partner B, and customer emails must be masked unless the viewer role is 'ADMIN_AUDITOR'."
            }
          },
          padmGate: {
            question: {
              id: "Kombinasi arsitektur FinOps dan keamanan mana yang menurunkan biaya >75% sekaligus menjamin isolasi multi-tenant yang tahan uji?",
              en: "Which combination of FinOps and security architecture cuts costs by >75% while enforcing bulletproof multi-tenant isolation?"
            },
            options: [
              {
                text: {
                  id: "A. Buat 85 proyek GCP dan 85 pipeline dbt terpisah (satu per franchise), lalu biarkan SELECT * berjalan di masing-masing proyek.",
                  en: "A. Create 85 separate GCP projects and 85 separate dbt pipelines (one per franchise), and let SELECT * run in each project."
                },
                correct: false,
                feedback: {
                  id: "❌ Mimpi buruk operasional: Memelihara 85 salinan pipeline dbt untuk skema yang sama melanggar prinsip DataOps dan tetap memboroskan biaya scan.",
                  en: "❌ Operational nightmare: Maintaining 85 duplicate dbt pipelines for identical schemas violates DataOps principles and still wastes scan budget."
                }
              },
              {
                text: {
                  id: "B. Wajibkan require_partition_filter=true + arahkan BI ke Tabel Target Rollup Harian (menghemat >95% byte), terapkan Row-Level Security (RLS) berbasis tabel pemetaan tenant-ke-store, dan pasang Dynamic Data Masking pada kolom PII.",
                  en: "B. Enforce require_partition_filter=true + point BI tiles at Daily Pre-Aggregated Rollup Marts (>95% scan reduction), enforce Row-Level Security (RLS) via a tenant-to-store entitlement mapping, and apply Dynamic Data Masking on PII columns."
                },
                correct: true,
                feedback: {
                  id: "✅ Arsitektur Staff DE! Tabel rollup + partition pruning memangkas biaya hingga >95%, sementara kebijakan RLS + Dynamic Masking di tingkat warehouse menjamin keamanan terpusat.",
                  en: "✅ Staff-level architecture! Rollup marts + partition pruning slash scan costs by >95%, while warehouse-enforced RLS + Dynamic Masking guarantee centralized security."
                }
              },
              {
                text: {
                  id: "C. Sembunyikan tombol filter cabang di tampilan frontend Javascript aplikasi portal.",
                  en: "C. Hide the store dropdown filter in the portal's frontend JavaScript UI."
                },
                correct: false,
                feedback: {
                  id: "❌ Celah keamanan kritis: Menyembunyikan dropdown di UI tidak menghentikan pengguna mengubah parameter API atau mengekstrak data tenant lain.",
                  en: "❌ Critical security vulnerability: Hiding a UI dropdown does not stop a tenant from inspecting network requests or querying other store IDs."
                }
              }
            ]
          },
          spec: {
            file: "mission_kopiku_expert.py",
            functionSig: "enforce_rls_and_finops_guard(rows: list[dict], entitlements: dict[str, list[str]], viewer_tenant: str, viewer_role: str, query_days: int, total_days: int = 365, raw_table_gb: float = 1000.0) -> dict",
            rules: {
              id: [
                "`entitlements` memetakan `tenant_id -> list[store_id]` yang berhak diakses (misal `{'FRANCHISE_A': ['S01', 'S02']}`). Jika `viewer_role == 'ADMIN_AUDITOR'`, ia boleh melihat semua `store_id`; jika bukan, filter `rows` sehingga hanya menyisakan baris yang `store_id`-nya ada di `entitlements.get(viewer_tenant, [])`.",
                "Terapkan **Dynamic Data Masking** pada setiap baris yang lolos RLS: jika `viewer_role == 'ADMIN_AUDITOR'`, biarkan `customer_email` utuh; jika bukan, ganti `customer_email` menjadi `'***@' + email.split('@')[-1].lower()`.",
                "Urutkan baris yang lolos berdasarkan `order_id`.",
                "Hitung penghematan FinOps: `naive_scan_gb = round(raw_table_gb, 2)`. Dengan partisi tanggal + proyeksi kolom + tabel rollup (faktor kompresi rollup `0.15`), `optimized_scan_gb = round(raw_table_gb * (query_days / total_days) * 0.15, 2)`. Hitung `savings_pct = round((1.0 - optimized_scan_gb / naive_scan_gb) * 100.0, 2)`.",
                "Kembalikan `{'visible_rows': [...], 'naive_scan_gb': float, 'optimized_scan_gb': float, 'savings_pct': float}`."
              ],
              en: [
                "`entitlements` maps `tenant_id -> list[store_id]` (e.g. `{'FRANCHISE_A': ['S01', 'S02']}`). If `viewer_role == 'ADMIN_AUDITOR'`, all stores are visible; otherwise filter `rows` to keep strictly rows where `store_id in entitlements.get(viewer_tenant, [])`.",
                "Apply **Dynamic Data Masking** on every surviving row: if `viewer_role == 'ADMIN_AUDITOR'`, keep `customer_email` unchanged; otherwise mask `customer_email` to `'***@' + email.split('@')[-1].lower()`.",
                "Sort visible rows by `order_id`.",
                "Compute FinOps metrics: `naive_scan_gb = round(float(raw_table_gb), 2)`. With date partition pruning + column projection + rollup compaction factor `0.15`, `optimized_scan_gb = round(float(raw_table_gb) * (int(query_days) / int(total_days)) * 0.15, 2)`. Compute `savings_pct = round((1.0 - optimized_scan_gb / naive_scan_gb) * 100.0, 2)`.",
                "Return `{'visible_rows': [...], 'naive_scan_gb': float, 'optimized_scan_gb': float, 'savings_pct': float}`."
              ]
            },
            starterCode: `"""Mission kopiku-expert: Mission 1.4: The $38,000/Month BigQuery Bill Shock & 85-Franchise Multi-Tenant RLS Portal

The rules (also on the mission page):

1. entitlements maps tenant_id -> list[store_id] (e.g. {'FRANCHISE_A': ['S01',
   'S02']}). If viewer_role == 'ADMIN_AUDITOR', all stores are visible; otherwise
   filter rows to keep strictly rows where store_id in entitlements.get(viewer_tenant,
   []).
2. Apply **Dynamic Data Masking** on every surviving row: if viewer_role ==
   'ADMIN_AUDITOR', keep customer_email unchanged; otherwise mask customer_email to
   '***@' + email.split('@')[-1].lower().
3. Sort visible rows by order_id.
4. Compute FinOps metrics: naive_scan_gb = round(float(raw_table_gb), 2). With date
   partition pruning + column projection + rollup compaction factor 0.15,
   optimized_scan_gb = round(float(raw_table_gb) * (int(query_days) / int(total_days))
   * 0.15, 2). Compute savings_pct = round((1.0 - optimized_scan_gb / naive_scan_gb) *
   100.0, 2).
5. Return {'visible_rows': [...], 'naive_scan_gb': float, 'optimized_scan_gb': float,
   'savings_pct': float}.

Check your work: python3 scripts/job_sim.py verify kopiku-expert <this folder>
"""


def enforce_rls_and_finops_guard(rows, entitlements, viewer_tenant, viewer_role, query_days, total_days=365, raw_table_gb=1000.0):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def enforce_rls_and_finops_guard(rows, entitlements, viewer_tenant, viewer_role, query_days, total_days=365, raw_table_gb=1000.0):
    is_admin = (str(viewer_role).strip().upper() == "ADMIN_AUDITOR")
    allowed_stores = set(entitlements.get(viewer_tenant, []))
    visible = []

    for r in sorted(rows, key=lambda x: str(x["order_id"])):
        sid = str(r["store_id"])
        if not is_admin and sid not in allowed_stores:
            continue
        email = str(r.get("customer_email", "")).strip()
        if not is_admin and "@" in email:
            email = "***@" + email.split("@")[-1].lower()
        visible.append({
            "order_id": str(r["order_id"]),
            "store_id": sid,
            "customer_email": email,
            "net_idr": int(r["net_idr"]),
        })

    naive_gb = round(float(raw_table_gb), 2)
    opt_gb = round(float(raw_table_gb) * (int(query_days) / int(total_days)) * 0.15, 2)
    savings_pct = round((1.0 - (opt_gb / naive_gb)) * 100.0, 2) if naive_gb > 0 else 0.0

    return {
        "visible_rows": visible,
        "naive_scan_gb": naive_gb,
        "optimized_scan_gb": opt_gb,
        "savings_pct": savings_pct,
    }`
          }
        }
      ]
    },
    {
      id: "paynusa",
      icon: "💳",
      badge: { id: "Cerita 2 · Fintech & Fraud ML", en: "Story 2 · Fintech & Fraud ML" },
      title: { id: "PayNusa Financial (Digital Ledger, PCI/GDPR & Fraud ML)", en: "PayNusa Financial (Digital Ledger, PCI/GDPR & Fraud ML)" },
      companyProfile: {
        id: "Dompet digital & payment gateway (2,5 juta transaksi/hari, audit Bank Sentral, PCI-DSS/UU PDP, deteksi fraud real-time).",
        en: "Digital wallet & payment gateway (2.5M daily transactions, Central Bank audits, PCI-DSS/GDPR compliance, real-time fraud ML)."
      },
      summary: {
        id: "Bangun infrastruktur data fintech berstandar perbankan: amankan webhook pembayaran dengan HMAC-SHA256 & buku besar double-entry integer, lolos audit privasi dengan Salted HMAC Tokenization & Data Vault 2.0 Crypto-Shredding, cegah ledakan angka join multi-fakta 470% & tangani stream BI-FAST yang terlambat dengan watermark, hingga bangun Feature Store ASOF bebas kebocoran masa depan.",
        en: "Engineer banking-grade fintech data infrastructure: verify payment webhooks with HMAC-SHA256 & double-entry integer ledgers, pass regulatory audits with Salted HMAC Tokenization & Data Vault 2.0 Crypto-Shredding, eliminate a 470% multi-fact join fan-out & handle late clearing streams with event-time watermarks, and ship a zero-leakage Point-in-Time ASOF Fraud Feature Store."
      },
      starResumeBullets: [
        "Engineered a constant-time HMAC-SHA256 webhook ingestion gateway and immutable double-entry integer ledger processing 100k+ daily payment and refund events with zero-cent reconciliation drift.",
        "Implemented a pre-ingestion PII Privacy Gate using salted HMAC-SHA256 tokenization and Data Vault 2.0 satellite crypto-shredding, achieving 100% GDPR/PDP right-to-be-forgotten erasure without altering regulatory settlement totals.",
        "Eliminated a 470% financial reporting inflation bug by refactoring multi-fact transfer and chargeback joins into grain-aligned pre-aggregated CTEs and an event-time watermarked stream processor with a late-settlement DLQ.",
        "Built a dual-storage Point-in-Time (`ASOF`) Fraud ML Feature Store eliminating 100% of future label leakage across historical training sets while maintaining sub-5ms online inference parity."
      ],
      levels: [
        {
          level: "easy",
          missionId: "paynusa-easy",
          difficultyBadge: { id: "🟢 Level 1: EASY (Junior DE · Keamanan Webhook & Buku Besar)", en: "🟢 Level 1: EASY (Junior DE · Webhook Security & Double-Entry Ledger)" },
          title: {
            id: "Misi 2.1: Selisih Settlement Rp 4.200.000 & Badai Duplikat Webhook Pembayaran",
            en: "Mission 2.1: The Rp 4,200,000 Settlement Mismatch & Duplicate Payment Webhook Storm"
          },
          lifecycle: "Generation → Ingestion → Storage",
          undercurrents: ["Security", "Software Engineering", "DataOps"],
          incidentTicket: {
            from: "Head of Treasury & Payment Engineering (#treasury-settlement-alert)",
            sla: { id: "SUM(debit) - SUM(credit) == 0 · Tolak 100% webhook palsu/replay", en: "SUM(debits) - SUM(credits) == 0 · Reject 100% forged/replayed webhooks" },
            brief: {
              id: "Rekonsiliasi settlement harian PayNusa selisih Rp 4.200.000 dibanding rekening bank penampung. Setelah diselidiki: (1) gateway pembayaran mengirim webhook at-least-once (hingga 3 duplikat per transaksi), (2) ada request webhook palsu dari luar yang lolos karena tidak ada cek HMAC, dan (3) setiap transaksi harus dicatat sebagai 2 baris buku besar berpasangan (Double-Entry: Debit & Kredit) dalam satuan integer Rupiah.",
              en: "PayNusa's daily settlement report drifted by Rp 4,200,000 against the escrow bank statement. Root causes: (1) the payment gateway delivers webhooks at-least-once (up to 3 duplicate retries per transaction), (2) forged external requests slipped through due to missing HMAC verification, and (3) every verified transaction must be recorded as balanced Double-Entry Integer Ledger rows (Debit == Credit)."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana desain gerbang ingestion webhook dan penyimpanan buku besar yang memenuhi standar audit perbankan?",
              en: "How should you architect the webhook ingestion gate and ledger storage to meet banking audit standards?"
            },
            options: [
              {
                text: {
                  id: "A. Percayai semua request POST yang masuk ke endpoint URL rahasia dan gunakan UPDATE saldo_akun = saldo_akun + nominal.",
                  en: "A. Trust all POST requests hitting a secret URL path and run UPDATE account_balance = account_balance + amount."
                },
                correct: false,
                feedback: {
                  id: "❌ Sangat berbahaya: URL rahasia bukan autentikasi kriptografis, dan menimpa kolom saldo dengan UPDATE menghilangkan jejak audit serta menggandakan uang saat terjadi retry webhook.",
                  en: "❌ Extremely dangerous: A secret URL is not cryptographic authentication, and mutating a balance column in place destroys the audit trail and double-counts money on webhook retries."
                }
              },
              {
                text: {
                  id: "B. Verifikasi tanda tangan HMAC-SHA256 dengan hmac.compare_digest + batas waktu replay 300 detik, deduplikasi berdasarkan tx_id, dan tulis baris buku besar Double-Entry (Debit & Kredit) integer immutable di mana total Debit == total Kredit.",
                  en: "B. Verify HMAC-SHA256 signatures via hmac.compare_digest + 300s replay window, deduplicate by tx_id, and emit immutable integer Double-Entry ledger postings (Debit & Credit) where total Debits == total Credits."
                },
                correct: true,
                feedback: {
                  id: "✅ Standar emas Fintech! HMAC-SHA256 + jendela waktu mencegah pemalsuan/replay, deduplikasi tx_id menjamin sifat idempoten, dan buku besar double-entry menjaga keseimbangan akuntansi mutlak.",
                  en: "✅ Fintech gold standard! HMAC-SHA256 + timestamp window blocks forgery/replay, tx_id deduplication guarantees idempotency, and double-entry postings enforce accounting invariant balance."
                }
              },
              {
                text: {
                  id: "C. Simpan nominal dalam tipe FLOAT64 dan jalankan DISTINCT pada nilai nominal di akhir bulan.",
                  en: "C. Store amounts as FLOAT64 and deduplicate by SELECT DISTINCT amount at the end of the month."
                },
                correct: false,
                feedback: {
                  id: "❌ Dua transaksi berbeda bisa memiliki nominal Rp 50.000 yang sama! Deduplikasi wajib menggunakan tx_id unik, bukan nominal.",
                  en: "❌ Two distinct transactions can both be Rp 50,000! Deduplication must key on unique tx_id, never on amount."
                }
              }
            ]
          },
          spec: {
            file: "mission_paynusa_easy.py",
            functionSig: "ingest_verified_ledger(webhooks: list[dict], secret: str, now_ts: int, tolerance_sec: int = 300) -> dict",
            rules: {
              id: [
                "Setiap item di `webhooks` adalah dict: `{'tx_id': str, 'timestamp': int, 'event_type': 'charge'|'refund', 'merchant_id': str, 'amount_idr': int, 'signature': str}`.",
                "Tanda tangan valid adalah `'sha256=' + hmac_sha256(secret, f\"{timestamp}.{tx_id}.{event_type}.{merchant_id}.{amount_idr}\")`. Tolak ke `rejected_ids` jika `abs(now_ts - timestamp) > tolerance_sec` atau tanda tangan tidak cocok (`hmac.compare_digest`) atau `amount_idr <= 0`.",
                "Deduplikasi webhook valid yang memiliki `tx_id` sama (proses hanya kemunculan valid pertama).",
                "Untuk setiap transaksi valid: jika `event_type == 'charge'`, buat 2 baris buku besar: Debit `'ESCROW_CASH'` sebesar `amount_idr` dan Kredit `f'MERCHANT:{merchant_id}'` sebesar `amount_idr`. Jika `event_type == 'refund'`, balik jurnalnya: Debit `f'MERCHANT:{merchant_id}'` dan Kredit `'ESCROW_CASH'` sebesar `amount_idr`.",
                "Kembalikan `{'ledger_entries': [...], 'rejected_ids': [...], 'total_debit_idr': int, 'total_credit_idr': int, 'net_merchant_balances': {merchant_id: int}}` (di mana saldo merchant = total kredit merchant - total debit merchant)."
              ],
              en: [
                "Each item in `webhooks` is a dict: `{'tx_id': str, 'timestamp': int, 'event_type': 'charge'|'refund', 'merchant_id': str, 'amount_idr': int, 'signature': str}`.",
                "A valid signature is `'sha256=' + hmac_sha256(secret, f\"{timestamp}.{tx_id}.{event_type}.{merchant_id}.{amount_idr}\")`. Append `tx_id` to `rejected_ids` if `abs(now_ts - timestamp) > tolerance_sec`, the signature fails (`hmac.compare_digest`), or `amount_idr <= 0`.",
                "Deduplicate valid webhooks sharing the same `tx_id` (process only the first valid occurrence).",
                "For each accepted transaction: if `event_type == 'charge'`, emit 2 double-entry postings: Debit `'ESCROW_CASH'` for `amount_idr` and Credit `f'MERCHANT:{merchant_id}'` for `amount_idr`. If `event_type == 'refund'`, reverse the accounts: Debit `f'MERCHANT:{merchant_id}'` and Credit `'ESCROW_CASH'` for `amount_idr`.",
                "Return `{'ledger_entries': [...], 'rejected_ids': [...], 'total_debit_idr': int, 'total_credit_idr': int, 'net_merchant_balances': {merchant_id: int}}` (where merchant balance = merchant credits - merchant debits)."
              ]
            },
            starterCode: `"""Mission paynusa-easy: Mission 2.1: The Rp 4,200,000 Settlement Mismatch & Duplicate Payment Webhook Storm

The rules (also on the mission page):

1. Each item in webhooks is a dict: {'tx_id': str, 'timestamp': int, 'event_type':
   'charge'|'refund', 'merchant_id': str, 'amount_idr': int, 'signature': str}.
2. A valid signature is 'sha256=' + hmac_sha256(secret,
   f"{timestamp}.{tx_id}.{event_type}.{merchant_id}.{amount_idr}"). Append tx_id to
   rejected_ids if abs(now_ts - timestamp) > tolerance_sec, the signature fails
   (hmac.compare_digest), or amount_idr <= 0.
3. Deduplicate valid webhooks sharing the same tx_id (process only the first valid
   occurrence).
4. For each accepted transaction: if event_type == 'charge', emit 2 double-entry
   postings: Debit 'ESCROW_CASH' for amount_idr and Credit f'MERCHANT:{merchant_id}'
   for amount_idr. If event_type == 'refund', reverse the accounts: Debit
   f'MERCHANT:{merchant_id}' and Credit 'ESCROW_CASH' for amount_idr.
5. Return {'ledger_entries': [...], 'rejected_ids': [...], 'total_debit_idr': int,
   'total_credit_idr': int, 'net_merchant_balances': {merchant_id: int}} (where
   merchant balance = merchant credits - merchant debits).

Check your work: python3 scripts/job_sim.py verify paynusa-easy <this folder>
"""


def ingest_verified_ledger(webhooks, secret, now_ts, tolerance_sec=300):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `import hashlib
import hmac

def ingest_verified_ledger(webhooks, secret, now_ts, tolerance_sec=300):
    entries, rejected, seen = [], [], set()
    total_debit, total_credit = 0, 0
    balances = {}

    for w in webhooks:
        tx_id = str(w["tx_id"])
        ts = int(w["timestamp"])
        etype = str(w["event_type"]).strip().lower()
        mid = str(w["merchant_id"]).strip()
        amt = int(w["amount_idr"])
        sig = str(w["signature"])

        if abs(int(now_ts) - ts) > int(tolerance_sec) or amt <= 0 or etype not in {"charge", "refund"}:
            rejected.append(tx_id)
            continue

        payload = f"{ts}.{tx_id}.{etype}.{mid}.{amt}".encode("utf-8")
        expected = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            rejected.append(tx_id)
            continue

        if tx_id in seen:
            continue
        seen.add(tx_id)

        if etype == "charge":
            entries.append({"tx_id": tx_id, "account": "ESCROW_CASH", "side": "DEBIT", "amount_idr": amt})
            entries.append({"tx_id": tx_id, "account": f"MERCHANT:{mid}", "side": "CREDIT", "amount_idr": amt})
            balances[mid] = balances.get(mid, 0) + amt
        else:
            entries.append({"tx_id": tx_id, "account": f"MERCHANT:{mid}", "side": "DEBIT", "amount_idr": amt})
            entries.append({"tx_id": tx_id, "account": "ESCROW_CASH", "side": "CREDIT", "amount_idr": amt})
            balances[mid] = balances.get(mid, 0) - amt

        total_debit += amt
        total_credit += amt

    return {
        "ledger_entries": entries,
        "rejected_ids": rejected,
        "total_debit_idr": total_debit,
        "total_credit_idr": total_credit,
        "net_merchant_balances": balances,
    }`
          }
        },
        {
          level: "normal",
          missionId: "paynusa-normal",
          difficultyBadge: { id: "🟡 Level 2: NORMAL (Mid-Level DE · Privasi PII & Data Vault Crypto-Shredding)", en: "🟡 Level 2: NORMAL (Mid-Level DE · PII Privacy & Data Vault Crypto-Shredding)" },
          title: {
            id: "Misi 2.2: Temuan Audit Bank Sentral (Rainbow Table NIK/HP) & Penghapusan UU PDP",
            en: "Mission 2.2: Central Bank Audit (Phone/NIK Rainbow Table) & GDPR Crypto-Shredding"
          },
          lifecycle: "Storage → Transformation → Governance",
          undercurrents: ["Security", "Data Management", "Data Architecture"],
          incidentTicket: {
            from: "Data Protection Officer & Head of Compliance (#regulatory-audit)",
            sla: { id: "0 PII mentah di warehouse · Penghapusan PII tidak mengubah total buku besar", en: "0 raw PII in warehouse · PII erasure preserves 100% of ledger totals" },
            brief: {
              id: "Auditor keamanan membuktikan bahwa kolom `sha256(phone)` tanpa salt di warehouse PayNusa dapat dibongkar kembali menjadi nomor HP asli hanya dalam 1,8 detik menggunakan rainbow table 100 juta nomor `+628...`. Selain itu, saat nasabah meminta penghapusan data pribadi (UU PDP / GDPR Right to Be Forgotten), tim tidak boleh menghapus baris transaksi buku besar karena akan merusak laporan keuangan ke Bank Sentral!",
              en: "Security auditors proved that PayNusa's unsalted `sha256(phone)` column in the warehouse can be reversed back into raw phone numbers in 1.8 seconds via a rainbow table of 100M `+628...` numbers. Furthermore, when a user invokes their GDPR/PDP Right to Be Forgotten, you must permanently erase their PII without deleting their financial transaction rows from the regulatory settlement ledger!"
            }
          },
          padmGate: {
            question: {
              id: "Arsitektur pemodelan dan privasi mana yang tahan serangan rainbow table sekaligus mendukung penghapusan PII tanpa merusak histori transaksi?",
              en: "Which modeling and privacy architecture defeats rainbow-table attacks while enabling PII erasure without breaking transaction history?"
            },
            options: [
              {
                text: {
                  id: "A. Gunakan MD5(phone) dan jalankan DELETE FROM fact_transfers WHERE account_id = ? saat nasabah meminta penghapusan akun.",
                  en: "A. Use MD5(phone) and run DELETE FROM fact_transfers WHERE account_id = ? when a customer requests erasure."
                },
                correct: false,
                feedback: {
                  id: "❌ MD5 juga langsung terbongkar oleh rainbow table, dan menghapus baris transaksi dari fact_transfers mengubah laporan keuangan historis (pelanggaran audit).",
                  en: "❌ MD5 is trivially reversible via rainbow tables, and deleting rows from fact_transfers alters historical financial statements (an audit violation)."
                }
              },
              {
                text: {
                  id: "B. Gunakan HMAC-SHA256 dengan secret salt di gerbang pra-ingestion, pisahkan atribut identitas pribadi ke Satellite PII terpisah (Data Vault 2.0: hub_account + sat_account_pii + link_transfer), dan lakukan Crypto-Shredding / pengosongan sat_account_pii untuk akun yang dihapus sambil menjaga link_transfer tetap utuh.",
                  en: "B. Use salted HMAC-SHA256 at the pre-ingestion gate, isolate personal identity attributes in a dedicated PII Satellite (Data Vault 2.0: hub_account + sat_account_pii + link_transfer), and purge/crypto-shred sat_account_pii for erased users while keeping link_transfer intact."
                },
                correct: true,
                feedback: {
                  id: "✅ Arsitektur perbankan terbaik! Secret salt menggagalkan rainbow table, dan pemisahan `sat_account_pii` dari `link_transfer` memungkinkan penghapusan identitas 100% tanpa mengubah satu Rupiah pun di buku besar.",
                  en: "✅ Banking-grade architecture! A secret salt defeats rainbow tables, and isolating `sat_account_pii` from `link_transfer` lets you erase 100% of a user's PII without changing a single Rupiah in the ledger."
                }
              },
              {
                text: {
                  id: "C. Simpan NIK dan nomor HP asli di tabel transaksi utama tetapi beri nama kolomnya `col_x` dan `col_y`.",
                  en: "C. Keep raw national IDs and phone numbers in the main transaction table, just rename the columns to `col_x` and `col_y`."
                },
                correct: false,
                feedback: {
                  id: "❌ Security by obscurity bukan perlindungan data dan melanggar regulasi PCI-DSS / UU PDP.",
                  en: "❌ Security by obscurity is not data protection and violates PCI-DSS / GDPR."
                }
              }
            ]
          },
          spec: {
            file: "mission_paynusa_normal.py",
            functionSig: "build_vault_and_shred_pii(accounts: list[dict], transfers: list[dict], erased_account_ids: list[str], secret_salt: str) -> dict",
            rules: {
              id: [
                "`accounts` berisi dict: `{'account_id': str, 'nik': str, 'phone': str, 'risk_tier': str}`.",
                "Untuk setiap akun (diurutkan berdasarkan `account_id`), hitung `hk_account = hmac_sha256(secret_salt, account_id.strip().upper())`.",
                "Jika `account_id.strip().upper()` ada di `erased_account_ids` (case-insensitive), akun tersebut mengalami **Crypto-Shredding**: di `sat_account_pii`, set `pii_token = None`, `phone_masked = 'ERASED'`, `is_shredded = True`. Jika tidak dihapus, set `pii_token = hmac_sha256(secret_salt, f'{nik.strip()}:{digits_only(phone)}')`, `phone_masked = '***-***-' + digits[-4:]`, dan `is_shredded = False`.",
                "Pastikan TIDAK ADA `nik` atau `phone` mentah di dalam `sat_account_pii`!",
                "Hitung `total_transfer_volume_idr = sum(int(t['amount_idr']) for t in transfers)` — nilai ini harus tetap 100% utuh meskipun pengirim/penerima telah di-shred di satellite PII. Kembalikan `{'sat_account_pii': [...], 'shredded_count': int, 'total_transfer_volume_idr': int}`."
              ],
              en: [
                "`accounts` contains dicts: `{'account_id': str, 'nik': str, 'phone': str, 'risk_tier': str}`.",
                "For each account (sorted by `account_id`), compute `hk_account = hmac_sha256(secret_salt, account_id.strip().upper())`.",
                "If `account_id.strip().upper()` is in `erased_account_ids` (case-insensitive), apply **Crypto-Shredding**: in `sat_account_pii`, set `pii_token = None`, `phone_masked = 'ERASED'`, `is_shredded = True`. Otherwise set `pii_token = hmac_sha256(secret_salt, f'{nik.strip()}:{digits_only(phone)}')`, `phone_masked = '***-***-' + digits[-4:]`, and `is_shredded = False`.",
                "Ensure ZERO raw `nik` or `phone` strings remain anywhere in `sat_account_pii`!",
                "Compute `total_transfer_volume_idr = sum(int(t['amount_idr']) for t in transfers)` — preserving 100% of ledger volume even after PII shredding. Return `{'sat_account_pii': [...], 'shredded_count': int, 'total_transfer_volume_idr': int}`."
              ]
            },
            starterCode: `"""Mission paynusa-normal: Mission 2.2: Central Bank Audit (Phone/NIK Rainbow Table) & GDPR Crypto-Shredding

The rules (also on the mission page):

1. accounts contains dicts: {'account_id': str, 'nik': str, 'phone': str, 'risk_tier':
   str}.
2. For each account (sorted by account_id), compute hk_account =
   hmac_sha256(secret_salt, account_id.strip().upper()).
3. If account_id.strip().upper() is in erased_account_ids (case-insensitive), apply
   **Crypto-Shredding**: in sat_account_pii, set pii_token = None, phone_masked =
   'ERASED', is_shredded = True. Otherwise set pii_token = hmac_sha256(secret_salt,
   f'{nik.strip()}:{digits_only(phone)}'), phone_masked = '***-***-' + digits[-4:], and
   is_shredded = False.
4. Ensure ZERO raw nik or phone strings remain anywhere in sat_account_pii!
5. Compute total_transfer_volume_idr = sum(int(t['amount_idr']) for t in transfers) —
   preserving 100% of ledger volume even after PII shredding. Return
   {'sat_account_pii': [...], 'shredded_count': int, 'total_transfer_volume_idr': int}.

Check your work: python3 scripts/job_sim.py verify paynusa-normal <this folder>
"""


def build_vault_and_shred_pii(accounts, transfers, erased_account_ids, secret_salt):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `import hashlib
import hmac
import re

def _hmac_hex(salt, msg):
    return hmac.new(salt.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()

def build_vault_and_shred_pii(accounts, transfers, erased_account_ids, secret_salt):
    erased_set = {str(a).strip().upper() for a in erased_account_ids}
    sat_pii = []
    shredded_count = 0

    for acc in sorted(accounts, key=lambda x: str(x["account_id"]).strip().upper()):
        aid = str(acc["account_id"]).strip().upper()
        hk = _hmac_hex(secret_salt, aid)
        if aid in erased_set:
            shredded_count += 1
            sat_pii.append({
                "account_id": aid,
                "hk_account": hk,
                "pii_token": None,
                "phone_masked": "ERASED",
                "risk_tier": str(acc["risk_tier"]),
                "is_shredded": True,
            })
        else:
            nik = str(acc.get("nik", "")).strip()
            digits = re.sub(r"\\D+", "", str(acc.get("phone", "")))
            tok = _hmac_hex(secret_salt, f"{nik}:{digits}")
            masked = f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***-***-****"
            sat_pii.append({
                "account_id": aid,
                "hk_account": hk,
                "pii_token": tok,
                "phone_masked": masked,
                "risk_tier": str(acc["risk_tier"]),
                "is_shredded": False,
            })

    vol = sum(int(t["amount_idr"]) for t in transfers)
    return {
        "sat_account_pii": sat_pii,
        "shredded_count": shredded_count,
        "total_transfer_volume_idr": vol,
    }`
          }
        },
        {
          level: "hard",
          missionId: "paynusa-hard",
          difficultyBadge: { id: "🔴 Level 3: HARD (Senior DE · Multi-Fact Fan-Out & Streaming Watermark)", en: "🔴 Level 3: HARD (Senior DE · Multi-Fact Fan-Out & Streaming Watermark)" },
          title: {
            id: "Misi 2.3: Ledakan Angka Transfer 470% (3-Way Join Fan-Out) & Stream BI-FAST Terlambat",
            en: "Mission 2.3: The 470% Transfer Volume Inflation (3-Way Join Fan-Out) & Late Clearing Stream"
          },
          lifecycle: "Ingestion (Streaming) → Transformation",
          undercurrents: ["DataOps", "Orchestration", "Data Architecture"],
          incidentTicket: {
            from: "VP of Risk & Settlement Operations (#settlement-stream-p1)",
            sla: { id: "0% multiplikasi fan-out · Watermark event-time 15 menit + Late DLQ", en: "0% fan-out multiplication · 15-minute event-time watermark + Late DLQ" },
            brief: {
              id: "Laporan risiko akun harian tiba-tiba melaporkan volume transfer 470% lebih tinggi dari kenyataan! Penyebabnya: query men-join tabel `accounts` ke `transfers` (1:N) dan `chargebacks` (1:M) dalam satu SELECT sehingga akun dengan 5 transfer dan 3 chargeback menghasilkan 15 baris silang (Cartesian fan-out). Di saat yang sama, stream kliring lintas-bank mengirim event yang terlambat hingga 45 menit.",
              en: "The daily account risk report suddenly overstated transfer volume by 470%! Root cause: a single query joined `accounts` to `transfers` (1:N) and `chargebacks` (1:M) in the same FROM clause, so an account with 5 transfers and 3 chargebacks produced 15 cross-multiplied rows. Simultaneously, interbank clearing events arrive up to 45 minutes late in the stream."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara menghilangkan ledakan baris join multi-fakta sekaligus menangani event kliring yang terlambat tanpa kehilangan uang?",
              en: "How do you eliminate multi-fact join row explosion while handling late clearing events without silently dropping money?"
            },
            options: [
              {
                text: {
                  id: "A. Gunakan SELECT DISTINCT di atas query join 3 tabel, dan buang semua event streaming yang terlambat lebih dari 1 detik.",
                  en: "A. Slap SELECT DISTINCT on top of the 3-table join, and drop any streaming event delayed by more than 1 second."
                },
                correct: false,
                feedback: {
                  id: "❌ SELECT DISTINCT tidak memperbaiki SUM(transfer_amount) yang sudah terlanjur digandakan oleh baris chargeback, dan membuang event kliring bank yang terlambat menyebabkan selisih saldo.",
                  en: "❌ SELECT DISTINCT does not fix a SUM(transfer_amount) multiplied across distinct chargeback IDs, and silently dropping late bank clearing events causes settlement drift."
                }
              },
              {
                text: {
                  id: "B. Pra-agregasi tabel transfers dan tabel chargebacks secara terpisah ke grain account_id terlebih dahulu sebelum di-join ke accounts, dan gunakan Event-Time Watermark (max_event_ts - 900 detik) yang mengarahkan event sangat terlambat ke antrean rekonsiliasi (late_settlement_dlq).",
                  en: "B. Pre-aggregate transfers and chargebacks separately to the account_id grain before joining to accounts, and enforce an Event-Time Watermark (max_event_ts - 900s) that routes ultra-late events to a reconciliation DLQ (late_settlement_dlq)."
                },
                correct: true,
                feedback: {
                  id: "✅ Solusi Senior DE! Pra-agregasi ke grain yang sama (`1:1`) menghilangkan fan-out 100%, dan watermark + antrean rekonsiliasi menjaga latensi rendah tanpa membuang transaksi terlambat.",
                  en: "✅ Senior DE solution! Pre-aggregating both facts to the `account_id` grain (`1:1`) eliminates fan-out completely, and a watermark + reconciliation queue preserves low latency without losing late money."
                }
              },
              {
                text: {
                  id: "C. Bagi total transfer dengan jumlah chargeback secara rata-rata.",
                  en: "C. Divide the total transfer sum by the average number of chargebacks."
                },
                correct: false,
                feedback: {
                  id: "❌ Pembagian rata-rata tetap salah untuk akun yang tidak punya chargeback (pembagian dengan nol).",
                  en: "❌ Dividing by an average fails on accounts with zero chargebacks (division by zero) or uneven counts."
                }
              }
            ]
          },
          spec: {
            file: "mission_paynusa_hard.py",
            functionSig: "reconcile_multifact_and_watermark(accounts: list[str], transfers: list[dict], chargebacks: list[dict], watermark_delay_sec: int = 900) -> dict",
            rules: {
              id: [
                "`transfers` berisi dict: `{'tx_id': str, 'account_id': str, 'amount_idr': int, 'event_ts': int}` yang datang secara streaming.",
                "Saat mengiterasi `transfers` sesuai urutan kedatangan, pelihara `max_event_ts` yang pernah terlihat sejauh ini dan `current_watermark = max_event_ts - watermark_delay_sec`. Jika sebuah event memiliki `event_ts < current_watermark` pada saat ia tiba, masukkan `tx_id`-nya ke `late_dlq_tx_ids` (jangan masukkan ke hitungan on-time window). Jika `event_ts >= current_watermark`, masukkan ke hitungan `on_time_transfer_idr` milik `account_id` tersebut.",
                "Pra-agregasi `chargebacks` (`{'cb_id': str, 'account_id': str, 'cb_amount_idr': int}`) secara independen per `account_id` (mencegah $1:N \\times 1:M$ fan-out!).",
                "Untuk setiap `account_id` di `sorted(accounts)`, keluarkan baris ringkasan `{'account_id': aid, 'transfer_sum_idr': int, 'chargeback_sum_idr': int, 'net_exposure_idr': transfer_sum_idr - chargeback_sum_idr}`.",
                "Kembalikan `{'account_summaries': [...], 'late_dlq_tx_ids': [...], 'final_watermark': int}`."
              ],
              en: [
                "`transfers` contains streaming dicts: `{'tx_id': str, 'account_id': str, 'amount_idr': int, 'event_ts': int}`.",
                "As you iterate through `transfers` in arrival order, track the running `max_event_ts` seen so far and `current_watermark = max_event_ts - watermark_delay_sec`. If an arriving event has `event_ts < current_watermark`, route its `tx_id` to `late_dlq_tx_ids` (exclude from on-time window). Otherwise add `amount_idr` to that `account_id`'s on-time transfer sum.",
                "Pre-aggregate `chargebacks` (`{'cb_id': str, 'account_id': str, 'cb_amount_idr': int}`) independently by `account_id` (preventing $1:N \\times 1:M$ fan-out!).",
                "For each `account_id` in `sorted(accounts)`, emit `{'account_id': aid, 'transfer_sum_idr': int, 'chargeback_sum_idr': int, 'net_exposure_idr': transfer_sum_idr - chargeback_sum_idr}`.",
                "Return `{'account_summaries': [...], 'late_dlq_tx_ids': [...], 'final_watermark': int}`."
              ]
            },
            starterCode: `"""Mission paynusa-hard: Mission 2.3: The 470% Transfer Volume Inflation (3-Way Join Fan-Out) & Late Clearing Stream

The rules (also on the mission page):

1. transfers contains streaming dicts: {'tx_id': str, 'account_id': str, 'amount_idr':
   int, 'event_ts': int}.
2. As you iterate through transfers in arrival order, track the running max_event_ts
   seen so far and current_watermark = max_event_ts - watermark_delay_sec. If an
   arriving event has event_ts < current_watermark, route its tx_id to late_dlq_tx_ids
   (exclude from on-time window). Otherwise add amount_idr to that account_id's on-time
   transfer sum.
3. Pre-aggregate chargebacks ({'cb_id': str, 'account_id': str, 'cb_amount_idr': int})
   independently by account_id (preventing $1:N \\times 1:M$ fan-out!).
4. For each account_id in sorted(accounts), emit {'account_id': aid,
   'transfer_sum_idr': int, 'chargeback_sum_idr': int, 'net_exposure_idr':
   transfer_sum_idr - chargeback_sum_idr}.
5. Return {'account_summaries': [...], 'late_dlq_tx_ids': [...], 'final_watermark':
   int}.

Check your work: python3 scripts/job_sim.py verify paynusa-hard <this folder>
"""


def reconcile_multifact_and_watermark(accounts, transfers, chargebacks, watermark_delay_sec=900):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def reconcile_multifact_and_watermark(accounts, transfers, chargebacks, watermark_delay_sec=900):
    max_ts = None
    watermark = 0
    tx_sums = {}
    late_dlq = []

    for t in transfers:
        ets = int(t["event_ts"])
        if max_ts is None or ets > max_ts:
            max_ts = ets
        watermark = max_ts - int(watermark_delay_sec)
        if ets < watermark:
            late_dlq.append(str(t["tx_id"]))
        else:
            aid = str(t["account_id"])
            tx_sums[aid] = tx_sums.get(aid, 0) + int(t["amount_idr"])

    cb_sums = {}
    for c in chargebacks:
        aid = str(c["account_id"])
        cb_sums[aid] = cb_sums.get(aid, 0) + int(c["cb_amount_idr"])

    summaries = []
    for aid in sorted(set(accounts)):
        tsum = tx_sums.get(aid, 0)
        csum = cb_sums.get(aid, 0)
        summaries.append({
            "account_id": aid,
            "transfer_sum_idr": tsum,
            "chargeback_sum_idr": csum,
            "net_exposure_idr": tsum - csum,
        })

    return {
        "account_summaries": summaries,
        "late_dlq_tx_ids": late_dlq,
        "final_watermark": watermark if max_ts is not None else 0,
    }`
          }
        },
        {
          level: "expert",
          missionId: "paynusa-expert",
          difficultyBadge: { id: "🟣 Level 4: EXPERT (Staff DE · ASOF Fraud Feature Store & 15-Min RPO DR)", en: "🟣 Level 4: EXPERT (Staff DE · ASOF Fraud Feature Store & 15-Min RPO DR)" },
          title: {
            id: "Misi 2.4: Model Fraud ML yang 'Curang' (AUC 0.99 → 0.54) & Failover DR 15 Menit",
            en: "Mission 2.4: The Cheating Fraud Model (0.99 → 0.54 AUC Leakage) & 15-Min RPO DR Failover"
          },
          lifecycle: "Serving (ML Feature Store) → Storage (Disaster Recovery)",
          undercurrents: ["Data Architecture", "DataOps", "Software Engineering"],
          incidentTicket: {
            from: "Chief Risk Officer & VP of AI (#ml-fraud-production-crisis)",
            sla: { id: "0 kebocoran label masa depan (ASOF join) · Verifikasi RPO failover < 15 menit (900 detik)", en: "0 future label leakage (ASOF join) · DR failover RPO < 15 min (900s)" },
            brief: {
              id: "Model ML deteksi fraud PayNusa mencetak skor AUC 0.99 saat backtesting, namun hancur menjadi 0.54 saat dirilis ke produksi! Penyebabnya: query tabel latihan men-join transaksi ke `dim_account_risk` memakai skor risiko *hari ini* (yang sudah dinaikkan menjadi 99 tiga hari *setelah* penipuan terjadi!). Selain itu, region utama mengalami gangguan jaringan sehingga Anda harus memvalidasi kesiapan failover Disaster Recovery (RPO <= 900 detik).",
              en: "PayNusa's fraud ML model scored 0.99 AUC in offline backtesting but collapsed to 0.54 AUC in live production! Root cause: the training pipeline joined historical transactions to `dim_account_risk` using *today's* risk score (which was bumped to 99 three days *after* the fraud occurred!). Simultaneously, primary region connectivity degraded and you must verify cross-region Lakehouse Disaster Recovery readiness (`RPO <= 900s`)."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara membangun dataset pelatihan model fraud yang 100% jujur sekaligus memverifikasi kelayakan failover DR?",
              en: "How do you build a 100% leakage-free fraud training dataset while verifying cross-region DR failover readiness?"
            },
            options: [
              {
                text: {
                  id: "A. Acak baris transaksi secara random (random train/test split) dan gunakan tabel risiko terbaru.",
                  en: "A. Randomly shuffle transaction rows (random train/test split) and join the latest risk table."
                },
                correct: false,
                feedback: {
                  id: "❌ Mengacak data deret waktu (random split) dan men-join tabel status terbaru sama-sama membocorkan informasi masa depan ke dalam masa lalu.",
                  en: "❌ Random train/test splits on time-series data and joining current-state dimensions both leak future information into past predictions."
                }
              },
              {
                text: {
                  id: "B. Gunakan Point-in-Time ASOF Join (pilih record fitur dengan updated_at terbesar di mana updated_at <= tx_ts) untuk menyamakan definisi Offline Training dan Online Inference, serta verifikasi selisih waktu snapshot replika DR <= 900 detik sebelum promosi.",
                  en: "B. Enforce a Point-in-Time ASOF Join (picking the feature record with the largest updated_at where updated_at <= tx_ts) to unify Offline Training and Online Inference, and verify DR replica snapshot lag <= 900 seconds before failover promotion."
                },
                correct: true,
                feedback: {
                  id: "✅ Standar Staff ML Data Engineer! ASOF join menjamin model hanya melihat fitur yang benar-benar sudah ada pada milidetik kartu digesek.",
                  en: "✅ Staff ML Data Engineering standard! An ASOF join guarantees the model only sees feature states that actually existed at the exact millisecond of the transaction."
                }
              },
              {
                text: {
                  id: "C. Hapus semua fitur riwayat akun dan hanya gunakan nominal transaksi saja.",
                  en: "C. Drop all historical account features and train only on the raw transaction amount."
                },
                correct: false,
                feedback: {
                  id: "❌ Menghapus fitur kecepatan transaksi (velocity) dan riwayat risiko membuat model buta terhadap pola pengambilalihan akun (account takeover).",
                  en: "❌ Dropping velocity and historical risk features blinds the model to account-takeover bursts."
                }
              }
            ]
          },
          spec: {
            file: "mission_paynusa_expert.py",
            functionSig: "build_asof_fraud_features_and_dr_check(transactions: list[dict], risk_history: list[dict], primary_last_commit_ts: int, dr_replica_commit_ts: int, rpo_limit_sec: int = 900) -> dict",
            rules: {
              id: [
                "`transactions` berisi `[{'tx_id': str, 'account_id': str, 'tx_ts': int, 'amount_idr': int}]`; `risk_history` berisi `[{'account_id': str, 'updated_at': int, 'risk_score': int}]`.",
                "Untuk setiap transaksi (diurutkan berdasarkan `tx_id`), lakukan **Point-in-Time ASOF Join**: cari baris di `risk_history` dengan `account_id` sama yang memiliki `updated_at <= tx_ts` paling besar. Jika tidak ada, `pit_risk_score = 0`. Bandingkan dengan `latest_risk_score` (skor risiko terbaru secara keseluruhan untuk akun tersebut tanpa batas waktu).",
                "Jika `latest_risk_score != pit_risk_score`, tandai `tx_id` ke dalam `leaked_tx_ids` (membuktikan transaksi yang akan bocor jika memakai join naif!).",
                "Hitung kesiapan DR: `replication_lag_sec = primary_last_commit_ts - dr_replica_commit_ts` dan `dr_rpo_ok = (0 <= replication_lag_sec <= rpo_limit_sec)`.",
                "Kembalikan `{'training_features': [...], 'leaked_tx_ids': [...], 'replication_lag_sec': int, 'dr_rpo_ok': bool}`."
              ],
              en: [
                "`transactions` contains `[{'tx_id': str, 'account_id': str, 'tx_ts': int, 'amount_idr': int}]`; `risk_history` contains `[{'account_id': str, 'updated_at': int, 'risk_score': int}]`.",
                "For each transaction (sorted by `tx_id`), perform a **Point-in-Time ASOF Join**: find the `risk_history` entry for that `account_id` with the largest `updated_at <= tx_ts` (if none exists, `pit_risk_score = 0`). Also find `latest_risk_score` (the overall latest risk_score for that account across all time).",
                "If `latest_risk_score != pit_risk_score`, append `tx_id` to `leaked_tx_ids` (proving which rows would suffer future leakage under a naive join!).",
                "Compute DR readiness: `replication_lag_sec = int(primary_last_commit_ts) - int(dr_replica_commit_ts)` and `dr_rpo_ok = (0 <= replication_lag_sec <= int(rpo_limit_sec))`.",
                "Return `{'training_features': [...], 'leaked_tx_ids': [...], 'replication_lag_sec': int, 'dr_rpo_ok': bool}`."
              ]
            },
            starterCode: `"""Mission paynusa-expert: Mission 2.4: The Cheating Fraud Model (0.99 → 0.54 AUC Leakage) & 15-Min RPO DR Failover

The rules (also on the mission page):

1. transactions contains [{'tx_id': str, 'account_id': str, 'tx_ts': int, 'amount_idr':
   int}]; risk_history contains [{'account_id': str, 'updated_at': int, 'risk_score':
   int}].
2. For each transaction (sorted by tx_id), perform a **Point-in-Time ASOF Join**: find
   the risk_history entry for that account_id with the largest updated_at <= tx_ts (if
   none exists, pit_risk_score = 0). Also find latest_risk_score (the overall latest
   risk_score for that account across all time).
3. If latest_risk_score != pit_risk_score, append tx_id to leaked_tx_ids (proving which
   rows would suffer future leakage under a naive join!).
4. Compute DR readiness: replication_lag_sec = int(primary_last_commit_ts) -
   int(dr_replica_commit_ts) and dr_rpo_ok = (0 <= replication_lag_sec <=
   int(rpo_limit_sec)).
5. Return {'training_features': [...], 'leaked_tx_ids': [...], 'replication_lag_sec':
   int, 'dr_rpo_ok': bool}.

Check your work: python3 scripts/job_sim.py verify paynusa-expert <this folder>
"""


def build_asof_fraud_features_and_dr_check(transactions, risk_history, primary_last_commit_ts, dr_replica_commit_ts, rpo_limit_sec=900):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def build_asof_fraud_features_and_dr_check(transactions, risk_history, primary_last_commit_ts, dr_replica_commit_ts, rpo_limit_sec=900):
    by_acc = {}
    latest_by_acc = {}
    for r in risk_history:
        aid = str(r["account_id"])
        ts = int(r["updated_at"])
        score = int(r["risk_score"])
        by_acc.setdefault(aid, []).append((ts, score))
        if aid not in latest_by_acc or ts >= latest_by_acc[aid][0]:
            latest_by_acc[aid] = (ts, score)

    features = []
    leaked = []
    for t in sorted(transactions, key=lambda x: str(x["tx_id"])):
        tx_id = str(t["tx_id"])
        aid = str(t["account_id"])
        tx_ts = int(t["tx_ts"])
        cands = [sc for (uts, sc) in by_acc.get(aid, []) if uts <= tx_ts]
        if cands:
            best_ts, pit_score = max(((uts, sc) for (uts, sc) in by_acc.get(aid, []) if uts <= tx_ts), key=lambda x: x[0])
        else:
            pit_score = 0
        latest_score = latest_by_acc[aid][1] if aid in latest_by_acc else 0
        if latest_score != pit_score:
            leaked.append(tx_id)
        features.append({
            "tx_id": tx_id,
            "account_id": aid,
            "tx_ts": tx_ts,
            "amount_idr": int(t["amount_idr"]),
            "pit_risk_score": pit_score,
        })

    lag = int(primary_last_commit_ts) - int(dr_replica_commit_ts)
    return {
        "training_features": features,
        "leaked_tx_ids": leaked,
        "replication_lag_sec": lag,
        "dr_rpo_ok": (0 <= lag <= int(rpo_limit_sec)),
    }`
          }
        }
      ]
    },
    {
      id: "gokirim",
      icon: "🚚",
      badge: { id: "Cerita 3 · Logistik & IoT Geospasial", en: "Story 3 · Logistics & IoT Mobility" },
      title: { id: "GoKirim Express (Telemetri Armada IoT & Real-Time Surge OLAP)", en: "GoKirim Express (IoT Fleet Telemetry & Real-Time Surge OLAP)" },
      companyProfile: {
        id: "50.000 ping GPS kurir/detik lintas zona waktu WIB/WITA/WIT (Streaming IoT → BigQuery ARRAY<STRUCT> → PyFlink/ClickHouse OLAP).",
        en: "50,000 courier GPS pings/sec across WIB/WITA/WIT timezones (IoT Streaming → BigQuery ARRAY<STRUCT> → PyFlink/ClickHouse OLAP)."
      },
      summary: {
        id: "Bangun sistem data logistik berkecepatan tinggi: bersihkan log GPS terowongan yang korup dan lintas zona waktu dengan generator memori konstan, rancang tabel perjalanan multi-pemberhentian ARRAY<STRUCT> & sessionization jam kerja kurir di BigQuery, tangani ledakan 12.000 paket GPS yang tertunda 40 menit di jalur pegunungan dengan Event-Time Window, hingga rancang mesin surge pricing sub-50ms.",
        en: "Engineer a high-velocity logistics data platform: clean corrupted cross-timezone tunnel GPS logs in flat O(1) memory, model multi-stop delivery trips with BigQuery ARRAY<STRUCT> & 30-minute courier shift sessionization, survive 40-minute mountain cellular blackouts using Event-Time Windows, and architect a sub-50ms geospatial surge-pricing OLAP engine."
      },
      starResumeBullets: [
        "Built a constant-memory Python generator ingestion pipeline normalizing 500k+ multi-timezone (`WIB/WITA/WIT` to `UTC`) courier GPS telemetry pings while quarantining impossible physics/bounding-box jumps in <15 MB RAM.",
        "Modeled multi-stop logistics trips using BigQuery `ARRAY<STRUCT>` nested columns and `LAG()` 30-minute inactivity sessionization, reducing daily warehouse bytes scanned by 84% while automating courier active-shift SLA payroll.",
        "Resolved phantom 400% surge-pricing spikes caused by 40-minute cellular tunnel reconnect bursts by re-architecting stream aggregations from processing-time to geohash-partitioned Event-Time Windows with watermarks.",
        "Designed a dual-path Real-Time OLAP serving layer (Kafka/Redpanda → pre-aggregated H3/Geohash rollup engine + S3 Iceberg Lakehouse) delivering p95 <50ms live dispatch supply/demand ratios under zero-trust OIDC Terraform IaC."
      ],
      levels: [
        {
          level: "easy",
          missionId: "gokirim-easy",
          difficultyBadge: { id: "🟢 Level 1: EASY (Junior DE · Pembersihan Telemetri IoT & Zona Waktu)", en: "🟢 Level 1: EASY (Junior DE · IoT Telemetry Physics & Timezone Gate)" },
          title: {
            id: "Misi 3.1: Blank Spot Terowongan, Lompatan GPS 999 Derajat & Kekacauan WIB/WITA/WIT",
            en: "Mission 3.1: The Tunnel Blackout, 999° GPS Glitches & WIB/WITA/WIT Timezone Chaos"
          },
          lifecycle: "Generation → Ingestion → Storage",
          undercurrents: ["Software Engineering", "DataOps"],
          incidentTicket: {
            from: "Head of Fleet Telemetry (#iot-gps-ingestion)",
            sla: { id: "Memori konstan O(1) · Semua waktu dalam UTC epoch · 0 koordinat mustahil", en: "O(1) flat memory · All timestamps normalized to UTC · 0 impossible coordinates" },
            brief: {
              id: "Kurir yang melewati terowongan bawah tanah dan antarpulau mengirim batch log GPS JSON yang berisi: (1) lompatan koordinat rusak (`lat: 999.0`, kecepatan `280 km/h`), (2) duplikat paket retry dengan `(courier_id, utc_ts)` yang sama, dan (3) tiga zona waktu lokal berbeda (`WIB` UTC+7, `WITA` UTC+8, `WIT` UTC+9) yang membuat durasi pengiriman lintas pulau tampak negatif!",
              en: "Couriers riding through underground tunnels and across islands emit batched GPS logs containing: (1) corrupted hardware glitches (`lat: 999.0`, `speed_kmh: 280`), (2) duplicate packet retries sharing the same `(courier_id, utc_ts)`, and (3) three local timezones (`WIB` UTC+7, `WITA` UTC+8, `WIT` UTC+9) that make inter-island delivery durations appear negative!"
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara membersihkan jutaan ping GPS lintas zona waktu tanpa membuat worker kehabisan RAM?",
              en: "How should you clean and normalize millions of multi-timezone GPS pings without running out of worker RAM?"
            },
            options: [
              {
                text: {
                  id: "A. Simpan waktu lokal apa adanya tanpa konversi zona waktu dan muat seluruh file log harian ke dalam satu list di memori.",
                  en: "A. Store local timestamps as-is without timezone conversion and load the entire daily log into a single in-memory list."
                },
                correct: false,
                feedback: {
                  id: "❌ Menyimpan waktu lokal campuran membuat paket yang dikirim dari Makassar (WITA) ke Jakarta (WIB) terlihat tiba sebelum dikirim, dan memuat jutaan baris sekaligus memicu OOM.",
                  en: "❌ Mixing local timezones makes a parcel flying from WITA to WIB appear to arrive before it departed, and loading millions of pings at once triggers an OOM crash."
                }
              },
              {
                text: {
                  id: "B. Alirkan log secara streaming, konversi semua waktu lokal (WIB +7, WITA +8, WIT +9) ke UTC epoch detik di pintu masuk, karantina koordinat di luar kotak batas Indonesia (-11<=lat<=6, 95<=lon<=141) atau speed > 150 km/jam ke DLQ, dan deduplikasi per (courier_id, utc_ts).",
                  en: "B. Stream records lazily, convert all local timestamps (WIB +7, WITA +8, WIT +9) to UTC epoch seconds at the boundary, quarantine coordinates outside Indonesia's bounding box (-11<=lat<=6, 95<=lon<=141) or speed > 150 km/h to a DLQ, and deduplicate by (courier_id, utc_ts)."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Normalisasi ke UTC di gerbang masuk dan filter batas fisika (bounding box + kecepatan maksimum) adalah fondasi utama pipeline IoT.",
                  en: "✅ Spot on! Normalizing to UTC at the ingestion boundary and enforcing physics bounds (bounding box + max speed) is the bedrock of IoT data engineering."
                }
              },
              {
                text: {
                  id: "C. Rata-ratakan nilai latitude 999.0 dengan ping sebelumnya agar tidak ada baris yang dibuang.",
                  en: "C. Average the 999.0 latitude glitch with the previous ping so no rows are ever quarantined."
                },
                correct: false,
                feedback: {
                  id: "❌ Merata-ratakan `999.0` dengan `-6.2` menghasilkan `496.4` (di luar bumi!), merusak seluruh perhitungan jarak tempuh kurir.",
                  en: "❌ Averaging `999.0` with `-6.2` yields `496.4` (off the planet!), corrupting every downstream mileage calculation."
                }
              }
            ]
          },
          spec: {
            file: "mission_gokirim_easy.py",
            functionSig: "clean_iot_gps_pings(pings: list[dict]) -> dict",
            rules: {
              id: [
                "Setiap item di `pings` adalah dict: `{'ping_id': str, 'courier_id': str, 'local_epoch': int, 'tz': 'WIB'|'WITA'|'WIT'|'UTC', 'lat': float, 'lon': float, 'speed_kmh': float}`.",
                "Konversi `local_epoch` ke `utc_ts`: kurangi offset zona waktu (`WIB`: `7*3600`, `WITA`: `8*3600`, `WIT`: `9*3600`, `UTC`: `0`). Jika `tz` tidak dikenal, masukkan `ping_id` ke `dlq_ping_ids`.",
                "Validasi batas fisika: jika `not (-11.0 <= lat <= 6.0 and 95.0 <= lon <= 141.0)` atau `not (0.0 <= speed_kmh <= 150.0)`, masukkan `ping_id` ke `dlq_ping_ids`.",
                "Deduplikasi ping valid berdasarkan kunci `(courier_id, utc_ts)` (simpan kemunculan valid pertama).",
                "Urutkan ping valid berdasarkan `(courier_id, utc_ts)` dan kembalikan `{'valid_pings': [...], 'dlq_ping_ids': [...]}`."
              ],
              en: [
                "Each item in `pings` is a dict: `{'ping_id': str, 'courier_id': str, 'local_epoch': int, 'tz': 'WIB'|'WITA'|'WIT'|'UTC', 'lat': float, 'lon': float, 'speed_kmh': float}`.",
                "Convert `local_epoch` to `utc_ts` by subtracting the timezone offset (`WIB`: `7*3600`, `WITA`: `8*3600`, `WIT`: `9*3600`, `UTC`: `0`). If `tz` is unknown, append `ping_id` to `dlq_ping_ids`.",
                "Enforce physics & bounding-box validation: if `not (-11.0 <= lat <= 6.0 and 95.0 <= lon <= 141.0)` or `not (0.0 <= speed_kmh <= 150.0)`, append `ping_id` to `dlq_ping_ids`.",
                "Deduplicate valid pings by `(courier_id, utc_ts)` (keep the first valid occurrence).",
                "Sort valid pings by `(courier_id, utc_ts)` and return `{'valid_pings': [...], 'dlq_ping_ids': [...]}`."
              ]
            },
            starterCode: `"""Mission gokirim-easy: Mission 3.1: The Tunnel Blackout, 999° GPS Glitches & WIB/WITA/WIT Timezone Chaos

The rules (also on the mission page):

1. Each item in pings is a dict: {'ping_id': str, 'courier_id': str, 'local_epoch':
   int, 'tz': 'WIB'|'WITA'|'WIT'|'UTC', 'lat': float, 'lon': float, 'speed_kmh':
   float}.
2. Convert local_epoch to utc_ts by subtracting the timezone offset (WIB: 7*3600, WITA:
   8*3600, WIT: 9*3600, UTC: 0). If tz is unknown, append ping_id to dlq_ping_ids.
3. Enforce physics & bounding-box validation: if not (-11.0 <= lat <= 6.0 and 95.0 <=
   lon <= 141.0) or not (0.0 <= speed_kmh <= 150.0), append ping_id to dlq_ping_ids.
4. Deduplicate valid pings by (courier_id, utc_ts) (keep the first valid occurrence).
5. Sort valid pings by (courier_id, utc_ts) and return {'valid_pings': [...],
   'dlq_ping_ids': [...]}.

Check your work: python3 scripts/job_sim.py verify gokirim-easy <this folder>
"""


def clean_iot_gps_pings(pings):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `TZ_OFFSETS = {"UTC": 0, "WIB": 7 * 3600, "WITA": 8 * 3600, "WIT": 9 * 3600}

def clean_iot_gps_pings(pings):
    valid_map = {}
    dlq = []

    for p in pings:
        pid = str(p["ping_id"])
        cid = str(p["courier_id"]).strip()
        tz = str(p.get("tz", "")).strip().upper()
        if tz not in TZ_OFFSETS:
            dlq.append(pid)
            continue
        lat = float(p["lat"])
        lon = float(p["lon"])
        spd = float(p["speed_kmh"])
        if not (-11.0 <= lat <= 6.0 and 95.0 <= lon <= 141.0) or not (0.0 <= spd <= 150.0):
            dlq.append(pid)
            continue
        utc_ts = int(p["local_epoch"]) - TZ_OFFSETS[tz]
        key = (cid, utc_ts)
        if key not in valid_map:
            valid_map[key] = {
                "ping_id": pid,
                "courier_id": cid,
                "utc_ts": utc_ts,
                "lat": lat,
                "lon": lon,
                "speed_kmh": spd,
            }

    valid = [valid_map[k] for k in sorted(valid_map)]
    return {"valid_pings": valid, "dlq_ping_ids": dlq}`
          }
        },
        {
          level: "normal",
          missionId: "gokirim-normal",
          difficultyBadge: { id: "🟡 Level 2: NORMAL (Mid-Level DE · BigQuery ARRAY<STRUCT> & Sessionization)", en: "🟡 Level 2: NORMAL (Mid-Level DE · BigQuery ARRAY<STRUCT> & Sessionization)" },
          title: {
            id: "Misi 3.2: Pemodelan Perjalanan 40 Pemberhentian & Sessionization Jam Kerja Kurir (Jeda 30 Menit)",
            en: "Mission 3.2: 40-Stop Trip ARRAY<STRUCT> Modeling & Courier Shift Sessionization (30-Min Gap)"
          },
          lifecycle: "Storage → Transformation → Serving",
          undercurrents: ["Data Architecture", "Data Management"],
          incidentTicket: {
            from: "VP of Logistics Operations (#courier-sla-analytics)",
            sla: { id: "Sessionization jeda >1800 detik akurat 100% · Struktur trip bersarang", en: "100% accurate >1800s inactivity sessionization · Nested trip stop structure" },
            brief: {
              id: "Tim Operasi butuh dua hal di BigQuery: (1) mengelompokkan ping GPS kurir menjadi 'Sesi Shift Aktif' di mana jeda tanpa ping lebih dari 30 menit (1.800 detik) memulai sesi shift baru untuk perhitungan insentif jam kerja, dan (2) menggabungkan pemberhentian pengiriman ke dalam struktur `ARRAY<STRUCT>` bersarang per `trip_id` agar dashboard tidak perlu men-join 3 tabel raksasa setiap kali dibuka.",
              en: "Logistics Operations needs two things in BigQuery: (1) group courier GPS pings into 'Active Shift Sessions' where an inactivity gap > 30 minutes (1,800 seconds) starts a new shift session for courier incentive pay, and (2) nest delivery stops into an `ARRAY<STRUCT>` array per `trip_id` so dashboards don't perform expensive 3-table joins on every load."
            }
          },
          padmGate: {
            question: {
              id: "Pola SQL/transformasi mana yang paling efisien untuk membentuk sesi shift kurir dan menyimpan pemberhentian multi-stop di BigQuery?",
              en: "Which SQL/transformation pattern most efficiently computes courier shift sessions and models multi-stop trips in BigQuery?"
            },
            options: [
              {
                text: {
                  id: "A. Bagi hari menjadi blok tetap 8 jam tanpa melihat jeda ping, dan ulangi 60 kolom header perjalanan di setiap baris pemberhentian dalam tabel rata (flat table).",
                  en: "A. Slice the day into fixed 8-hour blocks regardless of ping gaps, and repeat 60 trip-header columns on every stop row in a flat denormalized table."
                },
                correct: false,
                feedback: {
                  id: "❌ Blok 8 jam kaku tetap membayar kurir yang mematikan aplikasi selama 4 jam, dan mengulang 60 kolom header 40 kali membengkakkan ukuran scan BigQuery hingga 6x lipat.",
                  en: "❌ Fixed 8-hour blocks overpay couriers who go offline for 4 hours, and repeating 60 trip columns 40 times bloats BigQuery scan bytes by 6x."
                }
              },
              {
                text: {
                  id: "B. Gunakan pola Sessionization LAG(utc_ts) + SUM(is_new_session) dengan ambang 1.800 detik untuk menghitung durasi sesi aktif, dan kelompokkan pemberhentian ke dalam kolom berulang ARRAY<STRUCT> per trip_id.",
                  en: "B. Use the LAG(utc_ts) + cumulative SUM(is_new_session) window pattern with an 1,800-second threshold to compute active shift durations, and nest trip stops into an ARRAY<STRUCT> column per trip_id."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! `LAG()` + `SUM()` kumulatif adalah pola kanonis sessionization, dan `ARRAY<STRUCT>` menyimpan header perjalanan cukup satu kali sambil tetap cepat di-query lewat `UNNEST`.",
                  en: "✅ Spot on! `LAG()` + cumulative `SUM()` is the canonical sessionization pattern, and `ARRAY<STRUCT>` stores trip headers once while supporting fast local `UNNEST` queries."
                }
              },
              {
                text: {
                  id: "C. Gunakan self-join Cartesian `FROM pings a, pings b` untuk mencari selisih waktu antar-ping.",
                  en: "C. Run a Cartesian self-join `FROM pings a, pings b` to find time differences between pings."
                },
                correct: false,
                feedback: {
                  id: "❌ Self-join $O(N^2)$ pada 500 juta ping GPS akan langsung meledakkan kuota slot BigQuery.",
                  en: "❌ An $O(N^2)$ self-join on 500 million GPS pings will immediately exhaust BigQuery slot quotas."
                }
              }
            ]
          },
          spec: {
            file: "mission_gokirim_normal.py",
            functionSig: "sessionize_shifts_and_nest_trips(pings: list[dict], raw_stops: list[dict], gap_threshold_sec: int = 1800) -> dict",
            rules: {
              id: [
                "`pings` berisi `[{'courier_id': str, 'utc_ts': int}]`. Untuk setiap `courier_id` (diurutkan berdasarkan `courier_id`), urutkan `utc_ts` secara menaik. Ping pertama memulai sesi `1`; setiap ping berikutnya yang memiliki `utc_ts - prev_utc_ts > gap_threshold_sec` memulai sesi baru (`session_idx + 1`).",
                "Untuk setiap sesi, hitung `duration_sec = end_ts - start_ts` dan `ping_count`. Keluarkan `sessions` terurut `(courier_id, session_id)` dengan format `{'courier_id': cid, 'session_id': f'{cid}-S{idx}', 'start_ts': int, 'end_ts': int, 'duration_sec': int, 'ping_count': int}`.",
                "`raw_stops` berisi `[{'trip_id': str, 'courier_id': str, 'stop_seq': int, 'hub_id': str, 'delivered_count': int}]`. Kelompokkan ke dalam `nested_trips` terurut `trip_id`: `[{'trip_id': tid, 'courier_id': cid, 'total_delivered': int, 'stops': [{'stop_seq': ..., 'hub_id': ..., 'delivered_count': ...} (urut stop_seq)]}]`.",
                "Kembalikan `{'sessions': [...], 'nested_trips': [...]}`."
              ],
              en: [
                "`pings` contains `[{'courier_id': str, 'utc_ts': int}]`. For each `courier_id` (sorted by `courier_id`), sort `utc_ts` ascending. The first ping starts session `1`; any subsequent ping where `utc_ts - prev_utc_ts > gap_threshold_sec` starts a new session (`session_idx + 1`).",
                "For each session, compute `duration_sec = end_ts - start_ts` and `ping_count`. Emit `sessions` sorted by `(courier_id, session_id)` as `{'courier_id': cid, 'session_id': f'{cid}-S{idx}', 'start_ts': int, 'end_ts': int, 'duration_sec': int, 'ping_count': int}`.",
                "`raw_stops` contains `[{'trip_id': str, 'courier_id': str, 'stop_seq': int, 'hub_id': str, 'delivered_count': int}]`. Group into `nested_trips` sorted by `trip_id`: `[{'trip_id': tid, 'courier_id': cid, 'total_delivered': int, 'stops': [{'stop_seq': ..., 'hub_id': ..., 'delivered_count': ...} (sorted by stop_seq)]}]`.",
                "Return `{'sessions': [...], 'nested_trips': [...]}`."
              ]
            },
            starterCode: `"""Mission gokirim-normal: Mission 3.2: 40-Stop Trip ARRAY<STRUCT> Modeling & Courier Shift Sessionization (30-Min Gap)

The rules (also on the mission page):

1. pings contains [{'courier_id': str, 'utc_ts': int}]. For each courier_id (sorted by
   courier_id), sort utc_ts ascending. The first ping starts session 1; any subsequent
   ping where utc_ts - prev_utc_ts > gap_threshold_sec starts a new session
   (session_idx + 1).
2. For each session, compute duration_sec = end_ts - start_ts and ping_count. Emit
   sessions sorted by (courier_id, session_id) as {'courier_id': cid, 'session_id':
   f'{cid}-S{idx}', 'start_ts': int, 'end_ts': int, 'duration_sec': int, 'ping_count':
   int}.
3. raw_stops contains [{'trip_id': str, 'courier_id': str, 'stop_seq': int, 'hub_id':
   str, 'delivered_count': int}]. Group into nested_trips sorted by trip_id:
   [{'trip_id': tid, 'courier_id': cid, 'total_delivered': int, 'stops': [{'stop_seq':
   ..., 'hub_id': ..., 'delivered_count': ...} (sorted by stop_seq)]}].
4. Return {'sessions': [...], 'nested_trips': [...]}.

Check your work: python3 scripts/job_sim.py verify gokirim-normal <this folder>
"""


def sessionize_shifts_and_nest_trips(pings, raw_stops, gap_threshold_sec=1800):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def sessionize_shifts_and_nest_trips(pings, raw_stops, gap_threshold_sec=1800):
    by_courier = {}
    for p in pings:
        by_courier.setdefault(str(p["courier_id"]), []).append(int(p["utc_ts"]))

    sessions = []
    for cid in sorted(by_courier):
        ts_list = sorted(by_courier[cid])
        if not ts_list:
            continue
        s_idx = 1
        start_ts = ts_list[0]
        prev_ts = ts_list[0]
        cnt = 1
        for ts in ts_list[1:]:
            if ts - prev_ts > int(gap_threshold_sec):
                sessions.append({
                    "courier_id": cid,
                    "session_id": f"{cid}-S{s_idx}",
                    "start_ts": start_ts,
                    "end_ts": prev_ts,
                    "duration_sec": prev_ts - start_ts,
                    "ping_count": cnt,
                })
                s_idx += 1
                start_ts = ts
                cnt = 1
            else:
                cnt += 1
            prev_ts = ts
        sessions.append({
            "courier_id": cid,
            "session_id": f"{cid}-S{s_idx}",
            "start_ts": start_ts,
            "end_ts": prev_ts,
            "duration_sec": prev_ts - start_ts,
            "ping_count": cnt,
        })

    trips_map = {}
    for st in raw_stops:
        tid = str(st["trip_id"])
        t = trips_map.setdefault(tid, {"trip_id": tid, "courier_id": str(st["courier_id"]), "stops": []})
        t["stops"].append({
            "stop_seq": int(st["stop_seq"]),
            "hub_id": str(st["hub_id"]),
            "delivered_count": int(st["delivered_count"]),
        })

    nested_trips = []
    for tid in sorted(trips_map):
        t = trips_map[tid]
        t["stops"].sort(key=lambda x: x["stop_seq"])
        t["total_delivered"] = sum(s["delivered_count"] for s in t["stops"])
        nested_trips.append(t)

    return {"sessions": sessions, "nested_trips": nested_trips}`
          }
        },
        {
          level: "hard",
          missionId: "gokirim-hard",
          difficultyBadge: { id: "🔴 Level 3: HARD (Senior DE · Event-Time Window & Reconnect Burst)", en: "🔴 Level 3: HARD (Senior DE · Event-Time Window & Tunnel Reconnect Burst)" },
          title: {
            id: "Misi 3.3: Delay Terowongan Pegunungan 40 Menit & Lonjakan Palsu Surge Pricing 400%",
            en: "Mission 3.3: The 40-Minute Mountain Pass Delay & Phantom 400% Surge-Pricing Spike"
          },
          lifecycle: "Ingestion (Kafka/Redpanda) → Transformation (PyFlink / Spark Streaming)",
          undercurrents: ["Orchestration", "Data Architecture", "DataOps"],
          incidentTicket: {
            from: "Director of Marketplace Dispatch (#dispatch-streaming-incident)",
            sla: { id: "Agregasi Tumbling Window 5 menit berbasis Event-Time + Watermark", en: "5-minute Tumbling Window aggregation by Event-Time + Watermark" },
            brief: {
              id: "Ratusan truk kurir yang melintasi jalur Puncak kehilangan sinyal seluler selama 35 menit (`14:05–14:40`). Saat sinyal kembali pada pukul `14:45`, 12.000 paket GPS yang tersimpan di memori HP kurir tumpah ke Kafka sekaligus! Karena pipeline lama memakai Processing Time (waktu tiba di server), sistem melaporkan 0 kurir aktif pukul `14:15` (memicu tarif surge 400% palsu) lalu melaporkan kemacetan palsu pukul `14:45`.",
              en: "Hundreds of couriers crossing a mountain pass lose cellular signal for 35 minutes (`14:05–14:40`). When they reconnect at `14:45`, 12,000 buffered GPS packets flood Kafka at once! Because the legacy processor grouped windows by Processing Time (server arrival time), it reported 0 active couriers at `14:15` (triggering a phantom 400% surge price) and a fake traffic jam at `14:45`."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara memastikan 12.000 paket yang baru tiba pukul 14:45 dihitung ke jendela waktu 5 menit tempat kurir benar-benar berada saat itu?",
              en: "How do you ensure the 12,000 buffered packets arriving at 14:45 are attributed to the true 5-minute windows when the couriers were actually at those coordinates?"
            },
            options: [
              {
                text: {
                  id: "A. Gunakan waktu tiba di broker Kafka (`processing_ts`) tetapi perbesar ukuran jendela menjadi 3 jam.",
                  en: "A. Group by Kafka broker arrival timestamp (`processing_ts`) but widen the window to 3 hours."
                },
                correct: false,
                feedback: {
                  id: "❌ Jendela 3 jam terlalu lambat untuk dispatch waktu-nyata, dan processing time tetap menempatkan kejadian masa lalu di waktu sekarang.",
                  en: "❌ A 3-hour window is useless for live dispatch, and processing time still attributes past events to the wrong window."
                }
              },
              {
                text: {
                  id: "B. Kelompokkan ke dalam Tumbling Window 5 menit (300 detik) berdasarkan Event Time (`event_ts // 300 * 300`) dengan Watermark (`max_event_ts - allowed_lateness_sec`), dan pisahkan event yang melampaui watermark ke `dropped_late_events`.",
                  en: "B. Assign events to 5-minute (300s) Tumbling Windows by payload Event Time (`(event_ts // 300) * 300`) with a Watermark (`max_event_ts - allowed_lateness_sec`), routing events older than the watermark to `dropped_late_events`."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Event-time windowing menempatkan ping pukul 14:12 tepat ke jendela `[14:10, 14:15)` meskipun paketnya baru tiba pukul 14:45.",
                  en: "✅ Spot on! Event-time windowing places a 14:12 ping squarely into the `[14:10, 14:15)` window even if the packet arrives at 14:45."
                }
              },
              {
                text: {
                  id: "C. Matikan fitur offline buffer di aplikasi mobile kurir agar paket selama di terowongan langsung dibuang.",
                  en: "C. Disable offline buffering in the courier mobile app so packets during cellular blackouts are thrown away."
                },
                correct: false,
                feedback: {
                  id: "❌ Membuang telemetri selama di jalur tanpa sinyal menghilangkan bukti jarak tempuh dan SLA kurir.",
                  en: "❌ Discarding offline telemetry destroys courier mileage proof and SLA tracking."
                }
              }
            ]
          },
          spec: {
            file: "mission_gokirim_hard.py",
            functionSig: "process_event_time_windows(stream_events: list[dict], window_size_sec: int = 300, watermark_delay_sec: int = 2400) -> dict",
            rules: {
              id: [
                "`stream_events` berisi `[{'event_id': str, 'courier_id': str, 'geohash': str, 'event_ts': int, 'arrival_ts': int}]` sesuai urutan tiba di server.",
                "Saat mengiterasi `stream_events`, perbarui `max_event_ts = max(max_event_ts, event_ts)` dan `watermark = max_event_ts - watermark_delay_sec`.",
                "Jika `event_ts < watermark`, masukkan `event_id` ke `late_event_ids` (jangan masukkan ke agregat window).",
                "Jika `event_ts >= watermark`, petakan ke jendela tumbling `window_start = (event_ts // window_size_sec) * window_size_sec`. Hitung jumlah `active_couriers` unik (`COUNT(DISTINCT courier_id)`) dan `ping_count` per `(window_start, geohash)`.",
                "Kembalikan `{'window_aggregates': [...urut (window_start, geohash)...], 'late_event_ids': [...], 'final_watermark': int}` di mana tiap item agregat adalah `{'window_start': int, 'window_end': window_start + window_size_sec, 'geohash': str, 'active_couriers': int, 'ping_count': int}`."
              ],
              en: [
                "`stream_events` contains `[{'event_id': str, 'courier_id': str, 'geohash': str, 'event_ts': int, 'arrival_ts': int}]` in arrival order.",
                "As each event arrives, update `max_event_ts = max(max_event_ts, event_ts)` and `watermark = max_event_ts - watermark_delay_sec`.",
                "If `event_ts < watermark`, append `event_id` to `late_event_ids` (do not include in window aggregates).",
                "Otherwise assign the event to its event-time tumbling window `window_start = (event_ts // window_size_sec) * window_size_sec`. Track distinct `courier_id`s (`active_couriers`) and `ping_count` per `(window_start, geohash)`.",
                "Return `{'window_aggregates': [...sorted by (window_start, geohash)...], 'late_event_ids': [...], 'final_watermark': int}` where each aggregate dict has `{'window_start': int, 'window_end': window_start + window_size_sec, 'geohash': str, 'active_couriers': int, 'ping_count': int}`."
              ]
            },
            starterCode: `"""Mission gokirim-hard: Mission 3.3: The 40-Minute Mountain Pass Delay & Phantom 400% Surge-Pricing Spike

The rules (also on the mission page):

1. stream_events contains [{'event_id': str, 'courier_id': str, 'geohash': str,
   'event_ts': int, 'arrival_ts': int}] in arrival order.
2. As each event arrives, update max_event_ts = max(max_event_ts, event_ts) and
   watermark = max_event_ts - watermark_delay_sec.
3. If event_ts < watermark, append event_id to late_event_ids (do not include in window
   aggregates).
4. Otherwise assign the event to its event-time tumbling window window_start =
   (event_ts // window_size_sec) * window_size_sec. Track distinct courier_ids
   (active_couriers) and ping_count per (window_start, geohash).
5. Return {'window_aggregates': [...sorted by (window_start, geohash)...],
   'late_event_ids': [...], 'final_watermark': int} where each aggregate dict has
   {'window_start': int, 'window_end': window_start + window_size_sec, 'geohash': str,
   'active_couriers': int, 'ping_count': int}.

Check your work: python3 scripts/job_sim.py verify gokirim-hard <this folder>
"""


def process_event_time_windows(stream_events, window_size_sec=300, watermark_delay_sec=2400):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def process_event_time_windows(stream_events, window_size_sec=300, watermark_delay_sec=2400):
    max_ts = None
    watermark = 0
    windows = {}
    late_ids = []
    w_size = int(window_size_sec)

    for ev in stream_events:
        ets = int(ev["event_ts"])
        if max_ts is None or ets > max_ts:
            max_ts = ets
        watermark = max_ts - int(watermark_delay_sec)
        if ets < watermark:
            late_ids.append(str(ev["event_id"]))
            continue
        w_start = (ets // w_size) * w_size
        geo = str(ev["geohash"])
        key = (w_start, geo)
        bucket = windows.setdefault(key, {"couriers": set(), "pings": 0})
        bucket["couriers"].add(str(ev["courier_id"]))
        bucket["pings"] += 1

    aggs = []
    for (w_start, geo) in sorted(windows):
        b = windows[(w_start, geo)]
        aggs.append({
            "window_start": w_start,
            "window_end": w_start + w_size,
            "geohash": geo,
            "active_couriers": len(b["couriers"]),
            "ping_count": b["pings"],
        })

    return {
        "window_aggregates": aggs,
        "late_event_ids": late_ids,
        "final_watermark": watermark if max_ts is not None else 0,
    }`
          }
        },
        {
          level: "expert",
          missionId: "gokirim-expert",
          difficultyBadge: { id: "🟣 Level 4: EXPERT (Staff DE · Real-Time OLAP Surge Engine & Zero-Trust IaC)", en: "🟣 Level 4: EXPERT (Staff DE · Real-Time OLAP Surge Engine & Zero-Trust IaC)" },
          title: {
            id: "Misi 3.4: Mesin Surge Pricing Real-Time OLAP (<50ms) & Audit Keamanan Terraform IaC",
            en: "Mission 3.4: Sub-50ms Real-Time OLAP Surge Engine & Zero-Trust Terraform IaC Audit"
          },
          lifecycle: "Serving (Real-Time OLAP) → Security & Infrastructure as Code",
          undercurrents: ["Data Architecture", "Security", "DataOps"],
          incidentTicket: {
            from: "VP of Engineering & Cloud Security Architect (#architecture-review-board)",
            sla: { id: "Latensi p95 < 50ms untuk 5.000 driver konkuren · 0 celah keamanan Terraform IaC", en: "p95 latency < 50ms at 5,000 QPS · 0 Terraform IaC security violations" },
            brief: {
              id: "Aplikasi driver GoKirim memicu 5.000 query/detik untuk mengecek rasio penawaran/permintaan (surge multiplier) per sel Geohash. Menjalankan ini langsung di cloud warehouse tradisional memakan waktu 4,5 detik per query dan biaya $65.000/bulan. Anda harus membangun Materialized Rollup Index ala ClickHouse/Pinot untuk serving sub-50ms sekaligus mengaudit konfigurasi Terraform produksi agar bebas dari bucket publik, wildcard IAM `*`, dan static access key.",
              en: "GoKirim's driver app fires 5,000 queries/sec checking live supply/demand surge multipliers per Geohash cell. Running this against a traditional cloud warehouse takes 4.5s per query and costs $65,000/month. You must build a pre-aggregated Real-Time OLAP Rollup Index (ClickHouse/Pinot pattern) for sub-50ms serving and audit the production Terraform IaC plan for public buckets, wildcard IAM `*`, and static credentials."
            }
          },
          padmGate: {
            question: {
              id: "Arsitektur serving dan pola deployment cloud mana yang mampu melayani 5.000 QPS di bawah 50ms secara aman?",
              en: "Which serving architecture and cloud deployment pattern serves 5,000 QPS under 50ms securely?"
            },
            options: [
              {
                text: {
                  id: "A. Arahkan 5.000 aplikasi driver langsung ke tabel fakta mentah BigQuery menggunakan satu AWS/GCP static access key yang ditanam di aplikasi mobile.",
                  en: "A. Point all 5,000 driver mobile apps directly at the raw BigQuery fact table using a shared static service account JSON key embedded in the mobile app."
                },
                correct: false,
                feedback: {
                  id: "❌ Bencana ganda: BigQuery punya batas konkurensi query interaktif dan biaya scan tinggi, sedangkan menanam kunci statis di aplikasi mobile membocorkan seluruh database ke publik!",
                  en: "❌ Double catastrophe: Traditional cloud warehouses are not built for 5,000 QPS point lookups, and embedding a static key in a mobile app leaks your entire warehouse!"
                }
              },
              {
                text: {
                  id: "B. Gunakan arsitektur jalur ganda: alirkan Kafka ke Real-Time OLAP Rollup (ClickHouse/Pinot pre-aggregated per geohash) untuk pembacaan <50ms + S3/GCS Iceberg untuk histori ML, dan deploy via Terraform IaC menggunakan Keyless OIDC, enkripsi KMS, dan IAM least-privilege.",
                  en: "B. Use a dual-path serving architecture: stream Kafka into a Real-Time OLAP Rollup table (ClickHouse/Pinot pre-aggregated by geohash) for <50ms lookups + S3/GCS Iceberg for historical ML, deployed via Keyless OIDC Terraform IaC with KMS encryption and least-privilege IAM."
                },
                correct: true,
                feedback: {
                  id: "✅ Arsitektur Principal DE! Real-Time OLAP melayani ribuan QPS dari indeks pra-agregasi dalam milidetik, sementara Keyless OIDC + private endpoint menutup celah kebocoran kredensial.",
                  en: "✅ Principal DE architecture! Real-Time OLAP serves thousands of QPS from pre-aggregated rollup indexes in milliseconds, while Keyless OIDC + private endpoints eliminate static credential leaks."
                }
              },
              {
                text: {
                  id: "C. Simpan seluruh histori GPS 5 tahun di satu instance Redis RAM 16 GB.",
                  en: "C. Store 5 years of raw GPS history inside a single 16 GB RAM Redis instance."
                },
                correct: false,
                feedback: {
                  id: "❌ 5 tahun ping GPS berukuran puluhan terabyte—tidak akan muat di RAM 16 GB Redis.",
                  en: "❌ 5 years of raw GPS pings is puluhan terabytes—it will immediately crash a 16 GB Redis instance."
                }
              }
            ]
          },
          spec: {
            file: "mission_gokirim_expert.py",
            functionSig: "compute_olap_surge_and_audit_iac(cell_events: list[dict], tf_resources: list[dict]) -> dict",
            rules: {
              id: [
                "`cell_events` berisi `[{'geohash': str, 'orders_requested': int, 'couriers_available': int}]`. Pra-agregasi (jumlahkan `orders_requested` dan `couriers_available`) per `geohash` (diurutkan berdasarkan `geohash`).",
                "Hitung `surge_multiplier` per `geohash`: jika `total_couriers == 0`, `surge = 2.5` (jika `total_orders > 0` else `1.0`). Jika `ratio = total_orders / total_couriers`: jika `ratio <= 1.0`, `surge = 1.0`; jika `ratio > 1.0`, `surge = min(2.5, round(1.0 + (ratio - 1.0) * 0.5, 2))`.",
                "`tf_resources` berisi daftar resource Terraform: `[{'name': str, 'public_access': bool, 'kms_encrypted': bool, 'iam_wildcard': bool, 'uses_static_keys': bool}]`.",
                "Audit setiap resource: kumpulkan `violations` (`[{'resource': name, 'issues': [...]}]`) untuk setiap bendera yang melanggar Zero-Trust (`'public_access'` jika `public_access=True`, `'missing_kms'` jika `kms_encrypted=False`, `'iam_wildcard'` jika `iam_wildcard=True`, `'static_keys'` jika `uses_static_keys=True`).",
                "Kembalikan `{'surge_index': {geohash: surge_multiplier}, 'iac_violations': [...], 'iac_compliant': bool}` (`iac_compliant` bernilai `True` jika `len(iac_violations) == 0`)."
              ],
              en: [
                "`cell_events` contains `[{'geohash': str, 'orders_requested': int, 'couriers_available': int}]`. Pre-aggregate (sum `orders_requested` and `couriers_available`) per `geohash` (sorted by `geohash`).",
                "Compute `surge_multiplier` per `geohash`: if `total_couriers == 0`, `surge = 2.5` (when `total_orders > 0` else `1.0`). Otherwise let `ratio = total_orders / total_couriers`: if `ratio <= 1.0`, `surge = 1.0`; else `surge = min(2.5, round(1.0 + (ratio - 1.0) * 0.5, 2))`.",
                "`tf_resources` contains Terraform resource dicts: `[{'name': str, 'public_access': bool, 'kms_encrypted': bool, 'iam_wildcard': bool, 'uses_static_keys': bool}]`.",
                "Audit each resource: record `iac_violations` (`[{'resource': name, 'issues': [...]}]`) for any Zero-Trust violation in order: `'public_access'` if `public_access` is True, `'missing_kms'` if `kms_encrypted` is False, `'iam_wildcard'` if `iam_wildcard` is True, `'static_keys'` if `uses_static_keys` is True.",
                "Return `{'surge_index': {geohash: surge_multiplier}, 'iac_violations': [...], 'iac_compliant': bool}` (`iac_compliant` is `True` iff `len(iac_violations) == 0`)."
              ]
            },
            starterCode: `"""Mission gokirim-expert: Mission 3.4: Sub-50ms Real-Time OLAP Surge Engine & Zero-Trust Terraform IaC Audit

The rules (also on the mission page):

1. cell_events contains [{'geohash': str, 'orders_requested': int,
   'couriers_available': int}]. Pre-aggregate (sum orders_requested and
   couriers_available) per geohash (sorted by geohash).
2. Compute surge_multiplier per geohash: if total_couriers == 0, surge = 2.5 (when
   total_orders > 0 else 1.0). Otherwise let ratio = total_orders / total_couriers: if
   ratio <= 1.0, surge = 1.0; else surge = min(2.5, round(1.0 + (ratio - 1.0) * 0.5,
   2)).
3. tf_resources contains Terraform resource dicts: [{'name': str, 'public_access':
   bool, 'kms_encrypted': bool, 'iam_wildcard': bool, 'uses_static_keys': bool}].
4. Audit each resource: record iac_violations ([{'resource': name, 'issues': [...]}])
   for any Zero-Trust violation in order: 'public_access' if public_access is True,
   'missing_kms' if kms_encrypted is False, 'iam_wildcard' if iam_wildcard is True,
   'static_keys' if uses_static_keys is True.
5. Return {'surge_index': {geohash: surge_multiplier}, 'iac_violations': [...],
   'iac_compliant': bool} (iac_compliant is True iff len(iac_violations) == 0).

Check your work: python3 scripts/job_sim.py verify gokirim-expert <this folder>
"""


def compute_olap_surge_and_audit_iac(cell_events, tf_resources):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def compute_olap_surge_and_audit_iac(cell_events, tf_resources):
    cells = {}
    for ev in cell_events:
        g = str(ev["geohash"])
        c = cells.setdefault(g, {"orders": 0, "couriers": 0})
        c["orders"] += int(ev["orders_requested"])
        c["couriers"] += int(ev["couriers_available"])

    surge_index = {}
    for g in sorted(cells):
        orders = cells[g]["orders"]
        couriers = cells[g]["couriers"]
        if couriers == 0:
            surge = 2.5 if orders > 0 else 1.0
        else:
            ratio = orders / couriers
            surge = 1.0 if ratio <= 1.0 else min(2.5, round(1.0 + (ratio - 1.0) * 0.5, 2))
        surge_index[g] = surge

    violations = []
    for res in tf_resources:
        issues = []
        if res.get("public_access"):
            issues.append("public_access")
        if not res.get("kms_encrypted", False):
            issues.append("missing_kms")
        if res.get("iam_wildcard"):
            issues.append("iam_wildcard")
        if res.get("uses_static_keys"):
            issues.append("static_keys")
        if issues:
            violations.append({"resource": str(res["name"]), "issues": issues})

    return {
        "surge_index": surge_index,
        "iac_violations": violations,
        "iac_compliant": (len(violations) == 0),
    }`
          }
        }
      ]
    },
    {
      id: "cloudpulse",
      icon: "🧬",
      badge: { id: "Cerita 4 · B2B Healthcare SaaS & AI RAG", en: "Story 4 · B2B Healthcare SaaS & AI RAG" },
      title: { id: "CloudPulse & MedFlow AI (Multi-Tenant Lakehouse, MDM & Clinical RAG)", en: "CloudPulse & MedFlow AI (Multi-Tenant Lakehouse, MDM & Clinical RAG)" },
      companyProfile: {
        id: "Platform SaaS 400 Rumah Sakit & Klinik (REST API Ingestion → Brownfield ERP Strangler Fig & MDM → Iceberg/Delta Lakehouse → Multi-Tenant pgvector RAG).",
        en: "400-Hospital B2B Healthcare SaaS Platform (REST API Ingestion → Brownfield ERP Strangler Fig & MDM → Iceberg/Delta Lakehouse → Multi-Tenant pgvector RAG)."
      },
      summary: {
        id: "Modernisasi platform ERP kesehatan berusia 12 tahun menjadi Open Lakehouse & Asisten AI Klinis: ganti OFFSET pagination yang bocor dengan Cursor Pagination & Atomic Checkpointing, bangun mesin Master Data Management (MDM) Golden Patient Record & migrasi Strangler Fig tanpa downtime, atasi krisis 1,4 juta file Parquet kecil di Iceberg/Delta Lake & jalankan VACUUM GDPR, hingga bangun pipeline RAG pgvector hemat biaya 98% dengan isolasi tenant ketat.",
        en: "Modernize a 12-year-old healthcare ERP into an Open Lakehouse & Clinical AI Assistant: replace leaky OFFSET pagination with Cursor Pagination & Atomic Checkpointing, build an MDM Golden Patient Record engine & zero-downtime Strangler Fig migration, solve a 1.4M small-file crisis on Apache Iceberg/Delta Lake with GDPR snapshot expiration, and ship a 98%-cheaper SHA-256 incremental pgvector RAG pipeline with strict multi-tenant RLS."
      },
      starResumeBullets: [
        "Replaced leaky OFFSET pagination across 400 clinic REST APIs with deterministic keyset cursor pagination, exponential backoff with jitter, and crash-safe atomic watermark checkpointing, eliminating 100% of mid-run duplicate/skipped records.",
        "Executed a zero-downtime Brownfield Strangler Fig ERP migration and Master Data Management (MDM) entity resolution engine (`ERP > CRM > Billing CSV` survivorship) achieving 100.00% legacy parity before cutover.",
        "Resolved a 1.4-million small-file S3 Lakehouse bottleneck via Apache Iceberg/Delta Lake bin-packing compaction (95% file reduction, 20x faster query planning) and automated GDPR physical snapshot expiration (`VACUUM`).",
        "Built a HIPAA-compliant multi-tenant clinical RAG vector pipeline using content-addressable SHA-256 change detection (cutting embedding API costs by 98%) and mandatory pre-filtered `tenant_id` HNSW vector search."
      ],
      levels: [
        {
          level: "easy",
          missionId: "cloudpulse-easy",
          difficultyBadge: { id: "🟢 Level 1: EASY (Junior DE · Cursor Pagination & Crash-Safe Checkpoint)", en: "🟢 Level 1: EASY (Junior DE · Cursor Pagination & Crash-Safe Checkpoint)" },
          title: {
            id: "Misi 4.1: Jebakan OFFSET Pagination 400 API Klinik & Crash Tengah Malam",
            en: "Mission 4.1: The 400-Clinic REST API OFFSET Pagination Trap & Midnight Crash"
          },
          lifecycle: "Generation → Ingestion",
          undercurrents: ["Software Engineering", "Orchestration"],
          incidentTicket: {
            from: "Lead Integrations Engineer (#clinic-api-sync)",
            sla: { id: "0 baris terlewat/ganda saat data baru masuk · Resume bersih dari checkpoint terakhir", en: "0 skipped/duplicate rows under live inserts · Clean resume from last committed cursor" },
            brief: {
              id: "Skrip penarik data rekam kunjungan dari 400 API klinik memakai `LIMIT 100 OFFSET N` dan menyimpan checkpoint ke file *sebelum* menulis data ke disk. Akibatnya: (1) setiap kali ada pasien baru mendaftar saat penarikan berlangsung, baris bergeser sehingga ada data yang ganda dan terlewat, dan (2) saat terkena rate limit `HTTP 429` di halaman ke-143, skrip crash tetapi checkpoint sudah terlanjur maju sehingga halaman 143 hilang selamanya!",
              en: "The script pulling patient visit records from 400 clinic APIs uses `LIMIT 100 OFFSET N` and writes its checkpoint file *before* flushing records to disk. As a result: (1) live clinic inserts shift page boundaries, causing silent duplicates and skipped visits, and (2) when an `HTTP 429` crash hits on page 143, the pre-committed checkpoint causes the next run to skip page 143 forever!"
            }
          },
          padmGate: {
            question: {
              id: "Urutan eksekusi dan pola paginasi mana yang tahan terhadap penyisipan data langsung maupun crash di tengah jalan?",
              en: "Which pagination pattern and checkpoint commit ordering survives both live inserts and mid-run crashes?"
            },
            options: [
              {
                text: {
                  id: "A. Tetap gunakan OFFSET pagination tetapi simpan nomor halaman ke checkpoint.json sebelum memanggil API.",
                  en: "A. Keep OFFSET pagination and write the page number to checkpoint.json before calling the API."
                },
                correct: false,
                feedback: {
                  id: "❌ Menyimpan checkpoint sebelum data tersimpan di disk menjamin kehilangan data saat proses crash di tengah jalan.",
                  en: "❌ Advancing the checkpoint before data is flushed to disk guarantees data loss on any mid-run crash."
                }
              },
              {
                text: {
                  id: "B. Gunakan Keyset / Cursor Pagination (`updated_at > last_cursor` atau `(updated_at, record_id) > cursor`), deduplikasi berdasarkan `record_id`, dan patuhi urutan atomik: Tulis Data → Flush/Validasi → Baru Perbarui `next_cursor`.",
                  en: "B. Use Keyset / Cursor Pagination (`(updated_at, record_id) > last_cursor`), deduplicate by `record_id`, and enforce atomic ordering: Write Batch → Flush/Validate → Commit `new_cursor`."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Cursor pagination kebal terhadap pergeseran baris baru, dan menyimpan cursor paling akhir ditambah deduplikasi ID menjamin pemulihan 100% aman.",
                  en: "✅ Spot on! Keyset cursor pagination is immune to row-shift drift, and committing the cursor last paired with ID deduplication guarantees crash-safe recovery."
                }
              },
              {
                text: {
                  id: "C. Tarik seluruh data 5 tahun dalam satu HTTP request raksasa tanpa pagination.",
                  en: "C. Fetch all 5 years of clinic records in a single giant unpaginated HTTP request."
                },
                correct: false,
                feedback: {
                  id: "❌ Request raksasa tanpa pagination akan langsung diputus oleh timeout gateway HTTP (504 Gateway Timeout) dan OOM.",
                  en: "❌ An unpaginated multi-gigabyte HTTP response will immediately fail with a 504 Gateway Timeout or OOM."
                }
              }
            ]
          },
          spec: {
            file: "mission_cloudpulse_easy.py",
            functionSig: "ingest_cursor_pages_safely(pages: list[dict], initial_cursor: str | None = None) -> dict",
            rules: {
              id: [
                "`pages` berisi daftar halaman respons API: `[{'cursor': 'C0', 'next_cursor': 'C1', 'status_code': 200, 'records': [{'record_id': str, 'patient_id': str, 'updated_at': str}]}]`.",
                "Jika `initial_cursor` diberikan (bukan `None`), lewati semua halaman di awal hingga menemukan halaman dengan `page['cursor'] == initial_cursor`, lalu mulai memproses dari halaman tersebut.",
                "Jika sebuah halaman memiliki `status_code != 200` (misal `429` atau `503`), HENTIKAN pembacaan halaman berikutnya seketika (`stopped_on_error = True`), dan JANGAN memajukan `committed_cursor` untuk halaman yang gagal tersebut (crash-safe checkpoint ordering!).",
                "Untuk setiap halaman `status_code == 200`, deduplikasi `records` berdasarkan `record_id` (pertahankan yang memiliki `updated_at` terbaru), baru kemudian perbarui `committed_cursor = page['next_cursor']`.",
                "Kembalikan `{'records': [...urut record_id...], 'committed_cursor': str | None, 'pages_processed': int, 'stopped_on_error': bool}`."
              ],
              en: [
                "`pages` is a list of API page responses: `[{'cursor': 'C0', 'next_cursor': 'C1', 'status_code': 200, 'records': [{'record_id': str, 'patient_id': str, 'updated_at': str}]}]`.",
                "If `initial_cursor` is not `None`, skip leading pages until `page['cursor'] == initial_cursor` and resume from there.",
                "If a page has `status_code != 200` (e.g. `429` or `503`), STOP processing further pages immediately (`stopped_on_error = True`), and DO NOT advance `committed_cursor` for the failed page (crash-safe watermark ordering!).",
                "For each `status_code == 200` page, deduplicate `records` by `record_id` (keeping the latest `updated_at`), and only then advance `committed_cursor = page['next_cursor']`.",
                "Return `{'records': [...sorted by record_id...], 'committed_cursor': str | None, 'pages_processed': int, 'stopped_on_error': bool}`."
              ]
            },
            starterCode: `"""Mission cloudpulse-easy: Mission 4.1: The 400-Clinic REST API OFFSET Pagination Trap & Midnight Crash

The rules (also on the mission page):

1. pages is a list of API page responses: [{'cursor': 'C0', 'next_cursor': 'C1',
   'status_code': 200, 'records': [{'record_id': str, 'patient_id': str, 'updated_at':
   str}]}].
2. If initial_cursor is not None, skip leading pages until page['cursor'] ==
   initial_cursor and resume from there.
3. If a page has status_code != 200 (e.g. 429 or 503), STOP processing further pages
   immediately (stopped_on_error = True), and DO NOT advance committed_cursor for the
   failed page (crash-safe watermark ordering!).
4. For each status_code == 200 page, deduplicate records by record_id (keeping the
   latest updated_at), and only then advance committed_cursor = page['next_cursor'].
5. Return {'records': [...sorted by record_id...], 'committed_cursor': str | None,
   'pages_processed': int, 'stopped_on_error': bool}.

Check your work: python3 scripts/job_sim.py verify cloudpulse-easy <this folder>
"""


def ingest_cursor_pages_safely(pages, initial_cursor=None):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `def ingest_cursor_pages_safely(pages, initial_cursor=None):
    started = (initial_cursor is None)
    committed = initial_cursor
    by_id = {}
    pages_ok = 0
    stopped = False

    for p in pages:
        if not started:
            if p.get("cursor") == initial_cursor:
                started = True
            else:
                continue
        if int(p.get("status_code", 200)) != 200:
            stopped = True
            break
        for rec in p.get("records", []):
            rid = str(rec["record_id"])
            uts = str(rec["updated_at"])
            if rid not in by_id or uts >= str(by_id[rid]["updated_at"]):
                by_id[rid] = {
                    "record_id": rid,
                    "patient_id": str(rec["patient_id"]),
                    "updated_at": uts,
                }
        committed = p.get("next_cursor")
        pages_ok += 1

    return {
        "records": [by_id[k] for k in sorted(by_id)],
        "committed_cursor": committed,
        "pages_processed": pages_ok,
        "stopped_on_error": stopped,
    }`
          }
        },
        {
          level: "normal",
          missionId: "cloudpulse-normal",
          difficultyBadge: { id: "🟡 Level 2: NORMAL (Mid-Level DE · MDM Golden Record & Brownfield Strangler Fig)", en: "🟡 Level 2: NORMAL (Mid-Level DE · MDM Golden Record & Brownfield Strangler Fig)" },
          title: {
            id: "Misi 4.2: Pasien Ganda di 3 Sistem (MDM Survivorship) & Migrasi ERP Strangler Fig",
            en: "Mission 4.2: Duplicate Patients Across 3 Silos (MDM Survivorship) & Strangler Fig ERP Migration"
          },
          lifecycle: "Storage → Transformation → Data Management",
          undercurrents: ["Data Management", "Data Architecture", "DataOps"],
          incidentTicket: {
            from: "VP of Clinical Data & Enterprise Architect (#erp-modernization)",
            sla: { id: "1 Golden Record per NIK pasien (ERP > CRM > CSV) · 100% paritas Strangler Fig", en: "1 Golden Record per patient NIK (ERP > CRM > CSV) · 100% Strangler Fig parity" },
            brief: {
              id: "Satu pasien yang sama muncul sebagai 3 baris berbeda di sistem rumah sakit: di `ERP` tertulis `'Budi Santoso'`, di `CRM` tertulis `'Santoso, Budi'`, dan di `CSV` tagihan tertulis `'B. Santoso'` dengan alamat lama. Sementara itu, 42 laporan rumah sakit masih membaca tabel warisan `legacy_clinic_totals`. Anda harus membangun mesin Master Data Management (MDM) dengan aturan survivorship (`ERP > CRM > CSV`) dan memverifikasi paritas Strangler Fig sebelum memensiunkan tabel warisan.",
              en: "A single patient appears as 3 conflicting records across hospital silos: `'Budi Santoso'` in the clinical `ERP`, `'Santoso, Budi'` in the `CRM`, and `'B. Santoso'` with an outdated city in the billing `CSV`. Meanwhile, 42 hospital reports still query the legacy SQL Server table. You must build an MDM Golden Record resolution engine (`ERP > CRM > CSV` source survivorship) and verify Strangler Fig parity before retiring the legacy pipeline."
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana aturan survivorship MDM dan strategi migrasi brownfield yang aman agar 42 laporan rumah sakit tidak rusak?",
              en: "Which MDM survivorship rule and brownfield migration strategy safely modernizes the ERP without breaking 42 hospital reports?"
            },
            options: [
              {
                text: {
                  id: "A. Matikan database SQL Server lama hari Jumat malam dan paksa semua 42 laporan menulis ulang query mereka di hari Senin.",
                  en: "A. Turn off the legacy SQL Server database on Friday night and force all 42 hospital reports to rewrite their queries on Monday morning."
                },
                correct: false,
                feedback: {
                  id: "❌ Big-bang cutover tanpa verifikasi paritas hampir selalu gagal dan melumpuhkan operasional rumah sakit di hari Senin.",
                  en: "❌ A big-bang cutover without parity verification breaks clinical dashboards on Monday morning."
                }
              },
              {
                text: {
                  id: "B. Kelompokkan entitas berdasarkan kunci identitas bersih (NIK), terapkan urutan otoritas sumber (`ERP > CRM > CSV`, lalu `updated_at` terbaru jika sumber setara) untuk membentuk Golden Patient Record, dan jalankan pola Strangler Fig secara paralel hingga selisih (drift) terhadap sistem lama mencapai 0.",
                  en: "B. Group entities by normalized identity key (NIK), apply source authority survivorship (`ERP > CRM > CSV`, breaking ties by latest `updated_at`) to form Golden Patient Records, and run the Strangler Fig shadow pipeline in parallel until parity drift reaches 0."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Hierarki otoritas sumber (`ERP > CRM > CSV`) memastikan data klinis resmi tidak tertimpa CSV manual yang lebih baru, dan Strangler Fig menjamin migrasi tanpa downtime.",
                  en: "✅ Spot on! Source authority precedence (`ERP > CRM > CSV`) ensures authoritative clinical ERP attributes aren't overwritten by a newer manual CSV upload, and Strangler Fig guarantees zero-downtime cutover."
                }
              },
              {
                text: {
                  id: "C. Gabungkan pasien hanya berdasarkan kesamaan nama depan saja.",
                  en: "C. Merge patient records whenever their first names match."
                },
                correct: false,
                feedback: {
                  id: "❌ Menggabungkan ribuan pasien bernama depan 'Budi' menjadi satu rekam medis adalah kesalahan medis fatal!",
                  en: "❌ Merging thousands of distinct patients named 'Budi' into a single medical record is a catastrophic clinical error!"
                }
              }
            ]
          },
          spec: {
            file: "mission_cloudpulse_normal.py",
            functionSig: "resolve_mdm_patients_and_strangler_parity(raw_patients: list[dict], new_clinic_totals: dict[str, int], legacy_clinic_totals: dict[str, int]) -> dict",
            rules: {
              id: [
                "`raw_patients` berisi `[{'record_id': str, 'nik': str, 'source': 'ERP'|'CRM'|'CSV', 'full_name': str, 'city': str, 'updated_at': str}]`.",
                "Kelompokkan berdasarkan `nik_clean = nik.strip()`. Untuk setiap `nik_clean` (diurutkan menaik), pilih atribut pemenang (`full_name`, `city`, `winning_source`) menggunakan aturan **MDM Survivorship**: prioritas sumber `'ERP' (rank 3) > 'CRM' (rank 2) > 'CSV' (rank 1)`; jika prioritas sumber sama, pilih yang memiliki string `updated_at` terbesar. Simpan juga `merged_record_ids` (list terurut semua `record_id` unik untuk NIK tersebut).",
                "Bandingkan `new_clinic_totals` dan `legacy_clinic_totals` (`{clinic_id: amount_idr}`) di seluruh gabungan kunci `clinic_id` (terurut): jika nilai berbeda, tambahkan `{'clinic_id': cid, 'legacy_idr': int, 'new_idr': int, 'delta_idr': new_idr - legacy_idr}` ke `strangler_drift`.",
                "Kembalikan `{'golden_patients': [...], 'strangler_drift': [...], 'ready_to_cutover': bool}` (`ready_to_cutover` adalah `True` jika `len(strangler_drift) == 0`)."
              ],
              en: [
                "`raw_patients` contains `[{'record_id': str, 'nik': str, 'source': 'ERP'|'CRM'|'CSV', 'full_name': str, 'city': str, 'updated_at': str}]`.",
                "Group by `nik_clean = str(nik).strip()`. For each `nik_clean` (sorted ascending), pick the winning attributes (`full_name`, `city`, `winning_source`) using **MDM Survivorship**: source authority `'ERP' (rank 3) > 'CRM' (rank 2) > 'CSV' (rank 1)`; break ties by largest `updated_at` string. Also collect `merged_record_ids` (sorted unique `record_id`s for that NIK).",
                "Compare `new_clinic_totals` against `legacy_clinic_totals` (`{clinic_id: amount_idr}`) across the sorted union of `clinic_id`s: whenever values differ, append `{'clinic_id': cid, 'legacy_idr': int, 'new_idr': int, 'delta_idr': new_idr - legacy_idr}` to `strangler_drift`.",
                "Return `{'golden_patients': [...], 'strangler_drift': [...], 'ready_to_cutover': bool}` (`ready_to_cutover` is `True` iff `len(strangler_drift) == 0`)."
              ]
            },
            starterCode: `"""Mission cloudpulse-normal: Mission 4.2: Duplicate Patients Across 3 Silos (MDM Survivorship) & Strangler Fig ERP Migration

The rules (also on the mission page):

1. raw_patients contains [{'record_id': str, 'nik': str, 'source': 'ERP'|'CRM'|'CSV',
   'full_name': str, 'city': str, 'updated_at': str}].
2. Group by nik_clean = str(nik).strip(). For each nik_clean (sorted ascending), pick
   the winning attributes (full_name, city, winning_source) using **MDM Survivorship**:
   source authority 'ERP' (rank 3) > 'CRM' (rank 2) > 'CSV' (rank 1); break ties by
   largest updated_at string. Also collect merged_record_ids (sorted unique record_ids
   for that NIK).
3. Compare new_clinic_totals against legacy_clinic_totals ({clinic_id: amount_idr})
   across the sorted union of clinic_ids: whenever values differ, append {'clinic_id':
   cid, 'legacy_idr': int, 'new_idr': int, 'delta_idr': new_idr - legacy_idr} to
   strangler_drift.
4. Return {'golden_patients': [...], 'strangler_drift': [...], 'ready_to_cutover':
   bool} (ready_to_cutover is True iff len(strangler_drift) == 0).

Check your work: python3 scripts/job_sim.py verify cloudpulse-normal <this folder>
"""


def resolve_mdm_patients_and_strangler_parity(raw_patients, new_clinic_totals, legacy_clinic_totals):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `SOURCE_RANK = {"ERP": 3, "CRM": 2, "CSV": 1}

def resolve_mdm_patients_and_strangler_parity(raw_patients, new_clinic_totals, legacy_clinic_totals):
    groups = {}
    for r in raw_patients:
        nik = str(r["nik"]).strip()
        groups.setdefault(nik, []).append(r)

    golden = []
    for nik in sorted(groups):
        rows = groups[nik]
        winner = max(
            rows,
            key=lambda x: (SOURCE_RANK.get(str(x.get("source", "")).strip().upper(), 0), str(x.get("updated_at", ""))),
        )
        golden.append({
            "nik": nik,
            "full_name": str(winner["full_name"]).strip(),
            "city": str(winner["city"]).strip(),
            "winning_source": str(winner["source"]).strip().upper(),
            "merged_record_ids": sorted({str(x["record_id"]) for x in rows}),
        })

    drift = []
    for cid in sorted(set(new_clinic_totals) | set(legacy_clinic_totals)):
        leg = int(legacy_clinic_totals.get(cid, 0))
        new = int(new_clinic_totals.get(cid, 0))
        if leg != new:
            drift.append({
                "clinic_id": cid,
                "legacy_idr": leg,
                "new_idr": new,
                "delta_idr": new - leg,
            })

    return {
        "golden_patients": golden,
        "strangler_drift": drift,
        "ready_to_cutover": (len(drift) == 0),
    }`
          }
        },
        {
          level: "hard",
          missionId: "cloudpulse-hard",
          difficultyBadge: { id: "🔴 Level 3: HARD (Senior DE · Lakehouse Small-File Compaction & GDPR Snapshot Purge)", en: "🔴 Level 3: HARD (Senior DE · Lakehouse Small-File Compaction & GDPR Snapshot Purge)" },
          title: {
            id: "Misi 4.3: Krisis 1,4 Juta File Parquet 8 KB di S3 & Penghapusan Fisik Snapshot Iceberg/Delta",
            en: "Mission 4.3: The 1.4-Million 8KB Small-File Lakehouse Crisis & GDPR Physical Snapshot Purge"
          },
          lifecycle: "Storage (Open Lakehouse) → Transformation",
          undercurrents: ["Data Architecture", "DataOps", "Security"],
          incidentTicket: {
            from: "Staff Lakehouse Architect (#lakehouse-storage-ops)",
            sla: { id: "Kompaksi bin-packing ke target 128 MB · 0 file berisi pasien yang dicabut izinnya setelah VACUUM", en: "Bin-packing compaction to 128 MB target · 0 files retaining revoked patient IDs after VACUUM" },
            brief: {
              id: "Job streaming klinik menulis file Parquet baru setiap 5 detik ke S3, menciptakan 1,4 juta file mikro berukuran 8 KB! Akibatnya, waktu perencanaan query (query planning) memakan waktu 3 menit hanya untuk memanggil S3 `LIST`. Selain itu, 1.200 pasien mencabut izin penyimpanan data medis mereka: menjalankan `DELETE` di Delta Lake / Apache Iceberg hanya membuat snapshot baru, sedangkan file Parquet lama yang masih menyimpan data mereka belum terhapus secara fisik sebelum `VACUUM / expire_snapshots` dijalankan!",
              en: "A streaming clinic ingestion job writes a new Parquet file to S3 every 5 seconds, creating 1.4 million tiny 8 KB files! Query planning now takes 3 minutes just waiting on S3 `LIST` calls. Furthermore, 1,200 patients revoked medical data consent: running `DELETE` in Delta Lake / Apache Iceberg creates a new snapshot, but the old underlying Parquet data files still physically retain their PHI on S3 until compaction and `VACUUM / expire_snapshots` purge obsolete files!"
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana cara mengatasi masalah jutaan file kecil sekaligus menjamin data pasien yang dihapus benar-benar lenyap secara fisik dari S3?",
              en: "How do you solve the small-file problem while guaranteeing erased patient records are physically purged from S3 object storage?"
            },
            options: [
              {
                text: {
                  id: "A. Biarkan file 8 KB apa adanya dan cukup jalankan DELETE FROM table WHERE patient_id IN (...) tanpa pernah menjalankan OPTIMIZE atau VACUUM.",
                  en: "A. Leave the 8 KB files untouched and simply run DELETE FROM table WHERE patient_id IN (...) without ever running OPTIMIZE or VACUUM."
                },
                correct: false,
                feedback: {
                  id: "❌ Tanpa OPTIMIZE, jutaan file kecil tetap membuat query lambat; tanpa VACUUM / expire_snapshots, siapa pun yang melakukan query `TIMESTAMP AS OF` (time travel) masih bisa membaca data pasien yang sudah meminta dihapus!",
                  en: "❌ Without OPTIMIZE, millions of tiny files still cripple reads; without VACUUM / expire_snapshots, any time-travel query (`VERSION AS OF`) still reads the revoked patient data from old Parquet files!"
                }
              },
              {
                text: {
                  id: "B. Hapus record pasien yang dicabut izinnya, jalankan kompaksi Bin-Packing (`OPTIMIZE`) untuk menggabungkan file-file kecil per partisi ke ukuran target (misal 128 MB), lalu jalankan `VACUUM / expire_snapshots` untuk menghapus file snapshot lama dari S3.",
                  en: "B. Filter out revoked patient records, run Bin-Packing Compaction (`OPTIMIZE`) to coalesce small files per partition into target-sized (~128 MB) Parquet files, and execute `VACUUM / expire_snapshots` to physically unlink obsolete data files containing erased records."
                },
                correct: true,
                feedback: {
                  id: "✅ Tepat! Kompaksi memangkas jumlah file hingga >95% dan VACUUM memastikan file Parquet lama yang menyimpan data pasien terhapus secara fisik dari S3.",
                  en: "✅ Spot on! Bin-packing compaction reduces file count by >95%, and VACUUM ensures old snapshot files containing erased patient records are physically deleted from S3."
                }
              },
              {
                text: {
                  id: "C. Setel `VACUUM RETAIN 0 HOURS` saat job streaming sedang aktif menulis ke tabel.",
                  en: "C. Run `VACUUM RETAIN 0 HOURS` while concurrent streaming writers are actively committing to the table."
                },
                correct: false,
                feedback: {
                  id: "❌ `RETAIN 0 HOURS` saat ada penulis aktif dapat menghapus file Parquet yang baru saja ditulis oleh transaksi konkuren yang belum selesai commit!",
                  en: "❌ `RETAIN 0 HOURS` during active concurrent writes can delete newly written Parquet files before their transaction commit finishes!"
                }
              }
            ]
          },
          spec: {
            file: "mission_cloudpulse_hard.py",
            functionSig: "compact_lakehouse_and_vacuum_gdpr(data_files: list[dict], erased_patient_ids: list[str], target_file_mb: int = 128) -> dict",
            rules: {
              id: [
                "`data_files` berisi metadata file Parquet aktif di tabel Lakehouse: `[{'file_id': str, 'partition_dt': str, 'size_mb': int, 'row_count': int, 'patient_ids': list[str]}]`.",
                "Identifikasi semua `file_id` yang mengandung minimal satu pasien di `erased_patient_ids` sebagai `gdpr_tainted_files` (terurut).",
                "Untuk setiap `partition_dt` (diurutkan menaik): hitung total `surviving_rows` (kurangi 1 baris untuk setiap kemunculan `pid in erased_set` di dalam `patient_ids` file tersebut) dan `surviving_size_mb` (jumlahkan `size_mb` dari file di partisi tersebut; jika sebuah file memiliki `surviving_rows == 0`, kontribusi ukurannya `0`).",
                "Hitung jumlah file hasil kompaksi bin-packing per partisi: jika `surviving_rows == 0`, `compacted_files = 0`; selain itu `compacted_files = max(1, math.ceil(surviving_size_mb / target_file_mb))`.",
                "Semua file input lama yang digabungkan atau tercemar GDPR masuk ke `vacuumed_file_ids` (terurut). Kembalikan `{'partitions': [{'partition_dt': dt, 'old_file_count': int, 'compacted_file_count': int, 'surviving_rows': int}], 'gdpr_tainted_files': [...], 'total_files_before': int, 'total_files_after': int}`."
              ],
              en: [
                "`data_files` contains active Lakehouse Parquet file metadata: `[{'file_id': str, 'partition_dt': str, 'size_mb': int, 'row_count': int, 'patient_ids': list[str]}]`.",
                "Identify all `file_id`s containing at least one patient in `erased_patient_ids` as `gdpr_tainted_files` (sorted).",
                "For each `partition_dt` (sorted ascending): compute `surviving_rows` (subtracting 1 row for each occurrence of an erased `pid` in `file['patient_ids']`) and `surviving_size_mb` (sum of `size_mb` for files in that partition where the file's surviving rows > 0).",
                "Compute bin-packed `compacted_file_count` per partition: if `surviving_rows == 0`, `0`; otherwise `max(1, math.ceil(surviving_size_mb / target_file_mb))`.",
                "Return `{'partitions': [{'partition_dt': dt, 'old_file_count': int, 'compacted_file_count': int, 'surviving_rows': int}], 'gdpr_tainted_files': [...], 'total_files_before': int, 'total_files_after': int}`."
              ]
            },
            starterCode: `"""Mission cloudpulse-hard: Mission 4.3: The 1.4-Million 8KB Small-File Lakehouse Crisis & GDPR Physical Snapshot Purge

The rules (also on the mission page):

1. data_files contains active Lakehouse Parquet file metadata: [{'file_id': str,
   'partition_dt': str, 'size_mb': int, 'row_count': int, 'patient_ids': list[str]}].
2. Identify all file_ids containing at least one patient in erased_patient_ids as
   gdpr_tainted_files (sorted).
3. For each partition_dt (sorted ascending): compute surviving_rows (subtracting 1 row
   for each occurrence of an erased pid in file['patient_ids']) and surviving_size_mb
   (sum of size_mb for files in that partition where the file's surviving rows > 0).
4. Compute bin-packed compacted_file_count per partition: if surviving_rows == 0, 0;
   otherwise max(1, math.ceil(surviving_size_mb / target_file_mb)).
5. Return {'partitions': [{'partition_dt': dt, 'old_file_count': int,
   'compacted_file_count': int, 'surviving_rows': int}], 'gdpr_tainted_files': [...],
   'total_files_before': int, 'total_files_after': int}.

Check your work: python3 scripts/job_sim.py verify cloudpulse-hard <this folder>
"""


def compact_lakehouse_and_vacuum_gdpr(data_files, erased_patient_ids, target_file_mb=128):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `import math

def compact_lakehouse_and_vacuum_gdpr(data_files, erased_patient_ids, target_file_mb=128):
    erased_set = {str(p).strip() for p in erased_patient_ids}
    tainted = []
    by_part = {}

    for f in data_files:
        fid = str(f["file_id"])
        dt = str(f["partition_dt"])
        pids = [str(x).strip() for x in f.get("patient_ids", [])]
        erased_hits = sum(1 for x in pids if x in erased_set)
        if erased_hits > 0:
            tainted.append(fid)
        surv_rows = max(0, int(f["row_count"]) - erased_hits)
        surv_mb = int(f["size_mb"]) if surv_rows > 0 else 0
        p = by_part.setdefault(dt, {"old_files": 0, "surv_rows": 0, "surv_mb": 0})
        p["old_files"] += 1
        p["surv_rows"] += surv_rows
        p["surv_mb"] += surv_mb

    parts_out = []
    total_after = 0
    for dt in sorted(by_part):
        p = by_part[dt]
        if p["surv_rows"] == 0:
            c_files = 0
        else:
            c_files = max(1, int(math.ceil(p["surv_mb"] / float(target_file_mb))))
        total_after += c_files
        parts_out.append({
            "partition_dt": dt,
            "old_file_count": p["old_files"],
            "compacted_file_count": c_files,
            "surviving_rows": p["surv_rows"],
        })

    return {
        "partitions": parts_out,
        "gdpr_tainted_files": sorted(tainted),
        "total_files_before": len(data_files),
        "total_files_after": total_after,
    }`
          }
        },
        {
          level: "expert",
          missionId: "cloudpulse-expert",
          difficultyBadge: { id: "🟣 Level 4: EXPERT (Staff DE · Multi-Tenant HIPAA RAG & Incremental SHA-256 Vector Pipeline)", en: "🟣 Level 4: EXPERT (Staff DE · Multi-Tenant HIPAA RAG & Incremental SHA-256 Vector Pipeline)" },
          title: {
            id: "Misi 4.4: Isolasi Multi-Tenant Asisten AI Rumah Sakit & Penghematan 98% Biaya Embedding RAG",
            en: "Mission 4.4: Multi-Tenant HIPAA RAG Isolation & 98% Embedding API Cost Reduction"
          },
          lifecycle: "Transformation → Serving (AI / Vector DB & Governance)",
          undercurrents: ["Security", "DataOps", "Data Architecture"],
          incidentTicket: {
            from: "Chief Medical Information Officer & VP of AI (#clinical-rag-security)",
            sla: { id: "Hanya re-embed dokumen yang SHA-256-nya berubah · 0 kebocoran vektor lintas Rumah Sakit", en: "Re-embed strictly modified SHA-256 documents · 0 cross-hospital vector retrieval leakage" },
            brief: {
              id: "Dua krisis melanda Asisten AI Klinis CloudPulse: (1) Pipeline malam hari men-embed ulang seluruh 5 juta catatan SOP dan medis setiap malam, membakar $14.000/bulan untuk dokumen yang 98% tidak berubah, dan (2) Saat dokter di Rumah Sakit Tenant A bertanya ke AI, pencarian kemiripan vektor (`pgvector` HNSW) terkadang mengembalikan potongan dokumen milik Rumah Sakit Tenant B karena filter `tenant_id` baru dijalankan *setelah* mengambil top-k vektor global!",
              en: "Two crises hit CloudPulse's Clinical AI Assistant: (1) The nightly pipeline re-embeds all 5 million clinical notes every night, burning $14,000/month when 98% of documents haven't changed, and (2) When a doctor at Hospital Tenant A queries the assistant, `pgvector` similarity search occasionally leaks chunks from Hospital Tenant B—or returns 0 results—because `tenant_id` filtering was applied improperly!"
            }
          },
          padmGate: {
            question: {
              id: "Bagaimana arsitektur pipeline RAG yang memangkas biaya embedding 98% sekaligus menjamin isolasi multi-tenant dan penghapusan dokumen basi?",
              en: "How do you architect the RAG data pipeline to cut embedding costs by 98% while guaranteeing multi-tenant isolation and stale-chunk cleanup?"
            },
            options: [
              {
                text: {
                  id: "A. Embed ulang seluruh dokumen setiap Minggu saja, dan percayakan pada prompt LLM ('Tolong abaikan dokumen dari rumah sakit lain') untuk keamanan tenant.",
                  en: "A. Re-embed all documents once a week, and rely on an LLM system prompt ('Please ignore documents from other hospitals') for tenant security."
                },
                correct: false,
                feedback: {
                  id: "❌ Pelanggaran keamanan HIPAA fatal! Mengirim dokumen Rumah Sakit B ke dalam konteks prompt LLM saat melayani Rumah Sakit A adalah kebocoran data lintas-tenant yang mudah ditembus prompt injection.",
                  en: "❌ Fatal HIPAA security breach! Putting Hospital B's chunks into the LLM prompt context while serving Hospital A is a cross-tenant data leak vulnerable to prompt injection."
                }
              },
              {
                text: {
                  id: "B. Hitung sidik jari konten `sha256(normalized_text)` per `(tenant_id, doc_id)` agar hanya memanggil API embedding pada dokumen baru/berubah (serta menghapus chunk lama sebelum menyisipkan chunk baru), dan wajibkan pre-filtering `WHERE tenant_id = viewer_tenant` di database vektor sebelum mengurutkan skor kemiripan.",
                  en: "B. Compute a content hash `sha256(normalized_text)` per `(tenant_id, doc_id)` to invoke the embedding API strictly on new/modified documents (deleting old chunks on update/delete), and enforce mandatory database pre-filtering `WHERE tenant_id = viewer_tenant` before vector similarity ranking."
                },
                correct: true,
                feedback: {
                  id: "✅ Standar Staff AI Data Engineer! Content hashing SHA-256 memangkas biaya API hingga 98%, penghapusan chunk lama mencegah halusinasi dari teks usang, dan pre-filtering tenant di tingkat database menjamin isolasi mutlak.",
                  en: "✅ Staff AI Data Engineering standard! SHA-256 content hashing cuts API spend by 98%, deleting prior chunks prevents stale-chunk hallucinations, and database-enforced tenant pre-filtering guarantees zero cross-tenant leakage."
                }
              },
              {
                text: {
                  id: "C. Hanya periksa panjang karakter dokumen (`len(text)`) untuk mendeteksi apakah isi catatan medis berubah.",
                  en: "C. Check only `len(text)` to decide whether a clinical document changed."
                },
                correct: false,
                feedback: {
                  id: "❌ Mengubah dosis obat dari `'10mg'` menjadi `'90mg'` memiliki panjang karakter yang persis sama! Anda wajib menggunakan hash kriptografis `SHA-256`.",
                  en: "❌ Changing a dosage from `'10mg'` to `'90mg'` has the exact same string length! You must use a cryptographic `SHA-256` content hash."
                }
              }
            ]
          },
          spec: {
            file: "mission_cloudpulse_expert.py",
            functionSig: "sync_rag_index_and_retrieve(current_docs: list[dict], existing_index: dict[str, dict], query_tenant: str, query_terms: list[str], top_k: int = 3) -> dict",
            rules: {
              id: [
                "`current_docs` berisi `[{'doc_id': str, 'tenant_id': str, 'text': str}]`. `existing_index` memetakan `doc_id -> {'tenant_id': str, 'content_hash': str, 'text': str}` dari run sebelumnya.",
                "Untuk setiap dokumen di `current_docs` (diurutkan `doc_id`), hitung `content_hash = sha256(text.strip())`. Jika `doc_id` belum ada di `existing_index` atau `content_hash != existing_index[doc_id]['content_hash']`, masukkan `doc_id` ke `embedded_doc_ids` (hanya dokumen ini yang memanggil API embedding!). Jika sama, masukkan ke `skipped_unchanged_ids`.",
                "Identifikasi semua `doc_id` yang ada di `existing_index` tetapi sudah tidak ada di `current_docs` sebagai `deleted_doc_ids` (terurut).",
                "Bangun indeks baru yang bersih, lalu lakukan **Tenant-Isolated Retrieval**: filter dokumen HANYA milik `tenant_id == query_tenant` (0 kebocoran lintas-tenant!). Hitung skor kemiripan kata kunci `score = sum(1 for term in query_terms if term.lower() in doc['text'].lower())`. Ambil dokumen dengan `score > 0`, urutkan berdasarkan `(-score, doc_id)` hingga `top_k`.",
                "Kembalikan `{'embedded_doc_ids': [...], 'skipped_unchanged_ids': [...], 'deleted_doc_ids': [...], 'retrieved_docs': [{'doc_id': ..., 'tenant_id': ..., 'score': int}]}`."
              ],
              en: [
                "`current_docs` contains `[{'doc_id': str, 'tenant_id': str, 'text': str}]`. `existing_index` maps `doc_id -> {'tenant_id': str, 'content_hash': str, 'text': str}` from the previous run.",
                "For each doc in `current_docs` (sorted by `doc_id`), compute `content_hash = sha256(text.strip())`. If `doc_id` is not in `existing_index` or `content_hash != existing_index[doc_id]['content_hash']`, append `doc_id` to `embedded_doc_ids` (strictly these invoke the embedding API!). Otherwise append `doc_id` to `skipped_unchanged_ids`.",
                "Identify any `doc_id` present in `existing_index` that is missing from `current_docs` as `deleted_doc_ids` (sorted).",
                "From the updated index, perform **Tenant-Isolated Retrieval**: pre-filter strictly to documents where `tenant_id == query_tenant` (zero cross-tenant leakage!). Compute `score = sum(1 for term in query_terms if term.lower() in doc['text'].lower())`. Keep docs with `score > 0`, sorted by `(-score, doc_id)` up to `top_k`.",
                "Return `{'embedded_doc_ids': [...], 'skipped_unchanged_ids': [...], 'deleted_doc_ids': [...], 'retrieved_docs': [{'doc_id': ..., 'tenant_id': ..., 'score': int}]}`."
              ]
            },
            starterCode: `"""Mission cloudpulse-expert: Mission 4.4: Multi-Tenant HIPAA RAG Isolation & 98% Embedding API Cost Reduction

The rules (also on the mission page):

1. current_docs contains [{'doc_id': str, 'tenant_id': str, 'text': str}].
   existing_index maps doc_id -> {'tenant_id': str, 'content_hash': str, 'text': str}
   from the previous run.
2. For each doc in current_docs (sorted by doc_id), compute content_hash =
   sha256(text.strip()). If doc_id is not in existing_index or content_hash !=
   existing_index[doc_id]['content_hash'], append doc_id to embedded_doc_ids (strictly
   these invoke the embedding API!). Otherwise append doc_id to skipped_unchanged_ids.
3. Identify any doc_id present in existing_index that is missing from current_docs as
   deleted_doc_ids (sorted).
4. From the updated index, perform **Tenant-Isolated Retrieval**: pre-filter strictly
   to documents where tenant_id == query_tenant (zero cross-tenant leakage!). Compute
   score = sum(1 for term in query_terms if term.lower() in doc['text'].lower()). Keep
   docs with score > 0, sorted by (-score, doc_id) up to top_k.
5. Return {'embedded_doc_ids': [...], 'skipped_unchanged_ids': [...],
   'deleted_doc_ids': [...], 'retrieved_docs': [{'doc_id': ..., 'tenant_id': ...,
   'score': int}]}.

Check your work: python3 scripts/job_sim.py verify cloudpulse-expert <this folder>
"""


def sync_rag_index_and_retrieve(current_docs, existing_index, query_tenant, query_terms, top_k=3):
    raise NotImplementedError("write this function from the mission rules")
`,
            referenceCode: `import hashlib

def _sha256(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def sync_rag_index_and_retrieve(current_docs, existing_index, query_tenant, query_terms, top_k=3):
    embedded, skipped = [], []
    new_index = {}

    for d in sorted(current_docs, key=lambda x: str(x["doc_id"])):
        did = str(d["doc_id"])
        tid = str(d["tenant_id"])
        txt = str(d["text"]).strip()
        chash = _sha256(txt)
        prev = existing_index.get(did)
        if prev is None or prev.get("content_hash") != chash or prev.get("tenant_id") != tid:
            embedded.append(did)
        else:
            skipped.append(did)
        new_index[did] = {"doc_id": did, "tenant_id": tid, "content_hash": chash, "text": txt}

    deleted = sorted(k for k in existing_index if k not in new_index)

    terms = [str(t).strip().lower() for t in query_terms if str(t).strip()]
    scored = []
    for did, doc in new_index.items():
        if doc["tenant_id"] != str(query_tenant):
            continue
        low_txt = doc["text"].lower()
        sc = sum(1 for term in terms if term in low_txt)
        if sc > 0:
            scored.append({"doc_id": did, "tenant_id": doc["tenant_id"], "score": sc})

    scored.sort(key=lambda x: (-x["score"], x["doc_id"]))
    return {
        "embedded_doc_ids": embedded,
        "skipped_unchanged_ids": skipped,
        "deleted_doc_ids": deleted,
        "retrieved_docs": scored[: int(top_k)],
    }`
          }
        }
      ]
    }
  ]
};
