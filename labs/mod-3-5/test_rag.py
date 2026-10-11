"""Tests for Lab 3.5 (RAG data pipeline).   pip install -r labs/mod-3-5/requirements.txt && pytest labs/mod-3-5 -v

The tests start a throw-away embedded PostgreSQL with pgvector (pgserver). To use your own server instead, set DATABASE_URL
to an EMPTY scratch database that has the pgvector extension available.
"""
import math
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import psycopg
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
import kbgen  # noqa: E402
import labtools  # noqa: E402

lab = labtools.load(__file__, "rag.py")
DOCS, EVAL = kbgen.build()


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b))


# ---------------------------------------------------------------------------- pure functions

class TestChunking:
    def test_each_paragraph_is_a_chunk(self):
        assert lab.chunk_text("First para here.\n\nSecond   para\nspans lines.") == ["First para here.", "Second para spans lines."]

    def test_a_heading_joins_the_paragraph_after_it(self):
        assert lab.chunk_text("# Parking at Kemang\n\nFree for two hours.\n\nValet after 18:00.") == [
            "Parking at Kemang\nFree for two hours.", "Valet after 18:00."]

    def test_several_headings_and_a_trailing_heading(self):
        assert lab.chunk_text("# Policies\n\n## Refunds\n\nWithin 7 days.\n\n## Appendix") == ["Policies\nRefunds\nWithin 7 days.", "Appendix"]

    def test_long_paragraphs_are_cut_into_overlapping_windows(self):
        words = [f"w{i}" for i in range(100)]
        chunks = lab.chunk_text(" ".join(words), max_words=40, overlap=10)
        assert [c.split()[0] for c in chunks] == ["w0", "w30", "w60"]
        assert all(len(c.split()) <= 40 for c in chunks)
        assert chunks[0].split()[-10:] == chunks[1].split()[:10]
        assert chunks[-1].split()[-1] == "w99"

    def test_no_tiny_tail_window(self):
        chunks = lab.chunk_text(" ".join(f"w{i}" for i in range(70)), max_words=40, overlap=10)
        assert [c.split()[0] for c in chunks] == ["w0", "w30"]

    def test_empty_and_blank_text(self):
        assert lab.chunk_text("") == [] and lab.chunk_text("\n\n  \n") == []

    def test_editing_one_paragraph_changes_only_that_chunk(self):
        before = lab.chunk_text(DOCS[0]["text"])
        after = lab.chunk_text(DOCS[0]["text"].replace("on weekdays", "on weekdays and Fridays"))
        assert len(before) == len(after)
        assert sum(a != b for a, b in zip(before, after)) == 1


class TestEmbed:
    def test_has_the_right_length_and_unit_norm(self):
        v = lab.embed("kopi susu gula aren")
        assert len(v) == lab.DIM and math.sqrt(sum(x * x for x in v)) == pytest.approx(1.0)

    def test_is_deterministic(self):
        assert lab.embed("refund policy") == lab.embed("refund policy")

    def test_ignores_case_order_and_stopwords(self):
        assert lab.embed("Refund the POLICY") == pytest.approx(lab.embed("policy refund"))

    def test_related_text_is_closer_than_unrelated_text(self):
        q = lab.embed("parking at the Kemang store")
        near = lab.embed("Parking at Kemang is free for customers")
        far = lab.embed("Allergens in Americano: none")
        assert cosine(q, near) > cosine(q, far) + 0.3

    def test_a_different_model_is_a_different_space(self):
        assert abs(cosine(lab.embed("kopi susu", model="v1"), lab.embed("kopi susu", model="v2"))) < 0.5

    def test_text_without_tokens_is_the_zero_vector(self):
        assert lab.embed("the of and") == [0.0] * lab.DIM


