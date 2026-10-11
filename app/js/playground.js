// In-browser SQL sandbox backed by SQLite (sql.js, compiled to WebAssembly).
// Queries run on a real engine: nothing here is pattern-matched or faked.
// Dialect note: SQLite supports CTEs and window functions, but not QUALIFY,
// DATE - INT arithmetic, or EXTRACT(EPOCH ...). Use julianday() / strftime() instead.

window.SQL_PLAYGROUND = {
  SQL: null,
  db: null,
  datasetKey: null,
  loading: null,

  datasets: {
    ecommerce: {
      name: { id: "E-Commerce (customers & orders)", en: "E-Commerce (customers & orders)" },
      description: {
        id: "Satu tabel dimensi (customers) dan satu tabel fakta (orders). Perhatikan: order 105 berstatus REFUNDED dan pelanggan 6 belum pernah memesan.",
        en: "One dimension table (customers) and one fact table (orders). Note: order 105 is REFUNDED and customer 6 has never ordered."
      },
      setup: `
        CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT, tier TEXT, city TEXT, created_at TEXT);
        CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id), amount REAL, status TEXT, order_date TEXT);
        INSERT INTO customers VALUES
          (1,'Alice Tan','Gold','Jakarta','2026-01-10'),
          (2,'Budi Santoso','Silver','Surabaya','2026-01-15'),
          (3,'Citra Dewi','Platinum','Bandung','2026-02-01'),
          (4,'Doni Prasetyo','Bronze','Medan','2026-02-20'),
          (5,'Eka Putri','Gold','Jakarta','2026-03-05'),
          (6,'Fajar Nugroho','Bronze','Semarang','2026-03-09');
        INSERT INTO orders VALUES
          (101,1,250.00,'COMPLETED','2026-03-01'),
          (102,2,80.50,'COMPLETED','2026-03-02'),
          (103,1,420.00,'COMPLETED','2026-03-05'),
          (104,3,1200.00,'COMPLETED','2026-03-06'),
          (105,2,15.00,'REFUNDED','2026-03-07'),
          (106,4,95.00,'COMPLETED','2026-03-10'),
          (107,5,650.00,'COMPLETED','2026-03-12'),
          (108,1,180.00,'COMPLETED','2026-03-15'),
          (109,3,850.00,'COMPLETED','2026-03-18');`
    },
    logins: {
      name: { id: "Login harian (gaps & islands)", en: "Daily logins (gaps & islands)" },
      description: {
        id: "Tanggal login per pengguna. User 1 melewatkan 4 Maret, user 3 login 5 hari berturut-turut.",
        en: "Login dates per user. User 1 skips March 4; user 3 logs in five days in a row."
      },
      setup: `
        CREATE TABLE logins (user_id INTEGER, login_date TEXT);
        INSERT INTO logins VALUES
          (1,'2026-03-01'),(1,'2026-03-02'),(1,'2026-03-03'),(1,'2026-03-05'),(1,'2026-03-06'),(1,'2026-03-07'),(1,'2026-03-08'),
          (2,'2026-03-01'),(2,'2026-03-03'),(2,'2026-03-04'),
          (3,'2026-03-01'),(3,'2026-03-02'),(3,'2026-03-03'),(3,'2026-03-04'),(3,'2026-03-05');`
    },
    kopiku: {
      name: { id: "KopiKu (dataset kursus)", en: "KopiKu (the course dataset)" },
      description: {
        id: "Toko kopi online dalam versi kecil: 10 pelanggan, 6 produk, 18 pesanan Januari 2026. Jebakan yang sengaja ada: kota NULL, pelanggan tanpa pesanan, pesanan batal dan refund, serta biaya kirim di tabel orders (hati-hati saat di-JOIN ke order_items).",
        en: "The online coffee shop in miniature: 10 customers, 6 products, 18 orders in January 2026. Planted traps: NULL cities, customers with no orders, cancelled and refunded orders, and a shipping fee on orders (careful when joining to order_items)."
      },
      setup: `
        CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT, city TEXT, tier TEXT, signup_date TEXT);
        CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT, origin TEXT, roast TEXT, price_idr INTEGER);
        CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id), order_date TEXT, status TEXT, payment_method TEXT, shipping_fee_idr INTEGER);
        CREATE TABLE order_items (order_id INTEGER REFERENCES orders(order_id), line_no INTEGER, product_id INTEGER REFERENCES products(product_id), qty INTEGER, unit_price_idr INTEGER, PRIMARY KEY (order_id, line_no));
        INSERT INTO customers VALUES
          (1,'Budi Santoso','Jakarta','Gold','2025-11-03'),
          (2,'Siti Aminah','Bandung','Silver','2025-11-20'),
          (3,'Agus Wijaya','Surabaya','Bronze','2025-12-01'),
          (4,'Dewi Lestari','Jakarta','Bronze','2025-12-15'),
          (5,'Rina Pratama',NULL,'Silver','2026-01-02'),
          (6,'Andi Hidayat','Medan','Bronze','2026-01-05'),
          (7,'Wulan Kusuma','Bandung','Gold','2026-01-09'),
          (8,'Fajar Nugroho','Denpasar','Bronze','2026-01-12'),
          (9,'Maya Setiawan','Jakarta','Silver','2026-01-14'),
          (10,'Rizky Saputra',NULL,'Bronze','2026-01-20');
        INSERT INTO products VALUES
          (1,'Gayo Medium 250g','Gayo','medium',85000),
          (2,'Toraja Dark 250g','Toraja','dark',95000),
          (3,'Kintamani Light 250g','Kintamani','light',90000),
          (4,'Flores Medium 250g','Flores','medium',80000),
          (5,'Mandheling Dark 250g','Mandheling','dark',100000),
          (6,'Java Preanger Light 250g','Java Preanger','light',75000);
        INSERT INTO orders VALUES
          (101,1,'2026-01-03','delivered','card',15000),
          (102,1,'2026-01-10','delivered','ewallet',15000),
          (103,2,'2026-01-04','delivered','bank_transfer',20000),
          (104,2,'2026-01-18','cancelled','card',20000),
          (105,3,'2026-01-05','delivered','cod',25000),
          (106,4,'2026-01-06','refunded','card',15000),
          (107,4,'2026-01-21','delivered','ewallet',15000),
          (108,5,'2026-01-07','delivered','bank_transfer',20000),
          (109,6,'2026-01-08','delivered','cod',30000),
          (110,7,'2026-01-09','delivered','card',20000),
          (111,7,'2026-01-15','delivered','card',20000),
          (112,7,'2026-01-27','paid','ewallet',20000),
          (113,9,'2026-01-16','delivered','ewallet',15000),
          (114,9,'2026-01-22','delivered','bank_transfer',15000),
          (115,1,'2026-01-25','shipped','card',15000),
          (116,3,'2026-01-28','delivered','card',25000),
          (117,6,'2026-01-29','cancelled','cod',30000),
          (118,2,'2026-01-30','paid','ewallet',20000);
        INSERT INTO order_items VALUES
          (101,1,2,1,95000),(101,2,1,2,85000),
          (102,1,3,1,90000),
          (103,1,1,1,85000),
          (104,1,4,3,80000),
          (105,1,5,1,100000),(105,2,1,1,85000),
          (106,1,2,1,95000),
          (107,1,6,2,75000),
          (108,1,4,2,80000),(108,2,3,1,90000),
          (109,1,1,1,85000),
          (110,1,2,2,95000),(110,2,5,1,100000),(110,3,6,1,75000),
          (111,1,3,1,90000),
          (112,1,1,3,85000),
          (113,1,5,1,100000),
          (114,1,4,1,80000),(114,2,6,1,75000),
          (115,1,2,1,95000),
          (116,1,3,2,90000),
          (117,1,1,1,85000),
          (118,1,5,2,100000);`
    },
    daily_sales: {
      name: { id: "Penjualan harian per toko (window function)", en: "Daily sales per store (window functions)" },
      description: {
        id: "Omset harian dua toko selama 14 hari. Akhir pekan (Sabtu, Minggu) lebih tinggi. Dipakai untuk rata-rata bergerak.",
        en: "Daily revenue for two stores over 14 days. Weekends (Saturday, Sunday) are higher. Used for moving averages."
      },
      setup: `
        CREATE TABLE daily_sales (store TEXT, day TEXT, revenue INTEGER);
        WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 13)
        INSERT INTO daily_sales
        SELECT 'jakarta', date('2026-01-01', '+' || n || ' day'),
               800000 + ((n * 7) % 9) * 60000 + CASE WHEN strftime('%w', date('2026-01-01', '+' || n || ' day')) IN ('0','6') THEN 200000 ELSE 0 END
        FROM d
        UNION ALL
        SELECT 'bandung', date('2026-01-01', '+' || n || ' day'),
               500000 + ((n * 5 + 3) % 7) * 40000 + CASE WHEN strftime('%w', date('2026-01-01', '+' || n || ' day')) IN ('0','6') THEN 150000 ELSE 0 END
        FROM d;`
    },
    categories: {
      name: { id: "Kategori produk (rekursif)", en: "Product categories (recursive)" },
      description: {
        id: "Pohon kategori produk: setiap baris menunjuk ke induknya lewat parent_id (NULL untuk akar).",
        en: "A product category tree: each row points to its parent through parent_id (NULL for the root)."
      },
      setup: `
        CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, parent_id INTEGER REFERENCES categories(id));
        INSERT INTO categories VALUES
          (1,'Coffee',NULL),(2,'Beans',1),(3,'Gear',1),(4,'Single Origin',2),(5,'Blends',2),
          (6,'Grinders',3),(7,'Brewers',3),(8,'Gayo',4),(9,'Toraja',4),
          (10,'Hand Grinders',6),(11,'Electric Grinders',6),(12,'V60',7);`
    },
    scd_demo: {
      name: { id: "Dimensi pelanggan SCD Type 2", en: "Customer dimension (SCD Type 2)" },
      description: {
        id: "customer_changes adalah umpan perubahan; dim_customer adalah dimensi Type 2 yang sudah jadi; orders_small berisi 6 pesanan. Dipakai untuk modul pemodelan dimensional.",
        en: "customer_changes is the change feed; dim_customer is a finished Type 2 dimension; orders_small holds 6 orders. Used by the dimensional modeling module."
      },
      setup: `
        CREATE TABLE customer_changes (customer_id INTEGER, city TEXT, tier TEXT, effective_ts TEXT);
        INSERT INTO customer_changes VALUES
          (1,'Jakarta','Silver','2026-01-01 09:00:00'),
          (1,'Jakarta','Gold','2026-01-10 14:30:00'),
          (1,'Bandung','Gold','2026-01-20 08:15:00'),
          (2,'Surabaya','Bronze','2026-01-02 10:00:00'),
          (3,'Medan','Bronze','2026-01-03 11:45:00'),
          (3,'Medan','Silver','2026-01-15 16:20:00');
        CREATE TABLE dim_customer (customer_sk INTEGER PRIMARY KEY, customer_id INTEGER, city TEXT, tier TEXT, valid_from TEXT, valid_to TEXT, is_current INTEGER);
        INSERT INTO dim_customer VALUES
          (1,1,'Jakarta','Silver','2026-01-01 09:00:00','2026-01-10 14:30:00',0),
          (2,1,'Jakarta','Gold','2026-01-10 14:30:00','2026-01-20 08:15:00',0),
          (3,1,'Bandung','Gold','2026-01-20 08:15:00','9999-12-31 00:00:00',1),
          (4,2,'Surabaya','Bronze','2026-01-02 10:00:00','9999-12-31 00:00:00',1),
          (5,3,'Medan','Bronze','2026-01-03 11:45:00','2026-01-15 16:20:00',0),
          (6,3,'Medan','Silver','2026-01-15 16:20:00','9999-12-31 00:00:00',1);
        CREATE TABLE orders_small (order_id INTEGER PRIMARY KEY, customer_id INTEGER, order_ts TEXT, total_idr INTEGER);
        INSERT INTO orders_small VALUES
          (1,1,'2026-01-05 10:00:00',100000),
          (2,1,'2026-01-12 12:00:00',200000),
          (3,1,'2026-01-25 09:00:00',150000),
          (4,2,'2026-01-03 09:00:00',80000),
          (5,3,'2026-01-20 18:00:00',120000),
          (6,3,'2026-01-05 18:00:00',60000);`
    },
    clickstream: {
      name: { id: "Clickstream (sessionization)", en: "Clickstream (sessionization)" },
      description: {
        id: "Klik per pengguna dengan timestamp. Dipakai oleh lab Modul 1.3: sesi baru dimulai setelah 30 menit tidak aktif.",
        en: "Clicks per user with timestamps. Used by the Module 1.3 lab: a new session starts after 30 minutes of inactivity."
      },
      setup: `
        CREATE TABLE user_clickstream (user_id INTEGER, event_time TEXT, page TEXT);
        INSERT INTO user_clickstream VALUES
          (1,'2026-03-01 09:00:00','/home'),
          (1,'2026-03-01 09:10:00','/search'),
          (1,'2026-03-01 09:25:00','/product/7'),
          (1,'2026-03-01 10:40:00','/cart'),
          (1,'2026-03-01 10:50:00','/checkout'),
          (2,'2026-03-01 08:00:00','/home'),
          (2,'2026-03-01 08:45:00','/home'),
          (2,'2026-03-01 08:50:00','/search'),
          (3,'2026-03-01 12:00:00','/home');`
    }
  },

  // Exercises: the learner's result is compared with the reference query's result.
  challenges: [
    {
      id: "ch-1",
      module: "extra",
      dataset: "ecommerce",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Total belanja per pelanggan", en: "Total spend per customer" },
      task: {
        id: "Tampilkan name dan total_spent (jumlah amount) hanya dari order berstatus COMPLETED, untuk setiap pelanggan yang punya order tersebut.",
        en: "Return name and total_spent (sum of amount) using only COMPLETED orders, for every customer that has at least one."
      },
      hint: {
        id: "JOIN customers ke orders, filter status di WHERE, lalu GROUP BY name.",
        en: "JOIN customers to orders, filter status in WHERE, then GROUP BY name."
      },
      solution: `SELECT c.name, SUM(o.amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.name
ORDER BY total_spent DESC;`
    },
    {
      id: "ch-2",
      module: "extra",
      dataset: "ecommerce",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pelanggan tanpa order (NULL & LEFT JOIN)", en: "Customers without orders (NULL & LEFT JOIN)" },
      task: {
        id: "Tampilkan name semua pelanggan yang belum pernah punya order sama sekali (apa pun statusnya).",
        en: "Return the name of every customer that has never placed any order (any status)."
      },
      hint: {
        id: "LEFT JOIN lalu cari baris yang kolom orders-nya IS NULL. Hati-hati: jangan taruh filter status di WHERE.",
        en: "LEFT JOIN, then keep rows where the orders column IS NULL. Careful: do not put a status filter in WHERE."
      },
      solution: `SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;`
    },
    {
      id: "ch-3",
      module: "mod-1-3",
      dataset: "logins",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Streak login terpanjang (gaps & islands)", en: "Longest login streak (gaps & islands)" },
      task: {
        id: "Tampilkan user_id dan longest_streak (jumlah hari berturut-turut terpanjang) untuk setiap pengguna.",
        en: "Return user_id and longest_streak (longest run of consecutive days) for every user."
      },
      hint: {
        id: "Tanggal dikurangi nomor urut baris bernilai konstan di dalam satu streak. Di SQLite pakai julianday(login_date) - ROW_NUMBER() OVER (...).",
        en: "Date minus row number is constant inside one streak. In SQLite use julianday(login_date) - ROW_NUMBER() OVER (...)."
      },
      solution: `WITH grouped AS (
  SELECT user_id, login_date,
         julianday(login_date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS grp
  FROM logins
),
streaks AS (
  SELECT user_id, grp, COUNT(*) AS days FROM grouped GROUP BY user_id, grp
)
SELECT user_id, MAX(days) AS longest_streak
FROM streaks
GROUP BY user_id;`
    },
    {
      id: "ch-4",
      module: "mod-1-3",
      dataset: "clickstream",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Sessionization (Lab 1.3)", en: "Sessionization (Lab 1.3)" },
      task: {
        id: "Tampilkan user_id, session_id, dan clicks (jumlah klik) per sesi. Sesi baru dimulai bila jeda dari klik sebelumnya lebih dari 30 menit.",
        en: "Return user_id, session_id and clicks (click count) per session. A new session starts when the gap from the previous click exceeds 30 minutes."
      },
      hint: {
        id: "LAG() untuk waktu sebelumnya, tandai sesi baru dengan 1/0, lalu SUM() kumulatif sebagai session_id. Selisih detik: strftime('%s', a) - strftime('%s', b).",
        en: "Use LAG() for the previous time, flag new sessions with 1/0, then a running SUM() as session_id. Seconds between: strftime('%s', a) - strftime('%s', b)."
      },
      solution: `WITH lagged AS (
  SELECT user_id, event_time,
         LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_time
  FROM user_clickstream
),
flagged AS (
  SELECT user_id, event_time,
         CASE WHEN prev_time IS NULL
                OR strftime('%s', event_time) - strftime('%s', prev_time) > 1800
              THEN 1 ELSE 0 END AS is_new
  FROM lagged
),
sessions AS (
  SELECT user_id, event_time,
         SUM(is_new) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
  FROM flagged
)
SELECT user_id, session_id, COUNT(*) AS clicks
FROM sessions
GROUP BY user_id, session_id;`
    },
    {
      id: "k-1",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Pelanggan dari Jakarta", en: "Customers from Jakarta" },
      task: {
        id: "Tampilkan name dan tier semua pelanggan yang kotanya Jakarta.",
        en: "Return the name and tier of every customer whose city is Jakarta."
      },
      hint: {
        id: "Filter dengan WHERE city = 'Jakarta'. Teks di SQL memakai tanda kutip tunggal.",
        en: "Filter with WHERE city = 'Jakarta'. Text literals in SQL use single quotes."
      },
      solution: `SELECT name, tier
FROM customers
WHERE city = 'Jakarta';`
    },
    {
      id: "k-2",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Jumlah pesanan per status", en: "Orders per status" },
      task: {
        id: "Tampilkan status dan orders (jumlah pesanan) untuk setiap status.",
        en: "Return status and orders (the number of orders) for each status."
      },
      hint: {
        id: "GROUP BY status lalu COUNT(*).",
        en: "GROUP BY status, then COUNT(*)."
      },
      solution: `SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status;`
    },
    {
      id: "k-3",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Nilai tiap pesanan", en: "Value of each order" },
      task: {
        id: "Tampilkan order_id dan order_total, yaitu jumlah qty * unit_price_idr dari semua barisnya.",
        en: "Return order_id and order_total: the sum of qty * unit_price_idr over its lines."
      },
      hint: {
        id: "Hitung per baris dulu (qty * unit_price_idr), lalu SUM dan GROUP BY order_id.",
        en: "Compute per line first (qty * unit_price_idr), then SUM and GROUP BY order_id."
      },
      solution: `SELECT order_id, SUM(qty * unit_price_idr) AS order_total
FROM order_items
GROUP BY order_id;`
    },
    {
      id: "k-4",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Jebakan NULL: bukan Jakarta", en: "The NULL trap: not Jakarta" },
      task: {
        id: "Tampilkan name semua pelanggan yang kotanya bukan Jakarta, TERMASUK yang kotanya tidak diketahui (NULL).",
        en: "Return the name of every customer whose city is not Jakarta, INCLUDING customers whose city is unknown (NULL)."
      },
      hint: {
        id: "city <> 'Jakarta' tidak pernah benar untuk NULL (hasilnya UNKNOWN). Tambahkan OR city IS NULL.",
        en: "city <> 'Jakarta' is never true for NULL (the result is UNKNOWN). Add OR city IS NULL."
      },
      solution: `SELECT name
FROM customers
WHERE city <> 'Jakarta' OR city IS NULL;`
    },
    {
      id: "k-5",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pelanggan tanpa pesanan", en: "Customers who never ordered" },
      task: {
        id: "Tampilkan name pelanggan yang belum pernah membuat pesanan apa pun.",
        en: "Return the name of every customer who has never placed any order."
      },
      hint: {
        id: "LEFT JOIN dari customers ke orders, lalu cari baris yang order_id-nya IS NULL.",
        en: "LEFT JOIN from customers to orders, then keep rows whose order_id IS NULL."
      },
      solution: `SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;`
    },
    {
      id: "k-6",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Omset per kota (kota NULL jadi Unknown)", en: "Revenue per city (NULL city becomes Unknown)" },
      task: {
        id: "Tampilkan city dan revenue untuk pesanan berstatus delivered. Kota NULL ditampilkan sebagai 'Unknown'. revenue = jumlah qty * unit_price_idr.",
        en: "Return city and revenue for delivered orders only. A NULL city must appear as 'Unknown'. revenue = sum of qty * unit_price_idr."
      },
      hint: {
        id: "JOIN customers, orders, order_items. COALESCE(c.city, 'Unknown') untuk NULL, lalu GROUP BY ekspresi yang sama.",
        en: "JOIN customers, orders, order_items. Use COALESCE(c.city, 'Unknown') for NULL, then GROUP BY the same expression."
      },
      solution: `SELECT COALESCE(c.city, 'Unknown') AS city, SUM(i.qty * i.unit_price_idr) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'delivered'
GROUP BY COALESCE(c.city, 'Unknown');`
    },
    {
      id: "k-7",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pelanggan setia (HAVING)", en: "Repeat customers (HAVING)" },
      task: {
        id: "Tampilkan name dan delivered_orders untuk pelanggan dengan minimal 2 pesanan berstatus delivered.",
        en: "Return name and delivered_orders for customers with at least 2 delivered orders."
      },
      hint: {
        id: "Filter baris dengan WHERE (status), filter kelompok dengan HAVING COUNT(*) >= 2.",
        en: "Filter rows with WHERE (status), filter groups with HAVING COUNT(*) >= 2."
      },
      solution: `SELECT c.name, COUNT(*) AS delivered_orders
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'delivered'
GROUP BY c.customer_id, c.name
HAVING COUNT(*) >= 2;`
    },
    {
      id: "k-8",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Jebakan fan-out: biaya kirim", en: "The fan-out trap: shipping fees" },
      task: {
        id: "Tampilkan satu angka, shipping_total: total shipping_fee_idr dari pesanan berstatus delivered. Setiap pesanan harus dihitung SEKALI.",
        en: "Return a single number, shipping_total: the sum of shipping_fee_idr over delivered orders. Every order must be counted ONCE."
      },
      hint: {
        id: "Jangan JOIN ke order_items: satu pesanan punya banyak baris, sehingga biaya kirimnya terhitung berkali-kali. Cukup tabel orders.",
        en: "Do not JOIN to order_items: an order has several lines, so its fee would be counted several times. The orders table alone is enough."
      },
      solution: `SELECT SUM(shipping_fee_idr) AS shipping_total
FROM orders
WHERE status = 'delivered';`
    },
    {
      id: "k-9",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Ukuran pesanan (CASE + CTE)", en: "Order size bands (CASE + CTE)" },
      task: {
        id: "Tampilkan order_id dan size: 'small' bila order_total < 100000, 'medium' bila < 200000, selain itu 'large'.",
        en: "Return order_id and size: 'small' if order_total < 100000, 'medium' if < 200000, otherwise 'large'."
      },
      hint: {
        id: "Hitung total per pesanan di sebuah CTE (WITH ... AS), lalu CASE WHEN di query luar.",
        en: "Compute each order's total in a CTE (WITH ... AS), then CASE WHEN in the outer query."
      },
      solution: `WITH totals AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id,
       CASE WHEN order_total < 100000 THEN 'small'
            WHEN order_total < 200000 THEN 'medium'
            ELSE 'large' END AS size
FROM totals;`
    },
    {
      id: "k-10",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Porsi tiap metode bayar", en: "Share of each payment method" },
      task: {
        id: "Tampilkan payment_method, orders, dan pct: persentase dari seluruh pesanan, dibulatkan 1 desimal.",
        en: "Return payment_method, orders and pct: its percentage of all orders, rounded to 1 decimal."
      },
      hint: {
        id: "Pembagi bisa subquery skalar: (SELECT COUNT(*) FROM orders). Kalikan 100.0 agar bukan pembagian bilangan bulat.",
        en: "The denominator can be a scalar subquery: (SELECT COUNT(*) FROM orders). Multiply by 100.0 to avoid integer division."
      },
      solution: `SELECT payment_method,
       COUNT(*) AS orders,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS pct
FROM orders
GROUP BY payment_method;`
    },
    {
      id: "w-1",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Total berjalan per pelanggan", en: "Running total per customer" },
      task: {
        id: "Tampilkan customer_id, order_id, order_total, dan running_total: jumlah kumulatif order_total pelanggan itu, diurutkan menurut order_date lalu order_id.",
        en: "Return customer_id, order_id, order_total and running_total: the cumulative sum of that customer's order_total, ordered by order_date then order_id."
      },
      hint: {
        id: "Hitung total tiap pesanan di CTE, lalu SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date, order_id).",
        en: "Compute each order's total in a CTE, then SUM(...) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)."
      },
      solution: `WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.customer_id, o.order_id, t.order_total,
       SUM(t.order_total) OVER (PARTITION BY o.customer_id ORDER BY o.order_date, o.order_id
                                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders o
JOIN t ON t.order_id = o.order_id;`
    },
    {
      id: "w-2",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pesanan terbaru tiap pelanggan", en: "Latest order per customer" },
      task: {
        id: "Tampilkan customer_id dan order_id dari pesanan TERBARU (order_date terbesar) setiap pelanggan.",
        en: "Return customer_id and the order_id of each customer's LATEST order (largest order_date)."
      },
      hint: {
        id: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) lalu ambil yang bernilai 1. Pola ini juga dipakai untuk deduplikasi.",
        en: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC), then keep rank 1. This is also the de-duplication pattern."
      },
      solution: `WITH ranked AS (
  SELECT customer_id, order_id,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
SELECT customer_id, order_id
FROM ranked
WHERE rn = 1;`
    },
    {
      id: "w-3",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Jarak antar pesanan (LAG)", en: "Gap between orders (LAG)" },
      task: {
        id: "Tampilkan customer_id, order_id, dan days_since_prev: jumlah hari sejak pesanan sebelumnya pelanggan itu (NULL untuk pesanan pertama).",
        en: "Return customer_id, order_id and days_since_prev: days since that customer's previous order (NULL for the first order)."
      },
      hint: {
        id: "LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date), lalu julianday(a) - julianday(b). Bungkus dengan CAST(... AS INTEGER).",
        en: "LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date), then julianday(a) - julianday(b). Wrap with CAST(... AS INTEGER)."
      },
      solution: `SELECT customer_id, order_id,
       CAST(julianday(order_date) - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)) AS INTEGER) AS days_since_prev
FROM orders;`
    },
    {
      id: "w-4",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Porsi pesanan terhadap total pelanggan", en: "Order share of the customer's total" },
      task: {
        id: "Tampilkan order_id dan pct_of_customer: persentase order_total terhadap jumlah seluruh pesanan pelanggan yang sama, dibulatkan 1 desimal.",
        en: "Return order_id and pct_of_customer: the order's share of that customer's total across all their orders, rounded to 1 decimal."
      },
      hint: {
        id: "SUM(order_total) OVER (PARTITION BY customer_id) tanpa ORDER BY memberi total seluruh partisi pada setiap baris.",
        en: "SUM(order_total) OVER (PARTITION BY customer_id) without ORDER BY gives the whole partition total on every row."
      },
      solution: `WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT o.order_id,
       ROUND(100.0 * t.order_total / SUM(t.order_total) OVER (PARTITION BY o.customer_id), 1) AS pct_of_customer
FROM orders o
JOIN t ON t.order_id = o.order_id;`
    },
    {
      id: "w-5",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Peringkat dengan nilai kembar", en: "Ranking with ties" },
      task: {
        id: "Tampilkan order_id, order_total, dan rnk: peringkat dari total terbesar (1 = terbesar). Pesanan dengan total sama harus berperingkat sama, dan peringkat berikutnya TIDAK boleh melompat.",
        en: "Return order_id, order_total and rnk: rank by total, largest first (1 = largest). Orders with equal totals share a rank, and the next rank must NOT skip."
      },
      hint: {
        id: "Ada tiga fungsi peringkat. Satu melompat setelah nilai kembar (RANK), satu tidak (DENSE_RANK), satu memberi nomor unik (ROW_NUMBER).",
        en: "There are three ranking functions: one skips after ties (RANK), one does not (DENSE_RANK), one gives unique numbers (ROW_NUMBER)."
      },
      solution: `WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, order_total, DENSE_RANK() OVER (ORDER BY order_total DESC) AS rnk
FROM t;`
    },
    {
      id: "w-6",
      module: "mod-1-3",
      dataset: "daily_sales",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Rata-rata bergerak 7 hari", en: "7-day moving average" },
      task: {
        id: "Tampilkan store, day, dan avg_7d: rata-rata revenue pada hari itu dan 6 hari sebelumnya di toko yang sama (di awal data pakai baris yang tersedia), dibulatkan ke bilangan bulat.",
        en: "Return store, day and avg_7d: the average revenue of that day and the 6 days before it in the same store (use the rows available at the start), rounded to a whole number."
      },
      hint: {
        id: "AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW).",
        en: "AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)."
      },
      solution: `SELECT store, day,
       ROUND(AVG(revenue) OVER (PARTITION BY store ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)) AS avg_7d
FROM daily_sales;`
    },
    {
      id: "w-7",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Kuartil pesanan (NTILE)", en: "Order quartiles (NTILE)" },
      task: {
        id: "Tampilkan order_id dan quartile (1 sampai 4): bagi semua pesanan menurut order_total dari terkecil ke terbesar menjadi 4 kelompok sama besar sebisanya. Urutkan seri dengan order_id.",
        en: "Return order_id and quartile (1 to 4): split all orders by order_total, smallest first, into 4 groups as equal as possible. Break ties by order_id."
      },
      hint: {
        id: "NTILE(4) OVER (ORDER BY order_total, order_id). Dengan 18 pesanan, kelompok awal mendapat satu baris lebih banyak.",
        en: "NTILE(4) OVER (ORDER BY order_total, order_id). With 18 orders the first groups get one extra row."
      },
      solution: `WITH t AS (
  SELECT order_id, SUM(qty * unit_price_idr) AS order_total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, NTILE(4) OVER (ORDER BY order_total, order_id) AS quartile
FROM t;`
    },
    {
      id: "w-8",
      module: "mod-1-3",
      dataset: "categories",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Pohon kategori (CTE rekursif)", en: "Category tree (recursive CTE)" },
      task: {
        id: "Tampilkan id, depth (akar = 0), dan path berbentuk 'Coffee > Beans > Single Origin > Gayo' untuk setiap kategori.",
        en: "Return id, depth (root = 0) and path like 'Coffee > Beans > Single Origin > Gayo' for every category."
      },
      hint: {
        id: "WITH RECURSIVE: bagian awal memilih akar (parent_id IS NULL), bagian rekursif menggabungkan anak ke baris sebelumnya dan menambah depth + 1.",
        en: "WITH RECURSIVE: the anchor selects the root (parent_id IS NULL); the recursive part joins children to the previous rows and adds depth + 1."
      },
      solution: `WITH RECURSIVE tree AS (
  SELECT id, name, 0 AS depth, name AS path
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, tree.depth + 1, tree.path || ' > ' || c.name
  FROM categories c
  JOIN tree ON c.parent_id = tree.id
)
SELECT id, depth, path FROM tree;`
    },
    {
      id: "d-1",
      module: "mod-1-4",
      dataset: "scd_demo",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Bangun dimensi SCD Type 2", en: "Build the SCD Type 2 dimension" },
      task: {
        id: "Dari customer_changes, tampilkan customer_id, city, tier, valid_from, valid_to, dan is_current. valid_to adalah effective_ts versi berikutnya milik pelanggan yang sama, atau '9999-12-31 00:00:00' untuk versi terakhir (is_current = 1, selain itu 0).",
        en: "From customer_changes, return customer_id, city, tier, valid_from, valid_to and is_current. valid_to is the next version's effective_ts for the same customer, or '9999-12-31 00:00:00' for the last version (is_current = 1, otherwise 0)."
      },
      hint: {
        id: "LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts) memberi valid_to sekaligus nilai bawaan untuk baris terakhir.",
        en: "LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts) gives valid_to and the default for the last row."
      },
      solution: `WITH v AS (\n  SELECT customer_id, city, tier,\n         effective_ts AS valid_from,\n         LEAD(effective_ts, 1, '9999-12-31 00:00:00') OVER (PARTITION BY customer_id ORDER BY effective_ts) AS valid_to\n  FROM customer_changes\n)\nSELECT customer_id, city, tier, valid_from, valid_to,\n       CASE WHEN valid_to = '9999-12-31 00:00:00' THEN 1 ELSE 0 END AS is_current\nFROM v;`
    },
    {
      id: "d-2",
      module: "mod-1-4",
      dataset: "scd_demo",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Tier saat pembelian (as-of join)", en: "Tier at time of purchase (as-of join)" },
      task: {
        id: "Dari orders_small dan dim_customer, tampilkan order_id dan tier pelanggan PADA SAAT pesanan dibuat.",
        en: "From orders_small and dim_customer, return order_id and the customer's tier AT THE TIME the order was placed."
      },
      hint: {
        id: "Join pada customer_id DAN rentang waktu: order_ts >= valid_from AND order_ts < valid_to. Tanpa rentang, satu pesanan muncul sekali per versi.",
        en: "Join on customer_id AND the time range: order_ts >= valid_from AND order_ts < valid_to. Without the range an order appears once per version."
      },
      solution: `SELECT o.order_id, c.tier\nFROM orders_small o\nJOIN dim_customer c\n  ON c.customer_id = o.customer_id\n AND o.order_ts >= c.valid_from\n AND o.order_ts < c.valid_to;`
    },
    {
      id: "d-3",
      module: "mod-1-4",
      dataset: "scd_demo",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Omset per tier saat pembelian", en: "Revenue per tier at purchase" },
      task: {
        id: "Tampilkan tier dan revenue (jumlah total_idr) per tier pelanggan pada saat pesanan dibuat.",
        en: "Return tier and revenue (sum of total_idr) per customer tier at the time the order was placed."
      },
      hint: {
        id: "Pakai join as-of dari tantangan sebelumnya, lalu GROUP BY c.tier. Periksa bahwa jumlah seluruh revenue sama dengan jumlah total_idr di orders_small (tidak ada baris ganda).",
        en: "Use the as-of join from the previous challenge, then GROUP BY c.tier. Check that the grand total equals the sum of total_idr in orders_small (no duplicated rows)."
      },
      solution: `SELECT c.tier, SUM(o.total_idr) AS revenue\nFROM orders_small o\nJOIN dim_customer c\n  ON c.customer_id = o.customer_id\n AND o.order_ts >= c.valid_from\n AND o.order_ts < c.valid_to\nGROUP BY c.tier;`
    },
    {
      id: "d-4",
      module: "mod-1-4",
      dataset: "scd_demo",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Dimensi tanggal dari kalender", en: "A date dimension from the calendar" },
      task: {
        id: "Tampilkan date_key (YYYYMMDD sebagai bilangan bulat), full_date, day_name, dan is_weekend untuk 7 hari mulai 2026-01-01, termasuk hari tanpa data. day_name: 'Sunday'..'Saturday'; is_weekend = 1 untuk Sabtu dan Minggu.",
        en: "Return date_key (YYYYMMDD as an integer), full_date, day_name and is_weekend for 7 days starting 2026-01-01, including days with no data. day_name: 'Sunday'..'Saturday'; is_weekend = 1 for Saturday and Sunday."
      },
      hint: {
        id: "WITH RECURSIVE membangkitkan 7 tanggal. strftime('%w', d) memberi 0 untuk Minggu sampai 6 untuk Sabtu.",
        en: "WITH RECURSIVE generates the 7 dates. strftime('%w', d) gives 0 for Sunday through 6 for Saturday."
      },
      solution: `WITH RECURSIVE days(d) AS (\n  SELECT date('2026-01-01')\n  UNION ALL\n  SELECT date(d, '+1 day') FROM days WHERE d < '2026-01-07'\n)\nSELECT CAST(strftime('%Y%m%d', d) AS INTEGER) AS date_key,\n       d AS full_date,\n       CASE strftime('%w', d) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'\n            WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' ELSE 'Saturday' END AS day_name,\n       CASE WHEN strftime('%w', d) IN ('0', '6') THEN 1 ELSE 0 END AS is_weekend\nFROM days;`
    },
    {
      id: "k-11",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pelanggan berulang (Repeat buyers)", en: "Repeat buyers (Cohort analysis)" },
      task: {
        id: "Tampilkan name, order_count (jumlah pesanan unik), dan total_spend (jumlah nilai item belanja) untuk pelanggan yang memiliki lebih dari 1 pesanan. Urutkan dari total_spend terbesar.",
        en: "Return name, order_count (distinct orders) and total_spend (sum of item totals) for customers with more than 1 order. Order by total_spend descending."
      },
      hint: {
        id: "JOIN customers, orders, order_items. GROUP BY c.customer_id, c.name HAVING COUNT(DISTINCT o.order_id) > 1 ORDER BY total_spend DESC.",
        en: "JOIN customers, orders, order_items. GROUP BY c.customer_id, c.name HAVING COUNT(DISTINCT o.order_id) > 1 ORDER BY total_spend DESC."
      },
      solution: `SELECT c.name, COUNT(DISTINCT o.order_id) AS order_count, SUM(i.qty * i.unit_price_idr) AS total_spend
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT o.order_id) > 1
ORDER BY total_spend DESC;`
    },
    {
      id: "k-12",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Produk yang tidak pernah dibeli pelanggan Surabaya (Anti-join)", en: "Products no Surabaya customer ever bought (Anti-join)" },
      task: {
        id: "Tampilkan name dan origin dari semua produk yang tidak pernah muncul di pesanan milik pelanggan yang kotanya Surabaya (apa pun status pesanannya).",
        en: "Return name and origin for every product that never appears in an order placed by a customer whose city is Surabaya (any order status)."
      },
      hint: {
        id: "Buat subquery: product_id yang dibeli pelanggan Surabaya (order_items JOIN orders JOIN customers). LEFT JOIN products ke subquery itu lalu simpan baris yang kolomnya IS NULL.",
        en: "Build a subquery of the product_ids bought by Surabaya customers (order_items JOIN orders JOIN customers). LEFT JOIN products to it and keep the rows where its column IS NULL."
      },
      solution: `SELECT p.name, p.origin
FROM products p
LEFT JOIN (
  SELECT DISTINCT i.product_id
  FROM order_items i
  JOIN orders o ON o.order_id = i.order_id
  JOIN customers c ON c.customer_id = o.customer_id
  WHERE c.city = 'Surabaya'
) bought ON bought.product_id = p.product_id
WHERE bought.product_id IS NULL;`
    },
    {
      id: "k-13",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Average Order Value (AOV) per kota", en: "Average Order Value per city" },
      task: {
        id: "Tampilkan city dan avg_order_value (rata-rata nilai pesanan per transaksi di kota tersebut, dibulatkan ke bilangan bulat) hanya untuk pesanan berstatus delivered dan kota yang tidak NULL.",
        en: "Return city and avg_order_value (average order value per transaction, rounded to integer) for delivered orders and non-NULL cities only."
      },
      hint: {
        id: "Hitung total nilai per order_id di CTE terlebih dahulu pada status delivered, lalu gabungkan ke customers untuk menghitung AVG(val).",
        en: "Compute total value per order_id in a CTE first for delivered orders, then join to customers to compute AVG(val)."
      },
      solution: `WITH order_vals AS (
  SELECT o.order_id, o.customer_id, SUM(i.qty * i.unit_price_idr) AS val
  FROM orders o
  JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'delivered'
  GROUP BY o.order_id, o.customer_id
)
SELECT c.city, CAST(ROUND(AVG(v.val)) AS INTEGER) AS avg_order_value
FROM order_vals v
JOIN customers c ON c.customer_id = v.customer_id
WHERE c.city IS NOT NULL
GROUP BY c.city;`
    },
    {
      id: "k-14",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Prinsip Pareto omset produk (Running total)", en: "Pareto product revenue (Cumulative sum)" },
      task: {
        id: "Tampilkan product_id, name, revenue (total omset produk), dan cum_revenue: running total akumulatif omset dari produk dengan omset tertinggi ke terendah.",
        en: "Return product_id, name, revenue (total product revenue) and cum_revenue: running total of revenue ordered from highest to lowest."
      },
      hint: {
        id: "Hitung revenue per produk di CTE, lalu SUM(revenue) OVER (ORDER BY revenue DESC, product_id) di query luar.",
        en: "Aggregate revenue per product in a CTE, then SUM(revenue) OVER (ORDER BY revenue DESC, product_id) in the outer query."
      },
      solution: `WITH prod_rev AS (
  SELECT p.product_id, p.name, SUM(i.qty * i.unit_price_idr) AS revenue
  FROM products p
  JOIN order_items i ON i.product_id = p.product_id
  GROUP BY p.product_id, p.name
)
SELECT product_id, name, revenue,
       SUM(revenue) OVER (ORDER BY revenue DESC, product_id) AS cum_revenue
FROM prod_rev;`
    },
    {
      id: "k-15",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Pesanan terbesar tiap pelanggan (ROW_NUMBER)", en: "Largest order per customer (ROW_NUMBER)" },
      task: {
        id: "Tampilkan customer_id, order_id, dan max_order_total untuk pesanan dengan nilai belanja TERBESAR dari masing-masing pelanggan.",
        en: "Return customer_id, order_id and max_order_total for the largest order of each customer."
      },
      hint: {
        id: "Hitung total belanja per pesanan di CTE, beri peringkat dengan ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_total DESC, order_id), lalu filter rn = 1.",
        en: "Compute total spend per order in a CTE, rank with ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_total DESC, order_id), then filter rn = 1."
      },
      solution: `WITH totals AS (
  SELECT o.customer_id, o.order_id, SUM(i.qty * i.unit_price_idr) AS order_total
  FROM orders o
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY o.customer_id, o.order_id
),
ranked AS (
  SELECT customer_id, order_id, order_total AS max_order_total,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_total DESC, order_id) AS rn
  FROM totals
)
SELECT customer_id, order_id, max_order_total
FROM ranked
WHERE rn = 1;`
    },
    {
      id: "ch-5",
      module: "mod-0-3",
      dataset: "ecommerce",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Order di atas rata-rata (Subquery)", en: "Orders above average (Subquery)" },
      task: {
        id: "Tampilkan customer_id dan amount dari semua order berstatus COMPLETED yang nilainya lebih tinggi daripada rata-rata nilai order COMPLETED.",
        en: "Return customer_id and amount for all COMPLETED orders with amount higher than the overall average COMPLETED order amount."
      },
      hint: {
        id: "Gunakan subquery pembanding di klausa WHERE: amount > (SELECT AVG(amount) FROM orders WHERE status = 'COMPLETED').",
        en: "Use a scalar subquery comparison in the WHERE clause: amount > (SELECT AVG(amount) FROM orders WHERE status = 'COMPLETED')."
      },
      solution: `SELECT customer_id, amount
FROM orders
WHERE status = 'COMPLETED'
  AND amount > (SELECT AVG(amount) FROM orders WHERE status = 'COMPLETED');`
    },
    {
      id: "ch-6",
      module: "mod-0-3",
      dataset: "ecommerce",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Order dan refund per tier (Conditional aggregation)", en: "Orders and refunds per tier" },
      task: {
        id: "Tampilkan tier, total_orders (jumlah seluruh order), dan refunded_orders (jumlah order berstatus REFUNDED) untuk setiap tier pelanggan yang memiliki order.",
        en: "Return tier, total_orders (count of all orders) and refunded_orders (count of REFUNDED orders) for each customer tier with orders."
      },
      hint: {
        id: "JOIN customers ke orders, GROUP BY c.tier, dan gunakan SUM(CASE WHEN o.status = 'REFUNDED' THEN 1 ELSE 0 END).",
        en: "JOIN customers to orders, GROUP BY c.tier, and use SUM(CASE WHEN o.status = 'REFUNDED' THEN 1 ELSE 0 END)."
      },
      solution: `SELECT c.tier,
       COUNT(o.order_id) AS total_orders,
       SUM(CASE WHEN o.status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded_orders
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.tier;`
    },
    {
      id: "w-9",
      module: "mod-1-3",
      dataset: "daily_sales",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Selisih omset harian toko (Day-over-Day LAG)", en: "Day-over-day revenue diff (LAG)" },
      task: {
        id: "Tampilkan store, day, revenue, dan revenue_diff: selisih omset hari ini dikurangi omset hari kemarin di toko yang sama (NULL untuk hari pertama di toko tersebut).",
        en: "Return store, day, revenue and revenue_diff: today's revenue minus previous day's revenue in the same store (NULL for first day)."
      },
      hint: {
        id: "Gunakan LAG(revenue) OVER (PARTITION BY store ORDER BY day), lalu kurangi dari revenue hari ini.",
        en: "Use LAG(revenue) OVER (PARTITION BY store ORDER BY day), then subtract it from today's revenue."
      },
      solution: `SELECT store, day, revenue,
       revenue - LAG(revenue) OVER (PARTITION BY store ORDER BY day) AS revenue_diff
FROM daily_sales;`
    },
    {
      id: "w-10",
      module: "mod-1-3",
      dataset: "daily_sales",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Tiga hari omset tertinggi per toko (Top-3 DENSE_RANK)", en: "Top 3 revenue days per store" },
      task: {
        id: "Tampilkan store, day, revenue, dan rank (1 sampai 3) untuk 3 hari dengan omset tertinggi di setiap toko menggunakan DENSE_RANK.",
        en: "Return store, day, revenue and rank (1 to 3) for the top 3 revenue days in each store using DENSE_RANK."
      },
      hint: {
        id: "Beri peringkat omset dengan DENSE_RANK() OVER (PARTITION BY store ORDER BY revenue DESC) di dalam CTE, lalu filter rank <= 3 di query luar.",
        en: "Rank revenue using DENSE_RANK() OVER (PARTITION BY store ORDER BY revenue DESC) in a CTE, then filter rank <= 3 in outer query."
      },
      solution: `WITH ranked AS (
  SELECT store, day, revenue,
         DENSE_RANK() OVER (PARTITION BY store ORDER BY revenue DESC) AS rank
  FROM daily_sales
)
SELECT store, day, revenue, rank
FROM ranked
WHERE rank <= 3;`
    },
    {
      id: "d-5",
      module: "mod-1-4",
      dataset: "scd_demo",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Audit rekonsiliasi data mart", en: "Data mart reconciliation audit" },
      task: {
        id: "Dari tabel orders_small, tampilkan tepat satu baris berisi total_orders (jumlah seluruh pesanan) dan total_gmv (jumlah seluruh total_idr) sebagai angka kontrol audit rekonsiliasi.",
        en: "From orders_small, return a single row with total_orders (count of orders) and total_gmv (sum of total_idr) as control totals for audit reconciliation."
      },
      hint: {
        id: "Query agregasi sederhana: COUNT(*) AS total_orders dan SUM(total_idr) AS total_gmv.",
        en: "Simple aggregate query: COUNT(*) AS total_orders and SUM(total_idr) AS total_gmv."
      },
      solution: `SELECT COUNT(*) AS total_orders, SUM(total_idr) AS total_gmv
FROM orders_small;`
    },
    {
      id: "k-16",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Nama depan dan panjang nama (fungsi teks)", en: "First name and name length (text functions)" },
      task: {
        id: "Tampilkan customer_id, first_name (teks sebelum spasi pertama pada name), dan name_length (jumlah karakter name) untuk semua pelanggan.",
        en: "Return customer_id, first_name (the text before the first space in name) and name_length (number of characters in name) for every customer."
      },
      hint: {
        id: "Pakai SUBSTR(name, 1, INSTR(name, ' ') - 1) untuk nama depan dan LENGTH(name) untuk panjangnya.",
        en: "Use SUBSTR(name, 1, INSTR(name, ' ') - 1) for the first name and LENGTH(name) for the length."
      },
      solution: `SELECT customer_id,
       SUBSTR(name, 1, INSTR(name, ' ') - 1) AS first_name,
       LENGTH(name) AS name_length
FROM customers;`
    },
    {
      id: "k-17",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Dasar", en: "Basic" },
      title: { id: "Kota yang tidak diketahui (COALESCE)", en: "Unknown cities (COALESCE)" },
      task: {
        id: "Tampilkan city_label (city, atau 'Unknown' bila NULL) dan customers (jumlah pelanggan) untuk setiap label.",
        en: "Return city_label (the city, or 'Unknown' when it is NULL) and customers (number of customers) for each label."
      },
      hint: {
        id: "COALESCE(city, 'Unknown') dipakai di SELECT dan juga di GROUP BY (atau GROUP BY 1).",
        en: "Use COALESCE(city, 'Unknown') in the SELECT and also in the GROUP BY (or GROUP BY 1)."
      },
      solution: `SELECT COALESCE(city, 'Unknown') AS city_label, COUNT(*) AS customers
FROM customers
GROUP BY COALESCE(city, 'Unknown');`
    },
    {
      id: "k-18",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Persentase pesanan batal (jebakan pembagian bilangan bulat)", en: "Cancellation rate (the integer-division trap)" },
      task: {
        id: "Tampilkan satu baris berisi cancelled_pct: persentase pesanan berstatus cancelled dari semua pesanan, dibulatkan ke 1 desimal.",
        en: "Return one row with cancelled_pct: the percentage of all orders whose status is cancelled, rounded to 1 decimal place."
      },
      hint: {
        id: "Di SQLite 2 / 18 adalah 0 karena kedua angka bilangan bulat. Kalikan dengan 100.0 (bukan 100) sebelum membagi, lalu ROUND(..., 1).",
        en: "In SQLite 2 / 18 is 0 because both numbers are integers. Multiply by 100.0 (not 100) before dividing, then ROUND(..., 1)."
      },
      solution: `SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 1) AS cancelled_pct
FROM orders;`
    },
    {
      id: "k-19",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pesanan per hari dalam seminggu (fungsi tanggal)", en: "Orders per day of the week (date functions)" },
      task: {
        id: "Tampilkan weekday (0 = Minggu sampai 6 = Sabtu, sebagai teks dari strftime) dan orders (jumlah pesanan) untuk setiap hari yang punya pesanan.",
        en: "Return weekday (0 = Sunday to 6 = Saturday, as the text strftime gives) and orders (number of orders) for each weekday that has orders."
      },
      hint: {
        id: "strftime('%w', order_date) memberi nomor hari. GROUP BY ekspresi yang sama.",
        en: "strftime('%w', order_date) gives the weekday number. GROUP BY the same expression."
      },
      solution: `SELECT strftime('%w', order_date) AS weekday, COUNT(*) AS orders
FROM orders
GROUP BY strftime('%w', order_date);`
    },
    {
      id: "k-20",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Hari dari daftar sampai pesanan pertama (selisih tanggal)", en: "Days from signup to first order (date difference)" },
      task: {
        id: "Tampilkan name dan days_to_first_order (bilangan bulat: jumlah hari antara signup_date dan tanggal pesanan paling awal) untuk pelanggan yang punya minimal satu pesanan.",
        en: "Return name and days_to_first_order (an integer: days between signup_date and the customer's earliest order_date) for customers with at least one order."
      },
      hint: {
        id: "SQLite tidak punya DATE - DATE. Pakai julianday(MIN(order_date)) - julianday(signup_date), lalu CAST(... AS INTEGER).",
        en: "SQLite has no DATE - DATE. Use julianday(MIN(order_date)) - julianday(signup_date), then CAST(... AS INTEGER)."
      },
      solution: `SELECT c.name,
       CAST(julianday(MIN(o.order_date)) - julianday(c.signup_date) AS INTEGER) AS days_to_first_order
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.signup_date;`
    },
    {
      id: "k-21",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Tenggat pengiriman +7 hari (aritmetika tanggal)", en: "Delivery deadline +7 days (date arithmetic)" },
      task: {
        id: "Tampilkan order_id dan due_date (order_date ditambah 7 hari) untuk pesanan berstatus paid atau shipped.",
        en: "Return order_id and due_date (order_date plus 7 days) for orders whose status is paid or shipped."
      },
      hint: {
        id: "date(order_date, '+7 days') menambah hari pada teks tanggal ISO. Filter dengan WHERE status IN ('paid', 'shipped').",
        en: "date(order_date, '+7 days') adds days to an ISO date text. Filter with WHERE status IN ('paid', 'shipped')."
      },
      solution: `SELECT order_id, date(order_date, '+7 days') AS due_date
FROM orders
WHERE status IN ('paid', 'shipped');`
    },
    {
      id: "k-22",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Membuat VIEW lalu memakainya", en: "Create a VIEW, then use it" },
      task: {
        id: "Buat view delivered_orders (order_id, customer_id, order_date dari pesanan berstatus delivered), lalu tampilkan customer_id dan delivered (jumlah pesanan delivered) per pelanggan dengan membaca dari view itu.",
        en: "Create a view delivered_orders (order_id, customer_id, order_date of orders whose status is delivered), then return customer_id and delivered (number of delivered orders) per customer by reading from that view."
      },
      hint: {
        id: "CREATE VIEW delivered_orders AS SELECT ...; lalu SELECT ... FROM delivered_orders GROUP BY customer_id. Dua perintah dipisah titik koma. Bila error 'already exists', klik Reset data.",
        en: "CREATE VIEW delivered_orders AS SELECT ...; then SELECT ... FROM delivered_orders GROUP BY customer_id. Two statements separated by a semicolon. If you see 'already exists', click Reset data."
      },
      solution: `CREATE VIEW delivered_orders AS
  SELECT order_id, customer_id, order_date
  FROM orders
  WHERE status = 'delivered';

SELECT customer_id, COUNT(*) AS delivered
FROM delivered_orders
GROUP BY customer_id;`
    },
    {
      id: "k-23",
      module: "mod-0-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Membuat tabel dengan constraint (DDL)", en: "Create a table with constraints (DDL)" },
      task: {
        id: "Buat tabel wishlist(customer_id, product_id, added_on) dengan PRIMARY KEY gabungan (customer_id, product_id), foreign key ke customers dan products, dan added_on bawaan '2026-02-01'. Isi dengan (1,2), (1,3), (2,2), lalu tampilkan product_id dan wishers (jumlah pelanggan) per produk.",
        en: "Create a table wishlist(customer_id, product_id, added_on) with a composite PRIMARY KEY (customer_id, product_id), foreign keys to customers and products, and added_on defaulting to '2026-02-01'. Insert (1,2), (1,3), (2,2), then return product_id and wishers (number of customers) per product."
      },
      hint: {
        id: "CREATE TABLE ... (..., PRIMARY KEY (customer_id, product_id)); INSERT INTO wishlist (customer_id, product_id) VALUES ...; lalu SELECT dengan GROUP BY product_id. Bila error 'already exists', klik Reset data.",
        en: "CREATE TABLE ... (..., PRIMARY KEY (customer_id, product_id)); INSERT INTO wishlist (customer_id, product_id) VALUES ...; then SELECT with GROUP BY product_id. If you see 'already exists', click Reset data."
      },
      solution: `CREATE TABLE wishlist (
  customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
  product_id  INTEGER NOT NULL REFERENCES products (product_id),
  added_on    TEXT NOT NULL DEFAULT '2026-02-01',
  PRIMARY KEY (customer_id, product_id)
);

INSERT INTO wishlist (customer_id, product_id) VALUES (1, 2), (1, 3), (2, 2);

SELECT product_id, COUNT(*) AS wishers
FROM wishlist
GROUP BY product_id;`
    },
    {
      id: "w-11",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pesanan terakhir tiap pelanggan (pengganti QUALIFY)", en: "Latest order per customer (the portable QUALIFY)" },
      task: {
        id: "Tampilkan name, order_id, dan order_date dari pesanan paling baru setiap pelanggan (satu baris per pelanggan yang punya pesanan).",
        en: "Return name, order_id and order_date of each customer's most recent order (one row per customer that has orders)."
      },
      hint: {
        id: "SQLite, PostgreSQL, dan MySQL tidak punya QUALIFY. Beri ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) di CTE, lalu filter = 1 di query luar.",
        en: "SQLite, PostgreSQL and MySQL have no QUALIFY. Number rows with ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) in a CTE, then filter = 1 in the outer query."
      },
      solution: `WITH ranked AS (
  SELECT customer_id, order_id, order_date,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
SELECT c.name, r.order_id, r.order_date
FROM ranked r
JOIN customers c ON c.customer_id = r.customer_id
WHERE r.rn = 1;`
    },
    {
      id: "w-12",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Hitungan bersyarat dengan FILTER", en: "Conditional counts with FILTER" },
      task: {
        id: "Tampilkan customer_id, delivered (jumlah pesanan delivered), dan cancelled (jumlah pesanan cancelled) untuk setiap pelanggan yang punya pesanan, memakai COUNT(*) FILTER (WHERE ...).",
        en: "Return customer_id, delivered (number of delivered orders) and cancelled (number of cancelled orders) for every customer that has orders, using COUNT(*) FILTER (WHERE ...)."
      },
      hint: {
        id: "COUNT(*) FILTER (WHERE status = 'delivered') AS delivered. FILTER bekerja di SQLite, PostgreSQL, dan DuckDB; di MySQL pakai SUM(CASE ...).",
        en: "COUNT(*) FILTER (WHERE status = 'delivered') AS delivered. FILTER works in SQLite, PostgreSQL and DuckDB; in MySQL use SUM(CASE ...)."
      },
      solution: `SELECT customer_id,
       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders
GROUP BY customer_id;`
    },
    {
      id: "w-13",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Menengah", en: "Intermediate" },
      title: { id: "Pesanan per minggu (pengelompokan tanggal)", en: "Orders per week (date bucketing)" },
      task: {
        id: "Tampilkan week (strftime('%W', order_date), nomor minggu dengan Senin sebagai hari pertama) dan orders (jumlah pesanan) per minggu.",
        en: "Return week (strftime('%W', order_date), the week number with Monday as first day) and orders (number of orders) per week."
      },
      hint: {
        id: "Di PostgreSQL ini date_trunc('week', ...), di SQLite strftime('%W', ...). GROUP BY ekspresi yang sama.",
        en: "In PostgreSQL this is date_trunc('week', ...), in SQLite strftime('%W', ...). GROUP BY the same expression."
      },
      solution: `SELECT strftime('%W', order_date) AS week, COUNT(*) AS orders
FROM orders
GROUP BY strftime('%W', order_date);`
    },
    {
      id: "w-14",
      module: "mod-1-3",
      dataset: "kopiku",
      level: { id: "Lanjut", en: "Advanced" },
      title: { id: "Median nilai baris pesanan tanpa MEDIAN()", en: "Median line value without MEDIAN()" },
      task: {
        id: "Dari order_items tampilkan satu baris berisi median_line: median dari qty * unit_price_idr per baris (jumlah baris genap: rata-rata dua nilai tengah).",
        en: "From order_items return one row with median_line: the median of qty * unit_price_idr per row (with an even number of rows, the average of the two middle values)."
      },
      hint: {
        id: "SQLite tidak punya median. Beri ROW_NUMBER() dan COUNT(*) OVER () di CTE, lalu rata-ratakan baris dengan rn IN ((n + 1) / 2, (n + 2) / 2). Ingat: pembagian bilangan bulat membulatkan ke bawah.",
        en: "SQLite has no median. Add ROW_NUMBER() and COUNT(*) OVER () in a CTE, then average the rows where rn IN ((n + 1) / 2, (n + 2) / 2). Remember: integer division rounds down."
      },
      solution: `WITH lines AS (
  SELECT qty * unit_price_idr AS amount,
         ROW_NUMBER() OVER (ORDER BY qty * unit_price_idr) AS rn,
         COUNT(*) OVER () AS n
  FROM order_items
)
SELECT AVG(amount) AS median_line
FROM lines
WHERE rn IN ((n + 1) / 2, (n + 2) / 2);`
    }
  ],

  init() {
    if (this.loading) return this.loading;
    this.loading = initSqlJs({ locateFile: (f) => "vendor/sqljs/" + f }).then((SQL) => {
      this.SQL = SQL;
      return SQL;
    });
    return this.loading;
  },

  async loadDataset(key) {
    await this.init();
    this.freshDb(key);
  },

  // Rebuild the current dataset from scratch (synchronous: the engine is already loaded).
  freshDb(key) {
    if (this.db) this.db.close();
    this.db = new this.SQL.Database();
    this.db.exec(this.datasets[key || this.datasetKey].setup);
    this.datasetKey = key || this.datasetKey;
  },

  tables() {
    if (!this.db) return [];
    const res = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    if (!res.length) return [];
    return res[0].values.map(([name]) => {
      const cols = this.db.exec(`PRAGMA table_info(${name})`)[0].values.map((c) => `${c[1]} ${c[2]}`.trim());
      return { name, cols };
    });
  },

  // Run one or more statements. Returns the result set of the last statement that produced rows.
  run(sql) {
    const t0 = performance.now();
    try {
      const results = this.db.exec(sql);
      const ms = performance.now() - t0;
      if (!results.length) return { ok: true, columns: [], rows: [], ms, empty: true };
      const last = results[results.length - 1];
      return { ok: true, columns: last.columns, rows: last.values, ms };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Compare as unordered sets of rows (numbers rounded), ignoring column names.
  // Each side runs on a fresh copy of the dataset, so statements that change data (INSERT, CREATE VIEW ...) cannot disturb the comparison
  // or be applied twice.
  check(challenge, learnerSql) {
    this.freshDb(challenge.dataset);
    const mine = this.run(learnerSql);
    if (!mine.ok) { this.freshDb(); return { ok: false, reason: "error", detail: mine.error }; }
    if (mine.empty) { this.freshDb(); return { ok: false, reason: "empty" }; }
    this.freshDb();
    const ref = this.run(challenge.solution);
    this.freshDb();
    const norm = (rows) =>
      rows
        .map((r) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v))))
        .sort();
    if (mine.columns.length !== ref.columns.length) {
      return { ok: false, reason: "columns", expected: ref.columns.length, got: mine.columns.length };
    }
    const a = norm(mine.rows);
    const b = norm(ref.rows);
    if (a.length !== b.length) return { ok: false, reason: "rows", expected: b.length, got: a.length };
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { ok: false, reason: "values" };
    return { ok: true };
  }
};
