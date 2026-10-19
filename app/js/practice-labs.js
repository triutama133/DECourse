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
      modules: ["mod-0-2", "mod-1-1", "mod-1-5", "mod-1-6", "mod-2-5"],
      icon: "🔁",
      title: {
        id: "Simulator: Idempotensi Pipeline Saat Retry & Backfill",
        en: "Simulator: Pipeline Idempotency Under Retries & Backfills"
      },
      subtitle: {
        id: "Simulasikan kegagalan jaringan saat Airflow/Dagster menjalankan ulang task 3x. Lihat strategi penulisan mana yang merusak tabel produksi.",
        en: "Simulate network retries when Airflow/Dagster re-runs a task 3x. See which write strategy corrupts production tables."
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
    }
  ];

  root.PRACTICE_LABS = {
    SIMULATORS,
    SILENT_BUG_DRILLS
  };
})(typeof window !== "undefined" ? window : globalThis);