class TestContentHash:
    def test_ignores_whitespace_changes(self):
        assert lab.content_hash("a  b\n c ") == lab.content_hash("a b c")

    def test_changes_with_content(self):
        assert lab.content_hash("a b c") != lab.content_hash("a b d")

    def test_is_a_sha256_hex_digest(self):
        h = lab.content_hash("x")
        assert len(h) == 64 and int(h, 16) >= 0


class TestRecall:
    def test_is_the_overlap_fraction(self):
        assert lab.recall_at_k([1, 2, 3, 9], [1, 2, 3, 4]) == 0.75

    def test_order_does_not_matter(self):
        assert lab.recall_at_k([4, 3, 2, 1], [1, 2, 3, 4]) == 1.0

    def test_no_overlap(self):
        assert lab.recall_at_k([7, 8], [1, 2]) == 0.0


# ---------------------------------------------------------------------------- database tests

@pytest.fixture(scope="module")
def conn():
    server = None
    url = os.environ.get("DATABASE_URL")
    if not url:
        import pgserver
        server = pgserver.get_server(tempfile.mkdtemp(prefix="rag_pg_"))
        url = server.get_uri()
    c = psycopg.connect(url, autocommit=True)
    c.execute("DROP TABLE IF EXISTS chunks, vecs")
    lab.create_schema(c)
    yield c
    c.close()
    if server:
        server.cleanup()


@pytest.fixture(scope="module")
def kb(conn):
    for d in DOCS:
        lab.sync_document(conn, d["doc_id"], d["category"], d["text"])
    return conn


class Counter:
    """An embedding function that counts how often the (paid) model is called."""

    def __init__(self):
        self.calls = 0

    def __call__(self, text, model="v1"):
        self.calls += 1
        return lab.embed(text, model=model)


@pytest.fixture
def scratch(conn):
    yield conn
    conn.execute("DELETE FROM chunks WHERE doc_id LIKE 'tmp-%'")


TEXT = "# Title\n\nFirst paragraph about coffee.\n\nSecond paragraph about tea.\n\nThird paragraph about cake."


