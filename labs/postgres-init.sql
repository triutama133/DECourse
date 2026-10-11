-- Seed data for Lab 3.2 (CDC). Runs once when the Postgres volume is first created.
CREATE TABLE IF NOT EXISTS public.orders (
    order_id    SERIAL PRIMARY KEY,
    customer_id INT            NOT NULL,
    amount      NUMERIC(10, 2) NOT NULL,
    status      TEXT           NOT NULL DEFAULT 'PENDING',
    updated_at  TIMESTAMP      NOT NULL DEFAULT now()
);

INSERT INTO public.orders (customer_id, amount, status) VALUES
    (1, 250.00, 'PENDING'),
    (2,  80.50, 'PENDING'),
    (3, 1200.00, 'PAID');
