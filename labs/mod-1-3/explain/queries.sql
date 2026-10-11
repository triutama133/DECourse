-- Lab 1.3 part B. Four queries on a 500,000-row table:
--   events(event_id bigserial PK, customer_id int, event_type text, event_time timestamptz, status text)
-- Q1 to Q3 are fine as written; Q4 is written in a way that defeats any index: REWRITE IT (same answer, index-friendly).

-- Q1
SELECT * FROM events WHERE customer_id = 4242;

-- Q2
SELECT count(*) FROM events WHERE event_time >= '2026-01-10' AND event_time < '2026-01-11';

-- Q3
SELECT * FROM events WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10;

-- Q4 (the session time zone is UTC)
SELECT count(*) FROM events WHERE date(event_time) = '2026-01-10';
