---
title: AI and Vector Data Engineering
duration: 3 weeks
summary: Build the data pipeline behind a retrieval-augmented (RAG) application: chunk documents, embed them, store vectors in PostgreSQL with pgvector, sync changes incrementally and cheaply, tune approximate search, and measure retrieval quality so that model changes cannot silently break it.
why: Tutorials call an embedding API once on a pile of text files and show a chatbot. In production the hard part is the data engineering: documents change, models are replaced, deletion requests arrive, bills grow, and quality drops without any error message.
---

## @outcomes
- Explain retrieval-augmented generation (RAG) and which parts of it are data engineering work
- Describe embeddings and similarity search, and choose chunking and metadata strategies for a document collection
- Store and query vectors in PostgreSQL with pgvector, build an HNSW index, and tune the recall/latency trade-off with measurements
- Build an incremental, idempotent embedding pipeline that re-embeds only what changed, survives failures, supports deletion and tracks the model version
- Evaluate retrieval with a labelled question set (hit rate, MRR), and explain how model changes, filtering and access control can quietly break a RAG system

## @prereq
Modules 1.3 (PostgreSQL, indexes, EXPLAIN), 2.5 (data quality and contracts) and 3.2 (streaming and change capture are useful context for the sync lesson). The lab needs `pip install -r labs/mod-3-5/requirements.txt` and uses an embedded PostgreSQL (`pgserver`) that already contains pgvector. On Python 3.14 `pip` skips `pgserver` (no 3.14 wheel yet), so start the `pgvector/pgvector:pg16` Docker container and export `DATABASE_URL` as shown in `@verify` below. It makes no network calls, and needs no GPU, API key or account.

## @part From documents to vectors

## @lesson What RAG is, and what the data engineer owns
A large language model (LLM) knows what was in its training data. It does not know your refund policy, last week's price list or a customer's open ticket, and when it lacks facts it tends to produce fluent, confident, wrong answers. **Retrieval-augmented generation (RAG)** fixes this at question time: the application first *retrieves* the few passages of your own data that are relevant to the question, then puts them into the prompt and asks the model to answer from them (ideally citing them).

```
 documents --> chunk --> embed --> vector store         (offline: the data pipeline)
 question  --> embed --> nearest chunks --> prompt --> LLM --> answer + sources   (online)
```

:::talk The index that never heard of the change
@teacher A support bot answers from a vector index built last Monday. On Wednesday the refund policy changes from 14 days to 30 days. Nobody rebuilds the index. A customer asks, "Within how many days can I get a refund?"
@ask What does the bot answer?
@choice 30 days, because the bot reads the live policy | The bot reads the index, not the live policy, and the index is a copy made on Monday. Try again.
@choice * 14 days: confidently, from the old copy, and nothing in the pipeline failed | Yes. A stale index gives a wrong answer with no error. Keeping the index in step with its source is the data engineer's job.
@choice It says that it does not know | It found a matching passage, so it answers with it. Try again.
@teacher RAG makes the model exactly as current as your index. Sync is a data pipeline problem, with freshness checks like any other.
:::

The online part is application code. The offline part is a data pipeline like the ones you built in this course, with some new properties. Most RAG failures in production are caused by this part, not by the model:

- **Ingest and clean**: PDFs, wikis, tickets, web pages. Extraction errors (broken tables, repeated headers and footers) become wrong answers later.
- **Chunk**: cut documents into pieces that can be retrieved on their own.
- **Embed**: turn each piece into a vector with a model. This costs money and time per token.
- **Store and index**: keep vectors with their text and metadata, and search them fast.
- **Sync**: documents change and are deleted every day. The index must follow, cheaply and correctly.
- **Evaluate and monitor**: prove that retrieval works, and notice when it stops.
- **Govern**: who may see what, personal data, deletion requests, auditability.

Everything in the old checklist applies: idempotence, retries, backfills, data quality, lineage, cost. This module teaches the new parts and reuses the old ones. (The same skills also serve other AI work: assembling training and fine-tuning datasets, building evaluation sets, and feature pipelines for machine-learning models.)

> 🛠 **Try it (20 min, Python).** Build the smallest retrieval pipeline. Three documents: `refund` ("Refunds are possible within 14 days of purchase."), `shipping` ("Standard shipping takes 3 to 5 working days.") and `warranty` ("Devices have a one year warranty."). Tokenise with `re.findall(r"[a-z0-9]+", text.lower())`, make a `Counter` of tokens per document as the "index", and score a question by cosine similarity (defined mathematically in Lesson 2: `dot(a, b) / (norm(a) * norm(b))`, measuring how closely two word-count vectors align from 0 to 1) between its `Counter` and each document's. Print the scores for "Within how many days are refunds possible?" and for "banana pudding recipe". Then change the refund text to say 30 days **without** rebuilding the index and ask again; finally rebuild the index.
>
> **You should see:** scores of `0.67` for `refund`, `0.13` for `shipping` and `0.0` for `warranty` on the first question; all `0.0` on the second (a retriever always returns *something* ranked first, so a minimum score is part of the pipeline). With the stale index the retrieved text still says `14` although the source now says 30: the answer is wrong and nothing failed. Only after the rebuild does it say `30`. Sync is the data engineer's job.

:::ask A RAG chatbot gives wrong answers about the refund policy. The model is fine. Where should the data engineer look first?
@options
a bigger model with far more training parameters
* the offline extraction and chunking pipeline
the colour and the font of the chat window
@why
Most RAG failures in production come from the offline part: a broken table extracted as nonsense, a chunk that lost its context, or an index that still holds last year's policy.
:::

## @lesson Embeddings and similarity
An **embedding** is a list of numbers (a vector) that a model produces for a piece of text, so that texts with similar meaning get vectors that point in similar directions. Real embedding models have a few hundred to a few thousand dimensions (384, 768, 1,536, 3,072 are common). Search then becomes geometry: embed the question, find the stored vectors nearest to it.

:::talk Money back, refund
@teacher A customer asks a support bot: "Can I get my money back?" The policy document says: "Refunds are possible within 14 days of purchase." The question and the document share no important word.
@ask Which search finds the document?
@choice A keyword search for the words of the question | The question says "money back", the document says "refunds": no important word matches. Try again.
@choice * A search by embeddings: texts with similar meaning have vectors that are close together, even without shared words | Yes. That is the reason to embed. Cosine similarity measures how close the two vectors point, and "money back" and "refunds" point in nearly the same direction.
@choice Neither can find it | Embeddings were made for exactly this case. Try again.
@teacher Embeddings turn meaning into geometry: similar meanings sit close together.
:::

