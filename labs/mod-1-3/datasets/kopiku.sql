-- Dataset "kopiku" for the SQL labs and the in-app SQL Sandbox.
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
  (118,1,5,2,100000);
