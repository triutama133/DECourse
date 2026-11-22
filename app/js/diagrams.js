// Small explanatory diagrams and interactive step-by-step lesson animations, drawn as inline SVG/HTML
// so they follow the light/dark theme and bilingual ID/EN toggle automatically.
(function (root) {
  const svg = (w, h, label, body) =>
    `<figure class="diagram"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><title>${label}</title>${body}</svg></figure>`;
  const text = (x, y, s, cls = "dg-text", anchor = "start") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${s}</text>`;
  const box = (x, y, w, h, cls = "dg-box") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"/>`;

  const DIAGRAMS = {
    // Module 0.3 and 1.5: a per-order value repeated by a join to a per-line table
    fanout(l, num) {
      const fee = num(15000);
      const rowsL = [l("kopi Gayo", "Gayo beans"), l("kopi Toraja", "Toraja beans"), l("filter kertas", "paper filters")];
      let b = "";
      b += text(20, 22, l("orders: 1 baris per pesanan", "orders: 1 row per order"), "dg-head");
      b += box(20, 32, 220, 30) + text(32, 52, `#1007 · ${l("ongkir", "shipping")} <tspan class="dg-accent">${fee}</tspan>`);
      b += text(20, 96, l("order_items: 1 baris per item", "order_items: 1 row per line"), "dg-head");
      rowsL.forEach((r, i) => { b += box(20, 106 + i * 32, 220, 26) + text(32, 124 + i * 32, `#1007 · ${r}`); });
      b += `<path d="M252 120 H 318" class="dg-arrow" marker-end="url(#dg-ah)"/>` + text(285, 110, "JOIN", "dg-muted", "middle");
      b += text(330, 22, l("hasil: 1 baris per item", "result: 1 row per line"), "dg-head");
      rowsL.forEach((r, i) => { b += box(330, 32 + i * 32, 330, 26) + text(342, 50 + i * 32, `#1007 · ${r} · ${l("ongkir", "shipping")} <tspan class="dg-bad-text">${fee}</tspan>`); });
      b += box(330, 140, 330, 30, "dg-box dg-bad") + text(342, 160, `SUM(${l("ongkir", "shipping")}) = <tspan class="dg-bad-text">${num(45000)}</tspan>  ✗ ${l("tiga kali lipat", "three times too much")}`);
      b += box(330, 178, 330, 30, "dg-box dg-good") + text(342, 198, `${l("yang benar-benar dibayar", "what was actually paid")}: <tspan class="dg-good-text">${fee}</tspan>  ✓`);
      b += text(20, 232, l("Nilai per pesanan dijumlahkan di tabel per pesanan, bukan setelah join ke tabel per item.", "Sum a per-order value at the per-order grain, not after joining to a per-line table."), "dg-muted");
      return svg(680, 244, l("Diagram: join ke tabel per item mengulang ongkir satu pesanan tiga kali", "Diagram: a join to a per-line table repeats one order's shipping fee three times"),
        `<defs><marker id="dg-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="dg-arrowhead"/></marker></defs>${b}`);
    },

    // Module 1.5: a key that repeats in the right-hand table duplicates the left rows (pandas merge)
    dupkey(l, num) {
      const amt = num(120000);
      let b = "";
      b += text(20, 22, l("orders: 1 baris per pesanan", "orders: 1 row per order"), "dg-head");
      b += box(20, 32, 230, 30) + text(32, 52, `#1007 · ${l("pelanggan", "customer")} 42 · <tspan class="dg-accent">${amt}</tspan>`);
      b += text(20, 96, l("customers: pelanggan 42 ada dua kali", "customers: customer 42 listed twice"), "dg-head");
      b += box(20, 106, 230, 26) + text(32, 124, "42 · Gold");
      b += box(20, 138, 230, 26, "dg-box dg-bad") + text(32, 156, `42 · Gold  (${l("duplikat", "duplicate")})`);
      b += `<path d="M262 58 H 318" class="dg-arrow" marker-end="url(#dg-ah2)"/>` + text(290, 50, "merge", "dg-muted", "middle");
      b += text(330, 22, l("hasil: pesanan muncul dua kali", "result: the order appears twice"), "dg-head");
      [0, 1].forEach((i) => { b += box(330, 32 + i * 32, 330, 26) + text(342, 50 + i * 32, `#1007 · Gold · <tspan class="dg-bad-text">${amt}</tspan>`); });
      b += box(330, 106, 330, 30, "dg-box dg-bad") + text(342, 126, `${l("revenue", "revenue")} = <tspan class="dg-bad-text">${num(240000)}</tspan>  ✗`);
      b += box(330, 144, 330, 30, "dg-box dg-good") + text(342, 164, `validate="m:1" → MergeError ${l("lebih dulu", "before the number is wrong")}  ✓`);
      b += text(20, 204, l("Jika kunci di tabel kanan berulang, setiap baris kiri yang cocok ikut berulang, tanpa error.", "If a key repeats in the right-hand table, every matching left row repeats too, with no error."), "dg-muted");
      return svg(680, 216, l("Diagram: pelanggan yang tercantum dua kali menggandakan pesanannya setelah merge", "Diagram: a customer listed twice duplicates their orders after a merge"),
        `<defs><marker id="dg-ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="dg-arrowhead"/></marker></defs>${b}`);
    },

    // Module 3.3: watermark = newest event time - delay; late but open window is counted, emitted window drops it
    watermark(l) {
      const x = (m) => 40 + m * 50;                    // minutes after 10:00 -> x
      const t = (m) => `10:${String(m).padStart(2, "0")}`;
      let b = "";
      b += box(x(0), 30, 250, 34, "dg-box dg-good") + text(x(2.5), 52, `[10:00, 10:05) · ${l("dipancarkan", "emitted")}`, "dg-text", "middle");
      b += box(x(5), 30, 250, 34) + text(x(7.5), 52, `[10:05, 10:10) · ${l("masih terbuka", "still open")}`, "dg-text", "middle");
      b += box(x(10), 30, 100, 34, "dg-box dg-faint") + text(x(11), 52, "[10:10, …)", "dg-muted", "middle");
      [1, 2, 4, 6].forEach((m) => { b += `<circle cx="${x(m)}" cy="92" r="6" class="dg-dot"/>`; });
      b += `<circle cx="${x(7)}" cy="92" r="7" class="dg-dot dg-accent-fill"/>` + text(x(7) + 12, 96, l("terbaru: 10:07", "newest: 10:07"), "dg-text");
      b += `<line x1="${x(5)}" y1="22" x2="${x(5)}" y2="196" class="dg-wm"/>`;
      b += text(x(5) + 6, 18, l("watermark 10:05 = 10:07 − jeda 2 menit", "watermark 10:05 = 10:07 − 2 min delay"), "dg-accent-text");
      b += `<circle cx="${x(3)}" cy="128" r="6" class="dg-dot dg-warn-fill"/>`;
      b += text(x(3) + 12, 132, l("10:03 datang terlambat, jendelanya belum dipancarkan → tetap dihitung", "10:03 arrives late, its window not emitted yet → still counted"), "dg-text dg-halo");
      b += `<path d="M${x(2) - 6} 158 l12 12 M${x(2) + 6} 158 l-12 12" class="dg-cross"/>`;
      b += text(x(2) + 14, 168, l("10:02 datang setelah [10:00, 10:05) dipancarkan → dibuang", "10:02 arrives after [10:00, 10:05) was emitted → dropped"), "dg-text dg-halo");
      b += `<line x1="${x(0)}" y1="196" x2="${x(12)}" y2="196" class="dg-axis"/>`;
      for (let m = 0; m <= 12; m += 1) {
        b += `<line x1="${x(m)}" y1="192" x2="${x(m)}" y2="200" class="dg-axis"/>`;
        if (m % 2 === 0 || m === 5) b += text(x(m), 214, t(m), "dg-muted", "middle");
      }
      b += text(x(12), 232, l("waktu event", "event time"), "dg-muted", "end");
      return svg(680, 240, l("Diagram: watermark 10:05 menutup jendela 10:00–10:05; event terlambat dihitung selama jendelanya terbuka, dibuang setelah dipancarkan", "Diagram: a 10:05 watermark closes the 10:00–10:05 window; a late event counts while its window is open and is dropped after it is emitted"), b);
    },

    // Module 1.4: SCD Type 2 versions and the as-of join
    scd(l) {
      const x = (d) => 40 + (d - 1) * 20;               // day of January -> x
      let b = "";
      b += text(40, 20, `dim_customer · customer_id 1`, "dg-head");
      b += box(x(1), 30, x(10) - x(1), 34) + text((x(1) + x(10)) / 2, 52, "sk 1 · Silver · Jakarta", "dg-text", "middle");
      b += box(x(10), 30, x(20) - x(10), 34) + text((x(10) + x(20)) / 2, 52, "sk 2 · Gold · Jakarta", "dg-text", "middle");
      b += box(x(20), 30, 640 - x(20), 34, "dg-box dg-open") + text((x(20) + 640) / 2, 52, `sk 3 · Gold · Bandung · ${l("berlaku kini", "current")}`, "dg-text", "middle");
      [[1, "01-01"], [10, "01-10"], [20, "01-20"]].forEach(([d, s]) => { b += text(x(d), 82, s, "dg-muted", "middle"); });
      b += text(640, 82, "→ 9999-12-31", "dg-muted", "end");
      [[5, "sk 1 · Silver"], [15, "sk 2 · Gold"], [25, "sk 3 · Gold"]].forEach(([d, s]) => {
        b += `<line x1="${x(d)}" y1="66" x2="${x(d)}" y2="112" class="dg-link"/><circle cx="${x(d)}" cy="118" r="6" class="dg-dot dg-accent-fill"/>`;
        b += text(x(d), 142, `${l("pesanan", "order")} 01-${String(d).padStart(2, "0")} → ${s}`, "dg-text", "middle");
      });
      b += box(40, 160, 600, 28, "dg-box dg-good") + text(52, 179, l("customer_id sama DAN valid_from ≤ order_ts < valid_to → tepat 1 versi per pesanan  ✓", "same customer_id AND valid_from ≤ order_ts < valid_to → exactly 1 version per order  ✓"));
      b += box(40, 196, 600, 28, "dg-box dg-bad") + text(52, 215, l("hanya customer_id → setiap pesanan cocok dengan 3 versi: 3 baris, bukan 1  ✗", "customer_id only → every order matches all 3 versions: 3 rows instead of 1  ✗"));
      return svg(680, 232, l("Diagram: tiga versi SCD Type 2 pelanggan 1 dan as-of join yang memilih satu versi per pesanan", "Diagram: three SCD Type 2 versions of customer 1 and the as-of join that picks one version per order"), b);
    }
  };

  // ============================================================================
  // INTERACTIVE STEP-BY-STEP LESSON ANIMATION ENGINE (10 Core Visualizers)
  // Each visualizer has 4 frames and 2 comparison modes ("good" vs "broken"),
  // embedded directly inside the target lessons across the 27 modules.
  // ============================================================================
  const LESSON_ANIMATIONS = [
    // 1. OLTP Row Store vs. OLAP Columnar Storage
    {
      id: "anim-row-vs-column",
      placements: [
        { modId: "mod-0-2", lessonIdx: 0 },
        { modId: "mod-1-5", lessonIdx: 5 }
      ],
      title: {
        id: "Animasi Interaktif: Bagaimana Disk Membaca Penyimpanan Baris (OLTP) vs. Kolom (Parquet/OLAP)",
        en: "Interactive Animation: How Disk Reads Row-Oriented (OLTP) vs. Columnar (Parquet/OLAP) Storage"
      },
      modes: [
        { id: "columnar", label: { id: "⚡ Kolom (Parquet / DuckDB)", en: "⚡ Columnar (Parquet / DuckDB)" } },
        { id: "row", label: { id: "🐢 Baris (CSV / Postgres OLTP)", en: "🐢 Row-Store (CSV / Postgres OLTP)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Query Analitik Masuk", en: "Step 1: Analytical Query Arrives" },
          desc: {
            id: "Analis menjalankan SELECT SUM(amount) FROM orders. Tabel punya 4 kolom (id, user, city, amount), tetapi query HANYA membutuhkan kolom amount.",
            en: "An analyst runs SELECT SUM(amount) FROM orders. The table has 4 columns (id, user, city, amount), but the query ONLY needs the amount column."
          }
        },
        {
          title: { id: "Langkah 2: Tata Letak Blok di Disk", en: "Step 2: Physical Byte Layout on Disk" },
          desc: {
            id: "Pada penyimpanan Baris, seluruh kolom dari Baris #1 disimpan bersebelahan. Pada penyimpanan Kolom (Parquet), semua nilai 'amount' dikelompokkan dalam satu blok berurutan.",
            en: "In a Row-Store, all columns of Row #1 sit next to each other. In Columnar Parquet, all 'amount' values are packed contiguously into one tight column chunk."
          }
        },
        {
          title: { id: "Langkah 3: Pergerakan Kepala Baca (Disk Read Head)", en: "Step 3: Disk I/O Read Head Movement" },
          desc: {
            id: "Perhatikan blok yang menyala! Penyimpanan Kolom melompat langsung ke blok 'amount' (membaca 25% byte), sedangkan Baris wajib memindai 100% byte termasuk kolom yang tidak dipakai.",
            en: "Watch the highlighted blocks! Columnar storage jumps straight to the 'amount' chunk (reading 25% of bytes), while Row-Store must scan 100% of bytes across unused columns."
          }
        },
        {
          title: { id: "Langkah 4: Kompresi SIMD & Hasil Akhir", en: "Step 4: Vectorized SIMD & I/O Verdict" },
          desc: {
            id: "Karena nilai sejenis berdampingan, blok kolom dikompresi 5x lebih kecil dan dijumlahkan langsung di register CPU SIMD: SUM(amount) = Rp 420.000.",
            en: "Because identical types sit together, the column chunk compresses 5x smaller and sums directly in CPU SIMD registers: SUM(amount) = 420,000."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isCol = mode === "columnar";
        const rows = [
          ["#101", "Ayu", "JKT", "150k"],
          ["#102", "Budi", "BDG", "120k"],
          ["#103", "Citra", "SBY", "150k"]
        ];
        let b = "";
        b += box(16, 14, 648, 32, "dg-box") + text(28, 34, `SQL: <tspan class="dg-accent">SELECT SUM(amount)</tspan> FROM orders;   ·   ${isCol ? l("Mode: Parquet Kolom", "Mode: Columnar Parquet") : l("Mode: Baris OLTP/CSV", "Mode: Row-Store OLTP/CSV")}`, "dg-head");

        // Logical table on left
        b += text(20, 68, l("Tabel Logis (3 Baris × 4 Kolom)", "Logical Table (3 Rows × 4 Cols)"), "dg-muted");
        const cols = ["id", "user", "city", "amount"];
        cols.forEach((c, ci) => {
          const isTarget = ci === 3;
          b += box(20 + ci * 54, 76, 52, 22, isTarget && step >= 0 ? "dg-box dg-good" : "dg-box");
          b += text(46 + ci * 54, 91, c, isTarget ? "dg-good-text" : "dg-muted", "middle");
        });
        rows.forEach((r, ri) => {
          r.forEach((val, ci) => {
            const isTarget = ci === 3;
            b += box(20 + ci * 54, 100 + ri * 26, 52, 24, isTarget && step >= 2 ? "dg-box dg-good" : "dg-box");
            b += text(46 + ci * 54, 116 + ri * 26, val, isTarget ? "dg-good-text" : "dg-text", "middle");
          });
        });

        // Physical disk blocks on right
        b += text(265, 68, isCol ? l("Blok Fisik di Disk (Dikelompokkan per Kolom)", "Physical Disk Blocks (Grouped by Column Chunk)") : l("Blok Fisik di Disk (Berurutan per Baris)", "Physical Disk Blocks (Interleaved Row-by-Row)"), "dg-head");

        const blocks = isCol
          ? [
              { lbl: "id:#101", col: 0 }, { lbl: "id:#102", col: 0 }, { lbl: "id:#103", col: 0 },
              { lbl: "Ayu", col: 1 }, { lbl: "Budi", col: 1 }, { lbl: "Citra", col: 1 },
              { lbl: "JKT", col: 2 }, { lbl: "BDG", col: 2 }, { lbl: "SBY", col: 2 },
              { lbl: "150k", col: 3 }, { lbl: "120k", col: 3 }, { lbl: "150k", col: 3 }
            ]
          : [
              { lbl: "#101", col: 0 }, { lbl: "Ayu", col: 1 }, { lbl: "JKT", col: 2 }, { lbl: "150k", col: 3 },
              { lbl: "#102", col: 0 }, { lbl: "Budi", col: 1 }, { lbl: "BDG", col: 2 }, { lbl: "120k", col: 3 },
              { lbl: "#103", col: 0 }, { lbl: "Citra", col: 1 }, { lbl: "SBY", col: 2 }, { lbl: "150k", col: 3 }
            ];

        blocks.forEach((blk, idx) => {
          const rowIdx = Math.floor(idx / 4);
          const colIdx = idx % 4;
          const bx = 265 + colIdx * 98;
          const by = 78 + rowIdx * 34;
          const isTarget = blk.col === 3;
          let cls = "dg-box";
          if (step === 1) {
            cls = isTarget ? "dg-box dg-good" : "dg-box dg-faint";
          } else if (step >= 2) {
            if (isCol) {
              cls = isTarget ? "dg-box dg-good anim-pulse" : "dg-box dg-faint";
            } else {
              cls = isTarget ? "dg-box dg-good anim-pulse" : "dg-box dg-bad";
            }
          }
          b += box(bx, by, 92, 28, cls);
          b += text(bx + 46, by + 18, blk.lbl, isTarget ? "dg-good-text" : (!isCol && step >= 2 ? "dg-bad-text" : "dg-text"), "middle");
        });

        // Bottom verdict banner
        const bannerCls = isCol ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box");
        const verdict = step === 0
          ? l("Query hanya meminta 1 dari 4 kolom (25% dari tabel).", "Query requests only 1 of 4 columns (25% of the table).")
          : step === 1
            ? (isCol ? l("Parquet menyimpan semua nilai amount berdampingan di Baris Blok #3.", "Parquet packs all amount values contiguously in Chunk #3.") : l("Penyimpanan baris mencampur id, user, city, dan amount di setiap blok.", "Row storage interleaves id, user, city, and amount in every disk block."))
            : step === 2
              ? (isCol ? l("✓ Kepala baca langsung melompat ke Chunk amount: hanya 3 blok dibaca (9 blok dilewati!).", "✓ Read head jumps straight to amount chunk: only 3 blocks read (9 blocks skipped!).") : l("✗ Kepala baca terpaksa memindai ke-12 blok disk hanya untuk mengambil 3 angka!", "✗ Read head is forced to scan all 12 disk blocks just to extract 3 numbers!"))
              : (isCol ? l("✓ Hasil: 420k · I/O Hemat 75% · Kompresi Dictionary/RLE + Vectorized CPU.", "✓ Result: 420k · 75% I/O Saved · Dictionary/RLE Compression + Vectorized CPU.") : l("✗ Hasil: 420k · 100% Disk Dipindai · Lambat untuk agregasi jutaan baris.", "✗ Result: 420k · 100% Disk Scanned · Slow for multi-million-row aggregations."));
        b += box(16, 190, 648, 32, bannerCls) + text(28, 210, verdict, "dg-text");
        return svg(680, 232, l("Animasi perbandingan baca baris vs kolom", "Row vs columnar storage read animation"), b);
      }
    },

    // 2. B-Tree Index Seek O(log N) vs Full Table Scan O(N)
    {
      id: "anim-btree-vs-scan",
      placements: [
        { modId: "mod-1-3", lessonIdx: 5 },
        { modId: "mod-1-3", lessonIdx: 6 }
      ],
      title: {
        id: "Animasi Interaktif: Pencarian Pohon B-Tree O(log N) vs. Full Table Scan O(N)",
        en: "Interactive Animation: B-Tree Index Seek O(log N) vs. Full Table Scan O(N)"
      },
      modes: [
        { id: "seek", label: { id: "✅ Sargable: WHERE id = 74", en: "✅ Sargable: WHERE id = 74" } },
        { id: "scan", label: { id: "🚨 Fungsi di Kolom: WHERE ABS(id) = 74", en: "🚨 Function on Column: WHERE ABS(id) = 74" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Query Planner Mengevaluasi Klausa WHERE", en: "Step 1: Query Planner Evaluates the WHERE Predicate" },
          desc: {
            id: "Jika kolom indeks berdiri sendiri (id = 74), planner memakai B-Tree. Jika dibungkus fungsi (ABS(id) = 74), B-Tree tidak bisa dipakai!",
            en: "When the indexed column stands bare (id = 74), the planner uses the B-Tree. Wrapping it in a function (ABS(id) = 74) blinds the index!"
          }
        },
        {
          title: { id: "Langkah 2: Lompatan #1 — Root Node B-Tree vs. Halaman Awal", en: "Step 2: Hop #1 — B-Tree Root Node vs. Heap Page #1" },
          desc: {
            id: "B-Tree memeriksa Root [50]: karena 74 >= 50, seluruh cabang kiri (<50) langsung dibuang! Sebaliknya, Full Scan mulai memeriksa halaman tabel dari awal.",
            en: "B-Tree checks Root [50]: since 74 >= 50, the entire left subtree (<50) is eliminated in 1 step! Full Scan starts reading every heap page from Page 1."
          }
        },
        {
          title: { id: "Langkah 3: Lompatan #2 — Branch Node [60 | 85]", en: "Step 3: Hop #2 — Branch Node [60 | 85]" },
          desc: {
            id: "B-Tree turun ke cabang kanan [60 | 85] dan memilih rentang tengah (60..85). Full Scan masih sibuk membaca ribuan halaman yang tidak relevan.",
            en: "B-Tree hops to the right branch [60 | 85] and follows the middle pointer (60..85). Full Scan is still slogging through thousands of irrelevant pages."
          }
        },
        {
          title: { id: "Langkah 4: Lompatan #3 — Leaf Page Ditemukan (3 I/O vs 10.000 I/O)", en: "Step 4: Hop #3 — Leaf Page Hit (3 Page Reads vs. 10,000 Page Reads)" },
          desc: {
            id: "B-Tree tiba tepat di Leaf [70, 74, 81] hanya dalam 3 pembacaan halaman! Full Scan harus memeriksa 100% halaman tabel.",
            en: "B-Tree lands directly on Leaf [70, 74, 81] in just 3 page reads! Full Scan had to inspect 100% of the table's heap pages."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isSeek = mode === "seek";
        let b = "";
        b += box(16, 12, 648, 30, "dg-box") + text(28, 32, isSeek
          ? `EXPLAIN QUERY PLAN: <tspan class="dg-good-text">SEARCH orders USING INDEX idx_id (id=?)</tspan>`
          : `EXPLAIN QUERY PLAN: <tspan class="dg-bad-text">SCAN orders</tspan>  (WHERE ABS(id) = 74)`, "dg-head");

        // Root node
        const rootCls = isSeek && step >= 1 ? "dg-box dg-good anim-pulse" : "dg-box";
        b += box(280, 52, 120, 28, rootCls) + text(340, 70, "Root [ 50 ]", isSeek && step >= 1 ? "dg-good-text" : "dg-text", "middle");

        // Branches
        const brLeftCls = isSeek && step >= 1 ? "dg-box dg-faint" : "dg-box";
        const brRightCls = isSeek && step >= 2 ? "dg-box dg-good anim-pulse" : "dg-box";
        b += `<line x1="310" y1="80" x2="170" y2="102" class="dg-link"/>`;
        b += `<line x1="370" y1="80" x2="510" y2="102" class="dg-link"/>`;
        b += box(100, 102, 140, 28, brLeftCls) + text(170, 120, "Branch [ 20 | 35 ]", "dg-muted", "middle");
        b += box(440, 102, 140, 28, brRightCls) + text(510, 120, "Branch [ 60 | 85 ]", isSeek && step >= 2 ? "dg-good-text" : "dg-text", "middle");

        // Leaf / Heap pages at bottom
        const leaves = [
          { lbl: "1..19", hit: false },
          { lbl: "20..34", hit: false },
          { lbl: "35..49", hit: false },
          { lbl: "50..59", hit: false },
          { lbl: "60..84 [74]", hit: true },
          { lbl: "85..99", hit: false }
        ];
        leaves.forEach((lf, idx) => {
          const lx = 24 + idx * 106;
          let cls = "dg-box";
          if (isSeek) {
            if (step === 3) cls = lf.hit ? "dg-box dg-good anim-pulse" : "dg-box dg-faint";
            else if (step >= 1 && idx < 3) cls = "dg-box dg-faint";
          } else {
            // Full scan lights up sequentially in red
            const scannedUpTo = step === 0 ? -1 : step === 1 ? 1 : step === 2 ? 3 : 5;
            if (idx <= scannedUpTo) cls = lf.hit && step === 3 ? "dg-box dg-good" : "dg-box dg-bad anim-pulse";
          }
          b += box(lx, 148, 98, 30, cls);
          b += text(lx + 49, 167, lf.lbl, cls.includes("dg-good") ? "dg-good-text" : cls.includes("dg-bad") ? "dg-bad-text" : "dg-text", "middle");
        });

        const ioPages = isSeek ? (step === 0 ? 0 : step) : (step * 2);
        b += box(16, 190, 648, 30, isSeek ? "dg-box dg-good" : "dg-box dg-bad");
        b += text(28, 209, isSeek
          ? l(`✓ B-Tree Index Seek: ${ioPages} halaman dibaca (kompleksitas O(log N) — tetap ~3-4 lompatan meski tabel 100 juta baris).`, `✓ B-Tree Index Seek: ${ioPages} page(s) read (O(log N) complexity — stays ~3-4 hops even on 100M rows).`)
          : l(`✗ Full Table Scan: ${ioPages} dari 6 blok dipindai berurutan (kompleksitas O(N) — melambat linear seiring ukuran tabel).`, `✗ Full Table Scan: ${ioPages} of 6 blocks scanned sequentially (O(N) complexity — slows linearly with table size).`), "dg-text");
        return svg(680, 230, l("Animasi pencarian B-Tree vs Full Table Scan", "B-Tree index seek vs full table scan animation"), b);
      }
    },

    // 3. Retry Idempotency: Naive Append vs Idempotent Delete-Write / Upsert
    {
      id: "anim-idempotent-retry",
      placements: [
        { modId: "mod-1-2", lessonIdx: 3 },
        { modId: "mod-2-3", lessonIdx: 4 },
        { modId: "mod-2-4", lessonIdx: 2 },
        { modId: "mod-4-4", lessonIdx: 4 }
      ],
      title: {
        id: "Animasi Interaktif: Apa yang Terjadi Saat Job Gagal & Di-Retry? (Append vs. Idempoten)",
        en: "Interactive Animation: What Happens When a Job Crashes & Retries? (Naive Append vs. Idempotent)"
      },
      modes: [
        { id: "idempotent", label: { id: "✅ Idempoten: DELETE Partisi / MERGE", en: "✅ Idempotent: DELETE Partition / MERGE" } },
        { id: "naive", label: { id: "🚨 Naif: INSERT INTO (Append Biasa)", en: "🚨 Naive: Plain INSERT INTO (Append)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Eksekusi #1 Dimulai (Batch 2026-10-19 · 3 Pesanan)", en: "Step 1: Run #1 Starts (Batch 2026-10-19 · 3 Orders)" },
          desc: {
            id: "Sumber memiliki 3 pesanan untuk tanggal 2026-10-19 (#1, #2, #3) dengan total pendapatan Rp 300.000.",
            en: "The source holds 3 orders for partition 2026-10-19 (#1, #2, #3) totaling 300,000 in revenue."
          }
        },
        {
          title: { id: "Langkah 2: Koneksi Putus di Tengah Jalan (Baru 2 Baris Tertulis!)", en: "Step 2: Network Crash Mid-Flight (After Writing 2 Rows!)" },
          desc: {
            id: "Pada mode Naif, #1 dan #2 sudah terlanjur masuk ke tabel target sebelum gagal. Pada mode Idempoten, penulisan berada di dalam transaksi staging/partisi.",
            en: "In Naive mode, #1 and #2 are already committed to the target table before the crash. In Idempotent mode, writes are staged or scoped to an atomic partition swap."
          }
        },
        {
          title: { id: "Langkah 3: Orkestrator (Airflow/Dagster) Menjalankan Retry Otomatis", en: "Step 3: Orchestrator (Airflow/Dagster) Triggers Automatic Retry" },
          desc: {
            id: "Mode Idempoten membersihkan partisi 2026-10-19 (atau melakukan MERGE berdasarkan order_id) sebelum menulis. Mode Naif langsung menambahkan 3 baris lagi!",
            en: "Idempotent mode clears partition 2026-10-19 (or MERGEs by order_id) before writing. Naive mode blindly appends all 3 rows again!"
          }
        },
        {
          title: { id: "Langkah 4: Audit Tabel Target — f(f(x)) = f(x)", en: "Step 4: Target Table Audit — f(f(x)) = f(x)" },
          desc: {
            id: "Pipeline Idempoten menghasilkan tepat 3 baris (Rp 300k) berapa kali pun di-retry. Pipeline Naif menghasilkan 5 baris dengan duplikat #1 & #2 (Rp 500k — korupsi diam-diam!).",
            en: "The Idempotent pipeline yields exactly 3 rows (300k) no matter how many times it retries. The Naive pipeline leaves 5 rows with duplicates #1 & #2 (500k — silent corruption!)."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isIdem = mode === "idempotent";
        let b = "";
        b += box(16, 12, 648, 30, "dg-box") + text(28, 32, isIdem
          ? l("Pola Tulis: BEGIN; DELETE FROM orders WHERE dt='2026-10-19'; INSERT ...; COMMIT;", "Write Pattern: BEGIN; DELETE FROM orders WHERE dt='2026-10-19'; INSERT ...; COMMIT;")
          : l("Pola Tulis: INSERT INTO orders SELECT * FROM raw_2026_10_19; (Tanpa transaksi/dedup)", "Write Pattern: INSERT INTO orders SELECT * FROM raw_2026_10_19; (No cleanup or dedup)"), "dg-head");

        // Source box
        b += text(24, 64, l("Sumber (2026-10-19)", "Source (2026-10-19)"), "dg-head");
        ["#1 · 100k", "#2 · 100k", "#3 · 100k"].forEach((s, i) => {
          b += box(24, 74 + i * 32, 145, 26, "dg-box") + text(96, 91 + i * 32, s, "dg-text", "middle");
        });

        // Middle status
        const midLabel = step === 0 ? "Run #1 →" : step === 1 ? "⚡ CRASH @ #2!" : step === 2 ? "🔄 RETRY (Run #2)" : isIdem ? "✓ f(f(x)) = f(x)" : "✗ f(f(x)) ≠ f(x)";
        b += box(192, 98, 136, 36, step === 1 ? "dg-box dg-bad anim-pulse" : "dg-box") + text(260, 120, midLabel, step === 1 ? "dg-bad-text" : "dg-head", "middle");

        // Target table rows
        b += text(355, 64, l("Tabel Target Produksi", "Production Target Table"), "dg-head");
        let targetRows = [];
        if (step === 0) targetRows = [{ t: "#1 · 100k", ok: true }];
        else if (step === 1) targetRows = isIdem
          ? [{ t: l("(Transaksi dibatalkan / Staging)", "(Transaction rolled back)"), ok: true }]
          : [{ t: "#1 · 100k (Run 1)", ok: true }, { t: "#2 · 100k (Run 1)", ok: true }];
        else if (step >= 2) targetRows = isIdem
          ? [{ t: "#1 · 100k ✓", ok: true }, { t: "#2 · 100k ✓", ok: true }, { t: "#3 · 100k ✓", ok: true }]
          : [
              { t: "#1 · 100k (Run 1)", ok: true },
              { t: "#2 · 100k (Run 1)", ok: true },
              { t: "#1 · 100k (DUPLIKAT!)", ok: false },
              { t: "#2 · 100k (DUPLIKAT!)", ok: false },
              { t: "#3 · 100k (Run 2)", ok: true }
            ];

        targetRows.forEach((r, idx) => {
          const rx = idx < 3 ? 355 : 512;
          const ry = 74 + (idx % 3) * 32;
          b += box(rx, ry, 148, 26, r.ok ? "dg-box dg-good" : "dg-box dg-bad anim-pulse");
          b += text(rx + 74, ry + 17, r.t, r.ok ? "dg-good-text" : "dg-bad-text", "middle");
        });

        const rev = step < 2 ? (isIdem ? "0 (Atomic)" : "200k (Partial!)") : (isIdem ? "300k (Tepat ✓)" : "500k (+67% Palsu ✗)");
        b += box(16, 186, 648, 32, isIdem ? "dg-box dg-good" : (step >= 1 ? "dg-box dg-bad" : "dg-box"));
        b += text(28, 206, `${l("Total Pendapatan di Tabel Target", "Target Table SUM(revenue)")}: ${rev}   ·   ${isIdem ? l("Aman dijalankan ulang kapan saja.", "Safe to re-run or backfill N times.") : l("Bahaya: retry menggandakan baris tanpa pesan error!", "Danger: retry silently duplicated rows with exit code 0!")}`, "dg-text");
        return svg(680, 228, l("Animasi retry idempoten vs append naif", "Idempotent retry vs naive append animation"), b);
      }
    },

    // 4. SCD Type 2 History Split & Point-in-Time ASOF Join
    {
      id: "anim-scd2-asof",
      placements: [
        { modId: "mod-1-4", lessonIdx: 4 }
      ],
      title: {
        id: "Animasi Interaktif: Perubahan Histori SCD Tipe 2 & Point-in-Time ASOF Join",
        en: "Interactive Animation: SCD Type 2 History Split & Point-in-Time ASOF Join"
      },
      modes: [
        { id: "asof", label: { id: "✅ ASOF Join (valid_from ≤ ts < valid_to)", en: "✅ ASOF Join (valid_from ≤ ts < valid_to)" } },
        { id: "fanout", label: { id: "🚨 Join Tanpa Filter Tanggal (Fan-Out!)", en: "🚨 Unfiltered Join on customer_id Only" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Pelanggan C1 Masuk sebagai Tier Silver (1 Jan)", en: "Step 1: Customer C1 Starts in Silver Tier (Jan 1)" },
          desc: {
            id: "Baris dimensi pertama memiliki surrogate key sk=1, tier='Silver', valid_from='01-01', valid_to='9999-12-31', is_current=true.",
            en: "The initial dimension row has surrogate key sk=1, tier='Silver', valid_from='01-01', valid_to='9999-12-31', is_current=true."
          }
        },
        {
          title: { id: "Langkah 2: C1 Naik ke Tier Gold pada 10 Jan (Tutup Baris Lama, Tambah Baris Baru)", en: "Step 2: C1 Upgrades to Gold on Jan 10 (Close Old Row, Insert New Row)" },
          desc: {
            id: "SCD Tipe 2 TIDAK menimpa baris sk=1! Ia menutup sk=1 (valid_to='01-10', is_current=false) dan menyisipkan baris baru sk=2 (Gold, valid_from='01-10' → '9999-12-31').",
            en: "SCD Type 2 does NOT overwrite sk=1! It expires sk=1 (valid_to='01-10', is_current=false) and inserts a new row sk=2 (Gold, valid_from='01-10' → '9999-12-31')."
          }
        },
        {
          title: { id: "Langkah 3: Dua Pesanan Masuk (Pesanan 5 Jan & Pesanan 15 Jan)", en: "Step 3: Two Orders Arrive (Jan 05 Order & Jan 15 Order)" },
          desc: {
            id: "Pesanan #A terjadi tanggal 05 Jan (saat C1 masih Silver). Pesanan #B terjadi tanggal 15 Jan (setelah C1 menjadi Gold).",
            en: "Order #A happened on Jan 05 (when C1 was still Silver). Order #B happened on Jan 15 (after C1 became Gold)."
          }
        },
        {
          title: { id: "Langkah 4: Hasil JOIN Fakta ke Dimensi SCD2", en: "Step 4: Fact-to-SCD2 Dimension Join Result" },
          desc: {
            id: "ASOF Join mencocokkan #A ke Silver dan #B ke Gold (tepat 2 baris fakta). Join tanpa rentang tanggal mencocokkan setiap pesanan ke KEDUA versi (4 baris — pendapatan 2x lipat!).",
            en: "ASOF Join matches #A to Silver and #B to Gold (exact 2 fact rows). Joining without date bounds matches each order to BOTH versions (4 rows — revenue doubled!)."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isAsof = mode === "asof";
        let b = "";
        b += text(20, 22, "dim_customer (customer_id = 'C1')", "dg-head");
        const v1End = step >= 1 ? "2026-01-10 · current=false" : "9999-12-31 · current=true";
        b += box(20, 30, 640, 28, "dg-box") + text(32, 49, `sk=1 · C1 · Tier: <tspan class="dg-accent">Silver</tspan> · valid: 2026-01-01 → ${v1End}`);
        if (step >= 1) {
          b += box(20, 64, 640, 28, "dg-box dg-good anim-pulse") + text(32, 83, `sk=2 · C1 · Tier: <tspan class="dg-good-text">Gold</tspan>   · valid: 2026-01-10 → 9999-12-31 · current=true`);
        }

        if (step >= 2) {
          b += text(20, 114, l("fct_orders & Hasil JOIN:", "fct_orders & JOIN Output:"), "dg-head");
          if (step === 2) {
            b += box(20, 122, 305, 28, "dg-box") + text(32, 140, "Order #A (01-05) · Rp 100k · C1");
            b += box(355, 122, 305, 28, "dg-box") + text(367, 140, "Order #B (01-15) · Rp 100k · C1");
          } else if (isAsof) {
            b += box(20, 122, 305, 30, "dg-box dg-good anim-pulse") + text(32, 141, "Order #A (01-05) → sk=1 (Silver) · 100k ✓");
            b += box(355, 122, 305, 30, "dg-box dg-good anim-pulse") + text(367, 141, "Order #B (01-15) → sk=2 (Gold)   · 100k ✓");
          } else {
            b += box(20, 122, 305, 26, "dg-box dg-bad anim-pulse") + text(32, 139, "Order #A → sk=1 (Silver) · 100k");
            b += box(20, 152, 305, 26, "dg-box dg-bad anim-pulse") + text(32, 169, "Order #A → sk=2 (Gold)   · 100k (FAN-OUT!)");
            b += box(355, 122, 305, 26, "dg-box dg-bad anim-pulse") + text(367, 139, "Order #B → sk=1 (Silver) · 100k (FAN-OUT!)");
            b += box(355, 152, 305, 26, "dg-box dg-bad anim-pulse") + text(367, 169, "Order #B → sk=2 (Gold)   · 100k");
          }
        }

        b += box(20, 186, 640, 30, isAsof ? "dg-box dg-good" : (step === 3 ? "dg-box dg-bad" : "dg-box"));
        b += text(32, 205, step < 3
          ? l("Klik Berikutnya (⏭) untuk melihat bagaimana pesanan dicocokkan ke histori SCD2.", "Click Next (⏭) to watch how fact orders join against SCD2 history.")
          : (isAsof
              ? l("✓ ASOF Join: 2 pesanan → 2 baris hasil (SUM = Rp 200k). Atribut historis akurat 100%.", "✓ ASOF Join: 2 orders → 2 output rows (SUM = 200k). Historical attribution is 100% accurate.")
              : l("✗ Tanpa filter valid_from/valid_to: 2 pesanan × 2 versi = 4 baris (SUM = Rp 400k — menggelembung 2x!).", "✗ Without valid_from/valid_to bounds: 2 orders × 2 versions = 4 rows (SUM = 400k — inflated 2x!).")), "dg-text");
        return svg(680, 226, l("Animasi SCD Tipe 2 dan ASOF Join", "SCD Type 2 and ASOF Join animation"), b);
      }
    },

    // 5. API Cursor Pagination, 429 Backoff & Crash-Safe Checkpointing
    {
      id: "anim-api-checkpoint",
      placements: [
        { modId: "mod-1-6", lessonIdx: 3 },
        { modId: "mod-4-2", lessonIdx: 3 }
      ],
      title: {
        id: "Animasi Interaktif: Paginasi Kursor API, Rate-Limit 429 & Urutan Checkpoint Aman-Gagal",
        en: "Interactive Animation: API Cursor Pagination, HTTP 429 Backoff & Crash-Safe Checkpointing"
      },
      modes: [
        { id: "safe", label: { id: "✅ Tulis Data Dulu → Baru Simpan Checkpoint", en: "✅ Write Data First → Save Checkpoint After" } },
        { id: "unsafe", label: { id: "🚨 Simpan Checkpoint Dulu → Data Hilang Saat Crash!", en: "🚨 Save Checkpoint First → Data Lost on Crash!" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Ambil Halaman 1 (cursor=null → next_cursor='c_105')", en: "Step 1: Fetch Page 1 (cursor=null → next_cursor='c_105')" },
          desc: {
            id: "Worker mengambil 5 pesanan pertama dari API, menulisnya ke disk, dan mencatat checkpoint cursor='c_105'.",
            en: "The worker fetches the first 5 orders from the API, flushes them to disk, and records checkpoint cursor='c_105'."
          }
        },
        {
          title: { id: "Langkah 2: Ambil Halaman 2 (cursor='c_105') → Kena HTTP 429 Too Many Requests!", en: "Step 2: Fetch Page 2 (cursor='c_105') → Hits HTTP 429 Rate Limit!" },
          desc: {
            id: "Server mengembalikan HTTP 429 dengan header Retry-After: 2. Worker wajib tidur selama 2 detik (+ jitter) lalu mencoba ulang.",
            en: "The server returns HTTP 429 with header Retry-After: 2. The worker sleeps for 2 seconds (+ jitter) and retries cleanly."
          }
        },
        {
          title: { id: "Langkah 3: Halaman 2 Diterima (next_cursor='c_110'), Tiba-Tiba Listrik/Container Mati!", en: "Step 3: Page 2 Arrives (next_cursor='c_110'), Then the Container Crashes!" },
          desc: {
            id: "Jika Anda menyimpan checkpoint 'c_110' SEBELUM data Halaman 2 selesai ditulis ke disk, crash pada detik ini membuat Halaman 2 tidak pernah tertulis!",
            en: "If you save checkpoint 'c_110' BEFORE flushing Page 2's rows to disk, a crash right now means Page 2 was never written!"
          }
        },
        {
          title: { id: "Langkah 4: Worker Menyala Kembali & Membaca checkpoint.json", en: "Step 4: Worker Restarts & Resumes from checkpoint.json" },
          desc: {
            id: "Urutan Aman membaca ulang dari 'c_105' + deduplikasi ID (0 data hilang). Urutan Salah melanjutkan dari 'c_110' — data Halaman 2 hilang selamanya!",
            en: "The Safe order resumes from 'c_105' + deduplicates IDs (0 data lost). The Unsafe order resumes from 'c_110' — Page 2 is permanently lost!"
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isSafe = mode === "safe";
        let b = "";
        const boxes = [
          { x: 20, t: "1. HTTP API", sub: step === 1 ? "429 Retry-After: 2s" : "GET /orders?cursor=…" },
          { x: 185, t: "2. Worker RAM", sub: step >= 2 ? "Page 2 (#106..#110)" : "Page 1 (#101..#105)" },
          { x: 350, t: "3. out.jsonl (Disk)", sub: step < 2 ? "5 rows (#101..#105)" : (step === 2 && !isSafe ? "⚡ CRASH! (Masih 5 baris)" : "10 rows (#101..#110) ✓") },
          { x: 515, t: "4. checkpoint.json", sub: step === 0 ? "cursor: 'c_105'" : (step >= 2 ? (isSafe && step === 2 ? "cursor: 'c_105' (Aman)" : "cursor: 'c_110'") : "cursor: 'c_105'") }
        ];
        boxes.forEach((bx, i) => {
          let cls = "dg-box";
          if (step === 1 && i === 0) cls = "dg-box dg-bad anim-pulse";
          else if (step === 2 && i === 2) cls = isSafe ? "dg-box dg-good anim-pulse" : "dg-box dg-bad anim-pulse";
          else if (step === 3) cls = isSafe ? "dg-box dg-good" : (i >= 2 ? "dg-box dg-bad" : "dg-box");
          b += box(bx.x, 28, 145, 76, cls);
          b += text(bx.x + 72, 54, bx.t, "dg-head", "middle");
          b += text(bx.x + 72, 80, bx.sub, cls.includes("dg-bad") ? "dg-bad-text" : cls.includes("dg-good") ? "dg-good-text" : "dg-muted", "middle");
        });

        b += box(20, 124, 640, 44, isSafe ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box"));
        const orderRule = isSafe
          ? l("Aturan Hukum Pertama: (1) Ambil Halaman → (2) Tulis & fsync ke Disk → (3) Simpan Checkpoint → (4) Dedup ID saat baca.", "First-Law Rule: (1) Fetch Page → (2) Flush & fsync Data to Disk → (3) Save Checkpoint → (4) Deduplicate IDs on resume.")
          : l("Anti-Pola Berbahaya: Menyimpan cursor='c_110' sebelum data Halaman 2 tersimpan di disk menyebabkan kehilangan data permanen saat crash.", "Dangerous Anti-Pattern: Saving cursor='c_110' before Page 2 is flushed to disk causes permanent silent data loss on crash.");
        b += text(32, 151, orderRule, "dg-text");
        return svg(680, 182, l("Animasi paginasi API dan checkpoint aman", "API pagination and crash-safe checkpoint animation"), b);
      }
    },

    // 6. Parquet Row Groups & Zone-Map Predicate Pushdown
    {
      id: "anim-parquet-zonemap",
      placements: [
        { modId: "mod-2-1", lessonIdx: 1 },
        { modId: "mod-2-6", lessonIdx: 1 }
      ],
      title: {
        id: "Animasi Interaktif: Parquet Row Groups, Statistik Footer (Zone Maps) & Predicate Pushdown",
        en: "Interactive Animation: Parquet Row Groups, Footer Zone-Map Statistics & Predicate Pushdown"
      },
      modes: [
        { id: "pruned", label: { id: "✅ Terurut Tanggal (3 dari 4 Row Group Dilewati!)", en: "✅ Sorted by Date (3 of 4 Row Groups Skipped!)" } },
        { id: "unsorted", label: { id: "🚨 Tidak Terurut (Semua Row Group Terpaksa Dibaca)", en: "🚨 Unsorted Writes (All 4 Row Groups Must Be Scanned)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Query Meminta Data Tanggal 2026-10-19", en: "Step 1: Query Filters WHERE order_date = '2026-10-19'" },
          desc: {
            id: "File Parquet (512 MB) dibagi menjadi 4 Row Group (masing-masing 128 MB) ditambah Footer kecil di ujung file yang menyimpan nilai min/max tiap Row Group.",
            en: "A 512 MB Parquet file is divided into four 128 MB Row Groups plus a tiny Footer at the end storing min/max statistics for each Row Group."
          }
        },
        {
          title: { id: "Langkah 2: Mesin Membaca Footer Parquet Lebih Dulu (Hanya Beberapa KB)", en: "Step 2: Engine Reads the Parquet Footer First (Just a Few Kilobytes)" },
          desc: {
            id: "Sebelum menyentuh blok data 512 MB, DuckDB/Snowflake/Spark membaca statistik min_date dan max_date di Footer.",
            en: "Before touching the 512 MB data blocks, DuckDB/Snowflake/Spark inspects the min_date and max_date statistics in the Footer."
          }
        },
        {
          title: { id: "Langkah 3: Evaluasi Predicate Pushdown (Min/Max Pruning)", en: "Step 3: Predicate Pushdown Evaluation (Min/Max Pruning)" },
          desc: {
            id: "Jika data terurut, hanya Row Group #3 (Oct 15..Oct 21) yang memuat Oct 19 — RG #1, #2, dan #4 langsung dilewati! Jika data acak, setiap RG memiliki min=Oct 01 & max=Oct 31 sehingga tidak ada yang bisa dilewati.",
            en: "When sorted by date, only Row Group #3 (Oct 15..Oct 21) can contain Oct 19 — RG #1, #2, and #4 are skipped! When unsorted, every RG spans Oct 01..Oct 31 so none can be pruned."
          }
        },
        {
          title: { id: "Langkah 4: Biaya I/O & Kecepatan Query (128 MB vs. 512 MB)", en: "Step 4: I/O Cost & Query Speed Verdict (128 MB vs. 512 MB)" },
          desc: {
            id: "Menyimpan data terurut berdasarkan kolom filter utama menghemat 75% I/O disk dan tagihan scan cloud warehouse tanpa mengubah satu baris SQL pun!",
            en: "Clustering/sorting data by your primary filter column saves 75% of disk I/O and cloud warehouse scan charges without changing a single line of SQL!"
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isPruned = mode === "pruned";
        const rgs = isPruned
          ? [
              { name: "Row Group 1 (128MB)", range: "min: Oct 01 · max: Oct 07", match: false },
              { name: "Row Group 2 (128MB)", range: "min: Oct 08 · max: Oct 14", match: false },
              { name: "Row Group 3 (128MB)", range: "min: Oct 15 · max: Oct 21", match: true },
              { name: "Row Group 4 (128MB)", range: "min: Oct 22 · max: Oct 31", match: false }
            ]
          : [
              { name: "Row Group 1 (128MB)", range: "min: Oct 01 · max: Oct 30", match: true },
              { name: "Row Group 2 (128MB)", range: "min: Oct 02 · max: Oct 31", match: true },
              { name: "Row Group 3 (128MB)", range: "min: Oct 01 · max: Oct 29", match: true },
              { name: "Row Group 4 (128MB)", range: "min: Oct 03 · max: Oct 31", match: true }
            ];
        let b = "";
        b += box(16, 12, 648, 28, step === 1 ? "dg-box dg-good anim-pulse" : "dg-box");
        b += text(28, 30, `Parquet Footer Metadata · Filter: <tspan class="dg-accent">WHERE order_date = '2026-10-19'</tspan>`, "dg-head");

        rgs.forEach((rg, i) => {
          const x = 16 + i * 164;
          let cls = "dg-box";
          if (step >= 2) {
            if (isPruned) cls = rg.match ? "dg-box dg-good anim-pulse" : "dg-box dg-faint";
            else cls = "dg-box dg-bad anim-pulse";
          }
          b += box(x, 52, 156, 86, cls);
          b += text(x + 78, 76, rg.name, "dg-head", "middle");
          b += text(x + 78, 98, rg.range, "dg-muted", "middle");
          const status = step < 2 ? l("Menunggu cek footer", "Awaiting footer check") : (rg.match ? (isPruned ? "✓ DIBACA (Read)" : "✗ TERPAKSA DIBACA") : "⏭ DILEWATI (Skipped)");
          b += text(x + 78, 122, status, rg.match ? (isPruned ? "dg-good-text" : "dg-bad-text") : "dg-muted", "middle");
        });

        b += box(16, 150, 648, 30, isPruned ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box"));
        b += text(28, 169, isPruned
          ? l("✓ Zone-Map Pruning Aktif: Hanya 128 MB dari 512 MB yang dibaca dari S3 (Hemat 75% I/O!).", "✓ Zone-Map Pruning Active: Only 128 MB of 512 MB read from S3 (75% I/O saved!).")
          : l("✗ Zone-Map Gagal Memangkas: Karena tanggal tersebar acak di semua RG, seluruh 512 MB terpaksa didekompresi!", "✗ Zone-Map Pruning Defeated: Because dates are scattered across every RG, all 512 MB must be read!"), "dg-text");
        return svg(680, 192, l("Animasi Parquet Row Group dan Zone-Map Pruning", "Parquet Row Group and Zone-Map Pruning animation"), b);
      }
    },

    // 7. Apache Iceberg Atomic Metadata Pointer Swap vs In-Place Overwrite
    {
      id: "anim-iceberg-atomic",
      placements: [
        { modId: "mod-2-2", lessonIdx: 1 },
        { modId: "mod-2-2", lessonIdx: 2 }
      ],
      title: {
        id: "Animasi Interaktif: Pohon Metadata Apache Iceberg & Atomic Pointer Swap (ACID di S3)",
        en: "Interactive Animation: Apache Iceberg Metadata Tree & Atomic Catalog Pointer Swap"
      },
      modes: [
        { id: "iceberg", label: { id: "✅ Apache Iceberg (Atomic Pointer Swap + Time Travel)", en: "✅ Apache Iceberg (Atomic Pointer Swap + Time Travel)" } },
        { id: "hive", label: { id: "🚨 Folder Hive Lama (Mutasi File Langsung = Pembaca Korupsi!)", en: "🚨 Legacy Hive Folder (In-Place File Mutation = Dirty Reads!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Pembaca Sedang Membaca Snapshot s1 (v1.metadata.json)", en: "Step 1: Concurrent Reader Queries Snapshot s1 (v1.metadata.json)" },
          desc: {
            id: "Katalog menunjuk ke v1.metadata.json → Snapshot s1 → file data_a.parquet. Pembaca analitik mulai memindai tabel.",
            en: "The Catalog points to v1.metadata.json → Snapshot s1 → data_a.parquet. An analytical reader starts scanning the table."
          }
        },
        {
          title: { id: "Langkah 2: Penulis Menulis File Parquet & Manifest Baru Secara Terisolasi", en: "Step 2: Writer Creates New Parquet & Manifest Files in Complete Isolation" },
          desc: {
            id: "Di Iceberg, penulis menulis data_b.parquet dan pohon metadata v2 tanpa menyentuh s1. Di Hive lama, penulis langsung menghapus/menimpa file di dalam folder S3 yang sedang dibaca!",
            en: "In Iceberg, the writer creates data_b.parquet and metadata tree v2 without touching s1. In legacy Hive, the writer deletes/overwrites files directly inside the live S3 folder!"
          }
        },
        {
          title: { id: "Langkah 3: Atomic Compare-and-Swap (CAS) di Katalog (v1 → v2)", en: "Step 3: Atomic Compare-and-Swap (CAS) in the Catalog (v1 → v2)" },
          desc: {
            id: "Dalam 1 operasi atomik, pointer katalog berpindah dari v1 ke v2. Pembaca lama tetap menyelesaikan s1 dengan aman, sedangkan pembaca baru langsung melihat s2!",
            en: "In a single atomic operation, the catalog pointer flips from v1 to v2. Existing readers finish s1 safely, while new readers immediately see s2!"
          }
        },
        {
          title: { id: "Langkah 4: Time Travel & Rollback Instan (VERSION AS OF s1)", en: "Step 4: Instant Time Travel & Rollback (VERSION AS OF s1)" },
          desc: {
            id: "Karena Snapshot s1 dan data_a.parquet tidak ditimpa, Anda bisa menjalankan SELECT * FROM tbl TIMESTAMP AS OF ... atau rollback dalam 1 detik!",
            en: "Because Snapshot s1 and data_a.parquet are immutable, you can run SELECT * FROM tbl VERSION AS OF s1 or roll back a bad deploy in 1 second!"
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isIce = mode === "iceberg";
        let b = "";
        // Catalog box
        const ptr = step >= 2 && isIce ? "current → v2.metadata.json" : "current → v1.metadata.json";
        b += box(220, 12, 240, 32, step === 2 && isIce ? "dg-box dg-good anim-pulse" : "dg-box");
        b += text(340, 32, isIce ? `Iceberg Catalog (${ptr})` : l("Folder S3 Hive: s3://warehouse/orders/", "Hive S3 Folder: s3://warehouse/orders/"), "dg-head", "middle");

        // Left: Snapshot s1
        const s1Cls = isIce ? (step >= 2 ? "dg-box" : "dg-box dg-good") : (step >= 1 ? "dg-box dg-bad anim-pulse" : "dg-box");
        b += box(30, 62, 270, 74, s1Cls);
        b += text(165, 84, isIce ? "Snapshot s1 (v1.metadata.json)" : l("File di Folder S3 Saat Ini", "Files Inside Live S3 Folder"), "dg-head", "middle");
        b += text(165, 106, isIce ? "manifest_1.avro → data_a.parquet" : (step >= 1 ? "⚠️ data_a.parquet DIHAPUS saat sedang dibaca!" : "data_a.parquet"), isIce ? "dg-text" : "dg-bad-text", "middle");
        b += text(165, 124, isIce ? l("Pembaca #1 & Time-Travel tetap aman ✓", "Reader #1 & Time-Travel remain 100% intact ✓") : l("Pembaca gagal: FileNotFoundException / baris hilang!", "Reader crashes: FileNotFoundException / partial rows!"), "dg-muted", "middle");

        // Right: Snapshot s2
        const s2Cls = step === 0 ? "dg-box dg-faint" : (isIce ? "dg-box dg-good anim-pulse" : "dg-box dg-bad");
        b += box(380, 62, 270, 74, s2Cls);
        b += text(515, 84, isIce ? "Snapshot s2 (v2.metadata.json)" : l("Penulis Menimpa Folder Secara Langsung", "Writer Mutating Folder In-Place"), "dg-head", "middle");
        b += text(515, 106, isIce ? (step >= 1 ? "manifest_2.avro → data_b.parquet" : l("(Belum dibuat)", "(Not created yet)")) : "part-001.parquet (setengah tertulis)", "dg-text", "middle");
        b += text(515, 124, isIce ? (step >= 2 ? l("● Aktif untuk semua query baru ✓", "● Active for all new queries ✓") : l("Ditulis terisolasi sebelum pointer pindah", "Written in isolation before pointer swap")) : l("Tidak ada isolasi transaksi ACID", "Zero ACID transaction isolation"), "dg-muted", "middle");

        b += box(30, 148, 620, 30, isIce ? "dg-box dg-good" : "dg-box dg-bad");
        b += text(42, 167, isIce
          ? l("✓ Isolasi Snapshot Penuh: Pembaca tidak pernah mengunci penulis, dan penulis tidak pernah merusak pembaca.", "✓ Full Snapshot Isolation: Readers never block writers, and writers never corrupt concurrent readers.")
          : l("✗ Listing direktori S3 tidak atomik: menimpa file langsung di S3 merusak query yang sedang berjalan.", "✗ S3 directory listing is not atomic: mutating files in place corrupts in-flight queries."), "dg-text");
        return svg(680, 188, l("Animasi pohon metadata Apache Iceberg", "Apache Iceberg metadata tree animation"), b);
      }
    },

    // 8. Spark Narrow vs Wide Shuffle & Key Salting for Skew
    {
      id: "anim-spark-shuffle",
      placements: [
        { modId: "mod-3-0", lessonIdx: 2 },
        { modId: "mod-3-1", lessonIdx: 2 },
        { modId: "mod-3-1", lessonIdx: 4 },
        { modId: "mod-3-1", lessonIdx: 5 }
      ],
      title: {
        id: "Animasi Interaktif: Spark Narrow vs. Wide Shuffle & Key Salting untuk Mengatasi Data Skew",
        en: "Interactive Animation: Spark Narrow vs. Wide Shuffle & Key Salting to Defeat Data Skew"
      },
      modes: [
        { id: "salted", label: { id: "✅ Key Salting / Broadcast (Beban Merata di 3 Executor)", en: "✅ Key Salting / Broadcast (Balanced Across 3 Executors)" } },
        { id: "skewed", label: { id: "🚨 Unsalted Shuffle (90% Data Menumpuk di Executor #1 → OOM!)", en: "🚨 Unsalted Shuffle (90% of Rows Pile onto Executor #1 → OOM!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Stage 1 — Narrow Transformation (filter & map di RAM Lokal)", en: "Step 1: Stage 1 — Narrow Transformation (filter & map in Local RAM)" },
          desc: {
            id: "Operasi WHERE dan SELECT dieksekusi langsung di memori masing-masing Executor tanpa perpindahan data lewat jaringan (zero network shuffle).",
            en: "WHERE and SELECT operations run entirely in each Executor's local RAM with zero network traffic."
          }
        },
        {
          title: { id: "Langkah 2: Batas Stage — GROUP BY store_id Memicu Wide Shuffle!", en: "Step 2: Stage Boundary — GROUP BY store_id Triggers a Wide Network Shuffle!" },
          desc: {
            id: "Untuk menjumlahkan per store_id, Spark harus mengirim baris lintas jaringan menggunakan hash(store_id) % num_partitions. Tapi 90% pesanan berasal dari 'store_JKT'!",
            en: "To aggregate by store_id, Spark must send rows across the network via hash(store_id) % num_partitions. However, 90% of orders belong to 'store_JKT'!"
          }
        },
        {
          title: { id: "Langkah 3: Distribusi Beban Executor Saat Shuffle", en: "Step 3: Executor Partition Load After Shuffle" },
          desc: {
            id: "Tanpa salting, semua baris 'store_JKT' jatuh ke Executor #1 (macet & spill ke disk) sementara Executor #2 & #3 menganggur! Dengan salting (store_JKT_0..2), beban dibagi rata.",
            en: "Without salting, all 'store_JKT' rows hash to Executor #1 (straggler task + disk spill) while Executors #2 & #3 sit idle! With salting (store_JKT_0..2), work splits evenly."
          }
        },
        {
          title: { id: "Langkah 4: Agregasi Akhir & Waktu Selesai Job", en: "Step 4: Final Reduction & Total Job Wall-Clock Time" },
          desc: {
            id: "Shuffle dengan Key Salting (atau AQE Skew Join) selesai dalam 18 detik tanpa OOM. Shuffle timpang macet 45 menit di task terakhir (99% progress bar trap)!",
            en: "Salted shuffle (or AQE Skew Join) finishes in 18 seconds with flat memory. The skewed shuffle hangs for 45 minutes on the last straggler task (the 99% progress bar trap)!"
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isSalted = mode === "salted";
        let b = "";
        // Stage 1 executors
        b += text(20, 22, "Stage 1: Narrow (Map/Filter)", "dg-head");
        [0, 1, 2].forEach((i) => {
          b += box(20, 32 + i * 44, 175, 36, step === 0 ? "dg-box dg-good anim-pulse" : "dg-box");
          b += text(107, 55 + i * 44, `Executor #${i + 1} · 33% rows`, "dg-text", "middle");
        });

        // Network shuffle arrows
        b += text(285, 22, "Wide Shuffle (Network)", "dg-head", "middle");
        b += box(220, 56, 130, 68, step === 1 ? "dg-box dg-good anim-pulse" : "dg-box");
        b += text(285, 84, isSalted ? "hash(key + salt)" : "hash(store_id)", "dg-accent-text", "middle");
        b += text(285, 106, isSalted ? "store_JKT_0..2" : "90% = store_JKT", "dg-muted", "middle");

        // Stage 2 executors
        b += text(380, 22, "Stage 2: Reduce / Agg", "dg-head");
        const loads = isSalted
          ? [
              { lbl: "Executor #1 · 34% (JKT_0) ✓", ok: true },
              { lbl: "Executor #2 · 33% (JKT_1) ✓", ok: true },
              { lbl: "Executor #3 · 33% (JKT_2) ✓", ok: true }
            ]
          : [
              { lbl: "Executor #1 · 92% 💥 SPILL / OOM!", ok: false },
              { lbl: "Executor #2 · 4% (Idle / Menganggur)", ok: true },
              { lbl: "Executor #3 · 4% (Idle / Menganggur)", ok: true }
            ];
        loads.forEach((ld, i) => {
          const cls = step >= 2 ? (ld.ok ? (isSalted ? "dg-box dg-good anim-pulse" : "dg-box dg-faint") : "dg-box dg-bad anim-pulse") : "dg-box";
          b += box(380, 32 + i * 44, 280, 36, cls);
          b += text(520, 55 + i * 44, ld.lbl, !ld.ok && step >= 2 ? "dg-bad-text" : (isSalted && step >= 2 ? "dg-good-text" : "dg-text"), "middle");
        });

        b += box(20, 170, 640, 28, isSalted ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box"));
        b += text(32, 189, isSalted
          ? l("✓ Beban Seimbang: Semua 3 Executor bekerja paralel dan selesai dalam 18 detik.", "✓ Balanced Parallelism: All 3 Executors work in parallel and finish in 18 seconds.")
          : l("✗ Jebakan Progress 99%: 1 task raksasa menahan seluruh job Spark selama 45 menit hingga mati dengan Exit Code 137 (OOM).", "✗ The 99% Progress Trap: 1 straggler task holds back the entire Spark job for 45 minutes until it dies with OOM (Exit 137)."), "dg-text");
        return svg(680, 208, l("Animasi Spark Shuffle dan Data Skew Salting", "Spark Shuffle and Data Skew Salting animation"), b);
      }
    },

    // 9. Postgres WAL -> Debezium CDC -> Kafka Partitions & Consumer Offset Commit
    {
      id: "anim-kafka-cdc",
      placements: [
        { modId: "mod-3-2", lessonIdx: 1 },
        { modId: "mod-3-2", lessonIdx: 3 },
        { modId: "mod-3-2", lessonIdx: 6 }
      ],
      title: {
        id: "Animasi Interaktif: Aliran CDC Postgres WAL → Partisi Kafka & Commit Offset Konsumen",
        en: "Interactive Animation: Postgres WAL CDC → Kafka Partitions & Consumer Offset Commits"
      },
      modes: [
        { id: "manual_commit", label: { id: "✅ Upsert Target Dulu → Baru Commit Offset Kafka", en: "✅ Upsert Target First → Commit Kafka Offset After" } },
        { id: "auto_commit", label: { id: "🚨 Auto-Commit Offset Sebelum Proses Selesai (Data Hilang!)", en: "🚨 Auto-Commit Offset Before Write Finishes (Message Lost!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Aplikasi Mengubah Baris di Postgres → Tercatat di WAL (LSN 904)", en: "Step 1: App Updates Row in Postgres → Appended to WAL (LSN 904)" },
          desc: {
            id: "Tanpa melakukan polling SELECT yang membebani DB, Debezium membaca log transaksi biner (Write-Ahead Log) secara real-time.",
            en: "Without running heavy polling SELECT queries, Debezium tails the binary Write-Ahead Log (WAL) replication slot in real time."
          }
        },
        {
          title: { id: "Langkah 2: Event CDC Dikirim ke Partisi Kafka Berdasarkan Hash Kunci (order_id=42 → P1)", en: "Step 2: CDC Event Routed to Kafka Partition by Key Hash (order_id=42 → P1)" },
          desc: {
            id: "Karena semua perubahan untuk order_id=42 memiliki hash kunci yang sama, semuanya dijamin masuk berurutan ke Partisi P1 (offset 18).",
            en: "Because every change to order_id=42 shares the same key hash, Kafka guarantees strict ordering inside Partition P1 (offset 18)."
          }
        },
        {
          title: { id: "Langkah 3: Consumer Membaca Offset 18 & Menulis ke Warehouse", en: "Step 3: Consumer Reads Offset 18 & Upserts into Target Warehouse" },
          desc: {
            id: "Jika auto-commit aktif, offset 19 langsung dikomit ke Kafka bahkan sebelum penulisan ke warehouse selesai! Jika consumer mati saat itu, pesan 18 hilang.",
            en: "If auto-commit is enabled, offset 19 is committed to Kafka before the warehouse write finishes! If the consumer crashes right then, offset 18 is lost."
          }
        },
        {
          title: { id: "Langkah 4: At-Least-Once + Idempotent Upsert = Efek Tepat Satu Kali", en: "Step 4: At-Least-Once Commit + Idempotent Upsert = Effectively Once" },
          desc: {
            id: "Dengan mematikan auto-commit dan meng-commit offset HANYA setelah MERGE/Upsert sukses, setiap pesan dijamin tiba tanpa duplikasi.",
            en: "By disabling auto-commit and committing the offset ONLY after the target MERGE/Upsert succeeds, zero messages are ever lost or duplicated."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isSafe = mode === "manual_commit";
        let b = "";
        // 1. Postgres WAL
        b += box(16, 24, 140, 96, step === 0 ? "dg-box dg-good anim-pulse" : "dg-box");
        b += text(86, 48, "1. Postgres WAL", "dg-head", "middle");
        b += text(86, 72, "LSN 904 · op: 'u'", "dg-accent-text", "middle");
        b += text(86, 94, "order_id: 42", "dg-muted", "middle");

        // 2. Kafka Partitions
        b += box(180, 24, 170, 96, step === 1 ? "dg-box dg-good anim-pulse" : "dg-box");
        b += text(265, 44, "2. Kafka Topic", "dg-head", "middle");
        b += text(265, 66, "P0: [11][12]", "dg-muted", "middle");
        b += text(265, 86, "P1: [16][17][18 ★]", "dg-good-text", "middle");
        b += text(265, 106, "P2: [08][09]", "dg-muted", "middle");

        // 3. Consumer & Offset
        const cCls = step >= 2 ? (isSafe ? "dg-box dg-good anim-pulse" : "dg-box dg-bad anim-pulse") : "dg-box";
        b += box(374, 24, 288, 96, cCls);
        b += text(518, 48, "3. Consumer → Warehouse Target", "dg-head", "middle");
        b += text(518, 74, isSafe ? "1) MERGE order_id=42 ke Target ✓" : "1) Auto-commit offset=19 terlalu dini!", isSafe ? "dg-good-text" : "dg-bad-text", "middle");
        b += text(518, 96, isSafe ? "2) Commit offset=19 ke Kafka ✓" : "2) Crash sebelum tulis → Offset 18 HILANG!", "dg-text", "middle");

        b += box(16, 134, 646, 30, isSafe ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box"));
        b += text(28, 153, isSafe
          ? l("✓ Urutan Produksi: Baca P1[18] → Upsert Idempoten ke Target → Commit Offset 19.", "✓ Production Order: Poll P1[18] → Idempotent Upsert to Target → Commit Offset 19.")
          : l("✗ Jangan pernah meng-commit offset sebelum data benar-benar tersimpan di sistem tujuan!", "✗ Never commit a consumer offset before the downstream sink has durably written the batch!"), "dg-text");
        return svg(680, 174, l("Animasi CDC Postgres WAL dan Kafka Offset", "Postgres WAL CDC and Kafka Offset animation"), b);
      }
    },

    // 10. Event-Time Watermarks, Window Emission & Late-Event DLQ ( plus RAG Vector HNSW )
    {
      id: "anim-watermark-window",
      placements: [
        { modId: "mod-3-3", lessonIdx: 2 },
        { modId: "mod-4-3", lessonIdx: 2 }
      ],
      title: {
        id: "Animasi Interaktif: Jam Watermark Event-Time, Emisi Window & Penanganan Event Terlambat (DLQ)",
        en: "Interactive Animation: Event-Time Watermark Clock, Window Emission & Late-Data DLQ Routing"
      },
      modes: [
        { id: "event_time", label: { id: "✅ Event-Time + Watermark (2 mnt) + Rute DLQ", en: "✅ Event-Time + Watermark (2 min) + Late DLQ" } },
        { id: "proc_time", label: { id: "🚨 Processing-Time (Jam Server Mencampur Window!)", en: "🚨 Processing-Time (Wall-Clock Corrupts Windows!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Event 10:01 & 10:04 Masuk ke Jendela [10:00, 10:05)", en: "Step 1: Events 10:01 & 10:04 Enter Window [10:00, 10:05)" },
          desc: {
            id: "Event terbaru adalah 10:04. Dengan toleransi keterlambatan 2 menit, Watermark = 10:04 − 2m = 10:02. Jendela [10:00, 10:05) masih terbuka.",
            en: "Newest event is 10:04. With a 2-minute lateness bound, Watermark = 10:04 − 2m = 10:02. Window [10:00, 10:05) remains open."
          }
        },
        {
          title: { id: "Langkah 2: Event Terlambat 10:03 Tiba Saat Watermark Masih 10:02 (Diterima ✓)", en: "Step 2: Out-of-Order Event 10:03 Arrives While Watermark Is 10:02 (Counted ✓)" },
          desc: {
            id: "Meskipun datang terlambat dari HP yang sempat sinyal lemah, jendela [10:00, 10:05) belum ditutup karena Watermark < 10:05. Event 10:03 tetap masuk ke hitungan!",
            en: "Even though it arrived out of order from a flaky mobile connection, window [10:00, 10:05) is still open because Watermark < 10:05. Event 10:03 is counted!"
          }
        },
        {
          title: { id: "Langkah 3: Event 10:07 Tiba → Watermark Maju ke 10:05 → Jendela [10:00, 10:05) Ditutup & Dipancarkan!", en: "Step 3: Event 10:07 Arrives → Watermark Advances to 10:05 → Window [10:00, 10:05) Emits!" },
          desc: {
            id: "Sekarang Watermark = 10:07 − 2m = 10:05. Mesin streaming memancarkan hasil jendela [10:00, 10:05) dan membebaskan memori state-nya.",
            en: "Now Watermark = 10:07 − 2m = 10:05. The stream processor emits the final result for [10:00, 10:05) and frees its window state memory."
          }
        },
        {
          title: { id: "Langkah 4: Event Sangat Terlambat (10:02) Tiba Setelah Jendela Ditutup → Masuk ke Late DLQ!", en: "Step 4: Straggler Event (10:02) Arrives After Window Closed → Routed to Late DLQ!" },
          desc: {
            id: "Daripada dibuang diam-diam atau salah dimasukkan ke jendela 10:05–10:10 (seperti pada Processing-Time), event 10:02 dialihkan ke topik late_events_dlq untuk rekonsiliasi.",
            en: "Instead of being silently dropped or corrupting the 10:05–10:10 window (as Processing-Time does), event 10:02 is routed to late_events_dlq for reconciliation."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isEv = mode === "event_time";
        const wmText = step <= 1 ? "Watermark = 10:02" : "Watermark = 10:05 (Window Emitted!)";
        let b = "";
        // Window 1
        const w1Cls = step >= 2 && isEv ? "dg-box dg-good anim-pulse" : "dg-box";
        b += box(20, 20, 300, 88, w1Cls);
        b += text(170, 42, `Window [10:00, 10:05) · ${step >= 2 && isEv ? l("DIPANCARKAN ✓", "EMITTED ✓") : l("TERBUKA", "OPEN")}`, "dg-head", "middle");
        const w1Events = step === 0 ? "Events: [10:01, 10:04]" : "Events: [10:01, 10:04, 10:03 ✓]";
        b += text(170, 68, w1Events, "dg-good-text", "middle");
        b += text(170, 92, wmText, "dg-accent-text", "middle");

        // Window 2 & DLQ
        b += box(340, 20, 320, 88, step === 3 && !isEv ? "dg-box dg-bad anim-pulse" : "dg-box");
        b += text(500, 42, isEv ? "Window [10:05, 10:10) & Late DLQ" : "Window [10:05, 10:10) (Jam Server)", "dg-head", "middle");
        b += text(500, 68, step >= 2 ? "Window [10:05, 10:10): [10:07]" : l("(Menunggu event >= 10:05)", "(Waiting for events >= 10:05)"), "dg-text", "middle");
        if (step === 3) {
          b += text(500, 92, isEv ? "✓ Straggler 10:02 → late_events_dlq" : "✗ Straggler 10:02 salah masuk ke jendela 10:05!", isEv ? "dg-good-text" : "dg-bad-text", "middle");
        }

        b += box(20, 122, 640, 30, isEv ? "dg-box dg-good" : "dg-box dg-bad");
        b += text(32, 141, isEv
          ? l("✓ Event-Time + Watermark + DLQ menjaga keakuratan metrik per jendela sekaligus menyelamatkan event yang terlambat ekstrem.", "✓ Event-Time + Watermark + DLQ preserves exact window metrics while capturing extreme stragglers for backfill.")
          : l("✗ Processing-Time mencampur event lama dari perangkat offline ke jendela waktu saat ini, merusak laporan per jam!", "✗ Processing-Time dumps old offline events into the current wall-clock window, corrupting hourly analytics!"), "dg-text");
        return svg(680, 162, l("Animasi Watermark dan Late Event DLQ", "Watermark and Late Event DLQ animation"), b);
      }
    },

    // 11. Cloud MPP Warehouse Joins: Co-Located DISTKEY / Replicated ALL vs Network Reshuffle
    {
      id: "anim-mpp-colocated-join",
      placements: [
        { modId: "mod-2-6", lessonIdx: 2 }
      ],
      title: {
        id: "Animasi Interaktif Cloud MPP: Co-Located Join (DISTKEY Sama) vs. Network Redistribution Shuffle",
        en: "Interactive Cloud MPP Animation: Co-Located Join (Matching DISTKEY) vs. Network Redistribution Shuffle"
      },
      modes: [
        { id: "colocated", label: { id: "✅ Co-Located (DISTKEY customer_id di Kedua Tabel)", en: "✅ Co-Located (DISTKEY customer_id on Both Tables)" } },
        { id: "even_shuffle", label: { id: "🚨 Round-Robin EVEN (100% Baris Dikirim Lintas Jaringan!)", en: "🚨 Round-Robin EVEN (100% of Rows Shuffled Over Network!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Data Tersebar di 3 Node Komputasi MPP (Slice 1, 2, 3)", en: "Step 1: Tables Distributed Across 3 MPP Compute Nodes (Slices 1, 2, 3)" },
          desc: {
            id: "Pada mode Co-Located, baris dengan customer_id yang sama dari orders dan customers sudah ditaruh di Node yang sama. Pada mode EVEN, baris dibagi acak (round-robin).",
            en: "In Co-Located mode, matching customer_id rows from orders and customers already live on the same compute node. In EVEN mode, rows are dealt round-robin across nodes."
          }
        },
        {
          title: { id: "Langkah 2: Query JOIN orders ON customer_id Dieksekusi", en: "Step 2: Query JOIN orders ON customer_id Executes" },
          desc: {
            id: "Agar dua baris bisa di-JOIN, keduanya wajib berada di RAM mesin fisik yang sama!",
            en: "For two matching rows to be joined, they must meet inside the RAM of the exact same physical machine!"
          }
        },
        {
          title: { id: "Langkah 3: Lalu Lintas Jaringan Antar-Node (0 Baris vs. Jutaan Baris!)", en: "Step 3: Cross-Node Network Traffic (0 Rows Moved vs. Millions Shuffled!)" },
          desc: {
            id: "Co-Located Join melakukan 0 perpindahan jaringan! Sebaliknya, distribusi EVEN memaksa klaster mengirim jutaan baris fakta menyilang lewat kabel jaringan (DS_BCAST / DS_DIST_BOTH).",
            en: "A Co-Located Join moves 0 bytes over the network! EVEN distribution forces the cluster to hash and transmit millions of rows across the network fabric (DS_DIST_BOTH)."
          }
        },
        {
          title: { id: "Langkah 4: Penggabungan di Koordinator (Leader Node)", en: "Step 4: Final Merge on Coordinator (Leader Node)" },
          desc: {
            id: "Distribusi pada join key utama (atau replikasi ALL untuk tabel dimensi kecil) adalah cara paling ampuh mempercepat join di Redshift, Snowflake, dan BigQuery.",
            en: "Co-locating large tables on their primary join key (or replicating small dimensions with ALL) eliminates network bottlenecks in Redshift, Snowflake, and BigQuery."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isCo = mode === "colocated";
        let b = "";
        const nodes = isCo
          ? [
              { name: "MPP Node 1 (Slice 1)", ord: "orders: [C1, C4]", cust: "customers: [C1, C4]", ok: true },
              { name: "MPP Node 2 (Slice 2)", ord: "orders: [C2, C5]", cust: "customers: [C2, C5]", ok: true },
              { name: "MPP Node 3 (Slice 3)", ord: "orders: [C3, C6]", cust: "customers: [C3, C6]", ok: true }
            ]
          : [
              { name: "MPP Node 1 (Slice 1)", ord: "orders: [C1, C2]", cust: "customers: [C5, C6]", ok: false },
              { name: "MPP Node 2 (Slice 2)", ord: "orders: [C3, C4]", cust: "customers: [C1, C2]", ok: false },
              { name: "MPP Node 3 (Slice 3)", ord: "orders: [C5, C6]", cust: "customers: [C3, C4]", ok: false }
            ];
        nodes.forEach((nd, i) => {
          const x = 18 + i * 218;
          const cls = step >= 2 ? (isCo ? "dg-box dg-good anim-pulse" : "dg-box dg-bad anim-pulse") : "dg-box";
          b += box(x, 18, 206, 98, cls);
          b += text(x + 103, 40, nd.name, "dg-head", "middle");
          b += text(x + 103, 64, nd.ord, "dg-text", "middle");
          b += text(x + 103, 84, nd.cust, isCo ? "dg-good-text" : "dg-bad-text", "middle");
          b += text(x + 103, 104, isCo ? l("✓ Cocok lokal di RAM", "✓ Local RAM match") : l("✗ Beda node! Harus kirim", "✗ Mismatch! Must shuffle"), "dg-muted", "middle");
        });

        b += box(18, 130, 642, 32, isCo ? "dg-box dg-good" : (step >= 2 ? "dg-box dg-bad" : "dg-box"));
        b += text(30, 150, isCo
          ? l("✓ Co-Located Join (DS_DIST_NONE): 0 baris berpindah lewat jaringan · Eksekusi paralel penuh.", "✓ Co-Located Join (DS_DIST_NONE): 0 rows moved across the network · Pure local CPU speed.")
          : l("✗ Network Redistribution (DS_DIST_BOTH): Seluruh tabel harus dikirim silang antar-node sebelum JOIN bisa dimulai!", "✗ Network Redistribution (DS_DIST_BOTH): Tables must be reshuffled across nodes over the network before joining!"), "dg-text");
        return svg(680, 174, l("Animasi join MPP co-located vs network shuffle", "MPP co-located join vs network shuffle animation"), b);
      }
    },

    // 12. Cloud Warehouse Billing: Auto-Suspend Idle Tail vs Workload Isolation
    {
      id: "anim-warehouse-autosuspend",
      placements: [
        { modId: "mod-2-6", lessonIdx: 3 },
        { modId: "mod-3-4", lessonIdx: 3 }
      ],
      title: {
        id: "Animasi Interaktif FinOps Cloud: Tagihan Ekor Idle Auto-Suspend (60 Detik vs. 1 Jam)",
        en: "Interactive Cloud FinOps Animation: Virtual Warehouse Auto-Suspend Idle Tail (60s vs. 1 Hour)"
      },
      modes: [
        { id: "suspend_60s", label: { id: "✅ Auto-Suspend 60d ($188/bln · Tidur Saat Kosong)", en: "✅ 60s Auto-Suspend ($188/mo · Sleeps Between Bursts)" } },
        { id: "suspend_1h", label: { id: "🚨 Auto-Suspend 1 Jam ($995/bln · Menyala Terus!)", en: "🚨 1-Hour Auto-Suspend ($995/mo · Never Sleeps!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Gelombang Query #1 (Pukul 09:00 · Durasi Kerja Nyata: 2 Menit)", en: "Step 1: Query Burst #1 (09:00 AM · Actual Query Work: 2 Minutes)" },
          desc: {
            id: "Warehouse menyala (resume) dan menyelesaikan query dalam 2 menit. Setelah query selesai, argo waktu tunggu (auto-suspend window) mulai berjalan!",
            en: "The virtual warehouse wakes up and finishes the query in 2 minutes. Once the query ends, the auto-suspend countdown clock keeps billing you while idle!"
          }
        },
        {
          title: { id: "Langkah 2: Jeda Tanpa Query (09:02 – 09:40 · Tidak Ada Query Masuk)", en: "Step 2: Quiet Gap Between Queries (09:02 – 09:40 · Zero Queries Running)" },
          desc: {
            id: "Dengan Auto-Suspend 60 detik, warehouse tidur pada pukul 09:03 (hemat 37 menit!). Dengan Auto-Suspend 1 jam, warehouse terus menyala dan menagih kredit penuh tanpa bekerja!",
            en: "With a 60s Auto-Suspend, the warehouse sleeps at 09:03 (saving 37 minutes!). With a 1-hour Auto-Suspend, it stays awake burning full credits doing zero work!"
          }
        },
        {
          title: { id: "Langkah 3: Gelombang Query #2 Masuk pada Pukul 09:40 Reset Timer!", en: "Step 3: Query Burst #2 Arrives at 09:40 and Resets the 1-Hour Idle Timer!" },
          desc: {
            id: "Karena query baru tiba sebelum 1 jam habis, timer auto-suspend 1 jam ter-reset kembali ke nol! Warehouse akhirnya tidak pernah tidur sepanjang hari kerja.",
            en: "Because a new query arrives before the 1-hour window expires, the 1-hour idle timer resets to zero! The warehouse never goes to sleep all day."
          }
        },
        {
          title: { id: "Langkah 4: Perbandingan Tagihan 30 Hari (33 Jam Kerja Nyata: $188 vs. $995)", en: "Step 4: 30-Day Invoice Comparison (33 Hours of Real Work: $188 vs. $995)" },
          desc: {
            id: "Data log 30 hari dari lab (fungsi billed_seconds pada labs/shared/querylog.py) membuktikan: 33 jam kerja nyata hanya menagih 62,5 jam ($188) pada suspend 60 detik, tetapi membengkak menjadi 331,8 jam ($995, 5,3x lipat) pada suspend 1 jam. Asumsi bawaan lab: 1 kredit per jam, $3 per kredit.",
            en: "The lab's 30-day log (billed_seconds on labs/shared/querylog.py) proves it: 33 hours of real work bills 62.5 hours ($188) at 60s auto-suspend, vs. 331.8 hours ($995, 5.3x more) at 1-hour auto-suspend. The lab's default assumptions: 1 credit per hour, $3 per credit."
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isShort = mode === "suspend_60s";
        let b = "";
        b += text(20, 22, l("Garis Waktu Status Virtual Warehouse (09:00 – 10:30)", "Virtual Warehouse Timeline (09:00 – 10:30)"), "dg-head");

        // Timeline blocks
        const slots = [
          { x: 20, w: 95, t: "09:00 (2m)", work: true, sub: l("Query Jalan", "Query Active") },
          { x: 120, w: 195, t: "09:02 – 09:40 (38m)", work: false, sub: isShort ? l("💤 TIDUR ($0)", "💤 SUSPENDED ($0)") : l("🔥 IDLE DITAGIH!", "🔥 BILLED IDLE!") },
          { x: 320, w: 95, t: "09:40 (2m)", work: true, sub: l("Query Jalan", "Query Active") },
          { x: 420, w: 240, t: "09:42 – 10:30 (48m)", work: false, sub: isShort ? l("💤 TIDUR ($0)", "💤 SUSPENDED ($0)") : l("🔥 IDLE DITAGIH!", "🔥 BILLED IDLE!") }
        ];
        slots.forEach((sl, idx) => {
          const activeStep = idx <= step;
          let cls = "dg-box";
          if (activeStep) {
            if (sl.work) cls = "dg-box dg-good anim-pulse";
            else cls = isShort ? "dg-box dg-faint" : "dg-box dg-bad anim-pulse";
          }
          b += box(sl.x, 34, sl.w, 72, cls);
          b += text(sl.x + sl.w / 2, 58, sl.t, "dg-head", "middle");
          b += text(sl.x + sl.w / 2, 84, sl.sub, sl.work ? "dg-good-text" : (isShort ? "dg-muted" : "dg-bad-text"), "middle");
        });

        b += box(20, 120, 640, 32, isShort ? "dg-box dg-good" : "dg-box dg-bad");
        b += text(32, 140, isShort
          ? l("✓ Auto-Suspend 60d + Pisahkan Warehouse Batch & BI: Tagihan 30 hari = $188 (Hemat 81% biaya kredit!).", "✓ 60s Auto-Suspend + Separate Batch & BI Warehouses: 30-day bill = $188 (81% compute credits saved!).")
          : l("✗ Auto-Suspend 1 Jam: Setiap jeda < 60 menit menahan mesin tetap menyala · Tagihan 30 hari = $995 (+429% pemborosan!).", "✗ 1-Hour Auto-Suspend: Every gap < 60m keeps the cluster awake · 30-day bill = $995 (+429% pure idle waste!)."), "dg-text");
        return svg(680, 164, l("Animasi biaya auto-suspend cloud warehouse", "Cloud warehouse auto-suspend billing animation"), b);
      }
    },

    // 13. Cloud VPC Networking: S3 Gateway Endpoint ($0/GB) vs NAT Gateway ($0.045/GB) & Cross-AZ Shuffle
    {
      id: "anim-cloud-network-egress",
      placements: [
        { modId: "mod-3-4", lessonIdx: 2 },
        { modId: "mod-3-4", lessonIdx: 5 }
      ],
      title: {
        id: "Animasi Interaktif Jaringan Cloud: VPC Private Subnet → S3 Gateway Endpoint ($0) vs. NAT Gateway & Pajak Lintas-AZ",
        en: "Interactive Cloud Networking Animation: VPC Private Subnet → S3 Gateway Endpoint ($0) vs. NAT Gateway & Cross-AZ Tax"
      },
      modes: [
        { id: "endpoint_1az", label: { id: "✅ S3 Gateway Endpoint + 1-AZ Shuffle ($0 Biaya Jaringan!)", en: "✅ S3 Gateway Endpoint + Single-AZ Shuffle ($0 Network Tax!)" } },
        { id: "nat_3az", label: { id: "🚨 Lewat NAT Gateway + 3-AZ Shuffle ($14.750/bulan Terbakar!)", en: "🚨 Via NAT Gateway + 3-AZ Shuffle ($14,750/mo Burned!)" } }
      ],
      frames: [
        {
          title: { id: "Langkah 1: Worker Pipeline Berjalan di Private Subnet (10.0.32.0/20)", en: "Step 1: Pipeline Workers Run Inside a Private Subnet (10.0.32.0/20)" },
          desc: {
            id: "Demi keamanan, worker Spark/ETL dan database ditempatkan di Private Subnet tanpa IP publik sehingga tidak bisa disentuh dari internet.",
            en: "For security, Spark/ETL workers and databases sit in a Private Subnet with no public IP so nothing on the internet can reach them."
          }
        },
        {
          title: { id: "Langkah 2: Membaca & Menulis 5 TB/hari ke Amazon S3 (Gateway Endpoint vs. NAT Gateway)", en: "Step 2: Reading & Writing 5 TB/day to Amazon S3 (Gateway Endpoint vs. NAT Gateway)" },
          desc: {
            id: "Tanpa S3 Gateway Endpoint, trafik S3 keluar lewat NAT Gateway di Public Subnet dan kena biaya pemrosesan $0,045/GB ($225/hari = $6.750/bulan)! Dengan S3 Gateway Endpoint, rute langsung lewat jaringan internal AWS seharga $0/GB!",
            en: "Without an S3 Gateway Endpoint, S3 traffic detours through the Public Subnet's NAT Gateway at $0.045/GB ($225/day = $6,750/mo)! An S3 Gateway Endpoint routes directly over AWS's private backbone at $0/GB!"
          }
        },
        {
          title: { id: "Langkah 3: Shuffle 20 TB/hari Antar-Worker (Dalam 1 AZ vs. Menyilang 3 AZ)", en: "Step 3: Shuffling 20 TB/day Between Workers (Single-AZ vs. Crossing 3 AZs)" },
          desc: {
            id: "Trafik di dalam 1 Availability Zone (AZ) gratis ($0). Jika klaster tersebar di 3 AZ, 2/3 trafik shuffle (13.333 GB/hari) menyeberangi batas AZ dengan tarif $0,02/GB ($267/hari = $8.000/bulan)!",
            en: "Traffic inside a single Availability Zone (AZ) is free ($0). Spread across 3 AZs, 2/3 of the shuffle (13,333 GB/day) crosses an AZ boundary at $0.02/GB ($267/day = $8,000/mo)!"
          }
        },
        {
          title: { id: "Langkah 4: Audit Tagihan Jaringan Bulanan ($0 vs. $14.750/bulan)", en: "Step 4: Monthly Cloud Network Bill Verdict ($0 vs. $14,750/month)" },
          desc: {
            id: "Menambahkan 1 blok Terraform aws_vpc_endpoint (gratis) dan menempatkan worker batch di 1 AZ yang sama memangkas $14.750/bulan biaya jaringan tanpa menurunkan kecepatan!",
            en: "Adding one free aws_vpc_endpoint resource in Terraform and pinning batch shuffle workers to a single AZ eliminates $14,750/month in hidden network taxes!"
          }
        }
      ],
      renderSvg(step, mode, l) {
        const isOpt = mode === "endpoint_1az";
        let b = "";
        // Left: VPC Private Subnet
        b += box(16, 18, 210, 102, step >= 2 && !isOpt ? "dg-box dg-bad anim-pulse" : "dg-box dg-good");
        b += text(121, 40, "VPC Private Subnet (10.0.32.0/20)", "dg-head", "middle");
        b += text(121, 64, isOpt ? "Spark Workers (All in AZ-a)" : "Spark Workers (AZ-a ↔ AZ-b ↔ AZ-c)", "dg-text", "middle");
        b += text(121, 86, isOpt ? l("Shuffle 20TB dalam 1 AZ: $0/GB ✓", "20TB Shuffle in 1 AZ: $0/GB ✓") : l("Shuffle Lintas-AZ: $267/hari ✗", "Cross-AZ Shuffle: $267/day ✗"), isOpt ? "dg-good-text" : "dg-bad-text", "middle");
        b += text(121, 106, "Security Group: Internal Only", "dg-muted", "middle");

        // Middle: Route to S3 (Gateway Endpoint vs NAT Gateway)
        const midCls = step >= 1 ? (isOpt ? "dg-box dg-good anim-pulse" : "dg-box dg-bad anim-pulse") : "dg-box";
        b += box(246, 18, 200, 102, midCls);
        b += text(346, 40, isOpt ? "S3 Gateway Endpoint (vpce)" : "NAT Gateway (Public Subnet)", "dg-head", "middle");
        b += text(346, 66, isOpt ? l("Rute Privat Internal AWS", "Private AWS Backbone Route") : l("Keluar via IP Publik NAT", "Detours via Public NAT IP"), "dg-text", "middle");
        b += text(346, 90, isOpt ? "$0.00 / GB ($0/bln) ✓" : "$0.045 / GB ($6,750/bln) ✗", isOpt ? "dg-good-text" : "dg-bad-text", "middle");

        // Right: Amazon S3 Lakehouse Bucket
        b += box(466, 18, 198, 102, "dg-box");
        b += text(565, 40, "Amazon S3 Lakehouse", "dg-head", "middle");
        b += text(565, 66, "5 TB / hari (Parquet/Iceberg)", "dg-accent-text", "middle");
        b += text(565, 90, l("Region Sama (Data Gravity)", "Same Region (Data Gravity)"), "dg-muted", "middle");

        b += box(16, 132, 648, 30, isOpt ? "dg-box dg-good" : "dg-box dg-bad");
        b += text(28, 151, isOpt
          ? l("✓ Arsitektur Jaringan Cloud Optimal: S3 Gateway Endpoint ($0) + 1-AZ Batch Shuffle ($0) = Hemat $14.750/bulan.", "✓ Optimal Cloud Network Architecture: S3 Gateway Endpoint ($0) + Single-AZ Batch Shuffle ($0) = Saves $14,750/mo.")
          : l("✗ Pajak Jaringan Tersembunyi: $6.750/bln (NAT Gateway) + $8.000/bln (Shuffle Lintas-AZ) = $14.750/bln hanya untuk kabel!", "✗ Hidden Cloud Network Tax: $6,750/mo (NAT Gateway) + $8,000/mo (Cross-AZ Shuffle) = $14,750/mo just for moving bytes!"), "dg-text");
        return svg(680, 174, l("Animasi jaringan cloud VPC endpoint vs NAT gateway", "Cloud VPC S3 endpoint vs NAT gateway animation"), b);
      }
    }
  ];

  root.DIAGRAMS = DIAGRAMS;
  root.LESSON_ANIMATIONS = LESSON_ANIMATIONS;
})(typeof window !== "undefined" ? window : globalThis);
