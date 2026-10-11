-- Dataset "daily_sales" for the SQL labs and the in-app SQL Sandbox.
CREATE TABLE daily_sales (store TEXT, day TEXT, revenue INTEGER);
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 13)
INSERT INTO daily_sales
SELECT 'jakarta', date('2026-01-01', '+' || n || ' day'),
       800000 + ((n * 7) % 9) * 60000 + CASE WHEN strftime('%w', date('2026-01-01', '+' || n || ' day')) IN ('0','6') THEN 200000 ELSE 0 END
FROM d
UNION ALL
SELECT 'bandung', date('2026-01-01', '+' || n || ' day'),
       500000 + ((n * 5 + 3) % 7) * 40000 + CASE WHEN strftime('%w', date('2026-01-01', '+' || n || ' day')) IN ('0','6') THEN 150000 ELSE 0 END
FROM d;
