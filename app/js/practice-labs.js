// DataForge Active Learning Engine:
// 1. Interactive Mental-Model Simulators (Idea #1)
// 2. "Spot the Silent Data Bug" Production Clinic (Idea #6)
// 3. Active Recall & Spaced-Repetition Deck (Idea #2)

(function (root) {
  const SIMULATORS = [
    {
      id: "sim-join-fanout",
      modules: ["mod-1-2", "mod-1-4", "mod-2-2", "mod-2-3"],
      icon: "💥",
      title: {
        id: "Simulator: Join Fan-Out & Inflasi Pendapatan Diam-Diam",
        en: "Simulator: Join Fan-Out & Silent Revenue Inflation"
      },
      subtitle: {
        id: "Lihat bagaimana JOIN ke tabel dimensi yang memiliki duplikat kunci menggandakan nilai SUM(amount) tanpa pesan error sama sekali.",
        en: "See how joining a fact table to a dimension table with duplicate keys silently multiplies SUM(amount) with zero SQL errors."
      }
    },
    {
      id: "sim-partition-pruning",
      modules: ["mod-1-3", "mod-2-1", "mod-2-4", "mod-4-2", "mod-4-3"],
      icon: "💸",
      title: {
        id: "Simulator: Partition Pruning & Biaya Cloud Scan",
        en: "Simulator: Partition Pruning & Cloud Scan Cost"
      },
      subtitle: {
        id: "Bandingkan dampak membungkus kolom partisi dengan fungsi (WHERE DATE(ts) = ...) terhadap jumlah file Parquet yang dipindai dan tagihan cloud.",
        en: "Compare the impact of wrapping a partition column in a function (WHERE DATE(ts) = ...) on scanned Parquet files and cloud billing."
      }
    },
    {
      id: "sim-watermark",
      modules: ["mod-3-1", "mod-3-2", "mod-3-3"],
      icon: "🌊",
      title: {
        id: "Simulator: Streaming Watermark, Data Terlambat & Memori State",
        en: "Simulator: Streaming Watermark, Late Events & State Memory"
      },
      subtitle: {
        id: "Eksperimen dengan trade-off antara toleransi watermark (menit), event terlambat yang dibuang diam-diam, dan penggunaan RAM RocksDB.",
        en: "Experiment with the trade-off between watermark delay tolerance, silently dropped late events, and RocksDB state memory."
      }
    },
    {
      id: "sim-idempotency",
      modules: ["mod-0-1", "mod-1-1", "mod-1-5", "mod-1-6"],
      icon: "🔁",
      title: {
        id: "Simulator: Idempotensi Pipeline Saat Retry & Backfill",
        en: "Simulator: Pipeline Idempotency Under Retries & Backfills"
      },
      subtitle: {
        id: "Simulasikan kegagalan jaringan saat Airflow/Dagster menjalankan ulang task 3x. Lihat strategi penulisan mana yang merusak tabel produksi.",
        en: "Simulate network retries when Airflow/Dagster re-runs a task 3x. See which write strategy corrupts production tables."
      }
    },
    {
      id: "sim-data-maturity",
      modules: ["mod-0-2", "mod-0-3"],
      icon: "🧭",
      title: {
        id: "Simulator: Tahap Kematangan Data (Reis & Housley), Tipe A vs. B & Jebakan TOCO",
        en: "Simulator: Data Maturity Stage (Reis & Housley), Type A vs. B & TOCO Trap"
      },
      subtitle: {
        id: "Uji dampak memilih arsitektur Tipe A (Managed/Sederhana) vs. Tipe B (Custom Kafka + Spark + K8s) terhadap biaya TCO, waktu rilis nilai bisnis (TOCO), dan risiko gagal.",
        en: "Test how choosing a Type A (Managed/Lean) vs. Type B (Custom Kafka + Spark + K8s) stack across Stages 1–3 impacts TCO, Time-to-Value (TOCO), and project failure risk."
      }
    },
    {
      id: "sim-pii-gdpr",
      modules: ["mod-2-5", "mod-2-6", "mod-3-4", "mod-3-5"],
      icon: "🛡️",
      title: {
        id: "Simulator: Keamanan PII (Salted Hash), Multitenant RLS & Biaya Hapus GDPR Lakehouse",
        en: "Simulator: PII Salted Hashing, Multitenant RLS & Lakehouse GDPR Erasure Cost"
      },
      subtitle: {
        id: "Bandingkan kerentanan hash tanpa salt terhadap serangan rainbow table, serta biaya penghapusan GDPR di Parquet biasa vs. Apache Iceberg Merge-on-Read.",
        en: "Compare unsalted hash vulnerability to rainbow-table attacks and GDPR erasure cost on raw immutable Parquet vs. Apache Iceberg Merge-on-Read."
      }
    }
  ];

  const SILENT_BUG_DRILLS = [
    {
      id: "bug-not-in-null",
      category: "SQL / Anti-Join",
      difficulty: "High-Frequency Production Bug",
      relatedModule: "mod-1-2",
      title: {
        id: "Kasus #1: Perangkap NOT IN (NULL) yang Mengembalikan 0 Baris",
        en: "Case #1: The NOT IN (NULL) Zero-Row Trap"
      },
      symptom: {
        id: "Tim Finance melaporkan dashboard 'Pelanggan Tanpa Retur' tiba-tiba menampilkan tepat 0 pelanggan pagi ini, padahal ada 50.000 pelanggan aktif dan query berjalan sukses (0 error).",
        en: "Finance reports that the 'Customers With Zero Returns' dashboard suddenly shows 0 customers this morning, even though there are 50,000 active customers and the query succeeded with 0 errors."
      },
      codeLines: [
        "SELECT c.customer_id, c.email",
        "FROM customers c",
        "WHERE c.status = 'active'",
        "  AND c.customer_id NOT IN (",
        "    SELECT r.customer_id FROM returns r -- r.customer_id has 1 NULL row from guest checkout!",
        "  );"
      ],
      buggyLineIndex: 3,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Ganti NOT IN dengan NOT EXISTS (SELECT 1 FROM returns r WHERE r.customer_id = c.customer_id)",
            en: "Replace NOT IN with NOT EXISTS (SELECT 1 FROM returns r WHERE r.customer_id = c.customer_id)"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Tambahkan DISTINCT di dalam subquery: SELECT DISTINCT r.customer_id FROM returns r",
            en: "Add DISTINCT inside the subquery: SELECT DISTINCT r.customer_id FROM returns r"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Ubah WHERE c.status = 'active' menjadi UPPER(c.status) = 'ACTIVE'",
            en: "Change WHERE c.status = 'active' to UPPER(c.status) = 'ACTIVE'"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Dalam logika tiga-nilai SQL (Three-Valued Logic), `x NOT IN (1, 2, NULL)` dievaluasi menjadi `x <> 1 AND x <> 2 AND x <> NULL`. Karena `x <> NULL` selalu `UNKNOWN`, seluruh klausa `WHERE` menjadi `UNKNOWN` (falsy) untuk setiap baris! Gunakan selalu `NOT EXISTS` atau `LEFT JOIN ... WHERE r.customer_id IS NULL`.",
        en: "In SQL three-valued logic, `x NOT IN (1, 2, NULL)` expands to `x <> 1 AND x <> 2 AND x <> NULL`. Because `x <> NULL` is always `UNKNOWN`, the entire `WHERE` clause evaluates to `UNKNOWN` for every single row! Always use `NOT EXISTS` or `LEFT JOIN ... WHERE r.customer_id IS NULL`."
      }
    },
    {
      id: "bug-left-join-where",
      category: "SQL / Filtering",
      difficulty: "Classic Silent Bug",
      relatedModule: "mod-1-2",
      title: {
        id: "Kasus #2: LEFT JOIN yang Diam-Diam Berubah Menjadi INNER JOIN",
        en: "Case #2: The LEFT JOIN Silently Turned Into an INNER JOIN"
      },
      symptom: {
        id: "Laporan bulanan seharusnya menampilkan SEMUA produk beserta total penjualannya (termasuk produk yang belum laku = 0). Namun seluruh produk yang belum pernah terjual hilang dari laporan.",
        en: "A monthly report must list ALL products and their completed sales (including unsold products = 0). Instead, every unsold product silently vanished from the report."
      },
      codeLines: [
        "SELECT p.product_id, p.name, COALESCE(SUM(o.amount), 0) AS revenue",
        "FROM products p",
        "LEFT JOIN orders o ON o.product_id = p.product_id",
        "WHERE o.status = 'completed'",
        "GROUP BY p.product_id, p.name;"
      ],
      buggyLineIndex: 3,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Pindahkan kondisi filter ke klausa ON: LEFT JOIN orders o ON o.product_id = p.product_id AND o.status = 'completed'",
            en: "Move the filter condition into the ON clause: LEFT JOIN orders o ON o.product_id = p.product_id AND o.status = 'completed'"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Ganti COALESCE(SUM(o.amount), 0) dengan SUM(COALESCE(o.amount, 0))",
            en: "Replace COALESCE(SUM(o.amount), 0) with SUM(COALESCE(o.amount, 0))"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Ganti LEFT JOIN dengan FULL OUTER JOIN",
            en: "Replace LEFT JOIN with FULL OUTER JOIN"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Untuk produk yang belum pernah terjual, `LEFT JOIN` menghasilkan `o.status = NULL`. Menaruh `WHERE o.status = 'completed'` memfilter keluar semua baris di mana `o.status` bernilai `NULL`, sehingga menghancurkan fungsi `LEFT JOIN`. Filter pada tabel kanan wajib ditaruh di dalam klausa `ON`.",
        en: "For unsold products, `LEFT JOIN` produces `o.status = NULL`. Filtering `WHERE o.status = 'completed'` happens AFTER the join and discards every row where `o.status` is `NULL`, turning your `LEFT JOIN` into an `INNER JOIN`. Filters on the right table belong in the `ON` clause."
      }
    },
    {
      id: "bug-scd-fanout",
      category: "Data Modeling / SCD2",
      difficulty: "Senior DE Interview Favorite",
      relatedModule: "mod-2-2",
      title: {
        id: "Kasus #3: Inflasi Pendapatan akibat Join ke Tabel Dimensi SCD Tipe 2",
        en: "Case #3: Revenue Inflation Joining to an SCD Type 2 Dimension"
      },
      symptom: {
        id: "Setelah tim Data Warehouse mengubah `dim_customer` menjadi SCD Type 2 (menyimpan riwayat pindah kota pelanggan), total GMV perusahaan di dashboard CEO melonjak 38% dalam semalam.",
        en: "After the warehouse team upgraded `dim_customer` to SCD Type 2 (tracking customer city history), company-wide GMV on the CEO's dashboard jumped 38% overnight."
      },
      codeLines: [
        "SELECT d.region, SUM(f.order_amount) AS total_gmv",
        "FROM fact_orders f",
        "JOIN dim_customer d",
        "  ON f.customer_id = d.customer_id -- d has multiple historical versions per customer_id!",
        "GROUP BY d.region;"
      ],
      buggyLineIndex: 3,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Tambahkan predikat waktu/versi pada JOIN: AND f.order_ts >= d.valid_from AND (f.order_ts < d.valid_to OR d.valid_to IS NULL) (atau AND d.is_current = TRUE)",
            en: "Add point-in-time or current-flag predicate to the JOIN: AND f.order_ts >= d.valid_from AND (f.order_ts < d.valid_to OR d.valid_to IS NULL) (or AND d.is_current = TRUE)"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Gunakan SUM(DISTINCT f.order_amount) agar angka yang sama tidak dijumlahkan dua kali",
            en: "Use SUM(DISTINCT f.order_amount) so identical amounts are not summed twice"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Tambahkan DISTINCT setelah SELECT: SELECT DISTINCT d.region, SUM(f.order_amount)",
            en: "Add DISTINCT after SELECT: SELECT DISTINCT d.region, SUM(f.order_amount)"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Tabel SCD Type 2 memiliki banyak baris untuk satu `customer_id` (satu baris per versi historis). Melakukan `JOIN` hanya pada natural key `customer_id` menyebabkan fan-out: pelanggan yang pernah pindah alamat 3 kali akan menggandakan seluruh pesanan mereka 3x lipat! Anda wajib join menggunakan surrogate key atau rentang `valid_from` / `valid_to`.",
        en: "An SCD Type 2 table contains multiple rows per `customer_id` (one per historical version). Joining only on the natural key `customer_id` causes a 1-to-many fan-out: a customer who moved 3 times has every order multiplied 3x! Always join on the point-in-time window (`f.order_ts >= d.valid_from AND ...`) or surrogate key."
      }
    },
    {
      id: "bug-python-mutable-default",
      category: "Python ETL / Memory",
      difficulty: "Silent Data Duplication",
      relatedModule: "mod-1-1",
      title: {
        id: "Kasus #4: Kebocoran Batch Antar-Partisi karena Default List Mutable di Python",
        en: "Case #4: Cross-Partition Batch Leak via Python Mutable Default Arg"
      },
      symptom: {
        id: "Worker ETL memproses file CSV per cabang toko. Cabang #1 memiliki 100 baris, Cabang #2 memiliki 150 baris, tetapi di database Cabang #2 tercatat memiliki 250 baris (termasuk seluruh data Cabang #1!).",
        en: "An ETL worker processes one CSV per store branch. Branch #1 has 100 rows and Branch #2 has 150 rows, but in the database Branch #2 gets 250 rows (including all of Branch #1's data!)."
      },
      codeLines: [
        "def parse_branch_records(raw_lines, clean_batch=[]):",
        "    for line in raw_lines:",
        "        row = line.strip().split(',')",
        "        if len(row) == 3:",
        "            clean_batch.append(row)",
        "    return clean_batch"
      ],
      buggyLineIndex: 0,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Ubah signature menjadi `clean_batch=None` lalu inisialisasi `if clean_batch is None: clean_batch = []` di dalam fungsi",
            en: "Change signature to `clean_batch=None` and initialize `if clean_batch is None: clean_batch = []` inside the function"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Ganti `clean_batch.append(row)` dengan `clean_batch += [row]`",
            en: "Replace `clean_batch.append(row)` with `clean_batch += [row]`"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Gunakan tuple `clean_batch=()` di parameter fungsi tanpa mengubah `.append()`",
            en: "Use a tuple `clean_batch=()` in the function parameter without changing `.append()`"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Di Python, nilai default parameter dievaluasi HANYA SEKALI saat `def` didefinisikan, bukan setiap kali fungsi dipanggil. Akibatnya, `clean_batch=[]` yang sama dipakai bersama oleh seluruh pemanggilan fungsi berikutnya, mengakumulasi data cabang sebelumnya secara diam-diam!",
        en: "In Python, default argument values are evaluated ONCE when `def` is executed, not on each function call. The exact same `clean_batch` list object is shared across every call in the worker process, silently leaking earlier batches into later partitions!"
      }
    },
    {
      id: "bug-offset-pagination",
      category: "API Ingestion / CDC",
      difficulty: "Real-World Pipeline Bug",
      relatedModule: "mod-1-6",
      title: {
        id: "Kasus #5: Baris Terlewat & Duplikat Saat Ingesti API dengan OFFSET tanpa ORDER BY Stabil",
        en: "Case #5: Skipped & Duplicate Rows in OFFSET Pagination Without Stable Ordering"
      },
      symptom: {
        id: "Job ingesti malam menarik 10.000 transaksi dari API/database sumber menggunakan perulangan `LIMIT 1000 OFFSET N`. Setiap malam ada ~15 transaksi yang hilang dan ~15 transaksi lain yang tercatat ganda.",
        en: "A nightly ingestion job pulls 10,000 transactions from a live source database using `LIMIT 1000 OFFSET N`. Every night ~15 transactions are missing and ~15 others are duplicated."
      },
      codeLines: [
        "-- Page N pulled while live writes are happening:",
        "SELECT tx_id, user_id, amount, created_at",
        "FROM transactions",
        "WHERE created_at >= '2026-10-01'",
        "ORDER BY created_at DESC",
        "LIMIT 1000 OFFSET 2000;"
      ],
      buggyLineIndex: 4,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Gunakan Keyset / Cursor Pagination dengan tie-breaker unik: WHERE (created_at, tx_id) > (:last_ts, :last_id) ORDER BY created_at ASC, tx_id ASC LIMIT 1000",
            en: "Use Keyset / Cursor Pagination with a unique tie-breaker: WHERE (created_at, tx_id) > (:last_ts, :last_id) ORDER BY created_at ASC, tx_id ASC LIMIT 1000"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Perkecil ukuran halaman menjadi LIMIT 100 OFFSET N",
            en: "Reduce the page size to LIMIT 100 OFFSET N"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Hapus klausa ORDER BY created_at DESC agar database membaca urutan fisik disk",
            en: "Remove ORDER BY created_at DESC so the database reads in disk order"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Dua bug mematikan di sini: (1) `ORDER BY created_at DESC` pada tabel yang sedang menerima transaksi baru menggeser posisi offset setiap ada baris baru yang masuk, sehingga baris lama terdorong ke halaman berikutnya (duplikat) atau terlewat; (2) `created_at` bisa kembar pada milidetik yang sama tanpa tie-breaker unik (`tx_id`). Gunakan selalu Keyset Pagination `(created_at, tx_id) > ...`.",
        en: "Two silent killers here: (1) Paginating with `OFFSET` over `ORDER BY created_at DESC` while new rows are being inserted shifts the offset window between page requests, causing rows to be duplicated or skipped; (2) `created_at` alone is not unique without `tx_id` as a tie-breaker. Always use Keyset/Cursor pagination."
      }
    },
    {
      id: "bug-multitenant-rls",
      category: "Security / Multitenant RLS",
      difficulty: "Critical Security Breach",
      relatedModule: "mod-2-5",
      title: {
        id: "Kasus #6: Kebocoran Data Lintas-Tenant akibat Prioritas Operator OR Tanpa Kurung",
        en: "Case #6: Cross-Tenant Data Leak via Unparenthesized OR in Row-Level Security"
      },
      symptom: {
        id: "Pada dashboard Embedded Analytics B2B SaaS, Pelanggan Tenant #42 tiba-tiba melihat seluruh transaksi kartu kredit milik 500 perusahaan kompetitor lain yang metode bayarnya 'ewallet'!",
        en: "On a B2B SaaS Embedded Analytics dashboard, Tenant #42 suddenly sees all transactions belonging to 500 competitor companies whenever the payment method is 'ewallet'!"
      },
      codeLines: [
        "SELECT order_id, tenant_id, customer_id, total_idr",
        "FROM fact_orders",
        "WHERE tenant_id = :current_authenticated_tenant",
        "  AND payment_method = 'card' OR payment_method = 'ewallet'",
        "  AND status = 'delivered';"
      ],
      buggyLineIndex: 3,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Bungkus kondisi OR dengan tanda kurung atau gunakan IN: AND payment_method IN ('card', 'ewallet') serta tegakkan RLS di level policy database",
            en: "Wrap the OR condition in parentheses or use IN: AND payment_method IN ('card', 'ewallet') and enforce RLS via database row-access policy"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Pindahkan WHERE tenant_id = :current_authenticated_tenant ke baris terakhir klausa WHERE",
            en: "Move WHERE tenant_id = :current_authenticated_tenant to the last line of the WHERE clause"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Tambahkan DISTINCT order_id pada SELECT",
            en: "Add DISTINCT order_id to the SELECT list"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Di SQL, operator `AND` memiliki prioritas (precedence) lebih tinggi daripada `OR`! Tanpa tanda kurung, query di atas dievaluasi sebagai `(tenant_id = :tenant AND payment_method = 'card') OR (payment_method = 'ewallet' AND status = 'delivered')`. Akibatnya, semua pesanan `ewallet` dari SELURUH tenant di dunia lolos filter!",
        en: "In SQL, `AND` binds tighter than `OR`! Without parentheses, the predicate evaluates as `(tenant_id = :tenant AND payment_method = 'card') OR (payment_method = 'ewallet' AND status = 'delivered')`, leaking every delivered `ewallet` order across ALL tenants!"
      }
    },
    {
      id: "bug-unsalted-pii-hash",
      category: "Privacy / GDPR & PII",
      difficulty: "DMBOK Security Audit Failure",
      relatedModule: "mod-2-5",
      title: {
        id: "Kasus #7: Pseudonimisasi PII Tanpa Salt & Penggabungan Pelanggan Tanpa Nomor Telepon",
        en: "Case #7: Unsalted SHA-256 PII Hashing & NULL Phone Identity Collision"
      },
      symptom: {
        id: "Tim audit keamanan membuktikan bahwa seluruh `customer_hash` di data lake berhasil dibalikkan kembali ke nomor HP asli dalam 4 detik, DAN 1.200 pelanggan yang tidak mengisi nomor HP tergabung menjadi 1 orang dengan belanja Rp 4,5 Miliar!",
        en: "A security audit proves every `customer_hash` in the lakehouse can be reversed back to plaintext phone numbers in 4 seconds, AND 1,200 customers with missing phone numbers merged into 1 whale account!"
      },
      codeLines: [
        "def anonymize_customer_row(row):",
        "    raw_phone = (row.get('phone') or '').strip()",
        "    # Anonymize phone into pseudonymous customer key:",
        "    pii_token = hashlib.sha256(raw_phone.encode('utf-8')).hexdigest()",
        "    return {'pii_token': pii_token, 'city': row.get('city'), 'total_idr': row.get('total_idr')}"
      ],
      buggyLineIndex: 3,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Wajibkan secret salt dari KMS/Vault (`hmac.new(secret_salt, ...)`), dan jangan gunakan field opsional/kosong sebagai kunci identitas tanpa fallback ID unik",
            en: "Use a secret salt from KMS/Vault (`hmac.new(secret_salt, ...)`), and never hash an empty string as an entity key without a unique fallback ID"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Ganti algoritma hashlib.sha256 menjadi hashlib.sha512 tanpa menambahkan salt",
            en: "Replace hashlib.sha256 with hashlib.sha512 without adding a secret salt"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Enkripsi disk S3 dengan default AWS SSE-S3 agar hash tidak bisa dibaca oleh analis yang punya akses SELECT",
            en: "Enable default AWS SSE-S3 disk encryption so analysts with SELECT access cannot see the hash"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Dua kegagalan fatal: (1) Ruang kemungkinan nomor HP sangat kecil (~100 juta nomor), sehingga SHA-256 atau SHA-512 tanpa *secret salt* dapat ditebak dengan rainbow table dalam hitungan detik; (2) Setiap baris dengan `phone = None` atau `''` menghasilkan hash string kosong `e3b0c442...` yang sama persis, menggabungkan ribuan pelanggan berbeda menjadi satu identitas!",
        en: "Two fatal bugs: (1) Phone numbers have low entropy (~100M possibilities), so unsalted SHA-256/SHA-512 is trivially reversed via a precomputed rainbow table; (2) Every customer with `phone = None` or `''` hashes to the exact same empty-string SHA-256 digest (`e3b0c442...`), collapsing 1,200 distinct users into one entity!"
      }
    },
    {
      id: "bug-semantic-metric-drift",
      category: "Serving / Semantic Layer & Reverse ETL",
      difficulty: "Cross-Team Metric & Feedback Bug",
      relatedModule: "mod-2-6",
      title: {
        id: "Kasus #8: Drift Metrik Semantic Layer & Loop Reverse-ETL Voucher VIP",
        en: "Case #8: Semantic Layer Metric Drift & Reverse-ETL VIP Voucher Feedback Loop"
      },
      symptom: {
        id: "Job Reverse ETL mengirim voucher VIP Rp 500.000 otomatis ke 800 akun penipu yang melakukan checkout Rp 5.000.000 lalu langsung klik 'Cancel / Refund' 1 menit kemudian.",
        en: "A Reverse ETL sync automatically dispatches $50 VIP vouchers to 800 fraudsters who placed $500 orders and immediately cancelled or refunded them 1 minute later."
      },
      codeLines: [
        "-- Reverse ETL Query: Sync VIP customers (Net LTV >= 2,000,000) to CRM",
        "SELECT customer_id,",
        "       SUM(gross_idr - discount_idr - tax_idr) AS net_ltv_idr,",
        "       'VIP_UPGRADE' AS crm_action",
        "FROM fact_orders",
        "GROUP BY customer_id",
        "HAVING SUM(gross_idr - discount_idr - tax_idr) >= 2000000;"
      ],
      buggyLineIndex: 4,
      options: [
        {
          id: "opt-1",
          text: {
            id: "Gunakan definisi metrik terpusat Semantic Layer yang memfilter WHERE status IN ('paid', 'shipped', 'delivered') serta sertakan idempotency_key pada payload Reverse ETL",
            en: "Query the governed Semantic Layer metric that enforces WHERE status IN ('paid', 'shipped', 'delivered') and attach a deterministic idempotency_key to Reverse ETL payloads"
          },
          correct: true
        },
        {
          id: "opt-2",
          text: {
            id: "Naikkan ambang HAVING menjadi >= 10000000 tanpa memfilter kolom status",
            en: "Raise the HAVING threshold to >= 10000000 without filtering on status"
          },
          correct: false
        },
        {
          id: "opt-3",
          text: {
            id: "Ganti SUM(gross_idr - discount_idr - tax_idr) dengan AVG(gross_idr)",
            en: "Replace SUM(gross_idr - discount_idr - tax_idr) with AVG(gross_idr)"
          },
          correct: false
        }
      ],
      explanation: {
        id: "Menulis ulang logika metrik secara ad-hoc di query Reverse ETL tanpa memfilter `WHERE status IN ('paid', 'shipped', 'delivered')` menghitung pesanan yang dibatalkan/direfund sebagai LTV sah! Ini menciptakan *runaway feedback loop* (Bab 9 *Fundamentals of Data Engineering*): penipu mendapat voucher VIP dari pesanan batal dan menggunakannya lagi. Selalu konsumsi metrik dari Semantic Layer yang teruji.",
        en: "Re-writing metric logic ad-hoc inside a Reverse ETL query without `WHERE status IN ('paid', 'shipped', 'delivered')` counts cancelled and refunded orders as valid LTV! This triggers a *runaway automated feedback loop* (Chapter 9 of *Fundamentals of Data Engineering*). Always consume metrics from a single governed Semantic Layer."
      }
    }
  ];

  const STAKEHOLDER_DEFENSE_DRILLS = [
    {
      "id": "def-stage1-kafka",
      "role": "CEO & Co-Founder (Stage-1 Startup)",
      "chapter": "Ch. 1, 3 & 4 — Data Maturity, Type A vs. B & TCO/TOCO",
      "title": {
        "id": "Skenario #1: CEO Startup Stage-1 Meminta Klaster Real-Time Kafka & Spark untuk Rapat Mingguan",
        "en": "Scenario #1: Stage-1 Startup CEO Demands Real-Time Kafka & Spark for a Weekly Meeting"
      },
      "stakeholderQuote": {
        "id": "\"Saya baru membaca bahwa perusahaan teknologi modern menjalankan Apache Kafka dan Spark Streaming di Kubernetes. Tim data kita 2 orang dan kita memproses 40.000 pesanan sehari. Saya ingin Anda membangun klaster Kafka + Spark bulan ini agar dashboard penjualan untuk rapat direksi hari Senin terlihat canggih!\"",
        "en": "\"I just read that modern tech companies run Apache Kafka and Spark Streaming on Kubernetes. Our data team has 2 engineers and we process 40,000 orders a day. I want you to build a Kafka + Spark cluster this month so the sales dashboard for our Monday board meeting is cutting-edge!\""
      },
      "options": [
        {
          "id": "opt-1",
          "text": {
            "id": "Setuju, tetapi mulai kecil: satu topic Kafka terkelola yang mengisi job Spark, agar tim belajar streaming sambil dashboard dibangun.",
            "en": "Agree, but start smaller: one managed Kafka topic feeding a Spark job, so the team learns streaming while the dashboard is built."
          },
          "correct": false
        },
        {
          "id": "opt-2",
          "text": {
            "id": "Tolak dengan sopan dan tetap kirim angka hari Senin dari spreadsheet sampai perusahaan cukup besar untuk platform sungguhan.",
            "en": "Refuse politely and keep sending the Monday numbers from a spreadsheet until the company grows into a real platform."
          },
          "correct": false
        },
        {
          "id": "opt-3",
          "text": {
            "id": "Tanyakan apa yang akan diputuskan direksi dan seberapa sering, lalu tawarkan batch harian yang teruji (loader terkelola plus DuckDB atau warehouse kecil) yang siap minggu ini.",
            "en": "Ask what the board will decide and how often, then offer a tested daily batch (a managed loader plus DuckDB or a small warehouse) ready this week."
          },
          "correct": true
        },
        {
          "id": "opt-4",
          "text": {
            "id": "Bangun klaster sesuai permintaan, karena saat perusahaan tumbuh ke tahap 3 ia tetap akan butuh streaming, dan memulai lebih awal menghemat migrasi yang menyakitkan di kemudian hari.",
            "en": "Build the cluster as asked, because once the company grows to stage 3 it will need streaming anyway, and starting early saves a painful migration later on."
          },
          "correct": false
        }
      ],
      "rubric": {
        "id": "**Bab 1 sampai 4 buku ini:** sesuaikan desain dengan kematangan perusahaan. Rapat hari Senin butuh angka harian yang bisa dipercaya, bukan kesegaran di bawah satu detik. Empat puluh ribu pesanan sehari muat dengan mudah di satu mesin. Klaster Kafka dan Spark akan menghabiskan sebagian besar waktu dua engineer sebelum ada satu pun angka yang berguna: waktu yang hilang itulah biaya peluangnya. Memulai streaming secara \"kecil\" (opsi 1) tetap membayar biaya itu; spreadsheet (opsi 2) menyerah pada angka yang andal.",
        "en": "**Chapters 1 to 4 of the book:** match the design to the company's maturity. A Monday meeting needs trustworthy daily numbers, not sub-second freshness. Forty thousand orders a day fit easily on one machine. A Kafka and Spark cluster would eat most of two engineers' time before anyone saw a useful number: that lost time is the opportunity cost. Starting \"small\" with streaming (option 1) still buys that cost; a spreadsheet (option 2) gives up on reliable numbers."
      }
    },
    {
      "id": "def-upstream-contract",
      "role": "Lead Backend Software Engineer (Upstream Producer)",
      "chapter": "Ch. 1, 2 & 7 — Upstream Exhaust vs. Data Contracts",
      "title": {
        "id": "Skenario #2: Tim Backend Mengubah Nama & Tipe Kolom Postgres Setiap Jumat Tanpa Pemberitahuan",
        "en": "Scenario #2: Upstream Backend Team Renames Postgres Columns Every Friday Without Notice"
      },
      "stakeholderQuote": {
        "id": "\"Database PostgreSQL checkout adalah milik microservice kami, bukan milik tim Data! Kalau kami perlu mengubah `total_idr` dari integer menjadi string `'Rp 150.000'` atau menghapus kolom `status` pada deploy Jumat sore, itu urusan tim aplikasi. Mengapa pipeline analitik kalian yang lambat jadi menghambat sprint kami?\"",
        "en": "\"The checkout PostgreSQL database belongs to our application microservice, not the Data team! If we need to change `total_idr` from an integer to formatted text `'Rp 150.000'` or drop `status` on Friday afternoon, that's our business. Why should your analytics pipelines slow down our sprint velocity?\""
      },
      "options": [
        {
          "id": "opt-1",
          "text": {
            "id": "Minta tim backend memberi tahu tim data di kanal chat sebelum setiap deploy yang mengubah tabel, lalu sesuaikan pipeline saat itu.",
            "en": "Ask the backend team to tell the data team in the chat channel before every deploy that changes a table, and adjust the pipeline then."
          },
          "correct": false
        },
        {
          "id": "opt-2",
          "text": {
            "id": "Jelaskan siapa yang bergantung pada tabel itu, lalu sepakati view atau event yang dipublikasikan dengan data contract yang dicek di CI mereka, sementara tabel internal tetap bebas mereka ubah.",
            "en": "Explain who depends on the table, then agree a published view or event with a data contract checked in their CI, while internal tables stay theirs to change."
          },
          "correct": true
        },
        {
          "id": "opt-3",
          "text": {
            "id": "Buat pipeline toleran: baca setiap kolom sebagai teks dan lewati baris yang gagal, agar perubahan skema tidak pernah menghentikan load.",
            "en": "Make the pipeline tolerant: read every column as text and skip rows that fail, so a schema change can never stop the load."
          },
          "correct": false
        },
        {
          "id": "opt-4",
          "text": {
            "id": "Minta read replica database checkout yang dikendalikan oleh tim data, agar setiap perubahan dari tim backend baru sampai ke analitik setelah tim data punya cukup waktu untuk menyesuaikan pipeline-nya.",
            "en": "Ask for a read replica of the checkout database that the data team controls, so that backend changes reach analytics only after the data team has had time to adapt to them."
          },
          "correct": false
        }
      ],
      "rubric": {
        "id": "**Bab 2 dan 7 buku ini:** bagi engineer aplikasi, database adalah state aplikasi, bukan produk untuk Anda, dan wajar jika mereka ingin mengubahnya. Solusinya adalah antarmuka: view atau event yang dipublikasikan, bentuknya ditulis dalam data contract dan dicek otomatis di CI mereka, agar perubahan yang merusak menggagalkan build mereka, bukan laporan Senin Anda. Pesan chat (opsi 1) terlupakan; pipeline yang toleran (opsi 3) menyembunyikan kerusakan; replica (opsi 4) ikut menyalin perubahan skema yang sama.",
        "en": "**Chapters 2 and 7 of the book:** to application engineers the database is the app's state, not a product for you, and they are right to want to change it. The fix is an interface: a published view or event whose shape is written down in a data contract and checked automatically in their CI, so a breaking change fails their build instead of your Monday report. A chat message (option 1) is forgotten; a tolerant pipeline (option 3) hides the damage; a replica (option 4) copies the same schema changes."
      }
    },
    {
      "id": "def-cfo-cmo-drift",
      "role": "CFO (Finance) vs. CMO (Marketing)",
      "chapter": "Ch. 3 & 9 — Brownfield Strangler Fig & Semantic Layer",
      "title": {
        "id": "Skenario #3: Perang Angka 'Net Revenue' Antara Spreadsheet Finance vs. Dashboard Marketing",
        "en": "Scenario #3: CFO vs. CMO War Over a 14% 'Net Revenue' Discrepancy"
      },
      "stakeholderQuote": {
        "id": "\"Di rapat kuartal pagi ini, laporan stored procedure Finance mencatat Net Revenue Rp 12,0 Miliar, sedangkan dashboard Looker/Power BI Marketing mencatat Rp 13,7 Miliar (+14%). Keduanya menuduh tim Data Engineer tidak becus! Mereka meminta Anda menulis ulang seluruh 40 stored procedure warisan akhir pekan ini juga.\"",
        "en": "\"In this morning's quarterly review, Finance's legacy stored procedure reported $12.0M in Net Revenue while Marketing's BI dashboard reported $13.7M (+14%). Both executives are blaming the Data Engineering team and demanding a big-bang rewrite of all 40 legacy stored procedures this weekend!\""
      },
      "options": [
        {
          "id": "opt-1",
          "text": {
            "id": "Pilih angka keuangan sebagai angka resmi, karena keuangan yang menandatangani laporan, dan minta marketing mengubah dashboard-nya agar sama.",
            "en": "Pick the finance number as the official one, since finance signs the accounts, and ask marketing to change its dashboard to match."
          },
          "correct": false
        },
        {
          "id": "opt-2",
          "text": {
            "id": "Tulis ulang ke-40 prosedur di tool baru selama beberapa akhir pekan, kali ini dengan tes, lalu pindahkan semua orang sekaligus.",
            "en": "Rewrite all 40 procedures in a new tool over a few weekends, with tests this time, then switch everyone at once."
          },
          "correct": false
        },
        {
          "id": "opt-3",
          "text": {
            "id": "Tampilkan kedua angka berdampingan di setiap dashboard dengan catatan kaki yang menjelaskan kedua metode perhitungannya, agar setiap eksekutif bisa memilih angka yang paling sesuai dengan tujuannya.",
            "en": "Show both numbers side by side on every dashboard with a footnote explaining the two methods, so that each executive can choose the one that fits their purpose."
          },
          "correct": false
        },
        {
          "id": "opt-4",
          "text": {
            "id": "Jalankan yang lama dan yang baru berdampingan, pecah selisihnya menjadi penyebab (refund, diskon, pajak), sepakati satu definisi, lalu pindahkan satu metrik demi satu metrik.",
            "en": "Run old and new side by side, break the difference into causes (refunds, discounts, tax), agree one definition, then move one metric at a time."
          },
          "correct": true
        }
      ],
      "rubric": {
        "id": "**Bab 3 dan 9 buku ini:** perbedaan metrik adalah masalah definisi, bukan masalah tool. Rekonsiliasi dulu: jelaskan seluruh selisih menurut penyebabnya, yang sekaligus menemukan bug lama. Lalu tulis definisi yang disepakati sekali saja (semantic layer) dan ganti prosedur lama sedikit demi sedikit (strangler fig). Memilih pemenang (opsi 1) atau menampilkan keduanya (opsi 3) membiarkan definisinya tetap berbeda; menulis ulang besar-besaran (opsi 2) memindahkan perbedaan itu ke kode baru.",
        "en": "**Chapters 3 and 9 of the book:** a metric disagreement is a definition problem, not a tooling problem. Reconcile first: explain the whole difference by cause, which also finds the old bugs. Then write the agreed definition once (a semantic layer) and replace the old procedures piece by piece (the strangler fig). Picking a winner (option 1) or showing both (option 3) leaves the definitions apart; a big rewrite (option 2) moves the disagreement into new code."
      }
    },
    {
      "id": "def-gdpr-parquet",
      "role": "Chief Information Security Officer (CISO) & Legal DPO",
      "chapter": "Ch. 2, 6 & 10 — Security, Privacy (GDPR) & Open Table Formats",
      "title": {
        "id": "Skenario #4: Tuntutan Audit GDPR Penghapusan Data & Kebocoran Hash Nomor Telepon Tanpa Salt",
        "en": "Scenario #4: GDPR Right-to-Be-Forgotten Audit & Unsalted Phone Hash Vulnerability"
      },
      "stakeholderQuote": {
        "id": "\"Auditor eksternal menandai dua masalah di data lake 50 TB kita: (1) `phone_hash` adalah `SHA256(phone)` biasa, dan alat uji mereka berhasil membaliknya; (2) permintaan penghapusan GDPR setiap bulan membuat kita menulis ulang Parquet mentah dalam jumlah besar, dan tagihannya terus naik.\"",
        "en": "\"External auditors flagged two problems in our 50 TB data lake: (1) `phone_hash` is a plain `SHA256(phone)`, and their test tool reversed it; (2) every month's GDPR deletion requests make us rewrite huge amounts of raw Parquet, and the bill keeps growing.\""
      },
      "options": [
        {
          "id": "opt-1",
          "text": {
            "id": "Ganti hash ke bcrypt dengan salt acak per baris, standar untuk password, dan kumpulkan semua penghapusan menjadi satu penulisan ulang per tahun.",
            "en": "Switch the hash to bcrypt with a random salt per row, which is the standard for passwords, and batch all deletions into one yearly rewrite."
          },
          "correct": false
        },
        {
          "id": "opt-2",
          "text": {
            "id": "Enkripsi seluruh bucket dengan kunci terkelola dan batasi siapa yang bisa membacanya, agar hash tidak lagi penting dan penghapusan bisa menunggu.",
            "en": "Encrypt the whole bucket with a managed key and limit who can read it, so the hashes no longer matter and deletions can wait."
          },
          "correct": false
        },
        {
          "id": "opt-3",
          "text": {
            "id": "Buat token ulang saat ingestion dengan HMAC dan kunci di secret store, dan pindahkan tabel ke Iceberg agar penghapusan menulis file delete kecil, plus log audit tentang apa yang dihapus.",
            "en": "Re-tokenise at ingestion with HMAC and a key in a secret store, and move the tables to Iceberg so deletes write small delete files, plus an audit log of what was erased."
          },
          "correct": true
        },
        {
          "id": "opt-4",
          "text": {
            "id": "Tetap pakai hash SHA-256 tetapi tambahkan tanggal pendaftaran pelanggan sebagai salt, agar setiap nomor mendapat token berbeda, dan hapus baris yang cocok langsung dari file Parquet dengan job semalam.",
            "en": "Keep the SHA-256 hashes but add the customer's own signup date as a salt, so each phone gets a different token, and delete matching rows straight from the Parquet files with an overnight job."
          },
          "correct": false
        }
      ],
      "rubric": {
        "id": "**Bab 6 dan 10 buku ini:** nomor telepon punya sangat sedikit kemungkinan sehingga hash apa pun tanpa kunci bisa dibalik dengan mencoba semuanya; kunci rahasia (HMAC) mencegahnya sambil menjaga token tetap bisa di-join. Salt yang bisa dilihat penyerang di tabel yang sama (opsi 4) tidak membantu; salt acak per baris (opsi 1) merusak join. File Parquet biasa tidak bisa diubah di tempat, sehingga setiap penghapusan menulis ulang file; format tabel seperti Iceberg atau Delta mencatat penghapusan di file kecil lalu memadatkannya kemudian. Enkripsi saat disimpan (opsi 2) tidak memenuhi permintaan penghapusan.",
        "en": "**Chapters 6 and 10 of the book:** a phone number has so few possibilities that any unkeyed hash can be reversed by trying them all; a secret key (HMAC) stops that while keeping the token joinable. A salt the attacker can see in the same table (option 4) does not help; a random salt per row (option 1) breaks joins. Plain Parquet files cannot change in place, so every deletion rewrites them; a table format such as Iceberg or Delta records deletes in small files and compacts later. Encryption at rest (option 2) does not satisfy a deletion request."
      }
    }
  ];

  const TALENTHUB_BENCHMARK_JDS = [
    {
      id: "jd-analytics-warehouse",
      title: "Example — Analytics & warehouse data engineer",
      company: "Example job description (written for practice)",
      rawText: "Design, build, and maintain batch ETL/ELT pipelines into cloud data warehouses (Snowflake, BigQuery, Redshift, DuckDB). Develop dimensional data models (Kimball Star Schema, SCD Type 2, Data Vault 2.0) and staging-to-mart transformations using dbt Core and advanced SQL (Window functions, CTEs, EXPLAIN query optimization). Implement automated data quality gates, YAML data contracts, and a unified Semantic Layer for Finance and Marketing BI dashboards. Collaborate with cross-functional stakeholders to translate business requirements into SLAs.",
      requiredSkills: [
        { name: "Advanced SQL & Query Tuning (EXPLAIN / Window Functions)", keywords: ["sql", "window", "cte", "explain", "optimization"], modules: ["mod-0-3", "mod-1-3"] },
        { name: "Dimensional Modeling (Kimball Star Schema, SCD2 & Data Vault 2.0)", keywords: ["dimensional", "star schema", "kimball", "scd", "data vault", "model"], modules: ["mod-1-4"] },
        { name: "dbt Core Transformations & Testing", keywords: ["dbt", "elt", "mart", "staging"], modules: ["mod-2-3"] },
        { name: "Cloud Data Warehouses, Semantic Layer & Reverse ETL", keywords: ["snowflake", "bigquery", "redshift", "warehouse", "semantic", "reverse etl", "bi"], modules: ["mod-2-6"] },
        { name: "Data Quality Gates, Observability & Stakeholder Contracts", keywords: ["quality", "contract", "sla", "stakeholder", "governance"], modules: ["mod-0-2", "mod-2-5"] }
      ]
    },
    {
      id: "jd-batch-streaming",
      title: "Example — Batch & streaming data engineer",
      company: "Example job description (written for practice)",
      rawText: "Architect and operate scalable batch and real-time streaming data pipelines using Python, PySpark, Apache Kafka, Debezium Change Data Capture (CDC) from PostgreSQL WAL, and Apache Flink. Orchestrate complex DAGs with Apache Airflow or Dagster with strict idempotency, cursor pagination, rate-limit backoff, watermarks, and dead-letter queues (DLQ). Diagnose data skew, shuffle spill, and OOM exit code 137 in Docker/Linux environments.",
      requiredSkills: [
        { name: "Linux, Bash, Docker Containers & Git Hygiene", keywords: ["linux", "bash", "docker", "git", "137", "container"], modules: ["mod-0-1", "mod-1-1"] },
        { name: "Production Python, Pydantic, Generators & API Ingestion", keywords: ["python", "pydantic", "api", "pagination", "idempoten", "pytest"], modules: ["mod-1-2", "mod-1-6", "mod-4-2"] },
        { name: "Distributed Spark / PySpark & Skew Optimization", keywords: ["spark", "pyspark", "shuffle", "skew", "hadoop"], modules: ["mod-3-0", "mod-3-1"] },
        { name: "Kafka Event Streaming, Debezium CDC & Watermarks", keywords: ["kafka", "cdc", "debezium", "stream", "flink", "watermark", "real-time"], modules: ["mod-3-2", "mod-3-3", "mod-4-3"] },
        { name: "DAG Orchestration (Airflow / Dagster) & Backfills", keywords: ["airflow", "dagster", "orchestrat", "dag", "backfill"], modules: ["mod-2-4", "mod-4-4"] }
      ]
    },
    {
      id: "jd-lakehouse-finops",
      title: "Example — Cloud lakehouse data engineer",
      company: "Example job description (written for practice)",
      rawText: "Build and secure multi-environment cloud data lakehouses on AWS S3/GCS using columnar Parquet, Apache Arrow, DuckDB, Polars, Apache Iceberg, and Delta Lake (ACID transactions, time travel, Merge-on-Read compaction). Provision least-privilege IAM, KMS encryption, and VPC endpoints via Terraform Infrastructure as Code (IaC). Drive FinOps cost optimization across warehouse auto-suspend, partition pruning, storage tiering, and cross-AZ/region egress guardrails.",
      requiredSkills: [
        { name: "Columnar Parquet, Arrow, DuckDB & Polars", keywords: ["parquet", "arrow", "duckdb", "polars", "columnar"], modules: ["mod-2-1"] },
        { name: "Open Table Formats (Apache Iceberg & Delta Lake ACID)", keywords: ["iceberg", "delta lake", "lakehouse", "compaction", "time travel"], modules: ["mod-2-2", "mod-4-1"] },
        { name: "NoSQL Polyglot Storage (KV, Document, Wide-Column, Graph)", keywords: ["nosql", "mongodb", "redis", "cassandra", "dynamodb"], modules: ["mod-1-7"] },
        { name: "Terraform Infrastructure as Code (IaC) & Lakehouse Security", keywords: ["terraform", "iac", "s3", "iam", "kms", "aws", "cloud", "gcp", "azure"], modules: ["mod-3-4"] },
        { name: "Cloud FinOps, Partition Pruning & Network Egress Control", keywords: ["finops", "cost", "pruning", "egress", "partition", "budget"], modules: ["mod-2-6", "mod-3-4"] }
      ]
    },
    {
      id: "jd-ai-governance",
      title: "Example — Data engineer for AI & governance",
      company: "Example job description (written for practice)",
      rawText: "Build incremental, idempotent offline data pipelines for Retrieval-Augmented Generation (RAG) and LLM applications using PostgreSQL pgvector, HNSW approximate nearest neighbor indexing, structure-aware chunking, and content-hash deduplication. Enforce enterprise DMBOK data governance, salted PII pseudonymization, GDPR/UU PDP Right-to-Be-Forgotten erasure, Multitenant Row-Level Security (RLS), and Master Data Management (MDM Golden Records).",
      requiredSkills: [
        { name: "Vector Data Engineering, pgvector HNSW & Incremental RAG", keywords: ["ai", "llm", "rag", "vector", "pgvector", "embedding", "hnsw", "machine learning"], modules: ["mod-3-5"] },
        { name: "PII Salted Hashing, GDPR Erasure, Multitenant RLS & MDM", keywords: ["security", "privacy", "gdpr", "pii", "governance", "mdm", "master data", "rls", "masking"], modules: ["mod-2-5", "mod-3-4"] },
        { name: "Data Contracts, Observability & Drift Detection", keywords: ["contract", "observability", "lineage", "catalog", "quality", "monitoring"], modules: ["mod-2-5"] },
        { name: "Production Python, SQL & Automated Regression Evaluation", keywords: ["python", "sql", "pytest", "eval", "ci/cd"], modules: ["mod-1-2", "mod-1-3", "mod-3-5"] }
      ]
    }
  ];

  root.PRACTICE_LABS = {
    SIMULATORS,
    SILENT_BUG_DRILLS,
    STAKEHOLDER_DEFENSE_DRILLS,
    TALENTHUB_BENCHMARK_JDS
  };
})(typeof window !== "undefined" ? window : globalThis);