The usual closeness measure is **cosine similarity**: the cosine of the angle between two vectors. It is 1 for the same direction, 0 for unrelated and −1 for opposite. If vectors are scaled to length 1 it equals the dot product, and pgvector offers it as a *distance*: `<=>` is cosine distance (1 − similarity), `<->` is Euclidean distance and `<#>` is negative inner product. The operator you query with must match the operator class of the index.

### Vectors by hand: length and angle

A **vector** is just a list of numbers. Two things about it are needed for similarity. Its **length** (also called its *norm*) is found like the diagonal of a rectangle: `[3, 4]` has length 5, because 3 squared plus 4 squared is 25, and the square root of 25 is 5. The **dot product** of two vectors multiplies the matching numbers and adds them up. Cosine similarity is the dot product divided by the two lengths, so that only the **direction** of the vectors matters, not how long they are. Follow one example:

:::trace Cosine similarity of [3, 4] and [4, 3]
@code
a = [3, 4]
b = [4, 3]
dot = a[0] * b[0] + a[1] * b[1]
length_a = (a[0] ** 2 + a[1] ** 2) ** 0.5
length_b = (b[0] ** 2 + b[1] ** 2) ** 0.5
print(dot / (length_a * length_b))
@notes
3 | The dot product: 3 × 4 + 4 × 3 = 24.
4 | The length of `a`: the square root of 3² + 4² = 25, so 5.
5 | The length of `b` is also 5.
6 | 24 divided by 5 × 5 gives 0.96: the two vectors point in almost the same direction.
:::

:::ask The vectors `[1, 0]` and `[0, 1]` point in completely different directions (at a right angle). What is their cosine similarity?
@options
* 0, which means unrelated
1, the highest possible score
-1, which means exact opposites
@why
Their dot product is 1 × 0 + 0 × 1 = 0, so the cosine is 0 divided by the lengths: 0. A cosine of 1 means the same direction, 0 means unrelated, and -1 means opposite directions.
:::

### The stand-in used in the lab

A real model needs an API key or a download of hundreds of megabytes, and returns slightly different numbers across versions. To keep the lab offline and exactly reproducible, it uses a **hashing embedder**: every word is hashed to one of 256 positions, with a sign, and the counts are scaled to length 1. This captures *word overlap*, not meaning: "automobile" and "car" are unrelated to it, which a real model handles. Everything else in the module is identical for a real model: text goes in, a fixed-length unit vector comes out, and `embed` is the only function you would replace. The lab's hashing embedder takes a `model` name that changes the hashing, so two model names behave like two different incompatible real models. That is the point of the chaos scenario.

### Sizes and costs

A vector of 1,536 numbers stored as 4-byte floats is 6,144 bytes. Ten million chunks need about 61 GB for the vectors alone, plus the vector index (such as the graph index in Lesson 4, usually kept in memory for speed). Cost has four parts: **embedding** (billed per input token by hosted models; as an illustration, at $0.10 per million tokens a billion tokens costs $100, but check real prices), **storage and memory**, **queries** (each one embeds the question), and **re-embedding** whenever you change the chunking or the model. Lower dimension, half-precision (`halfvec`) or quantization trade a little accuracy for large savings, and some models can produce shorter vectors on request. Measure on your own eval set before choosing.

> 💡 **Practice Pause 1 (Deterministic Embedding & Content Hashing):**
> 1. Open `labs/mod-3-5/rag.py` in your text editor. Do not run this file directly in the terminal.
> 2. Implement `embed(text, dim, model)` using `hashlib.blake2b(..., digest_size=8)` (a fast deterministic hash that stays identical across Python restarts) and L2 unit-norm scaling (dividing every coordinate by `math.sqrt(sum(v * v))` so the vector has length `1.0`), and `content_hash(text)` using `sha256` after collapsing whitespace (`" ".join(text.split())`).
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-5/test_rag.py -k "TestEmbed or TestContentHash" -v`
> 4. **Success Indicator:** All 9 tests report `PASSED` in milliseconds in pure Python, validating deterministic L2 unit vectors and whitespace-invariant hashing.

:::drill python How close are two vectors?
Write `cosine(a, b)`: `a` and `b` are lists of numbers of the same length. Return the cosine similarity: the dot product divided by the product of the two vector lengths (norms). Vectors pointing the same way give 1, perpendicular ones 0, opposite ones −1.
@starter
import math
# write your function below this line

@check
defines("cosine") ## Define cosine(a, b).
abs(cosine([1, 0], [1, 0]) - 1) < 1e-9 ## The same direction: 1.
abs(cosine([1, 0], [0, 1])) < 1e-9 ## Perpendicular: 0.
abs(cosine([1, 0], [-1, 0]) + 1) < 1e-9 ## Opposite: −1.
abs(cosine([1, 1], [5, 5]) - 1) < 1e-9 ## Length does not matter, only direction.
@hint
Compute the dot product by summing products of paired elements (`zip`), compute each vector's length (`math.sqrt` of the sum of squares), then divide the dot product by the product of the two lengths.
@solution
import math
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b)
:::

## @lesson Chunking and metadata
You embed *chunks*, not documents. Embedding a whole 40-page manual produces a vector that is an average of everything, and retrieving 40 pages to answer one question fills the prompt with noise. Chunks that are too small lose their context ("It expires after 30 days" - what does?). Chunking is therefore a design decision with consequences for quality and for cost.

Common strategies, from simple to more careful:

1. **Fixed size** (for example 500 tokens with 50 overlap). Easy, but it cuts sentences and tables in half, and one inserted sentence moves every following boundary, so every later chunk changes.
2. **Structure-aware**: split by headings, paragraphs and list items, which is how people wrote the content. A small edit changes one chunk. The lab does this.
3. **Contextual**: attach the heading path (and sometimes a one-line summary of the document) to each chunk, because a chunk "Free for two hours." is meaningless alone. The lab joins a heading to the paragraph after it for this reason.
4. **Overlap** for paragraphs that exceed the size limit, so a fact on a boundary appears whole in at least one chunk.

Do not assume chunking always helps. In the lab's knowledge base, the 116 documents are short (about 45 words each) and become 256 chunks of about 15 words. On the labelled questions, embedding each whole document scores a hit rate of 99.1% at 5 results, a little *higher* than the chunks (98.3%). Chunking pays when documents are long, when the answer is a small part of them, and for update cost (below). The only way to know is a measurement on your own questions, which is why the lab ends with an evaluation.

### Metadata

Every chunk is stored with metadata: the source document, its position, a category, a language, a date, the owner team, an access-control label and the model that produced its vector. Metadata supports **filtered search** ("only the *menu* category"), citations ("source: store-kemang-hours"), freshness checks and permission checks. It must travel with the chunk because it is very hard to rebuild later.

Filtering has a trap. If a system runs the approximate vector search first and filters afterwards, a restrictive filter can discard most of the candidates and return *fewer than k results*, or none. The lab's filtered search puts the filter in the same SQL query as the ordering; with an approximate vector index (Lesson 4), PostgreSQL may still need a wider search for rare filters (pgvector has settings for iterative scans in recent versions). Always test filtered queries with rare filter values.

> 💡 **Practice Pause 2 (Structure-Aware Chunking & Context Preservation):**
> 1. Open `labs/mod-3-5/rag.py` in your text editor.
> 2. Implement `chunk_text(text, max_words, overlap)`: separate paragraphs on blank lines, attach heading lines (#) to the following paragraph for context, and split oversized paragraphs into overlapping windows.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-5/test_rag.py -k TestChunking -v`
> 4. **Success Indicator:** All 7 tests report `PASSED`, validating structure-aware chunking, heading context attachment, and overlap windows without tiny trailing fragments.

