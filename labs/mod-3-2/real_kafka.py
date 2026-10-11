"""Lab 3.2 part B: a real Kafka broker with confluent-kafka.   Tests: KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v

Start a broker first: `docker compose up -d redpanda` (from the course repository; the external listener is localhost:19092)
or any Kafka. Without KAFKA_BOOTSTRAP the tests are skipped.
"""
import json

from confluent_kafka import Consumer, KafkaException, Producer, TopicPartition  # noqa: F401
from confluent_kafka.admin import AdminClient, ConfigResource, NewTopic  # noqa: F401


def create_topic(bootstrap, name, partitions=3, config=None):
    """Create a topic (replication factor 1) with the given partition count and topic-level config dict,
    e.g. {"cleanup.policy": "compact"}. Wait for it to be created (AdminClient.create_topics returns futures)."""
    raise NotImplementedError("TODO: create_topic")


def topic_config(bootstrap, name):
    """Return the topic's configuration as {name: value} (AdminClient.describe_configs with a ConfigResource)."""
    raise NotImplementedError("TODO: topic_config")


def produce_orders(bootstrap, topic, orders):
    """Send every order dict as a JSON message KEYED by str(customer_id) (so one customer's orders stay in order).
    Use an IDEMPOTENT producer: config enable.idempotence=True and acks='all'.
    Collect delivery results with an on_delivery callback; flush; if any delivery failed raise KafkaException.
    Return [(partition, offset), ...] in the order messages were acknowledged."""
    raise NotImplementedError("TODO: produce_orders")


def consume_with_manual_commit(bootstrap, topic, group, process, expected, timeout_s=30):
    """Read until `expected` messages were processed (or timeout_s passes without data). Rules:
      - Consumer config: group.id=group, enable.auto.commit=False, auto.offset.reset='earliest'
      - call process(json_decoded_value) for every message, THEN commit offsets synchronously: commit AFTER processing
        gives at-least-once delivery (a crash in between re-delivers; committing BEFORE would risk losing messages)
      - raise KafkaException on a message error; always close the consumer
    Return [(partition, offset), ...] of processed messages."""
    raise NotImplementedError("TODO: consume_with_manual_commit")


def group_lag(bootstrap, topic, group):
    """Messages the group has not yet committed past, summed over all partitions: for each partition,
    high watermark (consumer.get_watermark_offsets) minus the group's committed offset (consumer.committed; an unset
    offset is negative and means 0). Use a Consumer with the same group.id but do not subscribe or commit."""
    raise NotImplementedError("TODO: group_lag")
