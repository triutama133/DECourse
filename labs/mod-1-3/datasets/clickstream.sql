-- Dataset "clickstream" for the SQL labs and the in-app SQL Sandbox.
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
  (3,'2026-03-01 12:00:00','/home');