:::drill python Cut a text into overlapping chunks
Write `chunk_words(text, size, overlap)`: split the text into words, then return a list of chunks (each a string of words joined by one space). Every chunk has up to `size` words, and each chunk starts `size - overlap` words after the previous one. Stop when a chunk reaches the end of the text. An empty text gives `[]`.
@starter
# write your function below this line

@check
defines("chunk_words") ## Define chunk_words(text, size, overlap).
chunk_words("a b c d e f", 3, 1) == ["a b c", "c d e", "e f"] ## Size 3, overlap 1: each chunk starts 2 words later.
chunk_words("a b c d", 4, 0) == ["a b c d"] ## The whole text fits in one chunk.
chunk_words("a b c d e", 2, 0) == ["a b", "c d", "e"] ## No overlap: plain cutting, the last chunk is shorter.
chunk_words("", 3, 1) == [] ## Nothing to chunk.
@hint
Split the text into words, advance the start position by `size - overlap` each iteration, join each slice of up to `size` words with a space, and break once a chunk reaches or passes the end of the word list.
@solution
def chunk_words(text, size, overlap):
    words = text.split()
    chunks = []
    step = size - overlap
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return chunks
:::

## @part Storing, updating and evaluating

## @lesson Vector storage and approximate search
Finding the exact nearest vectors means comparing the query with every stored vector: it is simple, always correct, and its cost grows linearly. At 20,000 vectors of 64 dimensions the lab's exact scan took about 5 ms per query; at 20 million vectors it takes seconds. **Approximate nearest neighbour (ANN)** indexes answer much faster by accepting that they may miss a true neighbour.

:::talk Approximately right
@teacher An HNSW index returns the five nearest chunks for a question. An exact search over all vectors would return the same five, except that one of them is different: the index returned the sixth-nearest chunk instead of the fifth.
@ask Is this a bug?
@choice Yes: a search index must always return the exact answer | Exact search over millions of vectors is too slow; the index buys speed by being approximate. Try again.
@choice * No: approximate nearest-neighbour search trades a little recall for a lot of speed, and you measure that recall against exact search | Yes. Raising `ef_search` raises recall and slows each query. The job of the data engineer is to measure recall and pick the setting, not to expect perfection.
@choice Yes, and the index must be rebuilt | Rebuilding will not make the search exact: the approximation is by design. Try again.
@teacher Approximate is a feature with a dial. Measure the recall, then turn the dial on purpose.
:::

**HNSW** (Hierarchical Navigable Small World) is the most used. It builds a layered graph: each vector is linked to nearby vectors, upper layers have few long links and the lowest layer has all vectors. A query starts at the top, walks greedily towards the query, and drops down a layer at a time. Three settings control it:

- `m`: links per vector. Bigger means better recall and a larger, slower-to-build index.
- `ef_construction`: how wide the build searches for neighbours. Bigger means a better graph and a slower build.
- `ef_search` (set at query time, `SET hnsw.ef_search`): how many candidates the search keeps. Bigger means better recall and a slower query.

The alternative **IVFFlat** clusters the vectors, then searches only the nearest clusters. It builds faster and uses less memory, but needs representative data present at build time and tuning of the number of clusters probed.

### What the lab measured

This is the lab's hardest data: 20,000 random vectors of 64 dimensions with no cluster structure, the worst case for ANN. Real embeddings are clustered, which makes ANN easier. The index uses `m = 16`, `ef_construction = 64` and takes about 7 seconds to build. Recall is measured against an exact answer computed independently in numpy:

| `ef_search` | recall@10 | time per query |
|---|---|---|
| 10 | 0.31 | 0.7 ms |
| 40 | 0.66 | 1.2 ms |
| 100 | 0.89 | 1.7 ms |
| 200 | 0.96 | 3.6 ms |
| 400 | 1.00 | 5.8 ms |

Two lessons. First, **recall is a dial, not a constant**: the default setting (40) loses a third of the true neighbours on this data. Second, build parameters matter: an index built with `m = 4` and `ef_construction = 16` took 0.6 seconds, and at `ef_search = 400` it still reached only 0.53 recall. A fast build is not a good deal if it caps your quality.

Do not confuse **ANN recall** (does the index return what an exact search would?) with **retrieval quality** (does the right *document* come back for the *question*?). The first is a property of the index and you can measure it without any labelled data. The second depends on the model, the chunking and the data, and needs the labelled questions of Lesson 6. A perfect index over bad embeddings is a fast way to retrieve the wrong things.

### Choosing a store

A dedicated vector database (Qdrant, Weaviate, Milvus, Pinecone and others) adds features such as built-in hybrid search, sharding and managed scaling. **pgvector** puts vectors next to your relational data: one system to back up, secure and query, transactions that include the vectors, and plain SQL joins with metadata. For tens of millions of vectors or fewer, pgvector is often enough and avoids a new system to operate. The decision should come from your size, latency and team skills, not from fashion. Whatever the store, the pipeline below is the same.

**Hybrid search** combines vector similarity with classic keyword search (BM25, or PostgreSQL full-text search) and merges the two ranked lists, for example with reciprocal rank fusion. Keywords find exact identifiers and rare terms (an order number, a product code) that embeddings blur, so hybrid search is a strong default for business data.

> 💡 **Practice Pause 3 (HNSW Graph Indexing & ANN Recall Metrics):**
> 1. Open `labs/mod-3-5/rag.py` in your text editor.
> 2. Implement `recall_at_k(approx_ids, exact_ids)`, `create_hnsw_index(conn, table, m, ef_construction)`, and `ann_top_k(conn, table, vec, k, ef_search)` using dynamic `SET LOCAL hnsw.ef_search`.
> 3. Run the tests in terminal (on Python 3.14 where `pgserver` is skipped, start Docker `pgvector/pgvector:pg16` and export `DATABASE_URL` as shown in `@verify` first):
>    `pytest labs/mod-3-5/test_rag.py -k "TestRecall or TestApproximateSearch" -v`
> 4. **Success Indicator:** All 8 tests report `PASSED`, validating exact recall fraction calculation and HNSW graph index traversal in pgvector.

