"""Reference fix for the streaming_rag_skew chaos drill (scripts/chaos_drill.py). Try the drill yourself before reading this."""

def process_stream_and_vectors(events, watermark_ts, vector_chunks, active_model):
    window_sum = 0
    late_dlq = []
    seen = set()
    for ev in events:
        eid = str(ev["event_id"])
        if eid in seen:
            continue
        seen.add(eid)
        if int(ev["event_ts"]) < int(watermark_ts):
            late_dlq.append(eid)
        else:
            window_sum += int(ev["amount"])
    matching_chunks = [
        c["doc_id"] for c in vector_chunks if c.get("model") == active_model
    ]
    return {
        "window_sum": window_sum,
        "late_dlq": late_dlq,
        "matching_chunks": matching_chunks,
    }
