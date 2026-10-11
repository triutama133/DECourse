"""Lab 3.5: the data-engineering half of a RAG system: chunk, embed, sync incrementally, search, evaluate.

Everything runs offline. `embed` is a deterministic hashing embedder (a stand-in with the same shape as a real model:
text in, fixed-length unit vector out). Replace it with a real model call and the rest of the pipeline stays the same.
"""
import hashlib
import math
import re

DIM = 256
STOPWORDS = {"the", "a", "an", "is", "are", "and", "or", "of", "to", "in", "on", "at", "for", "with", "my", "do", "does",
             "i", "it", "this", "that", "be", "by", "can", "how", "what", "which", "there", "you", "your", "we", "our", "from"}

SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS chunks (
    doc_id       text NOT NULL,
    content_hash text NOT NULL,
    chunk_no     int  NOT NULL,
    category     text NOT NULL,
    content      text NOT NULL,
    model        text NOT NULL,
    embedding    vector({DIM}) NOT NULL,
    PRIMARY KEY (doc_id, content_hash)
);
"""


def create_schema(conn):
    conn.execute(SCHEMA)


def vec_literal(vec):
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def tokens(text):
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS]


# ---------------------------------------------------------------- chunking, embedding, hashing

def chunk_text(text, max_words=80, overlap=10):
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    pieces, headings = [], []
    for p in paragraphs:
        if p.startswith("#"):
            headings.append(" ".join(re.sub(r"^#+\s*", "", p).split()))
            continue
        pieces.append("\n".join(headings + [" ".join(p.split())]))
        headings = []
    if headings:
        pieces.append("\n".join(headings))
    chunks = []
    for piece in pieces:
        words = piece.split()
        if len(words) <= max_words:
            chunks.append(piece)
            continue
        step = max_words - overlap
        for start in range(0, len(words), step):
            chunks.append(" ".join(words[start:start + max_words]))
            if start + max_words >= len(words):
                break
    return chunks


def embed(text, dim=DIM, model="v1"):
    vec = [0.0] * dim
    for tok in tokens(text):
        h = hashlib.blake2b(f"{model}:{tok}".encode(), digest_size=8).digest()
        vec[int.from_bytes(h[:4], "big") % dim] += 1.0 if h[4] & 1 else -1.0
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm else vec


def content_hash(text):
    return hashlib.sha256(" ".join(text.split()).encode()).hexdigest()


# ---------------------------------------------------------------- incremental sync

def sync_document(conn, doc_id, category, text, model="v1", embed_fn=embed):
    chunks, seen = [], set()
    for content in chunk_text(text):
        h = content_hash(content)
        if h not in seen:
            seen.add(h)
            chunks.append((len(chunks), h, content))
    embedded = kept = 0
    with conn.transaction():
        existing = dict(conn.execute("SELECT content_hash, model FROM chunks WHERE doc_id = %s", (doc_id,)).fetchall())
        for no, h, content in chunks:
            if existing.get(h) == model:
                conn.execute("UPDATE chunks SET chunk_no = %s, category = %s WHERE doc_id = %s AND content_hash = %s",
                             (no, category, doc_id, h))
                kept += 1
                continue
            vec = embed_fn(content, model=model)
            conn.execute(
                """INSERT INTO chunks (doc_id, content_hash, chunk_no, category, content, model, embedding)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                   ON CONFLICT (doc_id, content_hash) DO UPDATE
                   SET chunk_no = EXCLUDED.chunk_no, category = EXCLUDED.category, model = EXCLUDED.model,
                       embedding = EXCLUDED.embedding""",
                (doc_id, h, no, category, content, model, vec_literal(vec)))
            embedded += 1
        keep = [h for _, h, _ in chunks]
        deleted = conn.execute("DELETE FROM chunks WHERE doc_id = %s AND NOT (content_hash = ANY(%s))",
                               (doc_id, keep)).rowcount
    return {"embedded": embedded, "kept": kept, "deleted": deleted}


def delete_document(conn, doc_id):
    return conn.execute("DELETE FROM chunks WHERE doc_id = %s", (doc_id,)).rowcount


# ---------------------------------------------------------------- retrieval and evaluation

def search(conn, query, k=5, category=None, model="v1", embed_fn=embed):
    qv = vec_literal(embed_fn(query, model=model))
    sql = """SELECT doc_id, chunk_no, content, 1 - (embedding <=> %s::vector) AS score
             FROM chunks WHERE model = %s AND (%s::text IS NULL OR category = %s)
             ORDER BY embedding <=> %s::vector LIMIT %s"""
    rows = conn.execute(sql, (qv, model, category, category, qv, k)).fetchall()
    return [{"doc_id": r[0], "chunk_no": r[1], "content": r[2], "score": float(r[3])} for r in rows]


def evaluate(conn, eval_set, k=5, **search_kwargs):
    hits, rr = 0, 0.0
    for item in eval_set:
        docs = []
        for r in search(conn, item["query"], k=k, **search_kwargs):
            if r["doc_id"] not in docs:
                docs.append(r["doc_id"])
        if item["doc_id"] in docs:
            hits += 1
            rr += 1 / (docs.index(item["doc_id"]) + 1)
    n = len(eval_set)
    return {"hit_rate": round(hits / n, 4), "mrr": round(rr / n, 4)}


# ---------------------------------------------------------------- approximate nearest neighbours

def recall_at_k(approx_ids, exact_ids):
    return len(set(approx_ids) & set(exact_ids)) / len(exact_ids)


def create_hnsw_index(conn, table, m=16, ef_construction=64):
    conn.execute(f"CREATE INDEX {table}_hnsw ON {table} USING hnsw (embedding vector_cosine_ops) "
                 f"WITH (m = {int(m)}, ef_construction = {int(ef_construction)})")


def ann_top_k(conn, table, vec, k=10, ef_search=40):
    with conn.transaction():
        conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef_search)}")
        rows = conn.execute(f"SELECT id FROM {table} ORDER BY embedding <=> %s::vector LIMIT %s",
                            (vec_literal(vec), k)).fetchall()
    return [r[0] for r in rows]
