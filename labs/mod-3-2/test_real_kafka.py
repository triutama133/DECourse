"""Tests for Lab 3.2 part B (real Kafka).   KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v"""
import os
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

import pytest

BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP")
if not BOOTSTRAP:
    pytest.skip("set KAFKA_BOOTSTRAP (e.g. localhost:19092) to run the real-Kafka tests", allow_module_level=True)

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import labtools  # noqa: E402

lab = labtools.load(__file__, "real_kafka.py")

ORDERS = [{"order_id": 1000 + i, "customer_id": i % 7, "total_idr": 10000 + i} for i in range(60)]


@pytest.fixture()
def topic():
    name = f"orders-{uuid.uuid4().hex[:8]}"
    lab.create_topic(BOOTSTRAP, name, partitions=3)
    return name


def test_topic_is_created_with_the_requested_config():
    name = f"compacted-{uuid.uuid4().hex[:8]}"
    lab.create_topic(BOOTSTRAP, name, partitions=2, config={"cleanup.policy": "compact"})
    assert lab.topic_config(BOOTSTRAP, name)["cleanup.policy"] == "compact"


def test_every_order_is_delivered_and_a_customers_orders_share_a_partition(topic):
    results = lab.produce_orders(BOOTSTRAP, topic, ORDERS)
    assert len(results) == len(ORDERS)
    assert Counter(p for p, _ in results).keys() <= {0, 1, 2}
    # read them back to check keys -> partitions
    seen = defaultdict(set)
    lab.consume_with_manual_commit(BOOTSTRAP, topic, f"check-{uuid.uuid4().hex[:6]}", lambda o: None, len(ORDERS))
    from confluent_kafka import Consumer
    c = Consumer({"bootstrap.servers": BOOTSTRAP, "group.id": f"keys-{uuid.uuid4().hex[:6]}", "auto.offset.reset": "earliest"})
    c.subscribe([topic])
    got = 0
    while got < len(ORDERS):
        for msg in c.consume(num_messages=100, timeout=2.0):
            seen[msg.key().decode()].add(msg.partition())
            got += 1
    c.close()
    assert all(len(parts) == 1 for parts in seen.values()), "all messages with the same key must be in one partition"


def test_manual_commit_consumption_processes_everything_and_clears_the_lag(topic):
    lab.produce_orders(BOOTSTRAP, topic, ORDERS)
    group = f"billing-{uuid.uuid4().hex[:6]}"
    assert lab.group_lag(BOOTSTRAP, topic, group) == len(ORDERS), "a new group has not committed anything"
    handled = []
    done = lab.consume_with_manual_commit(BOOTSTRAP, topic, group, handled.append, len(ORDERS))
    assert len(done) == len(handled) == len(ORDERS)
    assert sorted(o["order_id"] for o in handled) == sorted(o["order_id"] for o in ORDERS)
    assert lab.group_lag(BOOTSTRAP, topic, group) == 0


def test_a_new_consumer_in_the_same_group_resumes_after_the_committed_offset(topic):
    lab.produce_orders(BOOTSTRAP, topic, ORDERS)
    group = f"resume-{uuid.uuid4().hex[:6]}"
    lab.consume_with_manual_commit(BOOTSTRAP, topic, group, lambda o: None, len(ORDERS))
    lab.produce_orders(BOOTSTRAP, topic, [{"order_id": 9999, "customer_id": 1, "total_idr": 1}])
    second = []
    lab.consume_with_manual_commit(BOOTSTRAP, topic, group, second.append, 1)
    assert [o["order_id"] for o in second] == [9999], "only the NEW message is delivered to the resumed group"
