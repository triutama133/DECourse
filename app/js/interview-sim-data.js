/* Story-driven Interview Loop Simulator data (bilingual ID / EN).
   Complements job-career-data.js with multi-round technical interview simulations
   across Junior/Mid, Mid/Senior Streaming, and Senior/AI Data Platform tracks. */
(function (root) {
  "use strict";
  const T = (id, en) => ({ id, en });

  const COMPETENCIES = [
    { id: "sql", label: T("SQL & Modeling", "SQL & Modeling"), color: "#2563eb" },
    { id: "arch", label: T("Arsitektur Sistem", "System Design"), color: "#0f766e" },
    { id: "ops", label: T("Insiden & FinOps", "Ops & FinOps"), color: "#d97706" },
    { id: "comm", label: T("Komunikasi Teknis", "Communication"), color: "#7c3aed" }
  ];

  const TRACKS = [
    {
      id: "tokopaedi",
      logo: { text: "TK", bg: "#0f766e", fg: "#f0fdfa" },
      company: "Tokopaedi Commerce",
      role: "Junior / Mid Data Engineer",
      level: T("Junior → Mid", "Junior → Mid"),
      salary: T("Rp 12–18 juta / bulan", "IDR 12–18 million / month"),
      duration: T("45 menit · 3 Babak + Komite", "45 mins · 3 Rounds + Committee"),
      summary: T(
        "Wawancara tim Analytics & Data Warehouse: loloskan query SQL bersih dari jebakan NULL/duplikat, rancang pipeline harian anti-dobel, dan hadapi tekanan stakeholder sebelum rapat direksi.",
        "Analytics & Data Warehouse team loop: debug SQL NULL/duplicate traps, design an idempotent daily batch pipeline, and handle executive pressure before a morning board meeting."
      ),
      relatedModules: ["mod-0-3", "mod-1-2", "mod-1-3", "mod-1-4", "mod-2-3"],
      people: {
        nadya: { name: "Nadya Kusuma", role: T("Tech Recruiter", "Tech Recruiter"), color: "#7c3aed" },
        dimas: { name: "Dimas Mahendra", role: T("Staff Data Engineer (SQL & Modeling)", "Staff Data Engineer (SQL & Modeling)"), color: "#0f766e" },
        clara: { name: "Clara Wijaya", role: T("Engineering Manager (Reliability)", "Engineering Manager (Reliability)"), color: "#1d4ed8" }
      },
      screening: {
        who: "nadya",
        timeline: [
          { title: T("CV lolos seleksi ATS", "CV passed ATS review"), when: T("Kemarin", "Yesterday") },
          { title: T("Recruiter Screen selesai", "Recruiter screen cleared"), when: T("Pagi ini", "This morning") },
          { title: T("Panel Teknis 3 Babak", "3-Round Technical Loop"), when: T("Dijadwalkan sekarang", "Scheduled now") }
        ],
        prompt: T(
          "Sebelum masuk ke panel teknis dengan Dimas dan Clara, bagaimana Anda membuka jawaban untuk pertanyaan: 'Ceritakan satu pipeline yang pernah Anda bangun dan bagaimana Anda memastikan datanya aman'?",
          "Before joining Dimas and Clara in the technical panel, how do you open your answer to: 'Tell me about a pipeline you built and how you made sure the data stayed trustworthy?'"
        ),
        pitches: [
          {
            text: T("Saya pakai Pandas dan skrip Python cepat di cron laptop, lalu langsung INSERT ke tabel laporan.", "I used a quick Python script on cron and inserted straight into the reporting table."),
            delta: { sql: 0, arch: 0, ops: 0, comm: 2 },
            good: false,
            reply: T("Nadya mencatat: 'Oke, nanti Dimas pasti akan mengejar soal idempotensi jika cron gagal di tengah jalan—siapkan pembelaan yang lebih kokoh ya!'", "Nadya notes: 'Got it—Dimas will definitely press you on what happens when that cron crashes mid-run. Be ready!'")
          },
          {
            text: T("Saya pisahkan fungsi validasi Pydantic, menulis atomik lewat file sementara + os.replace, dan mengirim baris cacat ke karantina agar eksekusi ulang selalu aman.", "I isolated Pydantic validation, wrote output atomically via temp swap + os.replace, and routed bad rows to quarantine so reruns stay idempotent."),
            delta: { sql: 2, arch: 4, ops: 3, comm: 6 },
            good: true,
            reply: T("Nadya tersenyum: 'Keren, padat sekali—langsung membahas validasi batas, atomisitas, dan idempotensi dalam 20 detik. Saya kirim catatan positif ke panel!'", "Nadya smiles: 'Crisp framing—you covered boundary validation, atomic writes, and idempotency in 20 seconds. Passing strong notes to the panel!'")
          },
          {
            text: T("Saya bangun Spark cluster 10 node dan Kafka supaya terlihat siap skala besar walaupun datanya masih 50 MB CSV.", "I spun up a 10-node Spark cluster and Kafka so it looks web-scale even for 50 MB CSVs."),
            delta: { sql: 0, arch: 1, ops: -1, comm: 2 },
            good: false,
            reply: T("Nadya mengingatkan: 'Tim kami sangat pragmatis—over-engineering untuk 50 MB sering dipertanyakan di sesi Arsitektur.'", "Nadya cautions: 'Our team is pragmatic—expect Clara to challenge why you added cluster overhead for 50 MB.'")
          }
        ]
      },
      rounds: [
        {
          id: "tk-r1",
          badge: T("Babak 1 · SQL & Modeling", "Round 1 · SQL & Modeling"),
          who: "dimas",
          pillar: "sql",
          artifact: {
            kind: "sql",
            title: T("Papan SQL: Atribusi Order & Pelanggan Yatim", "SQL Whiteboard: Order Attribution & Orphan Customers"),
            schema: "orders(order_id, customer_id, order_ts, total_idr, status)\ntouches(touch_id, customer_id, channel, touch_ts)\ndim_customer(customer_sk, customer_id, tier, valid_from, valid_to)",
            snippet: "SELECT o.order_id, t.channel, o.total_idr\nFROM orders o\nINNER JOIN touches t ON o.customer_id = t.customer_id\n  AND t.touch_ts <= o.order_ts;"
          },
          initial: {
            q: T(
              "Query di papan itu dipakai untuk menghitung pendapatan per channel iklan. Minggu lalu ada dua keluhan: total omzet membengkak 3x lipat, dan order dari pengguna baru tanpa catatan iklan menghilang total. Apa akar masalahnya?",
              "The query on the board tracks revenue by ad channel. Last week Finance flagged two bugs: attributed revenue tripled, and organic orders with no ad clicks completely disappeared. What is broken?"
            ),
            options: [
              {
                text: T("Tambahkan SELECT DISTINCT di baris pertama saja agar baris kembar otomatis terhapus.", "Just slap SELECT DISTINCT on the first line so duplicate rows disappear."),
                good: false,
                deltas: { sql: -6, arch: 0, ops: -2, comm: -2 },
                reply: T("Dimas menggeleng: 'DISTINCT tidak memulihkan order organik yang terbuang oleh INNER JOIN, dan bisa menyamarkan dua order sah dengan nominal sama.'", "Dimas shakes his head: 'DISTINCT still drops every organic order due to INNER JOIN, and silently hides real data grain bugs.'")
              },
              {
                text: T("INNER JOIN membuang order tanpa klik iklan, dan 1 order punya banyak klik sehingga fan-out 1:N. Gunakan LEFT JOIN plus ROW_NUMBER() / QUALIFY (atau MAX CASE WHEN) mengambil 1 touch terakhir sebelum order_ts, lalu fallback 'unattributed'.", "INNER JOIN drops organic orders, and 1:N clicks fan out order revenue. Switch to LEFT JOIN, rank touches with ROW_NUMBER()/QUALIFY before order_ts to pick 1 touch, and COALESCE missing channels to 'unattributed'."),
                good: true,
                deltas: { sql: 16, arch: 6, ops: 4, comm: 8 },
                reply: T("Dimas mengangguk cepat: 'Tepat sekali. Menjaga grain 1 baris per order dan tidak memakai INNER JOIN yang menghilangkan omzet adalah jawaban senior.'", "Dimas nods: 'Spot on. Preserving grain at 1 row per order and avoiding silent drops via INNER JOIN is the exact standard.'")
              },
              {
                text: T("Ubah status order yang NULL saja menjadi 'paid' lalu gunakan GROUP BY channel.", "Coalesce NULL statuses to 'paid' and GROUP BY channel."),
                good: false,
                deltas: { sql: -4, arch: -2, ops: 0, comm: -2 },
                reply: T("Dimas: 'Itu tidak menyentuh join fan-out 1:N maupun order tanpa touchpoint.'", "Dimas: 'That misses both the 1:N join fan-out and the missing touchpoint records.'")
              }
            ]
          },
          followup: {
            q: T(
              "Lanjutan: sekarang tim Keuangan lapor bahwa angka omzet tier 'Gold' kuartal lalu tiba-tiba naik Rp 6,8 juta setelah beberapa pelanggan naik kelas bulan ini. Bagaimana Anda memodelkan dim_customer agar angka historis tidak pernah berubah?",
              "Follow-up probe: Finance just noticed last quarter's 'Gold' tier revenue jumped by Rp 6.8M after a loyalty upgrade this month. How do you model dim_customer so closed quarters never shift?"
            ),
            options: [
              {
                text: T("Simpan dim_customer sebagai SCD Tipe 2 dengan surrogate key (customer_sk), valid_from, valid_to, plus baris Unknown Member (-1), lalu join tabel fakta dengan range order_ts >= valid_from AND order_ts < valid_to.", "Model dim_customer as SCD Type 2 with surrogate key (customer_sk), valid_from/valid_to, and an Unknown Member (-1), then range-join facts on order_ts >= valid_from AND order_ts < valid_to."),
                good: true,
                deltas: { sql: 14, arch: 8, ops: 2, comm: 6 },
                reply: T("Dimas: 'Sempurna—surrogate key + range join + Unknown Member (-1) menyelamatkan sejarah sekaligus order yatim.'", "Dimas: 'Perfect—surrogate key, half-open range join, and unknown member (-1) protect history and orphan rows.'")
              },
              {
                text: T("Jalankan UPDATE dim_customer SET tier = ... tiap malam agar tabel tetap kecil.", "Run UPDATE dim_customer SET tier = ... nightly so the table stays compact."),
                good: false,
                deltas: { sql: -6, arch: -4, ops: 0, comm: 0 },
                reply: T("Dimas: 'Itu SCD Tipe 1—justru itulah penyebab laporan kuartal lalu berubah!'", "Dimas: 'That is Type 1 overwrite—which is the exact bug causing historical numbers to rewrite!'")
              },
              {
                text: T("Salin snapshot penuh dim_customer tiap malam ke folder S3 tanpa join ke fakta.", "Dump full customer CSV snapshots nightly without linking facts."),
                good: false,
                deltas: { sql: 2, arch: 0, ops: 0, comm: 2 },
                reply: T("Dimas: 'Analis tetap kesulitan me-join di BI tanpa range key yang jelas di star schema.'", "Dimas: 'Analysts still cannot query historical point-in-time joins cleanly in BI without SCD2 in the star schema.'")
              }
            ]
          }
        },
        {
          id: "tk-r2",
          badge: T("Babak 2 · Desain Sistem", "Round 2 · System Design"),
          who: "dimas",
          pillar: "arch",
          artifact: {
            kind: "pipeline",
            title: T("Papan Arsitektur: 120 Cabang → Lakehouse Analitik", "Architecture Whiteboard: 120 Branches → Lakehouse"),
            nodes: [
              { id: "src", label: "120 POS CSV / API", role: T("Sumber Kasir", "POS Source") },
              { id: "ing", label: "Python + Quarantine", role: T("Validasi Batas", "Boundary Gate") },
              { id: "raw", label: "S3 Parquet Raw", role: T("Bronze Imutabel", "Immutable Raw") },
              { id: "trf", label: "dbt + DuckDB Marts", role: T("Silver & Gold", "Modeled Marts") }
            ]
          },
          initial: {
            q: T(
              "Tiap pagi 120 kafe mengirim ekspor CSV penjualan. Kadang cabang mengulang unggahan kemarin, dan format tanggalnya campur antara ISO dan '31/01/2026 14:03'. Rancang alur ingestion hingga mart yang tahan diulang berkali-kali.",
              "Every morning 120 cafés send sales CSVs. Sometimes a branch re-uploads yesterday's file, and dates mix ISO with '31/01/2026 14:03'. Design the end-to-end flow from landing to marts so reruns never corrupt data."
            ),
            options: [
              {
                text: T("Muat langsung CSV lewat pandas ke tabel produksi dengan mode INSERT APPEND, dan hapus baris cacat secara diam-diam.", "Load CSVs directly with pandas into prod using INSERT APPEND, silently skipping invalid rows."),
                good: false,
                deltas: { sql: 0, arch: -8, ops: -6, comm: 0 },
                reply: T("Dimas: 'APPEND menduplikasi data saat cabang upload ulang, dan silent drop membuat selisih audit.'", "Dimas: 'APPEND duplicates re-uploaded branches, and silent drops create unexplainable revenue gaps.'")
              },
              {
                text: T("Simpan file mentah apa adanya (raw layer), validasi batas ketat yang mengarahkan baris rusak ke quarantine + alasan, tulis partisi harian atomik (replace by partition / MERGE dedup by order_id), lalu serahkan transformasi ke staging & mart dbt.", "Preserve immutable raw landing, run boundary validation routing malformed rows to quarantine with reasons, land idempotent partition overwrites / deduplicated MERGE by order_id, then clean & test in dbt staging/marts."),
                good: true,
                deltas: { sql: 6, arch: 18, ops: 6, comm: 6 },
                reply: T("Dimas menandai diagram papan tulisnya: 'Raw terjaga, karantina transparan, dan write idempoten. Arsitektur bersih!'", "Dimas highlights the whiteboard nodes: 'Raw preserved, quarantine auditable, writes idempotent. Clean pipeline!'")
              },
              {
                text: T("Minta ke-120 manajer kafe mengedit manual CSV di Excel agar formatnya seragam sebelum di-upload.", "Email all 120 café managers to fix CSV formatting manually in Excel before uploading."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: -2, comm: -4 },
                reply: T("Dimas tertawa kecil: 'Dalam 3 hari pasti ada cabang baru yang lupa, dan manusia tidak skalabel.'", "Dimas chuckles: 'Within 3 days a branch will forget, and manual fixes never scale.'")
              }
            ]
          },
          followup: {
            q: T(
              "Dorongan terakhir di sesi desain: tim Marketing dan tim Finance masing-masing menghitung 'net revenue' dengan rumus sendiri di Looker dan Google Sheets. Di mana Anda menaruh definisi tunggal metrik itu agar angkanya tidak pernah beda lagi?",
              "Follow-up probe: Marketing and Finance still calculate 'net revenue' differently in Looker vs Google Sheets. Where do you lock in a single source of truth so numbers stop drifting?"
            ),
            options: [
              {
                text: T("Kunci metrik di satu model mart dbt terversi (Gold layer / Semantic Layer seperti MetricFlow) plus automated dbt test rekonsiliasi terhadap catatan sumber.", "Centralize the formula inside one version-controlled dbt mart / semantic layer (e.g., MetricFlow) backed by automated dbt reconciliation tests against source totals."),
                good: true,
                deltas: { sql: 4, arch: 14, ops: 4, comm: 8 },
                reply: T("Dimas menggarisbawahi kotak Gold Mart: 'Satu definisi di kode Git yang dites tiap build. Tepat!'", "Dimas underlines the Gold Mart node: 'One versioned definition tested on every build. Right call!'")
              },
              {
                text: T("Kirim panduan PDF ke Slack yang meminta semua analis menyalin rumus Excel yang sama.", "Pin a PDF guide in Slack asking analysts to copy-paste the same spreadsheet formula."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: 0, comm: -2 },
                reply: T("Dimas: 'Panduan PDF cepat usang dalam sebulan begitu ada aturan diskon baru.'", "Dimas: 'A PDF goes stale the moment a new promo discount rule launches.'")
              }
            ]
          }
        },
        {
          id: "tk-r3",
          badge: T("Babak 3 · Insiden & Stakeholder", "Round 3 · Incident & Stakeholders"),
          who: "clara",
          pillar: "ops",
          artifact: {
            kind: "incident",
            title: T("Alert Pukul 08.45 WIB · Rapat Direksi 09.00", "08:45 AM Alert · Board Meeting at 09:00"),
            sev: "SEV-2 · DATA QUALITY GATE",
            metrics: [
              { label: T("Tingkat Reject Baris", "Row Reject Rate"), val: "40.2% (SLA max 5%)" },
              { label: T("Kondisi Tabel Produksi", "Prod Table Status"), val: T("Masih versi kemarin (utuh)", "Yesterday's complete partition intact") },
              { label: T("Penyebab Terdeteksi", "Root Signal"), val: T("Kolom `net_idr` berubah jadi string kosong oleh rilis app semalam", "Upstream app release left `net_idr` blank on new checkouts") }
            ]
          },
          initial: {
            q: T(
              "15 menit sebelum rapat direksi, quality gate menggagalkan pipeline pagi karena 40% baris `net_idr` kosong dari rilis aplikasi kasir semalam. Untungnya penulisan atomik menahan data kemarin tetap utuh. Apa langkah pertama Anda?",
              "15 minutes before the board meeting, your quality gate halted the morning load because 40% of `net_idr` values arrived blank from last night's app deploy. Atomic swaps kept yesterday's partition intact. What do you do first?"
            ),
            options: [
              {
                text: T("Naikkan ambang batas reject rate menjadi 50% sementara agar pipeline hijau dan 60% data hari ini masuk ke dashboard direksi.", "Temporarily bump the reject threshold to 50% so the job turns green and pushes today's 60% partial data before the meeting."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: -10, comm: -6 },
                reply: T("Clara: 'Jangan pernah mendorong angka parsial -40% ke rapat direksi! Itu membuat direksi mengira penjualan jatuh 40%.'", "Clara: 'Never push -40% partial data into a board meeting! Executives would think revenue collapsed 40%.'")
              },
              {
                text: T("Pertahankan gate tetap gagal (data kemarin utuh), umumkan di #data-alerts kepada CFO & tim produk bahwa data pagi tertahan karena regresi app semalam, eskalasikan perbaikan sumber + rencana backfill.", "Keep the gate blocked (preserving yesterday's clean truth), proactively notify the CFO & product team that today's load is paused due to last night's app bug, and coordinate upstream fix + backfill."),
                good: true,
                deltas: { sql: 2, arch: 4, ops: 18, comm: 12 },
                reply: T("Clara tersenyum lega: 'Transparansi cepat + menjaga integritas dashboard. Kepercayaan bertahan saat bug diumumkan duluan, bukan saat ditemukan direksi.'", "Clara exhales: 'Proactive honesty while protecting dashboard integrity. Trust survives an announced delay, not silent wrong numbers.'")
              },
              {
                text: T("Isi saja 40% baris kosong dengan angka rata-rata minggu lalu di database produksi agar tidak terlambat.", "Impute the missing 40% rows with last week's average directly in prod so numbers look smooth."),
                good: false,
                deltas: { sql: -2, arch: -4, ops: -10, comm: -6 },
                reply: T("Clara: 'Memalsukan angka keuangan di database produksi tanpa jejak adalah pelanggaran audit serius.'", "Clara: 'Fabricating financial rows in prod is a major audit failure.'")
              }
            ]
          },
          followup: {
            q: T(
              "Tekanan terakhir: VP Operasional menelepon dan mendesak: 'Tolong matikan tes validasi permanen ya, saya cuma butuh dashboard selalu update jam 08.30 apa pun yang terjadi.' Bagaimana Anda membalasnya dengan diplomatis?",
              "Final probe: VP of Ops calls you directly: 'Please disable those validation tests permanently—I just need the dashboard refreshed by 08:30 no matter what.' How do you reply?"
            ),
            options: [
              {
                text: T("Jelaskan dampaknya ke keputusan beliau sendiri ('jika 40% order hilang tanpa peringatan, keputusan stok kafe salah'), lalu tawarkan jalan tengah: pertahankan gate pemblokir tetapi pasang banner tanggal kesegaran di dashboard + alert cepat jam 06.00 agar bug tertangkap sebelum jam kantor.", "Tie quality directly to their decisions ('if 40% of orders drop silently, store restock orders go wrong'), keep blocking gates, and offer an actionable compromise: display dashboard freshness timestamps + shift alert runs to 06:00 AM to catch bugs early."),
                good: true,
                deltas: { sql: 0, arch: 4, ops: 10, comm: 14 },
                reply: T("Clara: 'Jawaban berkelas. Anda tidak bilang \"tidak\" mentah-mentah—Anda melindungi bisnisnya dan menawarkan SLA operasional yang nyata.'", "Clara: 'Textbook senior communication. You protected the business without a blunt \"no\" and solved the underlying 8:30 timing problem.'")
              },
              {
                text: T("Turuti saja permintaan VP Operasional karena jabatan beliau lebih tinggi dari tim data.", "Comply immediately since the VP outranks the data team."),
                good: false,
                deltas: { sql: 0, arch: 0, ops: -8, comm: -6 },
                reply: T("Clara: 'Mengalah pada tekanan dengan mengorbankan kebenaran data justru menghancurkan reputasi Anda bulan depan.'", "Clara: 'Caving on data integrity guarantees a much bigger executive blow-up next month.'")
              }
            ]
          }
        }
      ],
      offer: {
        comp: T("Rp 15.500.000 / bulan + Tunjangan Hybrid", "IDR 15,500,000 / month + Hybrid Stipend"),
        level: T("Mid Data Engineer (L3)", "Mid Data Engineer (L3)"),
        note: T(
          "Panel sepakat Anda berpikir dari grain, idempotensi, dan dampak bisnis—bukan sekadar menghafal sintaks alat.",
          "The committee agreed you reason from grain, idempotency, and business impact rather than memorizing tool buzzwords."
        )
      }
    },

    {
      id: "kilatpay",
      logo: { text: "KP", bg: "#1d4ed8", fg: "#eff6ff" },
      company: "KilatPay Fintech",
      role: "Mid / Senior Streaming & Ledger DE",
      level: T("Mid → Senior", "Mid → Senior"),
      salary: T("Rp 22–34 juta / bulan", "IDR 22–34 million / month"),
      duration: T("55 menit · 3 Babak + War Room", "55 mins · 3 Rounds + War Room"),
      summary: T(
        "Wawancara platform pembayaran: tangani webhook duplikat dan pembulatan uang di SQL, rancang pipeline CDC berbasis WAL Debezium + Iceberg, dan pimpin triase SEV-1 Kafka lag 3,2 juta pesan.",
        "Digital payments infrastructure loop: solve webhook deduplication & currency rounding in SQL, design WAL-based Debezium CDC to Iceberg, and lead SEV-1 triage on a 3.2M Kafka lag outage."
      ),
      relatedModules: ["mod-1-6", "mod-2-2", "mod-3-1", "mod-3-2", "mod-3-3"],
      people: {
        farhan: { name: "Farhan Alatas", role: T("Engineering Manager (Payments Data)", "Engineering Manager (Payments Data)"), color: "#1d4ed8" },
        kenji: { name: "Kenji Tanaka", role: T("Principal Streaming Architect", "Principal Streaming Architect"), color: "#0369a1" },
        maya: { name: "Maya Putri", role: T("Staff Site Reliability Engineer", "Staff Site Reliability Engineer"), color: "#be123c" }
      },
      screening: {
        who: "farhan",
        timeline: [
          { title: T("Take-Home API Check lulus", "Take-home API check passed"), when: T("2 hari lalu", "2 days ago") },
          { title: T("Technical Screen dijadwalkan", "Technical screen set"), when: T("Hari ini", "Today") },
          { title: T("Streaming & War Room Loop", "Streaming & War Room Loop"), when: T("Aktif sekarang", "Active now") }
        ],
        prompt: T(
          "Farhan membuka panggilan: 'KilatPay memproses Rp 500 miliar transaksi per hari. Dalam satu kalimat, prinsip apa yang tidak boleh ditawar saat merancang ledger data keuangan?'",
          "Farhan opens the call: 'KilatPay settles $500M daily. In one framing, what non-negotiable engineering principle governs your payment data pipelines?'"
        ),
        pitches: [
          {
            text: T("Yang penting dashboard eksekutif cepat muncul di bawah 1 detik walaupun sekali-sekali ada satu transaksi yang terlewat.", "Sub-second dashboard speed comes first even if a few transactions drop occasionally."),
            delta: { sql: 0, arch: -2, ops: -2, comm: 0 },
            good: false,
            reply: T("Farhan menaikkan alis: 'Di fintech, satu transaksi hilang berarti audit OJK gagal. Kita utamakan akurasi & idempotensi dulu.'", "Farhan raises an eyebrow: 'In fintech, one lost settlement triggers regulator alarms. Correctness and idempotency come before speed.'")
          },
          {
            text: T("Buku besar harus append-only (koreksi lewat baris pembalik), memakai Idempotency-Key + integer satuan terkecil agar retry tidak menagih ganda, dan menyimpan setiap mutasi lewat WAL CDC tanpa membebani DB utama.", "Ledgers stay append-only with compensating entries, enforce Idempotency-Key + exact integer minor units so retries never double-count, and capture mutations via WAL CDC without OLTP lock contention."),
            delta: { sql: 3, arch: 5, ops: 3, comm: 5 },
            good: true,
            reply: T("Farhan tersenyum puas: 'Tepat sasaran. Ayo langsung masuk ke Kenji untuk menguji SQL & arsitektur streaming Anda.'", "Farhan nods approvingly: 'Spot on. Let's hand you to Kenji for the SQL and streaming deep dive.'")
          },
          {
            text: T("Memasang retry tak terbatas di consumer Kafka dengan auto-commit aktif tiap 5 detik.", "Using infinite Kafka consumer retries with auto-commit enabled every 5 seconds."),
            delta: { sql: 0, arch: -2, ops: 0, comm: 1 },
            good: false,
            reply: T("Farhan: 'Auto-commit sebelum tulis database selesai justru melompati pesan jika crash! Kenji akan mengujinya nanti.'", "Farhan: 'Auto-commit before sink writes risks silent data loss on crash—Kenji will probe that.'")
          }
        ]
      },
      rounds: [
        {
          id: "kp-r1",
          badge: T("Babak 1 · SQL & Deduplikasi", "Round 1 · SQL & Dedup"),
          who: "kenji",
          pillar: "sql",
          artifact: {
            kind: "sql",
            title: T("Papan SQL: Webhook Ganda & Versi Out-of-Order", "SQL Whiteboard: Duplicate Webhooks & Version Skew"),
            schema: "raw_payment_events(event_id, tx_id, status, payload_version, event_ts, amount_idr)",
            snippet: "SELECT tx_id, status, amount_idr\nFROM raw_payment_events\nWHERE status = 'settled';"
          },
          initial: {
            q: T(
              "Gateway pembayaran mengirim retry webhook sekaligus event out-of-order (kadang versi 2 tiba lebih dulu sebelum versi 3). Query di papan menghasilkan baris ganda untuk `tx_id` yang sama. Bagaimana SQL modern mengambil tepat 1 status terbaru per `tx_id`?",
              "Payment gateways fire webhook retries plus out-of-order versions (v2 sometimes arrives after v3). The board query duplicates `tx_id`s. Write the modern SQL pattern to keep exactly 1 authoritative row per `tx_id`."
            ),
            options: [
              {
                text: T("Gunakan QUALIFY ROW_NUMBER() OVER (PARTITION BY tx_id ORDER BY payload_version DESC, event_ts DESC) = 1 di atas seluruh raw_payment_events (lalu filter status = 'settled' sesudahnya jika perlu, agar refund terbaru menimpa settled lama!).", "Use QUALIFY ROW_NUMBER() OVER (PARTITION BY tx_id ORDER BY payload_version DESC, event_ts DESC) = 1 across all events BEFORE filtering status = 'settled' so a newer refund supersedes an older settlement!"),
                good: true,
                deltas: { sql: 18, arch: 6, ops: 4, comm: 6 },
                reply: T("Kenji bertepuk tangan kecil: 'Anda menangkap jebakan halusnya! Filter status SEBELUM window function justru meloloskan settlement lama saat status terbarunya sudah refunded.'", "Kenji smiles: 'You caught the subtle trap! Filtering status BEFORE ranking leaves stale settlements alive after a refund.'")
              },
              {
                text: T("Pakai GROUP BY tx_id, MAX(status), MAX(amount_idr) untuk meringkas setiap transaksi.", "Run GROUP BY tx_id with MAX(status) and MAX(amount_idr)."),
                good: false,
                deltas: { sql: -8, arch: 0, ops: 0, comm: -2 },
                reply: T("Kenji: 'MAX(status) dan MAX(amount) mengacak nilai dari versi berbeda secara alfabetis ('settled' > 'refunded'!)—sangat berbahaya.'", "Kenji: 'MAX(status) picks alphabetically ('settled' > 'refunded') and mixes fields from different versions!'")
              },
              {
                text: T("Filter WHERE status = 'settled' dulu baru ambil ORDER BY event_ts DESC LIMIT 1.", "Filter WHERE status = 'settled' first then ORDER BY event_ts DESC LIMIT 1."),
                good: false,
                deltas: { sql: -4, arch: 0, ops: 0, comm: 0 },
                reply: T("Kenji: 'LIMIT 1 hanya mengembalikan 1 baris untuk seluruh tabel, dan memfilter 'settled' duluan menyembunyikan status terbaru jika transaksi sudah dibatalkan.'", "Kenji: 'LIMIT 1 returns only one row globally, and pre-filtering settled hides later refunds.'")
              }
            ]
          },
          followup: {
            q: T(
              "Tepat! Sekarang lihat tipe datanya: tim sebelumnya menyimpan `amount` sebagai `DOUBLE / FLOAT` untuk memudahkan pembagian fee 1,5%. Audit menemukan selisih pembulatan Rp 180.000 per bulan. Apa perbaikannya?",
              "Follow-up probe: Now check the money type—a prior team stored `amount` as `DOUBLE / FLOAT` for 1.5% fees, and monthly reconciliation drifted by Rp 180,000. What is the fix?"
            ),
            options: [
              {
                text: T("Ganti tipe penyimpanan moneter menjadi `BIGINT` satuan terkecil (atau `NUMERIC / DECIMAL(18,2)` eksak untuk mata uang berkoma) karena float biner IEEE-754 tidak pernah eksak untuk desimal basis-10.", "Store money as exact integer minor units (`BIGINT`, e.g., rupiah/cents) or fixed-point `DECIMAL(18,2)` because binary IEEE-754 floats lose base-10 decimal precision."),
                good: true,
                deltas: { sql: 12, arch: 4, ops: 4, comm: 6 },
                reply: T("Kenji: 'Eksak. Tidak ada float untuk uang di sistem finansial.'", "Kenji: 'Exact. Zero floats for money anywhere in financial tables.'")
              },
              {
                text: T("Tetap pakai FLOAT tetapi panggil ROUND(amount, 0) di dashboard Looker saja.", "Keep FLOAT in storage and just wrap ROUND(amount, 0) in Looker."),
                good: false,
                deltas: { sql: -6, arch: 0, ops: -2, comm: 0 },
                reply: T("Kenji: 'Membulatkan di tampilan hanya menyembunyikan bug kalkulasi antar-tabel.'", "Kenji: 'Rounding at the UI layer only papers over accumulating upstream ledger drift.'")
              }
            ]
          }
        },
        {
          id: "kp-r2",
          badge: T("Babak 2 · CDC & Lakehouse", "Round 2 · CDC & Lakehouse"),
          who: "kenji",
          pillar: "arch",
          artifact: {
            kind: "pipeline",
            title: T("Papan Streaming: Postgres OLTP → Kafka → Lakehouse", "Streaming Whiteboard: Postgres OLTP → Kafka → Lakehouse"),
            nodes: [
              { id: "wal", label: "Postgres WAL (LSN)", role: T("Jurnal Biner", "Logical Log") },
              { id: "deb", label: "Debezium CDC", role: T("No-Lock Capture", "Zero Poll Load") },
              { id: "kfk", label: "Kafka (acks=all)", role: T("ISR Durable", "Min ISR = 2") },
              { id: "ice", label: "Iceberg MoR Table", role: T("Delete Files", "Fast CDC Upsert") }
            ]
          },
          initial: {
            q: T(
              "Pipeline lama melakukan polling `SELECT * FROM ledger WHERE updated_at > :last_run` tiap menit ke Postgres utama. Beban CPU DB melonjak dan baris yang di-`DELETE` tidak pernah terdeteksi. Bagaimana arsitektur log-based CDC menyelesaikannya?",
              "Our legacy job polls `SELECT * FROM ledger WHERE updated_at > :last_run` every minute against primary Postgres, spiking CPU and missing hard `DELETE`s. How does log-based CDC fix both?"
            ),
            options: [
              {
                text: T("Pasang Debezium membaca Postgres Write-Ahead Log (`wal_level=logical`) lewat replication slot & pgoutput: menangkap INSERT/UPDATE/DELETE berurut per `(lsn, seq)` dengan nol query lock ke tabel, lalu kirim ke Kafka (`acks=all`, `min.insync.replicas=2`).", "Attach Debezium to PostgreSQL's Write-Ahead Log (`wal_level=logical`) via replication slot & pgoutput: captures inserts, updates, and deletes in `(lsn, seq)` order with zero table polling locks, streamed to Kafka (`acks=all`, `min.insync.replicas=2`)."),
                good: true,
                deltas: { sql: 4, arch: 18, ops: 6, comm: 8 },
                reply: T("Kenji menyalakan simpul WAL → Debezium → Kafka di diagram: 'Lengkap hingga urutan `(lsn, seq)` dan jaminan `acks=all`!'", "Kenji lights up the WAL → Debezium → Kafka nodes: 'Complete down to `(lsn, seq)` ordering and `acks=all` durability!'")
              },
              {
                text: T("Tambahkan 3 trigger SQL `AFTER INSERT/UPDATE/DELETE` di semua tabel transaksi yang menyalin ke tabel audit lalu di-poll ulang.", "Attach SQL triggers on every table copying changes into an audit table and keep polling it."),
                good: false,
                deltas: { sql: 2, arch: -4, ops: -4, comm: 0 },
                reply: T("Kenji: 'Trigger menggandakan beban tulis sinkron pada transaksi pembayaran langsung—kita hindari di fintech berlatensi rendah.'", "Kenji: 'Triggers double synchronous write latency inside checkout transactions—non-starter at high throughput.'")
              },
              {
                text: T("Jalankan pg_dump penuh tiap 15 menit supaya delete ikut terpantau.", "Run a full pg_dump every 15 minutes so deletes show up."),
                good: false,
                deltas: { sql: 0, arch: -8, ops: -6, comm: -2 },
                reply: T("Kenji: 'pg_dump penuh tiap 15 menit akan meruntuhkan I/O disk produksi.'", "Kenji: 'Full pg_dump snapshots every 15 minutes would saturate production disk I/O.'")
              }
            ]
          },
          followup: {
            q: T(
              "Pertanyaan lanjutan tentang tabel tujuan: CDC pembayaran mengirim 50.000 update/menit ke tabel Apache Iceberg. Apakah Anda memilih strategi `Copy-on-Write (CoW)` atau `Merge-on-Read (MoR)`, dan apa konsekuensi operasional yang wajib dipantau?",
              "Follow-up probe on the Iceberg sink: Payment CDC streams 50,000 updates/min into Apache Iceberg. Would you pick `Copy-on-Write (CoW)` or `Merge-on-Read (MoR)`, and what maintenance job must follow?"
            ),
            options: [
              {
                text: T("Pilih `Merge-on-Read (MoR)` agar update/delete menulis file delta/delete kecil dengan cepat tanpa menulis ulang Parquet 256MB terus-menerus, sambil menjadwalkan **background compaction** rutin agar biaya baca tetap cepat.", "Choose `Merge-on-Read (MoR)` so updates/deletes append tiny delete files fast instead of rewriting entire 256MB Parquet files, paired with scheduled **background compaction** so read latency stays healthy."),
                good: true,
                deltas: { sql: 2, arch: 14, ops: 8, comm: 6 },
                reply: T("Kenji: 'Tepat! MoR menjaga latensi tulis CDC tetap rata, dan compaction berkala membayar utang bacanya.'", "Kenji: 'Nailed it! MoR keeps CDC write amplification low while compaction cleans up read cost.'")
              },
              {
                text: T("Pilih Copy-on-Write (CoW) setiap 10 detik agar tidak perlu menjalankan compaction.", "Use Copy-on-Write (CoW) every 10 seconds so we never need compaction."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: -4, comm: 0 },
                reply: T("Kenji: 'Menulis ulang file 256MB setiap 10 detik untuk 1 baris update menyebabkan write amplification luar biasa dan konflik OCC!'", "Kenji: 'Rewriting 256MB files every 10 seconds for tiny updates triggers massive write amplification and OCC conflicts!'")
              }
            ]
          }
        },
        {
          id: "kp-r3",
          badge: T("Babak 3 · War Room SEV-1", "Round 3 · SEV-1 War Room"),
          who: "maya",
          pillar: "ops",
          artifact: {
            kind: "incident",
            title: T("SEV-1 LIVE · Promo Tanggal Kembar 14:15 WIB", "LIVE SEV-1 · Flash Sale Launch 14:15 WIB"),
            sev: "SEV-1 · OOMKILLED EXIT 137 + LAG 3.2M",
            metrics: [
              { label: T("Consumer Lag Kafka", "Kafka Consumer Lag"), val: "3,240,000 msgs (+64,000%)" },
              { label: T("Status Pod Worker", "Worker Pod Status"), val: T("CrashLoopBackOff (Exit Code 137 OOM)", "CrashLoopBackOff (OOMKilled Exit 137)") },
              { label: T("Distribusi Partisi", "Partition Spread"), val: T("Partisi 0–6: lag 120 · Partisi 7: lag 3.239.000!", "Partitions 0–6: ~120 lag · Partition 7: 3,239,000 lag!") }
            ]
          },
          initial: {
            q: T(
              "Saya Maya dari tim SRE. Alarm SEV-1 berbunyi: consumer lag meledak ke 3,2 juta pesan dan pod worker mati karena `OOMKilled (137)`. Lihat papan telemetri—apa langkah triase 10 menit pertama Anda?",
              "I'm Maya from SRE. Pager just fired SEV-1: consumer lag jumped to 3.2M messages and worker pods are crashing with `OOMKilled (137)`. Check the telemetry panel—what is your first 10-minute triage?"
            ),
            options: [
              {
                text: T("Restart semua pod secara paksa berulang kali lalu hapus topic Kafka supaya lag kembali ke 0.", "Force-restart all pods in a loop and purge the Kafka topic so lag returns to 0."),
                good: false,
                deltas: { sql: 0, arch: -6, ops: -12, comm: -4 },
                reply: T("Maya terkejut: 'Menghapus topic menghilangkan jutaan transaksi pembayaran nyata! Itu bencana permanen.'", "Maya grimaces: 'Purging the Kafka topic permanently deletes millions of paid transactions!'")
              },
              {
                text: T("Buka #war-room, naikkan limit memori pod sementara + turunkan `max.poll.records` agar tiap batch muat di RAM, lalu langsung investigasi **Partisi 7** di mana 99% lag menumpuk (hot partition key skew).", "Open #war-room, temporarily bump pod memory limits + cap `max.poll.records` so catch-up batches fit in RAM, and immediately inspect **Partition 7** where 99% of the lag sits (hot-key skew)."),
                good: true,
                deltas: { sql: 0, arch: 6, ops: 18, comm: 10 },
                reply: T("Maya: 'Diagnosis cepat! Anda menstabilkan memori dulu lalu langsung melihat bahwa menambah worker biasa tidak akan membantu karena semua macet di Partisi 7.'", "Maya: 'Sharp triage! Stabilizing OOM poll size AND immediately spotting that adding replicas won't fix a single hot partition.'")
              },
              {
                text: T("Tambah jumlah pod consumer dari 8 menjadi 64 pod supaya lag terbagi rata ke semuanya.", "Scale consumer pods from 8 to 64 so lag spreads across every pod."),
                good: false,
                deltas: { sql: 0, arch: -2, ops: -2, comm: 0 },
                reply: T("Maya: 'Ingat aturan Kafka: satu partisi hanya bisa dibaca maksimal 1 consumer dalam satu group! 56 pod baru Anda akan menganggur total.'", "Maya: 'Remember Kafka's rule: only ONE consumer per group can read Partition 7! 56 of those pods sit completely idle.'")
              }
            ]
          },
          followup: {
            q: T(
              "Tepat! Ternyata 92% trafik dikirim dengan key `merchant_id = 'AGGREGATOR_DEFAULT'`, semuanya di-hash ke Partisi 7. Bagaimana perbaikan permanen supaya promo bulan depan tidak tumbang lagi?",
              "Follow-up probe: You nailed it—92% of events carried `merchant_id = 'AGGREGATOR_DEFAULT'`, hashing every one to Partition 7. How do you prevent next month's promo from collapsing?"
            ),
            options: [
              {
                text: T("Perbaiki pemilihan partition key (pakai kunci ber-kardinalitas merata seperti `tx_id` atau kunci majemuk bersalt `merchant_id#hash_bucket`, dan isolasi jalur aggregator raksasa), plus monitor alert lag per partisi.", "Fix key cardinality (use uniform `tx_id` or salted key `merchant_id#bucket` for hot merchants, or isolate giant tenants), and alert on per-partition max lag rather than topic averages."),
                good: true,
                deltas: { sql: 0, arch: 8, ops: 14, comm: 8 },
                reply: T("Maya mengacungkan jempol: 'Menghilangkan hot partition key + memantau max lag per partisi. Insiden tertangani bersih!'", "Maya gives a thumbs-up: 'Eliminating the hot partition key + alerting on max per-partition lag. Solid incident ownership!'")
              },
              {
                text: T("Ubah `unclean.leader.election.enable = true` supaya partisi 7 boleh melompati pesan macet.", "Turn on `unclean.leader.election.enable = true` so Partition 7 skips stuck messages."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: -8, comm: 0 },
                reply: T("Maya: 'Unclean election hanya menyembunyikan data hilang di broker yang tertinggal, bukan mengatasi hot key.'", "Maya: 'Unclean election risks silent data loss during failovers and does nothing for hot-key skew.'")
              }
            ]
          }
        }
      ],
      offer: {
        comp: T("Rp 29.000.000 / bulan + Bonus On-Call", "IDR 29,000,000 / month + On-Call Allowance"),
        level: T("Senior Data Engineer (L4)", "Senior Data Engineer (L4)"),
        note: T(
          "Kenji dan Maya terkesan dengan pemahaman Anda atas konsistensi finansial, mekanik CDC/MoR, dan triase hot-partition Kafka.",
          "Kenji and Maya praised your mastery of financial exactness, WAL CDC / Iceberg MoR trade-offs, and hot-partition triage."
        )
      }
    },

    {
      id: "nusantara",
      logo: { text: "NL", bg: "#7c3aed", fg: "#faf5ff" },
      company: "Nusantara Logistics AI",
      role: "Senior / AI Data Platform Engineer",
      level: T("Senior / AI Platform", "Senior / AI Platform"),
      salary: T("Rp 32–48 juta / bulan", "IDR 32–48 million / month"),
      duration: T("55 menit · FinOps, AI RAG & VP", "55 mins · FinOps, AI RAG & VP"),
      summary: T(
        "Wawancara jalur Senior & AI Platform: pangkas tagihan cloud warehouse 95%, atasi Spark skew 4 jam, rancang pipeline RAG inkremental yang bebas data leakage, dan negosiasi dengan VP.",
        "Senior & AI Platform track: slash runaway cloud warehouse bills 95%, fix a 4-hour Spark skew straggler, design leak-free ML/RAG pipelines, and defend sprints to executives."
      ),
      relatedModules: ["mod-2-6", "mod-3-1", "mod-3-4", "mod-3-5"],
      people: {
        tari: { name: "Tari Ramadhani", role: T("VP of Data & AI", "VP of Data & AI"), color: "#7c3aed" },
        evan: { name: "Evan Hidayat", role: T("Principal Cloud & Spark Architect", "Principal Cloud & Spark Architect"), color: "#1d4ed8" },
        aris: { name: "Aris Santoso", role: T("AI Platform Lead", "AI Platform Lead"), color: "#0f766e" }
      },
      screening: {
        who: "tari",
        timeline: [
          { title: T("Portofolio RAG & FinOps direview", "RAG & FinOps portfolio reviewed"), when: T("Kemarin", "Yesterday") },
          { title: T("Executive Fit Call", "Executive Fit Call"), when: T("Pagi ini", "This morning") },
          { title: T("Panel Senior & AI Platform", "Senior & AI Platform Loop"), when: T("Berjalan sekarang", "In progress now") }
        ],
        prompt: T(
          "Tari bertanya cepat di sesi pembuka: 'Banyak proyek AI gagal bukan karena LLM-nya bodoh, tetapi karena fondasi data dan biayanya jebol. Apa fokus utama Data Engineer pada sistem AI & cloud modern?'",
          "Tari asks to open: 'Most AI initiatives fail not because the LLM is weak, but because data freshness, privacy, and cloud costs explode. What does the Data Engineer actually own?'"
        ),
        pitches: [
          {
            text: T("Data engineer fokus melatih ulang bobot LLM setiap malam agar chatbot selalu pintar.", "Data engineers focus on retraining foundation LLM weights nightly."),
            delta: { sql: 0, arch: 0, ops: 0, comm: 1 },
            good: false,
            reply: T("Tari: 'Itu tugas ML researcher. Data engineer memegang chunking inkremental, hak akses metadata, eval retrieval, dan kontrol biaya token/warehouse.'", "Tari: 'That's ML research. We own incremental sync, ACL filtering, retrieval evaluation, and cost/leakage guardrails.'")
          },
          {
            text: T("Data engineer menguasai data pipeline offline: chunking berstruktur, content hashing inkremental agar hanya dokumen berubah yang di-embed, metadata ACL untuk keamanan, eval hit-rate, serta guardrails biaya & point-in-time ML.", "We own the offline data engine: structure-aware chunking, content-hashed incremental sync so only deltas get embedded, metadata ACLs, retrieval regression evals, plus FinOps & point-in-time feature hygiene."),
            delta: { sql: 2, arch: 5, ops: 4, comm: 5 },
            good: true,
            reply: T("Tari mengangguk mantap: 'Persis cara berpikir Principal/Staff kami. Mari masuk ke Evan dan Aris!'", "Tari nods firmly: 'Exact Senior/Staff framing. Heading into Evan and Aris now!'")
          }
        ]
      },
      rounds: [
        {
          id: "nl-r1",
          badge: T("Babak 1 · FinOps & Spark Skew", "Round 1 · FinOps & Spark Skew"),
          who: "evan",
          pillar: "sql",
          artifact: {
            kind: "sql",
            title: T("Query Profile: Tagihan BigQuery $960/hari + Spark 199/200", "Query Profile: $960/day BigQuery Scan + Spark 199/200"),
            schema: "events_20tb(event_id, event_date, driver_id, region, payload_json, fare_idr)",
            snippet: "-- Dashboard tile (runs 96x / day on unpartitioned 20TB table):\nSELECT * FROM events_20tb WHERE DATE(event_ts) >= CURRENT_DATE - 7;"
          },
          initial: {
            q: T(
              "Lihat query dashboard yang menyedot $960/hari karena memindai 100% partisi (2 TB tiap 15 menit). Tanpa mengubah satu grafik pun di UI dashboard, tiga perbaikan apa yang langsung memangkas biaya scan > 95%?",
              "Look at that dashboard query burning $960/day by scanning 100% of partitions (2 TB every 15 minutes). Without removing any dashboard chart, which 3 changes slash scan cost by >95%?"
            ),
            options: [
              {
                text: T("Ganti `SELECT *` menjadi hanya kolom yang dipakai, partisi tabel menurut `event_date` (hindari membungkus kolom partisi dalam `DATE(...)` di WHERE agar pruning aktif) + cluster menurut region/status, dan arahkan BI ke tabel rollup pre-aggregasi harian.", "Replace `SELECT *` with needed columns only, partition/cluster by `event_date` (avoid wrapping the partition key inside `DATE(...)` so pruning triggers!), and point BI tiles at a pre-aggregated daily rollup mart."),
                good: true,
                deltas: { sql: 16, arch: 8, ops: 10, comm: 6 },
                reply: T("Evan tersenyum lebar: 'Menyebut jebakan `DATE(event_ts)` yang mematikan partition pruning + rollup mart adalah tanda jam terbang tinggi!'", "Evan grins: 'Catching `DATE(event_ts)` disabling partition pruning plus moving BI to a rollup mart is pure production instinct!'")
              },
              {
                text: T("Naikkan timeout query dan tambah ukuran slot BigQuery 4x lipat agar selesainya lebih cepat.", "Raise query timeouts and buy 4x reserved BigQuery slots so it finishes faster."),
                good: false,
                deltas: { sql: -6, arch: -2, ops: -8, comm: 0 },
                reply: T("Evan: 'Pada pricing berbasis byte yang dipindai, scan 2 TB tetap ditagih sama mahalnya seberapa cepat pun slot Anda.'", "Evan: 'Under scan-based pricing, reading 2 TB costs the exact same regardless of slot speed.'")
              }
            ]
          },
          followup: {
            q: T(
              "Bagus! Di sisi lain, job PySpark malam kita tersangkut di task 199/200 selama 4 jam karena `driver_id = 'GUEST'` memegang 73% baris. Kedua sisi join sama-sama besar sehingga broadcast gagal. Apa solusinya?",
              "Follow-up probe: Meanwhile, a nightly PySpark join hangs on task 199/200 for 4 hours because `driver_id = 'GUEST'` holds 73% of all rows. Both tables are too big to broadcast. How do you eliminate the straggler?"
            ),
            options: [
              {
                text: T("Pisahkan key sampah/tamu `'GUEST'` sebelum join (proses terpisah lalu UNION ALL), atau aktifkan AQE skewJoin (`spark.sql.adaptive.skewJoin.enabled=true`) / terapkan **salting** `(driver_id, salt 0..N-1)` di sisi besar dan `explode` N salinan di sisi pasangan.", "Filter out placeholder `'GUEST'` rows before joining (handle separately + UNION ALL), or use AQE skewJoin (`spark.sql.adaptive.skewJoin.enabled=true`) / **key salting** `(driver_id, salt 0..N-1)` on the huge side matched by N exploded copies on the other."),
                good: true,
                deltas: { sql: 8, arch: 10, ops: 8, comm: 4 },
                reply: T("Evan: 'Tepat—isolasi key tamu atau salting mengembalikan kesetaraan kerja di seluruh executor.'", "Evan: 'Right on—isolating the placeholder key or salting balances work back across all executors.'")
              },
              {
                text: T("Tambahkan `.coalesce(1)` sebelum join supaya semua data menyatu rapi.", "Call `.coalesce(1)` before joining so everything runs cleanly in one place."),
                good: false,
                deltas: { sql: -6, arch: -6, ops: -6, comm: 0 },
                reply: T("Evan: 'coalesce(1) memaksa 100% dataset masuk ke 1 CPU core tunggal dan langsung OOM!'", "Evan: 'coalesce(1) collapses the entire dataset onto 1 single core and triggers instant OOM!'")
              }
            ]
          }
        },
        {
          id: "nl-r2",
          badge: T("Babak 2 · Pipeline RAG & ML", "Round 2 · RAG & ML Leakage"),
          who: "aris",
          pillar: "arch",
          artifact: {
            kind: "pipeline",
            title: T("Papan AI: Sinkronisasi Dokumen RAG & Fitur Point-in-Time", "AI Whiteboard: Incremental RAG Sync & ASOF Features"),
            nodes: [
              { id: "doc", label: "Markdown + Heading", role: T("Chunk Kontekstual", "Structure Split") },
              { id: "hash", label: "SHA-256 + Model ID", role: T("Hanya Delta", "Embed Deltas Only") },
              { id: "vec", label: "pgvector HNSW", role: T("Filter ACL + Hybrid", "Pre-Filter SQL") },
              { id: "eval", label: "HitRate + ASOF Join", role: T("Cegah Leakage", "CI Regression Gate") }
            ]
          },
          initial: {
            q: T(
              "Saya Aris dari AI Platform. Saat ini script RAG lama memotong teks asal tiap 500 karakter lalu memanggil API embedding berbayar untuk ke-500.000 dokumen setiap malam, bahkan untuk dokumen yang tidak berubah—plus user divisi reguler sempat melihat potongan dokumen rahasia HR! Rancang perbaikannya.",
              "I'm Aris from AI Platform. Right now a naive script slices docs blindly every 500 chars and re-embeds all 500,000 docs nightly even when unchanged—and regular staff briefly retrieved confidential HR chunks! Redesign this pipeline."
            ),
            options: [
              {
                text: T("Pakai chunking sadar-struktur (heading + paragraf), beri identitas `(doc_id, sha256_normalized)` + nama model sehingga hanya hash baru/berubah yang memanggil API embedding di dalam satu transaksi, dan simpan label **ACL metadata** untuk difilter langsung di klausa SQL `WHERE` (bukan menyuruh prompt LLM merahasiakannya).", "Use structure-aware chunking (heading + paragraphs), identify chunks by `(doc_id, content_hash)` + embedding model so only deltas hit the paid embedding API inside atomic transactions, and enforce **metadata ACL filters** inside the SQL `WHERE` clause (never rely on prompt instructions to hide secrets)."),
                good: true,
                deltas: { sql: 4, arch: 18, ops: 6, comm: 8 },
                reply: T("Aris sangat antusias: 'Tagihan embedding anjlok 98%, hak akses ditegakkan di DB sebelum menyentuh prompt, dan model version terisolasi!'", "Aris lights up: 'Embedding costs drop 98%, ACLs are enforced at retrieval time, and model spaces never mix!'")
              },
              {
                text: T("Tambahkan instruksi di akhir system prompt LLM: 'Tolong sembunyikan informasi gaji HR dari pengguna non-HR'.", "Add to the LLM system prompt: 'Please hide HR salary info from non-HR users.'"),
                good: false,
                deltas: { sql: 0, arch: -8, ops: -8, comm: -2 },
                reply: T("Aris: 'Prompt injection mudah membobol instruksi LLM. Data terlarang pantang masuk ke konteks prompt sama sekali!'", "Aris: 'Prompt injection trivially bypasses prompt-only guards. Restricted chunks must never reach the prompt!'")
              }
            ]
          },
          followup: {
            q: T(
              "Satu lagi di sisi Feature Store ML: model prediksi churn mendapat akurasi 78% saat latihan offline tetapi jatuh menjadi 44% saat live di produksi! Ternyata tabel latih menggabungkan `snapshot_pesanan` langsung dengan `dim_customer.tier` kondisi hari ini. Apa nama masalahnya dan bagaimana SQL memperbaikinya?",
              "Follow-up probe on ML features: Our churn model scored 78% accuracy offline then collapsed to 44% in live prod! Turns out the training SQL joined historical `prediction_snapshots` straight to today's `dim_customer.tier`. Name the bug and the SQL fix."
            ),
            options: [
              {
                text: T("Ini **data leakage (current-state leakage / training-serving skew)** karena membocorkan masa depan ke baris latihan masa lalu. Perbaiki dengan **point-in-time `ASOF LEFT JOIN`** (atau range join SCD2 `snapshot_ts >= effective_ts`) dan satu definisi feature store untuk offline & online.", "That is **data leakage (current-state leakage)** leaking future tier upgrades backward into historical training rows. Fix it via a **point-in-time `ASOF LEFT JOIN`** (or SCD2 range join `snapshot_ts >= effective_ts`) inside one unified feature definition."),
                good: true,
                deltas: { sql: 8, arch: 14, ops: 4, comm: 6 },
                reply: T("Aris: 'Diagnosa jitu. Model yang jujur harus diuji memakai apa yang diketahui pada detik prediksi tersebut.'", "Aris: 'Bullseye diagnosis. A model may only train on facts known at that exact prediction moment.'")
              },
              {
                text: T("Lakukan random shuffle row sebelum split train/test 80/20 supaya datanya lebih acak dan akurasinya naik.", "Randomly shuffle rows into 80/20 train/test split so training looks higher."),
                good: false,
                deltas: { sql: -4, arch: -6, ops: -2, comm: 0 },
                reply: T("Aris: 'Random split pada data waktu justru menambah kebocoran waktu baru!'", "Aris: 'Random shuffling time-series data creates even worse temporal leakage!'")
              }
            ]
          }
        },
        {
          id: "nl-r3",
          badge: T("Babak 3 · Strategi & Negosiasi VP", "Round 3 · Strategy & VP Defense"),
          who: "tari",
          pillar: "comm",
          artifact: {
            kind: "incident",
            title: T("Rapat Eksekutif: CEO Minta Live AI + Dashboard Jumat Ini", "Executive Board: CEO Wants Live AI + Dashboard by Friday"),
            sev: "STRATEGIC TRADE-OFF · SPRINT CAPACITY",
            metrics: [
              { label: T("Permintaan Awal CEO", "CEO Initial Ask"), val: T("Tutup warehouse, ganti 'AI Chat langsung baca file log mentah' hari Jumat", "Kill warehouse, let AI Chat query raw uncleaned files by Friday") },
              { label: T("Realita Data Mentah", "Raw Reality"), val: T("4 skema berbeda, tidak ada semantic net_revenue, dan tanpa ACL", "4 drifting schemas, no net_revenue definition, zero ACLs") },
              { label: T("Kendala Anggaran", "Budget Constraint"), val: T("Kapasitas 1 kuartal untuk 1 fondasi prioritas", "1 quarter capacity for 1 foundational bet") }
            ]
          },
          initial: {
            q: T(
              "CEO baru menonton demo viral AI di konferensi dan ingin langsung menaruh chatbot AI di atas file log mentah tanpa layer dbt/validasi agar rilis Jumat ini. Bagaimana Anda mempresentasikan posisi engineering yang matang?",
              "The CEO just saw an AI conference demo and wants to point an LLM directly at uncleaned raw logs with zero validation or dbt models to ship this Friday. How do you pitch the Staff engineering stance?"
            ),
            options: [
              {
                text: T("Gunakan analogi 'Sampah masuk, halusinasi keluar': tunjukkan bahwa AI yang membaca raw log tanpa definisi `net_revenue` & ACL akan memberi angka keuangan salah kepada eksekutif dengan percaya diri, lalu usulkan pengiriman bertahap (Strangler Fig): rilis pilot pada 1 domain mart yang sudah terverifikasi Jumat depan sambil menyusun eval set.", "Frame 'garbage in, confident hallucination out': show concrete risk where an LLM reading conflicting raw files gives executives wrong revenue or leaks private rows, then propose an iterative Strangler Fig rollout starting with 1 curated, tested mart + retrieval eval set next Friday."),
                good: true,
                deltas: { sql: 2, arch: 6, ops: 8, comm: 18 },
                reply: T("Tari: 'Kombinasi empati bisnis, risiko nyata yang konkret, dan jalan keluar bertahap yang cepat. CEO menyukai proposal pragmatis seperti ini.'", "Tari: 'Strong executive framing—concrete business risk, zero tech arrogance, and a pragmatic fast pilot path.'")
              },
              {
                text: T("Bilang ke CEO bahwa idenya bodoh secara teknis dan seluruh proyek AI harus ditunda 6 bulan sampai migrasi selesai.", "Tell the CEO the idea is technically naive and block all AI work for 6 months."),
                good: false,
                deltas: { sql: 0, arch: 0, ops: 0, comm: -12 },
                reply: T("Tari: 'Menjadi penolak absolut ('Department of No') membuat tim bisnis melewati tim data sepenuhnya!'", "Tari: 'Being the \"Department of No\" pushes business units to spin up shadow pipelines without you.'")
              }
            ]
          },
          followup: {
            q: T(
              "Keputusan akhir kuartal: anggaran hanya cukup untuk memprioritaskan SATU investasi kuartal ini — (A) membangun **Golden Evaluation Set (Hit Rate / MRR) + CI Regression Gate**, atau (B) mengganti LLM yang lebih mahal tanpa mengukur retrieval. Pilihan Anda?",
              "Final quarterly call: Sprint budget only covers ONE bet this quarter—(A) build a **Golden Retrieval Eval Set (Hit Rate / MRR) + CI Regression Gate**, or (B) upgrade to a 3x more expensive LLM without retrieval metrics. Which do you fund and why?"
            ),
            options: [
              {
                text: T("Pilih (A): evaluasi retrieval Hit Rate@k & MRR di CI. Jika retriever salah mengambil dokumen sumber, LLM termahal di dunia pun tetap akan berhalusinasi—dan tanpa eval gate, perbaikan apa pun tidak bisa diukur.", "Fund (A): Retrieval Hit Rate@k & MRR regression gates in CI. If retrieval feeds the wrong chunks, the smartest LLM on earth still hallucinates—and without measurement you cannot prove any upgrade helped."),
                good: true,
                deltas: { sql: 2, arch: 6, ops: 8, comm: 12 },
                reply: T("Tari menutup notebook: 'Keputusan investasi berbasis pengukuran (eval-first) adalah ciri engineer senior sejati. Terima kasih banyak!'", "Tari closes her notebook: 'Eval-first capital discipline is the hallmark of a Senior/Staff engineer. Great loop!'")
              },
              {
                text: T("Pilih (B): langsung beli model LLM paling mahal supaya jawabannya lebih panjang dan meyakinkan.", "Fund (B): Upgrade to the largest LLM first so answers sound smoother."),
                good: false,
                deltas: { sql: 0, arch: -4, ops: -6, comm: -4 },
                reply: T("Tari: 'Menambah ukuran model tanpa memeriksa retrieval hanya menghasilkan halusinasi yang lebih fasih dengan tagihan 3x lipat.'", "Tari: 'Bigger models on broken retrieval only hallucinate more fluently at 3x the bill.'")
              }
            ]
          }
        }
      ],
      offer: {
        comp: T("Rp 42.000.000 / bulan + Ekuitas / FinOps Bonus", "IDR 42,000,000 / month + Equity / FinOps Bonus"),
        level: T("Senior / Staff AI Data Engineer (L5)", "Senior / Staff AI Data Engineer (L5)"),
        note: T(
          "Komite kagum dengan ketajaman Anda memangkas biaya FinOps, menghilangkan skew/leakage, dan menegosiasikan arsitektur ke level VP.",
          "The committee highlighted your rare combination of FinOps discipline, leakage/skew debugging, and VP-level product negotiation."
        )
      }
    }
  ];

  root.INTERVIEW_SIM_DATA = { COMPETENCIES, TRACKS };
})(window);