class TestSync:
    def test_first_sync_embeds_every_chunk(self, scratch):
        emb = Counter()
        res = lab.sync_document(scratch, "tmp-a", "x", TEXT, embed_fn=emb)
        assert res == {"embedded": 3, "kept": 0, "deleted": 0} and emb.calls == 3
        rows = scratch.execute("SELECT chunk_no, content FROM chunks WHERE doc_id='tmp-a' ORDER BY chunk_no").fetchall()
        assert [r[0] for r in rows] == [0, 1, 2] and rows[0][1].startswith("Title\nFirst paragraph")

    def test_syncing_unchanged_text_costs_nothing(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        emb = Counter()
        assert lab.sync_document(scratch, "tmp-a", "x", TEXT, embed_fn=emb) == {"embedded": 0, "kept": 3, "deleted": 0}
        assert emb.calls == 0

    def test_editing_one_paragraph_embeds_one_chunk(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        emb = Counter()
        res = lab.sync_document(scratch, "tmp-a", "x", TEXT.replace("about tea", "about green tea"), embed_fn=emb)
        assert res == {"embedded": 1, "kept": 2, "deleted": 1} and emb.calls == 1
        assert scratch.execute("SELECT count(*) FROM chunks WHERE doc_id='tmp-a'").fetchone()[0] == 3

    def test_inserting_a_paragraph_only_embeds_the_new_one_and_reorders(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        new = TEXT.replace("Second paragraph", "Brand new paragraph about juice.\n\nSecond paragraph")
        assert lab.sync_document(scratch, "tmp-a", "x", new) == {"embedded": 1, "kept": 3, "deleted": 0}
        order = [r[0].split()[0] for r in scratch.execute("SELECT content FROM chunks WHERE doc_id='tmp-a' ORDER BY chunk_no")]
        assert order == ["Title", "Brand", "Second", "Third"]

    def test_removed_text_removes_its_vectors(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        res = lab.sync_document(scratch, "tmp-a", "x", "# Title\n\nFirst paragraph about coffee.")
        assert res == {"embedded": 0, "kept": 1, "deleted": 2}
        assert scratch.execute("SELECT count(*) FROM chunks WHERE doc_id='tmp-a'").fetchone()[0] == 1

    def test_a_repeated_paragraph_is_stored_once(self, scratch):
        res = lab.sync_document(scratch, "tmp-a", "x", "Same text here.\n\nSame text here.\n\nOther text.")
        assert res["embedded"] == 2

    def test_a_new_model_re_embeds_everything_even_if_the_text_is_unchanged(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT, model="v1")
        res = lab.sync_document(scratch, "tmp-a", "x", TEXT, model="v2")
        assert res == {"embedded": 3, "kept": 0, "deleted": 0}
        assert scratch.execute("SELECT DISTINCT model FROM chunks WHERE doc_id='tmp-a'").fetchall() == [("v2",)]

    def test_a_category_change_needs_no_new_embeddings(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        emb = Counter()
        lab.sync_document(scratch, "tmp-a", "y", TEXT, embed_fn=emb)
        assert emb.calls == 0
        assert scratch.execute("SELECT DISTINCT category FROM chunks WHERE doc_id='tmp-a'").fetchall() == [("y",)]

    def test_a_failure_halfway_leaves_the_document_untouched(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        before = scratch.execute("SELECT content_hash, chunk_no FROM chunks WHERE doc_id='tmp-a' ORDER BY 1").fetchall()

        def flaky(text, model="v1"):
            if "Brand" in text:
                raise RuntimeError("embedding API down")
            return lab.embed(text, model=model)

        new = "# Title\n\nCompletely different first.\n\nBrand new second.\n\nThird paragraph about cake."
        with pytest.raises(RuntimeError):
            lab.sync_document(scratch, "tmp-a", "x", new, embed_fn=flaky)
        assert scratch.execute("SELECT content_hash, chunk_no FROM chunks WHERE doc_id='tmp-a' ORDER BY 1").fetchall() == before

    def test_the_stored_vector_is_the_embedding_of_the_content(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", "Only one paragraph about espresso.")
        content = scratch.execute("SELECT content FROM chunks WHERE doc_id='tmp-a'").fetchone()[0]
        d = scratch.execute("SELECT embedding <=> %s::vector FROM chunks WHERE doc_id='tmp-a'", (lab.vec_literal(lab.embed(content)),)).fetchone()[0]
        assert d < 1e-4

    def test_deleting_a_document_removes_only_its_chunks(self, scratch):
        lab.sync_document(scratch, "tmp-a", "x", TEXT)
        lab.sync_document(scratch, "tmp-b", "x", TEXT)
        assert lab.delete_document(scratch, "tmp-a") == 3
        assert scratch.execute("SELECT count(*) FROM chunks WHERE doc_id='tmp-a'").fetchone()[0] == 0
        assert scratch.execute("SELECT count(*) FROM chunks WHERE doc_id='tmp-b'").fetchone()[0] == 3


class TestSearch:
    def test_finds_the_right_document(self, kb):
        top = lab.search(kb, "what time does the Kemang store open", k=3)
        assert top[0]["doc_id"] == "store-kemang-hours"

    def test_results_are_sorted_and_have_scores(self, kb):
        res = lab.search(kb, "can I use two vouchers on one order", k=5)
        assert len(res) == 5
        scores = [r["score"] for r in res]
        assert scores == sorted(scores, reverse=True) and all(-1.0001 <= s <= 1.0001 for s in scores)
        assert set(res[0]) == {"doc_id", "chunk_no", "content", "score"}

    def test_a_category_filter_still_returns_k_results(self, kb):
        res = lab.search(kb, "parking free hours", k=5, category="menu")
        assert len(res) == 5 and all(r["doc_id"].startswith(("product-", "allergens-")) for r in res)

    def test_only_chunks_of_the_same_model_are_compared(self, kb):
        assert lab.search(kb, "kemang opening hours", model="v9") == []


class TestEvaluation:
    def test_retrieval_quality_on_the_eval_set(self, kb):
        r = lab.evaluate(kb, EVAL, k=5)
        assert r["hit_rate"] >= 0.95 and r["mrr"] >= 0.75

    def test_a_larger_k_can_only_help(self, kb):
        assert lab.evaluate(kb, EVAL, k=1)["hit_rate"] < lab.evaluate(kb, EVAL, k=5)["hit_rate"] <= lab.evaluate(kb, EVAL, k=10)["hit_rate"]

    def test_hits_and_misses_are_counted_exactly(self, kb):
        items = [{"query": "what time does the Kemang store open", "doc_id": "store-kemang-hours"},
                 {"query": "what time does the Kemang store open", "doc_id": "does-not-exist"}]
        assert lab.evaluate(kb, items, k=5) == {"hit_rate": 0.5, "mrr": 0.5}

    def test_an_unreachable_model_scores_zero_instead_of_garbage(self, kb):
        assert lab.evaluate(kb, EVAL[:10], k=5, model="v2") == {"hit_rate": 0.0, "mrr": 0.0}


# ---------------------------------------------------------------------------- approximate search

N, D = 20000, 64


@pytest.fixture(scope="module")
def ann(conn):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(N, D))
    x /= np.linalg.norm(x, axis=1, keepdims=True)
    q = rng.normal(size=(50, D))
    q /= np.linalg.norm(q, axis=1, keepdims=True)
    conn.execute("DROP TABLE IF EXISTS vecs")
    conn.execute(f"CREATE TABLE vecs (id int PRIMARY KEY, embedding vector({D}))")
    with conn.cursor().copy("COPY vecs (id, embedding) FROM STDIN") as cp:
        for i, v in enumerate(x):
            cp.write_row((i + 1, lab.vec_literal(v)))
    conn.execute("SET max_parallel_maintenance_workers = 0")
    lab.create_hnsw_index(conn, "vecs", m=16, ef_construction=64)
    exact = [list(np.argsort(-(x @ v))[:10] + 1) for v in q]  # ground truth, computed outside the database
    return conn, q, exact


def mean_recall(ann, ef):
    conn, q, exact = ann
    return sum(lab.recall_at_k(lab.ann_top_k(conn, "vecs", v, 10, ef), e) for v, e in zip(q, exact)) / len(q)


class TestApproximateSearch:
    def test_the_index_has_the_requested_parameters(self, ann):
        conn = ann[0]
        d = conn.execute("SELECT indexdef FROM pg_indexes WHERE tablename='vecs' AND indexname='vecs_hnsw'").fetchone()[0]
        assert "hnsw" in d and "vector_cosine_ops" in d and "m='16'" in d.replace(" ", "").replace("m=16", "m='16'")

    def test_queries_use_the_index(self, ann):
        conn, q, _ = ann
        plan = "\n".join(r[0] for r in conn.execute("EXPLAIN SELECT id FROM vecs ORDER BY embedding <=> %s::vector LIMIT 10", (lab.vec_literal(q[0]),)))
        assert "vecs_hnsw" in plan

    def test_returns_k_ids_nearest_first(self, ann):
        conn, q, exact = ann
        ids = lab.ann_top_k(conn, "vecs", q[0], 10, ef_search=400)
        assert len(ids) == 10 and ids[0] == exact[0][0]

    def test_a_small_search_breadth_misses_neighbours(self, ann):
        assert mean_recall(ann, 10) < 0.6

    def test_widening_the_search_buys_recall(self, ann):
        r10, r100, r400 = (mean_recall(ann, ef) for ef in (10, 100, 400))
        assert r10 < r100 < r400
        assert r400 >= 0.95
