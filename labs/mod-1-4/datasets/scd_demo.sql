-- Dataset "scd_demo" for the SQL labs and the in-app SQL Sandbox.
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
  (6,3,'2026-01-05 18:00:00',60000);