:::ask At 20 million vectors an exact scan is too slow. What does an HNSW index trade for speed?
@options
correctness of each vector that is stored
the ability to filter on metadata ever again
* a little recall: it may miss a true neighbour
@why
HNSW walks a layered graph instead of comparing every vector, so it is approximate. Settings such as `ef_search` move the balance between recall and time; more links per vector cost more memory.
:::

## @lesson Incremental pipelines: pay only for what changed
The naive pipeline re-embeds the whole collection every night. It is simple, slow and expensive, and it hides the real problem: *the embedding call is the expensive step, so the pipeline must call it as rarely as possible.*

### Content-addressed chunks

:::talk One new paragraph at the top
@teacher A document of 40 paragraphs gets one new paragraph inserted at the very top. Your sync job must update the vector index. Every embedding call costs money.
@ask What is the cheapest correct way to sync?
@choice Re-embed the whole document, to be safe | Correct but wasteful: 39 paragraphs did not change, and each embedding call costs money. Try again.
@choice Number the chunks by position and re-embed those whose number changed | Inserting at the top shifts the position of every chunk below it, so you would re-embed almost everything. Try again.
@choice * Identify each chunk by a hash of its content, keep the unchanged ones, and embed only the new paragraph: one call | Yes. Content hashes tell you what really changed. The top insert shifts positions but not contents, so only one chunk needs a new embedding.
@teacher Identity by content, not by position: it is the same idea as an idempotent load, applied to embeddings.
:::

The lab gives each chunk an identity: **(document id, hash of its normalised content)**. On every sync of a document:

1. Chunk the new text and hash each chunk (whitespace changes must not change the hash).
2. A chunk whose hash is already stored, made with the *current model*, is **kept**; only its position is updated. No embedding call.
3. A new hash is **embedded** and upserted.
4. A stored hash that no longer appears is **deleted**.

This makes the sync idempotent (running it twice does nothing the second time) and proportional to the *change*, not to the size of the collection. The lab's tests pin the numbers: syncing unchanged text makes 0 calls; editing one paragraph makes exactly 1; inserting a paragraph makes 1 and reorders the others; a category change needs none. This is also why structure-aware chunking matters: with fixed-size windows, one inserted sentence changes every later chunk, and the sync would re-embed the rest of the document.

Do the work for a document in **one transaction**. If the embedding service fails halfway through a document, a half-updated state, with old and new chunks mixed, is worse than the old state. The lab proves that after a failure the document is exactly as before. At the collection level, process documents independently and retry the failed ones (Module 1.2: retries with backoff, rate limits, batching of embedding calls, a dead-letter list for documents that keep failing).

### How changes reach the pipeline

Options, from simplest: a nightly scan comparing hashes; a table of changed documents updated by the source system; or change data capture and events (Module 3.2) that trigger a sync within seconds. Pick the freshness your users need. A policy chatbot may tolerate a day; a stock-availability assistant may not. Track **staleness** (the age of the oldest unsynced change) as a metric.

### Deletions and personal data

When a customer asks for deletion, or a document is withdrawn, its vectors must go as well; vectors can leak the content they came from. `delete_document` and the "removed text removes its vectors" test exist for this reason. Also delete from backups and caches within your legal deadlines, and keep an audit of what was removed. Do not index personal data without a purpose: scan for it in ingestion (Module 2.5).

### Model versions

A vector is only meaningful together with the model that made it. Vectors from different models live in different spaces: comparing them gives noise, **without any error**. So the model name is stored on every row, search only compares vectors of the same model, and a sync with a new model re-embeds everything even though the text is unchanged. For a large collection do this as a blue/green migration: build a complete second index with the new model, run the evaluation on both, and switch the application only when the new one is not worse. The next sections show why.

