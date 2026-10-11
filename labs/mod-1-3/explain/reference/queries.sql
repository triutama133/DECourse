-- Reference: only Q4 changes. A function on the column (date(event_time)) hides it from the index;
-- comparing the column itself against a range gives the same answer and can use an index.

-- Q1
SELECT * FROM events WHERE customer_id = 4242;

-- Q2
SELECT count(*) FROM events WHERE event_time >= '2026-01-10' AND event_time < '2026-01-11';

-- Q3
SELECT * FROM events WHERE customer_id = 4242 ORDER BY event_time DESC LIMIT 10;

-- Q4
SELECT count(*) FROM events WHERE event_time >= '2026-01-10' AND event_time < '2026-01-11';
