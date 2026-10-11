-- One composite index serves Q1 (leftmost column) and Q3 (equality on customer_id, then the sort order).
CREATE INDEX idx_events_customer_time ON events (customer_id, event_time DESC);

-- One index on the time column serves the range queries Q2 and Q4.
CREATE INDEX idx_events_time ON events (event_time);
