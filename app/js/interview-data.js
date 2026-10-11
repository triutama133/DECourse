// Interview Simulator Data: System Design, SQL & Data Modeling Arena, and Incident Post-Mortem Simulator

window.INTERVIEW_DATA = {
  systemDesignScenarios: [
    {
      id: "sd-1",
      title: "Real-Time Ride-Hailing Telemetry Pipeline (Uber / Grab)",
      difficulty: "Hard",
      tags: ["High Throughput", "Geospatial", "Kafka", "Flink", "Iceberg"],
      scenarioDescription: "Design a data platform that ingests real-time GPS locations from 5 million active drivers every 4 seconds (1.25M events/sec peak), enables real-time dispatch matching (sub-second latency), and stores historical trip trajectories in a lakehouse for pricing and route optimization analytics.",
      stages: [
        {
          stageName: "1. Requirement Clarification & Scale Math",
          prompt: "Clarify functional requirements, latency SLAs, data retention, and compute traffic volume before proposing tools.",
          sampleAnswer: `**Functional Requirements:**
- Ingest real-time GPS ping: (driver_id, lat, lon, heading, speed, timestamp, ride_status).
- Low-latency sink: Driver location lookup for dispatch engine (<500ms freshness).
- Analytical sink: Historical route trajectories and aggregated driver earnings stored for 3+ years.

**Scale Calculation:**
- Active drivers: 5,000,000
- Ping frequency: Every 4 seconds
- Write throughput: $5,000,000 / 4 = 1,250,000$ events/sec.
- Payload size: ~200 bytes per event.
- Network bandwidth: $1,250,000 \\times 200\\text{ bytes} = 250\\text{ MB/sec} = 2\\text{ Gbps}$.
- Daily storage volume: $250\\text{ MB/sec} \\times 86,400\\text{ sec} \\approx 21.6\\text{ TB/day}$ uncompressed (~4-5 TB compressed Parquet).`
        },
        {
          stageName: "2. High-Level Architecture",
          prompt: "Draft the end-to-end ingestion, stream processing, low-latency cache, and analytical storage flow.",
          sampleAnswer: `**Architecture Flow:**
1. **Edge Ingestion**: Mobile App $\\rightarrow$ API Gateway (Envoy/Nginx with mTLS) $\\rightarrow$ Kafka / Redpanda Cluster.
   - Partitioning strategy: Partition by \`H3\` Geospatial Hexagon Index (resolution 7) or \`driver_id\`.
2. **Real-time Path (<500ms)**:
   - Stream Processing: Apache Flink consumer group reading Kafka.
   - Hot Cache Sink: Write latest driver location into **Redis Geospatial / KeyDB** cluster with 15-second TTL.
   - Dispatch Service queries Redis via \`GEORADIUS\` to find top 10 nearest drivers in <50ms.
3. **Analytical Batch/Lakehouse Path**:
   - Flink / Spark Streaming micro-batch writes to **Apache Iceberg** tables on S3/MinIO.
   - Hidden partitioning by \`date(event_time)\` and \`bucket(100, driver_id)\`.
   - Downstream query engine: Trino / StarRocks / DuckDB for pricing models and ML feature stores.`
        },
        {
          stageName: "3. Deep Dive & Failure Modes",
          prompt: "How do you handle mobile offline reconnect bursts, network partitions, and Iceberg small-file explosion?",
          sampleAnswer: `**Failure Mode Mitigations:**
1. **Offline Ping Bursts**: When drivers drive through tunnels or lose 4G connectivity, mobile clients queue up pings and dump 200 pings at once.
   - In Flink, apply an **Event-Time Watermark** (e.g., 2 minutes allowed lateness).
   - If a ping is older than 2 minutes, bypass the real-time Redis cache (it is irrelevant for live matching) and route straight to the Iceberg historical lake.
2. **Iceberg Small File Problem**: Ingesting 1.25M events/sec directly into S3 creates thousands of tiny Parquet files.
   - Flink commits Iceberg snapshots every 1-2 minutes with 128MB target file size.
   - Dedicated Iceberg background maintenance daemon runs **Bin-Packing Compaction** every hour and daily **Z-Order sorting** on \`(h3_cell, event_time)\`.
3. **Zero Data Loss Guarantee**: Kafka topic configured with \`acks=all\`, replication factor 3, and min.insync.replicas=2.`
        }
      ]
    },
    {
      id: "sd-2",
      title: "Financial Transaction Ledger with Exactly-Once Processing",
      difficulty: "Hard",
      tags: ["ACID", "Idempotency", "CDC", "Double-Entry", "Auditability"],
      scenarioDescription: "Design a data platform for a modern digital bank processing $500M in daily payments. The system must guarantee zero transaction loss, zero double-charging, complete immutable audit trails, and sub-second balance reconciliation across distributed payment gateways.",
      stages: [
        {
          stageName: "1. Requirements & Core Principles",
          prompt: "What are the non-negotiable architectural constraints for a financial ledger?",
          sampleAnswer: `**Core Constraints:**
- **Double-Entry Bookkeeping**: Every transaction consists of at least one debit and one credit; the sum of debits must equal the sum of credits ($Assets = Liabilities + Equity$).
- **Immutability**: Records are never updated (\`UPDATE\`) or deleted (\`DELETE\`). Corrections must be made via compensating reverse transactions.
- **Strict Idempotency**: Payment gateways often retry network requests; submitting the same payment request 10 times must result in exactly 1 ledger entry.
- **Auditability & Point-in-Time Correctness**: Ability to reconstruct account balances as of any millisecond in history.`
        },
        {
          stageName: "2. Ingestion & Storage Architecture",
          prompt: "Design the transaction write path and ledger persistence layer.",
          sampleAnswer: `**Architecture Flow:**
1. **Idempotency Gate**:
   - Ingestion API receives request with client-supplied \`Idempotency-Key\` (UUID v4).
   - Transactional check against Redis distributed lock and PostgreSQL ledger table with a unique index on \`(idempotency_key)\`.
2. **Transactional Core (OLTP)**:
   - Primary Ledger stored in multi-region PostgreSQL / CockroachDB.
   - Double-entry table: \`ledger_entries (id, tx_id, account_id, amount, direction, created_at)\`.
3. **Streaming & Analytical Ingestion (OLAP)**:
   - Zero-overhead Change Data Capture (**Debezium**) streams Write-Ahead Log (WAL) to Redpanda.
   - Transactions emitted with transactional producer ID.
   - Apache Iceberg on S3 stores raw historical ledger events with WORM (Write Once, Read Many) compliance locking.`
        },
        {
          stageName: "3. Reconciliation & Edge Cases",
          prompt: "How do you detect ledger discrepancies and handle out-of-order webhook settlements?",
          sampleAnswer: `**Reconciliation Engine:**
1. **Continuous Real-Time Check**: Flink stream processor computes running balance sums across debits and credits every 10 seconds; alerts PagerDuty if $\\sum(\\text{debits}) - \\sum(\\text{credits}) \\ne 0$.
2. **End-of-Day (EOD) Batch Reconciliation**: Dagster pipeline pulls external settlement files from Visa/Mastercard/Stripe and runs automated reconciliation join against internal ledger. Unmatched records are placed into a Human-in-the-Loop review queue.
3. **Data Quality Gate**: Automated dbt singular tests verifying account balance invariants and zero null accounts.`
        }
      ]
    },
    {
      id: "sd-3",
      title: "E-Commerce Clickstream & Attribution Engine (1B Events/Day)",
      difficulty: "Hard",
      tags: ["Clickstream", "Sessionization", "Attribution", "dbt", "DuckDB/Trino"],
      scenarioDescription: "Design a clickstream tracking and multi-touch marketing attribution engine for a global retailer processing 1 billion user interactions per day. Marketing teams require first-touch, last-touch, and linear attribution reporting updated every 30 minutes.",
      stages: [
        {
          stageName: "1. Scale & Requirements",
          prompt: "Define data schemas, sessionization logic, and compute storage footprint for 1B daily clicks.",
          sampleAnswer: `**Scale Metrics:**
- 1,000,000,000 events / day $\\approx 11,500$ events/sec average, 35,000 peak events/sec.
- Uncompressed: ~300 GB/day. Compressed Parquet: ~40 GB/day.
- Business requirement: Sessionize events (30-minute inactivity timeout) and link completed purchases back to marketing campaign touchpoints.`
        },
        {
          stageName: "2. Pipeline Architecture",
          prompt: "Outline the ingestion, sessionization, and attribution modeling DAG.",
          sampleAnswer: `**Architecture Flow:**
1. **SDK / Ingestion**: Mobile & Web SDKs send events to Amazon Kinesis / Redpanda.
2. **Raw Staging**: Spark Streaming / Flink writes raw micro-batches to Apache Iceberg landing tables.
3. **Sessionization (dbt Incremental / Dagster)**:
   - Run hourly sessionization model using SQL Window functions (\`LAG(event_time)\` and running \`SUM(is_new_session)\`).
4. **Attribution Engine**:
   - Join \`fct_orders\` with historical touchpoint sessions for each user in the 30 days prior to checkout.
   - Compute:
     - **First-Touch**: 100% credit to the first ad click that introduced the customer.
     - **Last-Touch**: 100% credit to the last channel clicked before purchase.
     - **Linear (Multi-Touch)**: Divide order value equally across all intermediate touches.`
        },
        {
          stageName: "3. Trade-offs & Optimization",
          prompt: "Explain how you optimize query costs on a 30-day attribution join across 30 billion records.",
          sampleAnswer: `**Optimization Strategies:**
1. **User-level Partition Pruning**: Filter touchpoint events by \`user_id IN (SELECT DISTINCT user_id FROM todays_orders)\` before executing the heavy window attribution joins.
2. **Z-Ordering & Clustering**: Z-order the clickstream Iceberg table on \`(user_id, event_time)\` so data for a specific user is localized in adjacent Parquet files.
3. **Incremental Watermark Processing**: Maintain a persistent user attribution state table rather than scanning the full 30-day history from scratch every 30 minutes.`
        }
      ]
    },
    {
      id: "sd-4",
      title: "Multi-Tenant Enterprise Lakehouse with GDPR Right-to-be-Forgotten",
      difficulty: "Medium-Hard",
      tags: ["Iceberg", "GDPR", "Delete Optimization", "Data Privacy", "SaaS"],
      scenarioDescription: "Design an analytics lakehouse supporting 10,000 B2B enterprise tenants where users frequently invoke GDPR Article 17 (Right to Erasure). You must delete or anonymize all user PII records within 72 hours across immutable columnar lakehouse files without incurring massive re-write compute costs.",
      stages: [
        {
          stageName: "1. The Columnar Lakehouse Deletion Dilemma",
          prompt: "Why are row deletions notoriously difficult and expensive in Parquet / S3 data lakes?",
          sampleAnswer: `**The Dilemma:**
- Parquet files are immutable columnar objects. In traditional data lakes without modern table formats, deleting a single user's records requires finding every file containing that user, decompressing the entire file in memory, filtering out the rows, and rewriting brand new Parquet files.
- If 1,000 users request deletion per day scattered across terabytes of data, rewriting 80% of your lakehouse daily costs thousands in compute and causes constant write lock contention.`
        },
        {
          stageName: "2. The Modern Apache Iceberg Solution",
          prompt: "How does Apache Iceberg's Merge-on-Read (MoR) and Position Delete files solve this efficiently?",
          sampleAnswer: `**Solution Architecture:**
1. **Iceberg Merge-on-Read (MoR) & Delete Files**:
   - Instead of immediately rewriting the entire Parquet file, Iceberg writes a lightweight **Position Delete File** or **Equality Delete File** that points to the exact file path and row offset of the deleted user.
   - Writing delete files takes milliseconds and requires near-zero compute.
2. **Cryptographic Erasure (Crypto-Shredding)**:
   - For sensitive PII attributes (name, email, SSN), store the values encrypted with a per-user symmetric key managed in AWS KMS / HashiCorp Vault.
   - When a user requests GDPR erasure, simply delete that user's encryption key. The data in Parquet immediately becomes undecipherable ciphertext, satisfying legal erasure requirements instantly without touching storage files!
3. **Scheduled Compaction**: Run weekly compaction jobs that physically rewrite data files and purge position deletes during off-peak hours.`
        }
      ]
    }
  ],

  sqlArenaProblems: [
    {
      id: "sql-1",
      title: "The Gaps & Islands: Contiguous User Activity Streaks",
      difficulty: "Hard",
      company: "Meta / Uber",
      category: "Window Functions & Gaps/Islands",
      problemStatement: `Given a table \`user_activity (user_id INT, activity_date DATE)\` containing daily login logs, write a performant SQL query to find the length of the longest streak of consecutive days each user was active.`,
      schema: `CREATE TABLE user_activity (
    user_id INT,
    activity_date DATE
);`,
      solutionSql: `WITH deduplicated_activity AS (
    -- Step 1: Remove potential multiple logins on the same day
    SELECT DISTINCT
        user_id,
        activity_date
    FROM user_activity
),
ranked_activity AS (
    -- Step 2: Subtract dense_rank from activity_date to create a constant 'island' identifier
    SELECT
        user_id,
        activity_date,
        activity_date - (DENSE_RANK() OVER (
            PARTITION BY user_id 
            ORDER BY activity_date
        ) * INTERVAL '1 day') AS streak_island_group
    FROM deduplicated_activity
),
streak_lengths AS (
    -- Step 3: Count days in each contiguous island
    SELECT
        user_id,
        streak_island_group,
        COUNT(*) AS streak_days
    FROM ranked_activity
    GROUP BY user_id, streak_island_group
)
-- Step 4: Find maximum streak per user
SELECT
    user_id,
    MAX(streak_days) AS longest_active_streak
FROM streak_lengths
GROUP BY user_id
ORDER BY longest_active_streak DESC;`,
      explanation: "The key intuition of the Gaps and Islands problem is subtracting a monotonically increasing sequence (`ROW_NUMBER()` or `DENSE_RANK()`) from the date. Consecutive dates increment at the same rate as the rank, making `activity_date - rank` constant for consecutive streaks. A gap causes the constant value to jump, creating a new 'island'.",
      complexity: "Time: $O(N \\log N)$ for sorting partition, Space: $O(N)$ for window state."
    },
    {
      id: "sql-2",
      title: "First-Touch vs Last-Touch Marketing Attribution",
      difficulty: "Medium-Hard",
      company: "Amazon / Shopify",
      category: "Window Functions & Joins",
      problemStatement: `You have two tables:
1. \`marketing_touches (touch_id, user_id, channel, touch_time)\`
2. \`orders (order_id, user_id, order_value, order_time)\`

Write a query that determines for each order:
- The \`first_channel\` the user interacted with prior to the order.
- The \`last_channel\` the user interacted with immediately prior to the order.
Only consider touches that occurred within 30 days prior to the order.`,
      schema: `CREATE TABLE marketing_touches (touch_id INT, user_id INT, channel TEXT, touch_time TIMESTAMP);
CREATE TABLE orders (order_id INT, user_id INT, order_value NUMERIC, order_time TIMESTAMP);`,
      solutionSql: `WITH eligible_touches AS (
    SELECT
        o.order_id,
        o.user_id,
        o.order_value,
        o.order_time,
        t.channel,
        t.touch_time,
        ROW_NUMBER() OVER (
            PARTITION BY o.order_id 
            ORDER BY t.touch_time ASC
        ) AS touch_asc_rank,
        ROW_NUMBER() OVER (
            PARTITION BY o.order_id 
            ORDER BY t.touch_time DESC
        ) AS touch_desc_rank
    FROM orders o
    INNER JOIN marketing_touches t
        ON o.user_id = t.user_id
       AND t.touch_time < o.order_time
       AND t.touch_time >= o.order_time - INTERVAL '30 days'
)
SELECT
    order_id,
    user_id,
    order_value,
    order_time,
    MAX(CASE WHEN touch_asc_rank = 1 THEN channel END) AS first_touch_channel,
    MAX(CASE WHEN touch_desc_rank = 1 THEN channel END) AS last_touch_channel
FROM eligible_touches
GROUP BY order_id, user_id, order_value, order_time;`,
      explanation: "We join orders to touches bounded by the 30-day lookback window, compute dual `ROW_NUMBER()` ranks (ascending for first touch, descending for last touch), and then aggregate using conditional `MAX(CASE WHEN...)`.",
      complexity: "Time: $O(N \\log M)$ where $M$ is touches per user."
    },
    {
      id: "sql-3",
      title: "Idempotent Deduplication with Prioritized Versioning",
      difficulty: "Medium",
      company: "Stripe / Snowflake",
      category: "Deduplication & QUALIFY",
      problemStatement: `An event stream pushes updates into an append-only staging table \`order_events (event_id, order_id, status, payload_version, event_time)\`.
Write a query to retrieve the current single truth record for each \`order_id\`, prioritized first by highest \`payload_version\`, and if versions are tied, by latest \`event_time\`. Optimize for Snowflake/BigQuery using \`QUALIFY\`.`,
      schema: `CREATE TABLE order_events (event_id TEXT, order_id TEXT, status TEXT, payload_version INT, event_time TIMESTAMP);`,
      solutionSql: `-- Modern Snowflake / BigQuery / DuckDB syntax with QUALIFY
SELECT
    order_id,
    status,
    payload_version,
    event_time
FROM order_events
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY order_id 
    ORDER BY payload_version DESC, event_time DESC
) = 1;

-- Standard ANSI SQL fallback with CTE
/*
WITH ranked_events AS (
    SELECT
        order_id, status, payload_version, event_time,
        ROW_NUMBER() OVER (
            PARTITION BY order_id 
            ORDER BY payload_version DESC, event_time DESC
        ) AS rn
    FROM order_events
)
SELECT order_id, status, payload_version, event_time
FROM ranked_events
WHERE rn = 1;
*/`,
      explanation: "Using `QUALIFY` filters directly on window function results without requiring a verbose subquery or CTE wrapper. `ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY payload_version DESC, event_time DESC)` guarantees deterministic selection of the latest canonical record.",
      complexity: "Time: $O(N \\log K)$ per order partition."
    },
    {
      id: "sql-4",
      title: "Rolling 7-Day Active Users & Retention Calculation",
      difficulty: "Hard",
      company: "Netflix / LinkedIn",
      category: "Time-Series Aggregations & Self-Joins",
      problemStatement: `Given a calendar date dimension \`calendar (calendar_date DATE)\` and user logins \`user_logins (user_id INT, login_date DATE)\`, compute the 7-day Rolling Active Users count (distinct users who logged in within the previous 7 days inclusive) for every single calendar day.`,
      schema: `CREATE TABLE calendar (calendar_date DATE);
CREATE TABLE user_logins (user_id INT, login_date DATE);`,
      solutionSql: `SELECT
    c.calendar_date,
    COUNT(DISTINCT l.user_id) AS rolling_7d_active_users
FROM calendar c
LEFT JOIN user_logins l
    ON l.login_date BETWEEN c.calendar_date - INTERVAL '6 days' AND c.calendar_date
GROUP BY c.calendar_date
ORDER BY c.calendar_date ASC;`,
      explanation: "A standard `COUNT(DISTINCT)` cannot be used over window frames (`OVER (ORDER BY ... RANGE BETWEEN 6 PRECEDING AND CURRENT ROW)`) in standard ANSI SQL. The idiomatic high-performance pattern joins the calendar spine to the logins within the rolling 6-day lookback window and groups by date.",
      complexity: "Time: $O(C \\times L)$ optimized via date partitioning."
    }
  ],

  incidentPostMortemDrills: [
    {
      id: "drill-1",
      title: "The Silent Metric Drop (Revenue -35% at 8:00 AM)",
      scenario: "At 8:15 AM, the VP of Finance Slacks you: 'Why does the executive dashboard show total revenue dropped 35% yesterday? Are our sales down or is data broken?'. You check Airflow: all 42 DAG tasks for yesterday completed with status SUCCESS (green). What do you do in the first 60 minutes?",
      rubric: [
        {
          phase: "0-15 Minutes: Incident Triage & Communication",
          action: "Acknowledge immediately: 'Investigating now, preliminary update within 20 mins.' Never stay silent. Create a dedicated incident Slack channel (#inc-202610-rev-drop). Do not touch production code yet."
        },
        {
          phase: "15-30 Minutes: Diagnostic Investigation",
          action: "Check row count anomalies in staging vs raw: did raw events drop or did transformation filter rows out? Query: `SELECT COUNT(*), SUM(amount) FROM raw_transactions WHERE date = 'yesterday'`. If raw numbers match expected volume, inspect recent dbt commits or upstream schema changes. You discover an upstream engineer added a new payment gateway code `'STRIPE_ELEMENTS_V2'` which was excluded by an old hardcoded filter `WHERE payment_method IN ('STRIPE_V1', 'PAYPAL')`."
        },
        {
          phase: "30-50 Minutes: Fix & Idempotent Backfill",
          action: "Create a hotfix branch. Update the model to dynamically include all valid payment statuses. Run dbt tests locally in dev. Deploy to production via CI/CD. Trigger an idempotent backfill for yesterday's partition."
        },
        {
          phase: "50-60 Minutes: Post-Mortem & Prevention",
          action: "Write Post-Mortem (Blameless). Action item: replace hardcoded payment filter with a dynamic mapping table and add a Data Quality check that alerts if uncategorized payment methods appear in staging."
        }
      ]
    },
    {
      id: "drill-2",
      title: "The Upstream Breaking Schema Push on Friday Night",
      scenario: "An upstream software engineering team deploys a database migration at 6:30 PM on Friday that renames column `customer_id` to `account_uuid` in PostgreSQL. At 2:00 AM Saturday, the nightly ETL crashes, blocking customer reports for Monday morning.",
      rubric: [
        {
          phase: "Triage & Blast Radius",
          action: "Assess which downstream tables and stakeholder dashboards are impacted. Mark downstream tables with a temporary 'Data Freshness Delayed' banner in the BI tool."
        },
        {
          phase: "Defensive Transformation Patch",
          action: "In the staging dbt layer, update the extraction query with backward-compatible aliasing: `COALESCE(account_uuid, customer_id) AS customer_id` to handle both old historical records and new records."
        },
        {
          phase: "Organizational Long-Term Solution",
          action: "Implement Data Contracts with pre-merge GitHub Actions checking database migration PRs in the upstream repo against a schema registry to reject breaking column renames."
        }
      ]
    }
  ]
};

