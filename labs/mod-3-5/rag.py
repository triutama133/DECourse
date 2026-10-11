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
    """Split a Markdown-ish document into chunks that each make sense alone.

    1. Paragraphs are separated by blank lines. Each paragraph is a chunk, with its whitespace collapsed to single spaces.
    2. A paragraph that starts with "#" is a HEADING. Remove the leading #'s and join the heading, a newline, and the NEXT
       normal paragraph into one chunk, so the chunk carries its context ("Parking at Kemang\nFree for two hours.").
       Consecutive headings all go in front of the next paragraph. A heading with nothing after it is a chunk by itself.
    3. A chunk longer than max_words words is split into windows of max_words words that start max_words - overlap words
       apart (consecutive windows share `overlap` words). Stop at the window that reaches the last word: no tiny tail window.
    An empty text gives [].
    """
    raise NotImplementedError


def embed(text, dim=DIM, model="v1"):
    """A deterministic hashing embedder: a stand-in with the same SHAPE as a real model.

    For every token in tokens(text), hash f"{model}:{token}" with blake2b(digest_size=8). Take int.from_bytes(h[:4], "big") % dim as the
    index and the lowest bit of h[4] as the sign (bit 1 -> +1.0, bit 0 -> -1.0), and add the sign to that component.
    Then scale to unit length (L2). A text with no tokens gives the zero vector. Do not use Python's built-in hash():
    it changes between runs.
    """
    raise NotImplementedError


def content_hash(text):
    """sha256 hex digest of the text after collapsing all runs of whitespace to single spaces (so reformatting alone changes nothing)."""
    raise NotImplementedError


# ---------------------------------------------------------------- incremental sync

def sync_document(conn, doc_id, category, text, model="v1", embed_fn=embed):
    """Bring the `chunks` rows of one document in line with `text`, calling the (paid!) embedding model as rarely as possible.

    Identity of a chunk is (doc_id, content_hash). Chunks are produced by chunk_text; if two chunks of the document have the
    same content_hash keep only the first. chunk_no is the position (0, 1, 2 ...) among the kept chunks.
      - A stored chunk with the same hash AND the same model is KEPT: do not call embed_fn; just refresh its chunk_no and category.
      - A new hash, or a stored chunk made by a different model, is EMBEDDED: call embed_fn(content, model=model) and upsert the row
        (insert, or update on conflict) with the vector as vec_literal(...) cast ::vector.
      - Stored chunks of this document whose hash is no longer present are DELETED.
    Do all of it in one transaction (with conn.transaction():), so an error halfway leaves the document exactly as it was.
    Return {"embedded": n, "kept": n, "deleted": n}.
    """
    raise NotImplementedError


def delete_document(conn, doc_id):
    """Delete every chunk of a document (a deletion request must really remove its vectors). Return the number of rows deleted."""
    raise NotImplementedError


# ---------------------------------------------------------------- retrieval and evaluation

def search(conn, query, k=5, category=None, model="v1", embed_fn=embed):
    """Return the k most similar chunks, best first, as dicts: doc_id, chunk_no, content, score (= 1 - cosine distance).

    Embed the query with embed_fn(query, model=model). Only compare against chunks stored with the SAME model (vectors from
    different models live in different spaces and must never be compared). If `category` is given, only that category.
    Use the pgvector cosine distance operator <=> and ORDER BY it with LIMIT k, so that an index can be used.
    """
    raise NotImplementedError


def evaluate(conn, eval_set, k=5, **search_kwargs):
    """Measure retrieval quality. eval_set is [{"query", "doc_id"}], where doc_id is the one document that answers the query.

    For each query run search(..., k=k, **search_kwargs) and reduce the results to distinct doc_ids in rank order
    (several chunks of one document count once). HIT if the right doc_id is among them; its reciprocal rank is 1/(position, from 1).
    Return {"hit_rate": hits/n, "mrr": mean reciprocal rank (0 for a miss)}, each rounded to 4 decimals.
    """
    raise NotImplementedError


# ---------------------------------------------------------------- approximate nearest neighbours

def recall_at_k(approx_ids, exact_ids):
    """The fraction of the exact top-k ids that the approximate search also returned (order does not matter)."""
    raise NotImplementedError


def create_hnsw_index(conn, table, m=16, ef_construction=64):
    """Create an HNSW index named <table>_hnsw on table(embedding) for cosine distance (vector_cosine_ops) with the given m and ef_construction."""
    raise NotImplementedError


def ann_top_k(conn, table, vec, k=10, ef_search=40):
    """Return the ids (column id) of the k nearest rows to `vec` by cosine distance, nearest first, using the index.

    The search-time breadth is a setting: inside a transaction, run SET LOCAL hnsw.ef_search = <ef_search> before the query.
    """
    raise NotImplementedError