> 💡 **Practice Pause 4 (Idempotent Incremental Sync & Atomic Deletion):**
> 1. Open `labs/mod-3-5/rag.py` in your text editor.
> 2. Implement `sync_document(conn, doc_id, category, text, model, embed_fn)` inside an atomic transaction block (`with conn.transaction():`) calling embeddings only on changed hashes or models, and `delete_document(conn, doc_id)`.
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-5/test_rag.py -k TestSync -v`
> 4. **Success Indicator:** All 11 tests report `PASSED`, validating 0 embedding calls for unchanged text, 1 call for a single edited paragraph, and safe transactional rollback on failure.

:::drill python Which chunks need a new embedding?
Embedding is the expensive call, so only embed chunks that are new. Write `to_embed(stored_hashes, chunks)`: `stored_hashes` is a set of hashes already embedded, `chunks` is the document's new list of chunk texts. The hash of a chunk is `hashlib.sha256(" ".join(chunk.split()).encode()).hexdigest()`, so extra whitespace does not change it. Return the list of chunk texts whose hash is **not** in `stored_hashes`, in order.
@starter
import hashlib
# write your function below this line

@check
defines("to_embed") ## Define to_embed(stored_hashes, chunks).
to_embed(set(), ["a b", "c"]) == ["a b", "c"] ## Nothing stored: everything is new.
to_embed({hashlib.sha256(b"a b").hexdigest()}, ["a b", "c"]) == ["c"] ## "a b" is already embedded: skip it.
to_embed({hashlib.sha256(b"a b").hexdigest()}, ["a   b"]) == [] ## Extra spaces do not change the hash.
to_embed(set(), []) == [] ## No chunks, no calls.
@hint
For each chunk, compute the hash of `" ".join(chunk.split())` and keep the chunk if the hash is not in `stored_hashes`.
@solution
import hashlib
def to_embed(stored_hashes, chunks):
    out = []
    for chunk in chunks:
        h = hashlib.sha256(" ".join(chunk.split()).encode()).hexdigest()
        if h not in stored_hashes:
            out.append(chunk)
    return out
:::

## @lesson Evaluating and operating a RAG data pipeline
You cannot see whether retrieval works by looking at the chatbot's pleasant sentences. Build an **evaluation set**: a few hundred real or realistic questions, each labelled with the document (or passages) that answers it. The lab generates 116, one per document. Then measure:

- **Hit rate at k**: the share of questions for which the right document is among the top k results.
- **MRR** (mean reciprocal rank): the average of 1/(rank of the right document), which rewards putting it first.

On the lab's knowledge base: hit rate 63% at k=1, 98% at k=5, MRR 0.80. The hashing embedder cannot understand paraphrases, so these numbers describe the stand-in, not a real model. Judge a real model the same way, on your own questions.

Use the evaluation as a **regression test**, in CI and after every change to chunking, model, index settings or data: if the hit rate falls, the change does not ship. It is the RAG equivalent of the tests you wrote in every earlier module. (Evaluating the generated *answers* is a second layer: are they faithful to the retrieved text, do they cite correctly, do they refuse when nothing relevant was found. It is usually done with labelled examples and an LLM judge, but retrieval must be right first.)

### Operating it

- **Metrics**: queries with zero or few results, the distribution of top similarity scores (a sudden shift means a model or data change), latency percentiles, staleness, embedding errors and cost per day.
- **Access control**: apply permissions at retrieval time with metadata filters. A chunk a user may not read must never reach the prompt, because a model cannot be trusted to hide it afterwards.
- **Prompt injection**: retrieved documents are *data from outside* and may contain instructions ("ignore previous rules and ..."). Treat content from untrusted sources as untrusted, limit what the model's tools may do, and do not let retrieved text widen permissions.
- **Reproducibility**: record the model, chunking version and index settings alongside the data, so an answer can be explained and rebuilt.
- **Cost control**: embed only what changed (above), batch calls, cache embeddings by content hash, and set budgets and alerts as in Module 3.4.

### See it: the permission filter must run before the top-k

Three chunks, two tenants. The query is closest to the chunk of tenant B, which user A must never see:

:::trace Rank first, filter later leaks; filter first is safe
@code
chunks = [
    {"id": "b1", "tenant": "B", "score": 0.95},
    {"id": "a1", "tenant": "A", "score": 0.80},
    {"id": "a2", "tenant": "A", "score": 0.70},
]
k = 1
rank_first = sorted(chunks, key=lambda c: -c["score"])[:k]
visible_late = [c["id"] for c in rank_first if c["tenant"] == "A"]
allowed = [c for c in chunks if c["tenant"] == "A"]
filter_first = [c["id"] for c in sorted(allowed, key=lambda c: -c["score"])[:k]]
print(visible_late, filter_first)
@notes
7 | Ranking first takes the top 1 of **everyone's** chunks: it is `b1`, the other tenant's chunk.
8 | Filtering afterwards removes it, and nothing is left: the user gets **no result** (and the chunk had already been retrieved).
9 | Filtering first keeps only what the user may read...
10 | ...and then the top 1 of those is `a1`: a real answer, and a forbidden chunk never reached the pipeline.
:::

:::ask Why must permissions be applied as a filter at retrieval time, before the chunks reach the prompt?
@options
the model will hide it if we ask politely
filters only make the search faster, nothing else
* a forbidden chunk must never reach the prompt
@why
Once text is in the prompt the model can repeat it. The only safe place to enforce access is **before** retrieval results leave the data layer, with metadata filters applied inside the search so the top-k is chosen among allowed chunks.
:::

*(Browser warm-up on in-memory dicts, distinct from the PostgreSQL `search(conn, ...)` function in `labs/mod-3-5/rag.py` below.)*

:::drill python Filter first, then rank
Write `search(chunks, user_groups, k)`: `chunks` are dicts with `"id"`, `"group"` and `"score"`. Keep only chunks whose `"group"` is in `user_groups`, **then** return the ids of the `k` highest scores, best first.
@starter
# write your function below this line

@check
defines("search") ## Define search(chunks, user_groups, k).
search([{"id": "b1", "group": "B", "score": 0.95}, {"id": "a1", "group": "A", "score": 0.8}, {"id": "a2", "group": "A", "score": 0.7}], ["A"], 1) == ["a1"] ## The best chunk overall (b1) is forbidden for group A: the answer is a1.
search([{"id": "b1", "group": "B", "score": 0.95}, {"id": "a1", "group": "A", "score": 0.8}, {"id": "a2", "group": "A", "score": 0.7}], ["A", "B"], 2) == ["b1", "a1"] ## With both groups allowed the top 2 are b1 and a1.
search([{"id": "b1", "group": "B", "score": 0.95}], ["A"], 3) == [] ## Nothing allowed: an empty result, never a forbidden chunk.
@hint
First filter `chunks` to keep only items whose `"group"` is in `user_groups`. Next sort those allowed chunks by `"score"` descending, slice the top `k`, and return a list of their `"id"` values.
@solution
def search(chunks, user_groups, k):
    allowed = [c for c in chunks if c["group"] in user_groups]
    best = sorted(allowed, key=lambda c: -c["score"])[:k]
    return [c["id"] for c in best]
:::

> 💡 **Practice Pause 5 (Vector Similarity Search & Hit Rate / MRR Evaluation):**
> 1. Open `labs/mod-3-5/rag.py` in your text editor.
> 2. Implement `search(conn, query, k=5, category=None, model="v1", embed_fn=embed)` using pgvector cosine distance `<=>` with strict model filtering, and `evaluate(conn, eval_set, k=5, **search_kwargs)` computing Hit Rate @ k and Mean Reciprocal Rank (MRR).
> 3. Run the tests in terminal:
>    `pytest labs/mod-3-5/test_rag.py -k "TestSearch or TestEvaluation" -v`
> 4. **Success Indicator:** All 8 tests report `PASSED`, validating similarity ranking, model isolation enforcement, and retrieval evaluation metrics.

## @part Data for machine learning

## @lesson Training data for machine learning: point-in-time features and leakage
Machine learning or AI appears in **47.8%** of the 1,130 data engineering postings measured in TalentHub (2026-07-23 to 2026-11-20). Data scientists choose and train the models; the data engineer builds what the model learns from and what it reads in production. A model is only as honest as its training table, and the most common way to make it dishonest is a data engineering mistake, not a modelling one.

:::talk 92% on the test, bad after launch
@teacher A churn model scores 92% on its test set. The test set was made by shuffling all rows randomly and putting 20% aside. After launch the model does much worse.
@ask What is the most likely data cause?
@choice * Random splitting let training see days that come after the test days: the model learned from the future | Yes. This is temporal leakage. Split by time: train on earlier days and test on later days, the way the model will really be used.
@choice The test set was too small | A small test set makes the score noisy, but not systematically too high. Try again.
@choice The model has too few features | That would lower the test score as well. The sharp gap between test and launch points to how the data was split. Try again.
@teacher For every feature, ask: "would I have known this at the moment of the prediction?" If not, it leaks.
:::

**What the data engineer owns.** A **training table** has one row per *prediction moment* ("customer 248 on 15 January"), the **features** known at that moment (orders in the last 14 days, tier, city), and the **label** that came after it (did the customer order again within 7 days?). Around it: keeping features fresh, computing them the same way for training and for live predictions, rebuilding the exact table a model was trained on (time travel and snapshots, Module 2.2), and watching for drift once the model is live.

**Point-in-time correctness** is the rule that every feature may only use what was known at the prediction moment. A row for 15 January may count the orders *before* 15 January and must not count a single order after it, and it must use the customer's tier *as it was* on 15 January, not today's tier. This is the exact same idea as the SCD Type 2 range join from Module 1.4 (`order_ts >= valid_from AND order_ts < valid_to`), applied to every feature. In SQL the shortcut is an **as-of join**: for each row on the left, take the latest row on the right whose time is not after it. DuckDB has it built in:

```sql
SELECT s.customer_id, s.snapshot_ts, f.tier
FROM snapshots s
ASOF LEFT JOIN tier_feed f
  ON s.customer_id = f.customer_id AND s.snapshot_ts >= f.effective_ts;
