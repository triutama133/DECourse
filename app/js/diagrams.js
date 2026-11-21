// Small explanatory diagrams for the hardest ideas, drawn as inline SVG so they follow the light/dark theme and the language.
// A lesson asks for one with a line of its own:  [[diagram:fanout]]  (see md() in app.js). Each function gets l(id, en).
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

  root.DIAGRAMS = DIAGRAMS;
})(typeof window !== "undefined" ? window : globalThis);
