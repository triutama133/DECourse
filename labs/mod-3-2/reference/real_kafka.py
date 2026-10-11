"""Reference solution for Lab 3.2 part B: the same ideas against a REAL Kafka broker (confluent-kafka)."""
import json

from confluent_kafka import Consumer, KafkaException, Producer, TopicPartition
from confluent_kafka.admin import AdminClient, ConfigResource, NewTopic


def create_topic(bootstrap, name, partitions=3, config=None):
    admin = AdminClient({"bootstrap.servers": bootstrap})
    futures = admin.create_topics([NewTopic(name, num_partitions=partitions, replication_factor=1, config=config or {})])
    futures[name].result(timeout=15)


def topic_config(bootstrap, name):
    admin = AdminClient({"bootstrap.servers": bootstrap})
    res = ConfigResource(ConfigResource.Type.TOPIC, name)
    return {k: v.value for k, v in admin.describe_configs([res])[res].result(timeout=15).items()}


def produce_orders(bootstrap, topic, orders):
    """Send each order as JSON, keyed by customer_id. Returns [(partition, offset), ...] in send order."""
    producer = Producer({"bootstrap.servers": bootstrap, "enable.idempotence": True, "acks": "all"})
    results, errors = [], []

    def on_delivery(err, msg):
        if err is not None:
            errors.append(err)
        else:
            results.append((msg.partition(), msg.offset()))

    for order in orders:
        producer.produce(topic, key=str(order["customer_id"]), value=json.dumps(order), on_delivery=on_delivery)
        producer.poll(0)
    producer.flush(30)
    if errors:
        raise KafkaException(errors[0])
    return results


def consume_with_manual_commit(bootstrap, topic, group, process, expected, timeout_s=30):
    """Process `expected` messages, committing offsets only AFTER the batch has been processed (at-least-once)."""
    consumer = Consumer({"bootstrap.servers": bootstrap, "group.id": group, "enable.auto.commit": False,
                         "auto.offset.reset": "earliest"})
    consumer.subscribe([topic])
    done, waited = [], 0.0
    try:
        while len(done) < expected and waited < timeout_s:
            msgs = consumer.consume(num_messages=50, timeout=1.0)
            if not msgs:
                waited += 1.0
                continue
            for msg in msgs:
                if msg.error():
                    raise KafkaException(msg.error())
                process(json.loads(msg.value()))
                done.append((msg.partition(), msg.offset()))
            consumer.commit(asynchronous=False)          # after processing, not before
    finally:
        consumer.close()
    return done


def group_lag(bootstrap, topic, group):
    """Total number of messages the group has not committed past, across all partitions."""
    consumer = Consumer({"bootstrap.servers": bootstrap, "group.id": group, "enable.auto.commit": False})
    try:
        meta = consumer.list_topics(topic, timeout=10).topics[topic]
        parts = [TopicPartition(topic, p) for p in meta.partitions]
        committed = {tp.partition: tp.offset for tp in consumer.committed(parts, timeout=10)}
        lag = 0
        for p in meta.partitions:
            _, high = consumer.get_watermark_offsets(TopicPartition(topic, p), timeout=10)
            c = committed.get(p, -1001)
            lag += high - (c if c >= 0 else 0)
        return lag
    finally:
        consumer.close()