```

**Four kinds of leakage** (information from the future reaching the training row):
1. **Future rows:** a count, sum or average over a window that runs past the prediction moment, for example "orders this month" for a row in the middle of the month.
2. **Current state:** joining a dimension's *current* row instead of the version valid at the time (tier, city, account status).
3. **Target leakage:** a feature that is only known because the label happened, for example "refund amount" in a model that predicts refunds.
4. **Random splits:** shuffling rows into train and test, so the model trains on days that come after the days it is tested on. Split by time instead: train on the past, test on what came later.

**Training-serving skew** is the quieter twin: the feature is computed one way for training (a batch SQL job) and another way in production (an API that counts differently, or rounds, or uses another time zone). The model then sees inputs it was never trained on. The cure is one definition of each feature, used for both. That is the main promise of a **feature store**: an *offline* store for training tables, built with point-in-time joins, and an *online* store with the latest value of each feature for live predictions, both filled from the same code.

> 🛠 **Try it (25 min, Python with DuckDB, needs your Lab 1.4 `warehouse.db`).** Attach it in DuckDB (`ATTACH 'warehouse.db' AS w (TYPE sqlite)`) and use `stg_orders` for customers that exist in `stg_customers`, all statuses, with `order_ts` cast to `TIMESTAMP`. For a prediction moment S, the population is every customer with at least one order before S, the label is "at least one order in the 7 days from S", and you build two versions of one feature: **point-in-time** (orders in the 14 days before S) and **leaky** (all orders in the data, before and after S). Pick the rule "predict yes when feature ≥ k" (k from 1 to 7) with the best accuracy at S = 2026-01-15, then apply that same k at S = 2026-01-22, where only the past exists, so both versions become the point-in-time count. Compare with always guessing the more common answer. Finally, with an as-of join on the tier feed (`stg_customers` signup rows plus `stg_customer_changes`), count the customers whose tier on 2026-01-15 differs from their latest tier.
>
> **You should see:** `808` customers at 2026-01-15 (`466` ordered again) and `915` at 2026-01-22; always guessing "yes" scores `57.7%` and `56.8%`. The leaky feature looks useful in training, `70.4%` with k = 3, and collapses to `44.7%` at the later date, worse than guessing. The point-in-time feature scores `57.7%` and `54.9%`: on this data the honest signal is weak, which is exactly what you need to know before anyone ships the model. `14` of the 808 customers had a different tier on 15 January than today, so joining the current tier would have leaked too. Measured with DuckDB 2.0.1.

:::ask A churn model's training row for 15 January counts the customer's orders, including one placed on 20 January. What is wrong?
@options
* leakage: it uses information from after that day
nothing: more orders always make a better feature
the label is missing, so the row must be dropped
@why
A feature may only use what was known at the prediction moment. The model would look excellent in training and fail in production, where the future order does not exist yet.
:::

## @lesson Dual-storage feature stores (Feast pattern), in-warehouse ML (BigQuery ML), and point-in-time ASOF verification {optional}

In Chapter 9 (*Serving Data for Analytics, Machine Learning, and Reverse ETL*) of *Fundamentals of Data Engineering* and Module 3 of *DataTalksClub Data Engineering Zoomcamp*, two production ML data patterns bridge data warehouses and real-time inference:

**1. Dual-Storage Feature Store Architecture (Offline Warehouse + Online Low-Latency Key-Value Store).**
Lesson 7 introduced the feature store and the training-serving skew it prevents. The reason there are *two* stores is latency: a training job reads millions of historical rows and can wait for a warehouse query to start, while a fraud check at checkout needs the latest values for **one** customer in a few milliseconds, which is a key-value lookup (`Redis / DynamoDB / Bigtable`), not a warehouse scan. A feature store (`Feast`, Databricks Feature Engineering) runs one feature definition and writes it twice: the full history to the **offline store** for point-in-time training joins, and only the latest value per entity to the **online store**. The Try it below builds both views and finds the rows a naive join would leak.

**2. In-Warehouse Machine Learning (`BigQuery ML` / `Snowpark ML`).**
When latency requirements are batch or near-real-time and your features already live in the warehouse, exporting terabytes of data out to external Python servers creates security and egress risk. **BigQuery ML** lets you train, evaluate, and run batch predictions on XGBoost, Logistic Regression, Time-Series (`ARIMA_PLUS`), and remote Vertex AI models directly inside standard SQL. (The SQL below follows the BigQuery ML documentation but was not run for this course, because it needs a BigQuery project; Module 2.6 lesson 8 shows how to get a free sandbox.)

```sql
-- 1. Train a Boosted Tree Churn Model directly inside BigQuery using Point-in-Time features:
CREATE OR REPLACE MODEL `kopiku_prod.ml_marts.customer_churn_xgb`
OPTIONS (
  model_type = 'BOOSTED_TREE_CLASSIFIER',
  input_label_cols = ['churned_next_30d'],
  auto_class_weights = TRUE,
  data_split_method = 'SEQ',
  data_split_col = 'snapshot_date'   -- Temporal split (NEVER random split on time-series!)
) AS
SELECT
  snapshot_date,
  orders_trailing_14d,
  spend_trailing_14d_idr,
  tier_at_snapshot,
  churned_next_30d
FROM `kopiku_prod.ml_marts.fct_customer_pit_features`
WHERE snapshot_date < DATE '2026-02-01';

-- 2. Score today's active customers in SQL for Reverse ETL win-back campaigns:
SELECT customer_id, predicted_churned_next_30d, predicted_churned_next_30d_probs
FROM ML.PREDICT(
  MODEL `kopiku_prod.ml_marts.customer_churn_xgb`,
  (SELECT * FROM `kopiku_prod.ml_marts.fct_customer_pit_features` WHERE snapshot_date = CURRENT_DATE())
);
```

> 🛠 **Try it (20 min, Python: First-Law Point-in-Time `ASOF` Feature Store & Leakage Detector Lab).** Create `~/practice/feature_store.py` and implement `build_feature_store_views(prediction_requests, feature_updates)`:
> - `prediction_requests`: list of dicts `{"request_id": str, "entity_id": str, "prediction_ts": int}`
> - `feature_updates`: list of dicts `{"entity_id": str, "updated_at": int, "risk_score": int, "tx_count_24h": int}`
> - Return a dict with three keys:
>   1. `"offline_training_rows"`: for each request (sorted by `request_id`), find the **point-in-time `ASOF` feature record** for that `entity_id` with the largest `updated_at` such that `updated_at <= prediction_ts`. If found, emit `{"request_id": ..., "entity_id": ..., "prediction_ts": ..., "risk_score": ..., "tx_count_24h": ..., "feature_ts": updated_at}`; if no update existed at or before `prediction_ts`, emit `risk_score=0, tx_count_24h=0, feature_ts=None`.
>   2. `"online_store"`: dict mapping each `entity_id` to its single latest state overall (`max(updated_at)`): `{"risk_score": ..., "tx_count_24h": ..., "updated_at": ...}`.
>   3. `"leaked_request_ids"`: sorted list of `request_id`s where a naive join against the `online_store` latest state would have used a future `updated_at > prediction_ts` whose `risk_score` or `tx_count_24h` differs from the true point-in-time `ASOF` values!
>
> **Check it:** `python3 labs/tryit/check.py 3.5-1 ~/practice`

## @lab Lab: a RAG data pipeline on PostgreSQL and pgvector
Build the offline half of a RAG system for the KopiKu help center: 116 short documents (store hours, payments, parking, menu items, allergens and policies) and 116 questions with known answers. You write chunking, embedding, content hashing, an incremental atomic sync, filtered search, evaluation, and the HNSW index functions, and the tests prove each behaviour, including the rare ones: nothing is re-embedded when nothing changed, a failed sync changes nothing, and vectors from another model are never compared.

### @steps
> **Already completed Practice Pauses 1–5?** Your functions in `labs/mod-3-5/rag.py` are already written, jump straight to Step 7 (experiments) and Practice Pause 6 (`pytest` + `prove.py`).

1. Install and run the tests (a throw-away PostgreSQL with pgvector starts by itself on Python 3.10–3.13; on Python 3.14 `pip` skips `pgserver`, so start Docker `pgvector/pgvector:pg16` and export `DATABASE_URL` as shown in `@verify` below, stop any older Postgres container using port 5432 first if needed):

```bash
python -m pip install -r labs/mod-3-5/requirements.txt
pytest labs/mod-3-5 -v        # fails at first
```

2. Read `labs/shared/kbgen.py` (the knowledge base) and the provided part of `labs/mod-3-5/rag.py` (the table, `tokens`, `vec_literal`). Note the table's primary key: (doc_id, content_hash).
3. Implement the pure functions first, in this order: `chunk_text`, `embed`, `content_hash`, `recall_at_k`. Run `pytest labs/mod-3-5 -k "Chunking or Embed or Hash or Recall"`. The docstrings are the specification; the tests show edge cases.
4. Implement `sync_document` and `delete_document`. Start with the happy path, then make the failure test pass using a transaction. Run `-k Sync`.
5. Implement `search` and `evaluate`. Print the top three results for a question such as "can I use two vouchers on one order" and read the scores.
6. Implement `create_hnsw_index` and `ann_top_k`, then run `-k Approximate`. Add `EXPLAIN` in a Python shell and confirm the index is used.
7. Experiments, using your own code: (a) sync every document twice and count the embedding calls; (b) change `max_words` and see how many chunks you get and how `hit_rate` moves; (c) drop the `WHERE model = ...` filter from `search`, re-sync half of the documents with `model="v2"` and compare the hit rate; (d) vary `m`, `ef_construction` and `ef_search` and plot recall against time for your machine.

> 💡 **Practice Pause 6 (Full Verification & Proof Token):**
> 1. In terminal, run the complete suite of 43 tests:
>    `pytest labs/mod-3-5/test_rag.py -v`
> 2. Generate the completion verification proof token:
>    `python3 scripts/prove.py mod-3-5`
> 3. **Success Indicator:** All 43 tests report `PASSED` and your completion proof token is printed to terminal.

### @files
- labs/mod-3-5/rag.py :: Working file: chunking, embedding, sync, search, evaluation, HNSW :: starter
- labs/mod-3-5/test_rag.py :: The tests (43) :: test
- labs/shared/kbgen.py :: Deterministic knowledge base and question set :: data
- labs/mod-3-5/requirements.txt :: pytest, numpy, psycopg, pgserver :: config
- labs/mod-3-5/reference/rag.py :: Reference solution (try first!) :: reference

### @deliverables
- All 43 tests pass
- You can state, with numbers from your run, the hit rate at k=1 and k=5, the number of embedding calls for a full first sync versus a one-paragraph edit, and the recall at `ef_search` 10 and 400
- A short note explaining what happens in your system if the query path switches to a new model before the stored vectors are re-embedded

### @verify
```bash
pytest labs/mod-3-5 -v
python3 scripts/prove.py mod-3-5
```

Known-good run: `LAB_DIR=reference pytest labs/mod-3-5 -v`. To use your own PostgreSQL (with the pgvector extension, for example the `pgvector/pgvector` Docker image), set `DATABASE_URL` to an empty scratch database. On Python 3.14 `pip` skips `pgserver` (it has no build for 3.14 yet), so start PostgreSQL in Docker instead: `docker run -d --name kopiku-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16 -c wal_level=logical`, then `docker exec kopiku-pg psql -U postgres -c "CREATE DATABASE lab35"` and `export DATABASE_URL=postgresql://postgres:dev@localhost:5432/lab35`. That one container serves Modules 1.3, 3.2 and 3.5 (it has pgvector and logical decoding); measured on Python 3.14, the reference passes all 43 tests this way.

## @chaos The silent model upgrade
### @scenario
A support assistant answers staff questions from 40,000 policy chunks. A new, cheaper embedding model is announced and a developer switches the query service to it, with a one-line configuration change that passes review ("same dimension, drop-in replacement"). The nightly sync, which only embeds *changed* chunks, starts producing vectors with the new model for the few documents edited that night. Nobody schedules a full re-embedding.

Nothing fails. There are no errors, no timeouts and the dashboards are green. But the assistant starts giving vague or invented answers, because the retrieval step now returns nearly random chunks and the language model does its best to answer anyway. Three weeks later, after complaints from staff who followed wrong instructions, someone notices.

### @cause
Vectors from different embedding models are not comparable, even when they have the same number of dimensions. The query vectors came from the new model while most stored vectors came from the old one, so the nearest-neighbour search compared numbers that mean different things. In the lab's measurement, the same 116 questions scored a hit rate of 98.3% when queries and chunks used the same model, but only **2.6%** (about what random guessing gives) when every document had been embedded by one model and the queries by the other. With half of the documents migrated and no model filter, it was 50%: half the knowledge silently unreachable.

The incremental sync made it worse by being efficient: it saw unchanged text and rightly kept the old vectors. Missing was any check that tied a vector to its model, and any evaluation that would have turned a green dashboard red.

### @fix
1. Store the **model name and version on every row**, and make search compare only vectors of the model in use. In the lab a mismatch returns *no results*, which is loud, instead of wrong results, which is silent.
2. Treat a model change as a **migration**: build a new index with the new model next to the old one (blue/green), run the evaluation on both, and switch queries only when the new index scores at least as well.
3. Run the **labelled-question evaluation in CI and on a schedule** against production, and alert on a drop in hit rate and on a shift in the distribution of top similarity scores.
4. Make the embedding model part of the configuration of *both* the pipeline and the query service (one setting, one deployment), and require a review checklist item for any change to it.
5. Add an end-to-end canary: a set of known questions asked every hour with the expected source document, and an alert when it is not retrieved.

### @pattern
A vector is only meaningful together with the model that produced it. Version the model with the data, evaluate retrieval continuously, and make mismatches fail loudly.

## @quiz
### What problem does retrieval-augmented generation (RAG) solve?
- [ ] It makes the language model run faster, by compressing its weights so that it fits on a smaller server
- [ ] It removes the need to store documents, because the model can memorise every document it is shown once
- [ ] It guarantees that the generated answer is true, since the model is no longer able to make mistakes
- [x] It lets the model answer from your current data by retrieving relevant passages into the prompt first

> The model does not know your private or recent data. RAG retrieves the relevant passages at question time and asks the model to answer from them. It reduces, but does not eliminate, wrong answers.

### In the lab, a document gets one new paragraph inserted at the start. Why does the sync make only one embedding call?
- [ ] The embedding model is told which characters changed, and returns an update for only those characters
- [x] Chunks are identified by a hash of their content, so unchanged chunks are found and kept as they are
- [ ] The sync skips any document whose text differs by less than one paragraph from the stored version
- [ ] The database recomputes the vectors for the old chunks by itself when a row of the table changes

> Identity is (document, content hash). Unchanged chunks keep their vectors and only get a new position. Fixed-size windows would shift every later boundary and re-embed everything.

### A hosted embedding model is replaced by a new model with the same number of dimensions. What should happen to the stored vectors?
- [ ] Nothing, because the dimension is the same, so the old vectors can be compared with the new ones
- [x] They should be re-embedded with the new model, because vectors of different models are not comparable
- [ ] They should be normalised again to unit length, which makes vectors from different models compatible
- [ ] They should be deleted for good, because a chatbot works best with the vectors of the newest model only

> The meaning of each coordinate depends on the model. Mixed spaces return noise without an error. Re-embed (blue/green), evaluate, then switch.

### What does raising `ef_search` on an HNSW index do?
- [ ] It makes the index use more memory, because the graph gets more links between the stored vectors
- [ ] It makes the index build slower, because the graph must be rebuilt whenever the setting is changed
- [x] It raises recall and slows each query, because more candidates are kept while walking the whole graph
- [ ] It lowers recall and speeds up each query, because fewer candidates are kept while searching the graph

> `ef_search` is the query-time breadth. In the lab, recall@10 went from 0.31 at 10 to 1.00 at 400 while time per query grew from 0.7 to 5.8 ms. `m` and `ef_construction` are the build-time settings.

### What is the difference between ANN recall and retrieval hit rate?
- [ ] They are the same measurement under two different names, and either one can be used to compare embedding models
- [ ] Recall is measured only on the training data of the model, and the hit rate only on live production traffic
- [x] Recall asks if the index finds what exact search finds, while hit rate asks if the right document returns
- [ ] Hit rate measures the speed of the search, and recall measures the number of vectors held in the index

> A perfect index over poor embeddings still retrieves the wrong documents. Recall needs no labels (compare with exact search); hit rate needs labelled questions.

### A query filtered to a rare category returns only two results although k = 5. What is a likely cause?
- [ ] The embedding model refuses to return vectors for categories that it has seen very rarely before
- [ ] The vector column is too short, so that all but the first two rows of the table are cut off silently
- [x] The approximate search found its candidates first and the filter then discarded most of them
- [ ] The cosine distance operator is limited to returning two results when a category is given

> Post-filtering a small candidate list can leave fewer than k rows. Test filters with rare values, widen the search or use iterative scans, and consider partitioning by the filter column.

### A customer asks to have their data deleted. Which step is required for the RAG index?
- [ ] Nothing, because vectors are only numbers and cannot be turned back into the original text in any way at all
- [ ] Hide the customer's documents from the chatbot's prompt, but keep their chunks and vectors in the index
- [ ] Delete only the source documents, since the embeddings are rebuilt from scratch every few weeks anyway
- [x] Delete the chunks and vectors of those documents, then remove them from backups within the legal deadline

> Vectors and the stored chunk text derive from the personal data and can leak it. Deletion must cover the index, caches and backups, with an audit trail.

### Which practice best protects a RAG system from a silent drop in answer quality?
- [ ] A larger language model for the generation step, so that it can work around any weak retrieval
- [ ] A weekly meeting where the team reads some of the chatbot answers and gives them a rough rating
- [ ] A longer prompt that tells the model never to answer if the retrieved passages look unrelated
- [x] A labelled question set run as a regression test, with alerts when the hit rate or scores drop

> Retrieval quality can be measured. Run the evaluation on every change to model, chunking or index and on a schedule in production, so a quiet failure becomes a failing check.

### A churn model scores 92% on a test set made by shuffling rows at random, and much worse after launch. What is the most likely data cause?
- [ ] The test set was too small, so any accuracy above 90% is noise that disappears later on
- [x] Rows were split at random, so training saw days that come after the test days; split by time
- [ ] Churn cannot be predicted from order data, so no split of the rows would ever give a good model
- [ ] The production database is slower than training data, so live predictions often time out

> A random split lets the model learn from the future of the rows it is tested on. Train on the past, test on later dates, and build every feature as of the prediction moment (lesson 7).

## @resources
- [pgvector: vector similarity search for PostgreSQL](https://github.com/pgvector/pgvector)
- [Lewis et al.: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)
- [Malkov and Yashunin: Efficient and robust approximate nearest neighbor search using HNSW graphs](https://arxiv.org/abs/1603.09320)
- [MTEB: Massive Text Embedding Benchmark](https://huggingface.co/spaces/mteb/leaderboard)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Sentence Transformers documentation](https://www.sbert.net/)
