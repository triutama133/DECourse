---
title: AI dan Vector Data Engineering
duration: 3 minggu
summary: Bangun pipeline rekayasa data di balik aplikasi Retrieval-Augmented Generation (RAG): pemotongan dokumen (chunking), komputasi embeddings, penyimpanan vektor di PostgreSQL menggunakan pgvector, sinkronisasi inkremental yang hemat biaya, penyetelan approximate search HNSW, serta evaluasi kualitas retrieval agar evolusi model tidak merusak sistem secara hening.
why: Banyak tutorial pemula hanya memanggil API embedding satu kali terhadap kumpulan file teks lalu memamerkan aplikasi chatbot sederhana. Di lingkungan produksi nyata, tantangan terberat berada di ranah data engineering: dokumen terus berubah, versi model diperbarui, permintaan penghapusan privasi tiba, tagihan cloud melonjak, dan akurasi jawaban anjlok tanpa memunculkan pesan error apa pun.
---

## @outcomes
- Menjelaskan arsitektur Retrieval-Augmented Generation (RAG) dan mengidentifikasi secara presisi komponen mana saja yang menjadi tanggung jawab ranah data engineering
- Menguraikan prinsip matematis embeddings dan similarity search, serta memilih strategi pemotongan dokumen (chunking) dan pelacakan metadata yang tepat
- Menyimpan dan melakukan query data vektor di PostgreSQL menggunakan ekstensi pgvector, membangun indeks HNSW, serta mengukur trade-off recall vs latensi
- Membangun pipeline embedding inkremental dan idempoten yang hanya memproses ulang teks yang berubah, tahan terhadap kegagalan transaksi, mendukung penghapusan data, dan melacak versi model
- Mengevaluasi performa pencarian retrieval menggunakan dataset pertanyaan berlabel (metrik hit rate dan MRR), serta mengidentifikasi risiko perubahan model, filtering, dan kontrol akses

## @prereq
Modul 1.3 (PostgreSQL, indeks B-Tree, query EXPLAIN), Modul 2.5 (kualitas data dan contracts), serta Modul 3.2 (streaming dan change data capture sebagai konteks sinkronisasi data). Lab modul ini membutuhkan instalasi pustaka via `pip install -r labs/mod-3-5/requirements.txt` dan menggunakan embedded PostgreSQL yang telah terintegrasi dengan ekstensi pgvector. Pengujian berjalan 100% lokal tanpa panggilan jaringan eksternal, tanpa GPU, serta tanpa memerlukan API key berbayar.

## @lesson Apa itu RAG, dan apa yang dikelola oleh Data Engineer
Model bahasa berskala besar (Large Language Model / LLM) hanya mengetahui informasi yang termuat di dalam data pelatihannya (training data). Model tersebut tidak mengetahui isi kebijakan refund perusahaan Anda, pembaruan daftar harga kopi minggu lalu, atau tiket komplain aktif pelanggan, dan saat kekurangan konteks faktual, LLM memiliki kecenderungan menghasilkan jawaban yang terdengar sangat meyakinkan namun sepenuhnya salah (halusinasi). **Retrieval-Augmented Generation (RAG)** menyelesaikan dilema ini saat runtime pertanyaan: aplikasi terlebih dahulu *mengambil (retrieve)* segelintir kutipan data internal perusahaan yang relevan dengan pertanyaan pengguna, lalu menyematkannya ke dalam teks prompt sistem agar LLM menjawab secara faktual berdasarkan dokumen tersebut (lengkap dengan sitasi sumber).

```
 documents --> chunk --> embed --> vector store         (offline: the data pipeline)
 question  --> embed --> nearest chunks --> prompt --> LLM --> answer + sources   (online)
```

Sisi online adalah ranah kode aplikasi backend. Sisi offline adalah **pipeline rekayasa data (data pipeline)** yang memiliki karakteristik dan tantangan serupa dengan seluruh pipeline yang telah Anda bangun di kurikulum ini. Faktanya, mayoritas kegagalan sistem RAG di lingkungan produksi berakar dari masalah pada sisi offline data pipeline, dan bukan dari kecerdasan model LLM:

- **Ingestion dan Pembersihan**: mengekstrak teks dari PDF, dokumen wiki, tiket pelanggan, dan web. Kesalahan parsing data mentah (tabel yang terpotong, header dan footer dokumen yang berulang) akan langsung bermuara pada jawaban halusinasi di kemudian hari.
- **Chunking**: memotong dokumen menjadi potongan-potongan teks mandiri yang relevan untuk diambil secara individual.
- **Embedding**: mentransformasikan setiap potongan teks menjadi representasi vektor numerik menggunakan embedding model. Proses ini menelan biaya API dan waktu komputasi per token.
- **Penyimpanan dan Pengindeksan (Vector Store)**: menyimpan vektor berdampingan dengan teks asli dan metrik metadata, serta membangun indeks pencarian cepat.
- **Sinkronisasi Inkremental**: dokumen di sistem operasional terus diedit dan dihapus setiap hari. Indeks vektor wajib mengikuti perubahan tersebut secara akurat, cepat, dan hemat biaya.
- **Evaluasi dan Observabilitas**: mengukur akurasi retrieval secara matematis dan membunyikan alarm saat kualitas pencarian menurun.
- **Tata Kelola Data (Governance)**: kontrol hak akses dokumen, kepatuhan regulasi privasi data pribadi (GDPR/UU PDP), hak penghapusan data, dan jejak audit.

Seluruh prinsip rekayasa data yang telah Anda pelajari tetap berlaku mutlak: idempotensi, penanganan retry, perancangan backfill, pengujian kualitas data, lineage pelacakan versi, dan tata kelola biaya FinOps. (Keahlian data engineering di modul ini juga menjadi fondasi untuk beban kerja AI lainnya: penyiapan dataset pre-training dan fine-tuning, evaluasi benchmark model, serta feature store untuk machine learning).

## @lesson Embeddings dan kesamaan vektor (similarity)
**Embedding** adalah serangkaian larik angka desimal terpadu (sebuah vektor berdimensi tinggi) yang dihasilkan oleh model machine learning dari suatu potongan teks, di mana teks-teks yang memiliki kesamaan makna semantik akan menghasilkan vektor-vektor yang mengarah ke sudut orientasi yang berdekatan di ruang spasial. Model embedding di industri umumnya memiliki ratusan hingga ribuan dimensi (seperti 384, 768, 1.536, atau 3.072 dimensi). Pencarian informasi kemudian bertransformasi menjadi operasi geometri murni: ubah pertanyaan pengguna menjadi vektor, lalu temukan vektor-vektor data di database yang posisinya paling dekat dengannya.

Metrik kedekatan yang paling standar adalah **Cosine Similarity**: nilai kosinus dari sudut antara dua vektor. Bernilai 1 untuk vektor yang searah sempurna (makna identik), 0 untuk vektor yang saling tegak lurus (tidak berhubungan), dan −1 untuk vektor yang berlawanan arah. Jika seluruh vektor dinormalisasi sehingga memiliki panjang magnitudo tepat 1, cosine similarity bernilai identik dengan operasi dot product (perkalian titik). Di PostgreSQL ekstensi pgvector menyediakan operator metrik jarak: `<=>` untuk cosine distance ($1 - \text{similarity}$), `<->` untuk Euclidean distance (L2 distance), dan `<#>` untuk negative inner product. Operator yang Anda gunakan dalam query SQL wajib selaras dengan kelas operator indeks yang dibangun di tabel.

### Pendekatan Hashing Embedder pada Lab Modul Ini

Model embedding produksi umumnya membutuhkan token API berbayar atau mengunduh bobot neural network ratusan megabyte, serta dapat menghasilkan angka desimal yang sedikit bergeser antar versi platform. Agar lab modul ini dapat dijalankan sepenuhnya secara offline, instan, dan deterministik 100%, sistem praktikum menggunakan **Hashing Embedder**: setiap kata di-hash ke dalam salah satu dari 256 posisi dimensi dengan bobot tanda arah, lalu vektor frekuensi dinormalisasi ke panjang 1. Model hashing ini merepresentasikan *tumpang tindih kata (lexical overlap)* dan bukan semantik murni: kata "mobil" dan "kendaraan" dianggap tidak berhubungan oleh hash ini, sesuatu yang dipahami oleh model embedding riil. Namun selain karakteristik semantiknya, seluruh aspek arsitektur rekayasa data di modul ini bekerja secara identik: teks masuk, vektor satuan panjang tetap keluar, dan fungsi `embed` adalah satu-satunya komponen yang akan Anda ganti saat beralih ke model produksi seperti OpenAI `text-embedding-3` atau model open-source Hugging Face. Hashing embedder di lab menerima parameter nama `model` yang mengubah seed algoritma hash, sehingga dua nama model berbeda bertindak persis seperti dua embedding model terpisah yang tidak kompatibel—fondasi penting dari skenario chaos modul ini.

### Ukuran Kapasitas dan Analisis Biaya

Sebuah vektor 1.536 dimensi yang disimpan sebagai bilangan float 4-byte memakan ruang 6.144 byte. Menyimpan 10 juta potongan teks membutuhkan kapasitas sekitar 61 GB hanya untuk vektor mentahnya saja, belum termasuk struktur indeks HNSW yang umumnya wajib ditampung di RAM agar performa query tetap cepat. Komponen pembiayaan RAG terbagi menjadi empat pilar: **komputasi embedding** (ditagih per juta token input oleh penyedia cloud), **kapasitas storage dan RAM server**, **query realtime** (setiap pertanyaan pengguna wajib di-embed terlebih dahulu), serta **re-embedding menyeluruh** saat Anda mengubah strategi chunking atau mengganti model. Memilih dimensi yang lebih rendah, menggunakan format half-precision (`halfvec` 16-bit float di pgvector), atau teknik kuantisasi skalar menukar sedikit akurasi demi penghematan RAM yang sangat signifikan. Selalu lakukan pengukuran pada dataset evaluasi Anda sendiri sebelum memutuskan arsitektur.

> 💡 **Jeda Praktik 1 (Komputasi Embedding Deterministik & Content Hashing):**
> 1. Buka file `labs/mod-3-5/rag.py` di teks editor Anda. Jangan jalankan file ini langsung di terminal.
> 2. Implementasikan fungsi `embed(text, dim, model)` menggunakan algoritma blake2b dan normalisasi panjang satuan L2, serta fungsi `content_hash(text)` menggunakan sha256 setelah menormalkan whitespace.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-5/test_rag.py -k "TestEmbed or TestContentHash" -v`
> 4. **Indikator Sukses:** Sebanyak 9 pengujian berstatus `PASSED` dalam hitungan milidetik murni Python, memvalidasi vektor satuan deterministik dan hash konten yang kebal terhadap variasi spasi.

## @lesson Chunking dan manajemen metadata
Dalam sistem RAG, entitas yang Anda ubah menjadi vektor adalah **potongan teks (chunks)** dan bukan keseluruhan isi dokumen utuh. Menghitung embedding untuk satu buku manual setebal 40 halaman akan menghasilkan vektor rata-rata yang terlalu umum dan kehilangan fokus, dan menyematkan 40 halaman dokumen ke dalam prompt LLM hanya untuk menjawab satu pertanyaan spesifik akan membanjiri model dengan teks sampah yang bising. Di sisi lain, potongan yang terlalu kecil akan kehilangan konteks aslinya (misalnya potongan teks: "Masa berlaku promonya 30 hari" — promo produk yang mana?). Oleh karena itu, strategi chunking adalah keputusan arsitektur krusial yang berdampak langsung pada akurasi jawaban dan tagihan token.

Pendekatan umum pemotongan teks:

1. **Batas Ukuran Tetap (Fixed-Size Chunking)**: memotong teks secara kaku berdasarkan jumlah token (misalnya 500 token dengan 50 token overlap). Sederhana, namun berisiko memotong kalimat dan baris tabel di tengah-tengah kata, dan penambahan satu kalimat baru di awal paragraf akan menggeser seluruh batas pemotongan di bawahnya sehingga seluruh chunk berikutnya berubah identitas.
2. **Berbasis Struktur Dokumen (Structure-Aware Chunking)**: memotong dokumen mengikuti batas alami penulisan manusia: judul heading markdown, pergantian paragraf, dan butir daftar (list items). Perubahan kecil pada satu paragraf hanya akan memengaruhi satu chunk lokal. Inilah strategi yang Anda bangun di lab modul ini.
3. **Penyertaan Konteks Hirarkis (Contextual Chunking)**: menyematkan garis keturunan judul (heading path) atau ringkasan dokumen ke dalam setiap potongan teks, karena kalimat "Gratis selama 2 jam pertama" tidak memiliki arti tanpa konteks judul "Aturan Parkir Gerai Kemang". Lab menggabungkan judul heading dengan paragraf di bawahnya untuk mempertahankan konteks ini.
4. **Tumpang Tindih (Overlap)**: memberikan jendela overlap khusus untuk paragraf yang melebihi batas panjang maksimum, memastikan tidak ada fakta penting yang terpotong di perbatasan.

Jangan pernah berasumsi bahwa pemotongan teks selalu lebih unggul secara otomatis. Pada basis pengetahuan KopiKu di lab praktikum, 116 dokumen yang ada berukuran pendek (rata-rata 45 kata per dokumen) dan terpecah menjadi 256 chunk rata-rata 15 kata. Berdasarkan pengukuran dataset pertanyaan berlabel, melakukan embedding pada dokumen utuh justru menghasilkan hit rate 99,1% pada top-5 hasil, sedikit lebih unggul dibandingkan chunking (98,3%). Chunking membuktikan keunggulannya yang masif ketika dokumen berukuran panjang, ketika jawaban merupakan potongan kecil di dalam bab dokumen, serta untuk efisiensi biaya pembaruan inkremental. Satu-satunya cara memastikannya adalah melalui pengukuran metrik riil pada dataset evaluasi Anda.

### Manajemen Metadata

Setiap potongan teks wajib disimpan berdampingan dengan kolom-kolom metadata: ID dokumen sumber, nomor urut posisi dalam dokumen, kategori bisnis, bahasa, tanggal pembaruan, tim pemilik dokumen, label hak akses keamanan (Access Control List / ACL), dan identitas versi model embedding yang menghasilkan vektor tersebut. Metadata menjadi fondasi untuk **Pencarian Terfilter (Filtered Search)** (contoh: "hanya cari dokumen dengan kategori *menu*"), sitasi sumber jawaban ke pengguna ("Sumber: Gerai Kemang - Jam Operasional"), verifikasi kesegaran dokumen, serta penegakan izin otorisasi pengguna. Informasi metadata wajib mengalir bersama chunk sejak awal pembuatan karena hampir mustahil untuk direkonstruksi kembali di kemudian hari.

Jebakan dalam Filtering Vektor: Jika sebuah sistem menjalankan pencarian vektor perkiraan (ANN) terlebih dahulu lalu melakukan pemfilteran metadata setelahnya (*post-filtering*), filter kategori yang ketat dapat membuang sebagian besar kandidat hasil pencarian dan mengembalikan hasil yang **kurang dari nilai k yang diminta** atau bahkan menghasilkan daftar kosong. Query pencarian di lab modul ini menyatukan filter metadata langsung di dalam klausa `WHERE` pada query SQL yang sama dengan perhitungan jarak vektor. Ujilah selalu query terfilter Anda terhadap kategori yang memiliki populasi data langka.

> 💡 **Jeda Praktik 2 (Pemotongan Dokumen Berbasis Struktur & Konteks):**
> 1. Buka file `labs/mod-3-5/rag.py` di teks editor Anda.
> 2. Implementasikan fungsi `chunk_text(text, max_words, overlap)`: pisahkan paragraf pada baris kosong, gabungkan judul heading (#) dengan paragraf berikutnya untuk menjaga konteks, dan potong paragraf panjang menjadi jendela bertumpang tindih (sliding windows).
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-5/test_rag.py -k TestChunking -v`
> 4. **Indikator Sukses:** Sebanyak 7 pengujian berstatus `PASSED`, memvalidasi pemotongan berbasis struktur, pelestarian konteks judul, dan jendela overlap tanpa potongan buntut mini.

## @lesson Vector storage dan pencarian perkiraan (ANN)
Mencari tetangga terdekat secara eksak (Exact K-Nearest Neighbor / KNN) mengharuskan sistem menghitung jarak kosinus antara vektor pertanyaan terhadap *seluruh* vektor yang ada di tabel: metode ini sangat sederhana, selalu menghasilkan jawaban akurat 100%, namun kompleksitas biayanya tumbuh linier seiring volume data ($O(N)$). Pada skala 20.000 vektor 64 dimensi di lab, pencarian eksak membutuhkan waktu 5 milidetik per query; namun pada skala 20 juta vektor, pencarian eksak akan memakan waktu beberapa detik. Indeks **Approximate Nearest Neighbor (ANN)** menyelesaikan tantangan skalabilitas ini dengan memangkas waktu pencarian secara drastis melalui kompromi kecil: menerima kemungkinan kecil terlewatnya segelintir tetangga terdekat yang sebenarnya.

Algoritma **HNSW (Hierarchical Navigable Small World)** adalah algoritma indeks ANN yang paling dominan di industri. HNSW membangun struktur graf multi-layer yang terinspirasi dari fenomena "enam derajat pemisahan": setiap vektor dihubungkan dengan vektor-vektor tetangganya, layer atas memiliki sedikit link dengan lompatan jarak jauh (expressway), dan layer terbawah memuat seluruh vektor secara lengkap. Saat query tiba, pencarian dimulai dari layer teratas, menelusuri graf secara greedy mendekati target, lalu turun lapis demi lapis ke bawah. Tiga parameter utama yang mengendalikannya:

- `m`: jumlah koneksi dua arah maksimum per node vektor. Semakin besar nilai `m`, semakin tinggi akurasi recall dan semakin besar ukuran memori serta waktu pembuatan indeks.
- `ef_construction`: kedalaman penelusuran kandidat tetangga saat indeks sedang dibangun. Semakin besar nilainya, semakin optimal struktur graf yang terbentuk dengan konsekuensi proses build indeks yang lebih lama.
- `ef_search` (dikonfigurasi saat runtime query, `SET hnsw.ef_search = ...`): ukuran antrean kandidat tetangga yang dievaluasi saat menelusuri graf. Semakin besar nilainya, semakin tinggi recall dan semakin bertambah latensi waktu query.

Alternatif lainnya adalah **IVFFlat (Inverted File Flat)** yang mengelompokkan vektor ke dalam klaster-klaster centroid menggunakan algoritma k-means, lalu hanya mencari di klaster terdekat saat query. IVFFlat lebih cepat dibangun dan hemat memori, namun membutuhkan data yang representatif saat indeks dibangun dan sangat sensitif terhadap rasio jumlah probe klaster.

### Pengukuran Empiris dari Lab

Pengujian modul ini menguji skenario paling ekstrem bagi algoritma ANN: 20.000 vektor acak murni 64 dimensi tanpa klaster semantik alami. Indeks HNSW dibangun dengan parameter `m = 16`, `ef_construction = 64` (membutuhkan waktu build ~7 detik di PostgreSQL). Nilai recall diukur terhadap hasil pencarian eksak absolut yang dihitung secara independen di NumPy:

| Konfigurasi `ef_search` | Recall @ 10 | Rata-rata Latensi per Query |
|---|---|---|
| 10 | 0,31 (31%) | 0,7 ms |
| 40 (nilai default pgvector) | 0,66 (66%) | 1,2 ms |
| 100 | 0,89 (89%) | 1,7 ms |
| 200 | 0,96 (96%) | 3,6 ms |
| 400 | 1,00 (100%) | 5,8 ms |

Dua pelajaran fundamental: Pertama, **akurasi recall pada indeks ANN adalah sebuah kenop setelan, dan bukan angka konstan**: konfigurasi default pgvector (`ef_search = 40`) kehilangan sepertiga dari total tetangga terdekat yang sebenarnya pada dataset ini. Kedua, parameter pembuatan indeks di awal sangat menentukan batas atas kualitas: indeks yang dibangun dengan parameter rendah `m = 4` dan `ef_construction = 16` selesai dibangun dalam 0,6 detik, namun bahkan saat `ef_search` dinaikkan ke 400, nilai recall mentok di angka 0,53. Waktu build yang cepat tidak ada artinya jika membatasi kualitas pencarian Anda secara permanen.

Pembedaan Kritis: Jangan mencampuradukkan **ANN Recall** (apakah indeks ANN mengembalikan vektor yang sama dengan pencarian eksak matematika?) dengan **Kualitas Retrieval / Hit Rate** (apakah sistem mengembalikan *dokumen yang benar* untuk menjawab *pertanyaan manusia*?). ANN recall adalah karakteristik murni dari algoritma indeks dan dapat diukur tanpa data berlabel; sedangkan kualitas retrieval bergantung pada keandalan model embedding, strategi chunking, dan keterwakilan data. Indeks HNSW dengan recall 100% yang berjalan di atas embedding model yang buruk hanyalah cara tercepat untuk mengambil dokumen yang salah!

### Memilih Vector Store yang Tepat

Vector database terdedikasi (seperti Qdrant, Weaviate, Milvus, atau Pinecone) menawarkan fitur-fitur native seperti hybrid search bawaan, auto-sharding klaster, dan manajemen horizontal scaling. Namun **pgvector** mengintegrasikan data vektor langsung di samping tabel relasional PostgreSQL Anda yang sudah ada: satu sistem database tunggal untuk di-backup, diamankan, dan dipantau; integritas transaksi ACID yang mengikat data vektor dengan data bisnis; serta kemudahan query SQL JOIN standar dengan metadata tabel lain. Untuk skala hingga puluhan juta vektor, pgvector umumnya sudah sangat memadai dan menghindarkan tim dari beban mengoperasikan infrastruktur baru. Pilihlah berdasarkan skala data, kebutuhan latensi, dan kesiapan tim engineering.

**Pencarian Hibrida (Hybrid Search)** memadukan kemiripan vektor (semantic search) dengan pencarian kata kunci tradisional berbasis BM25 atau Full-Text Search PostgreSQL, lalu menggabungkan kedua peringkat hasil menggunakan algoritma seperti Reciprocal Rank Fusion (RRF). Pencarian kata kunci sangat unggul dalam menemukan nomor ID unik yang presisi, kode produk, dan istilah langka yang kerap kabur dalam ruang vektor, menjadikan hybrid search sebagai standar arsitektur terbaik untuk data korporat.

> 💡 **Jeda Praktik 3 (Indeks Graf HNSW & Metrik Recall ANN):**
> 1. Buka file `labs/mod-3-5/rag.py` di teks editor Anda.
> 2. Implementasikan fungsi `recall_at_k(approx_ids, exact_ids)`, `create_hnsw_index(conn, table, m, ef_construction)`, dan `ann_top_k(conn, table, vec, k, ef_search)` dengan parameter dinamis `SET LOCAL hnsw.ef_search`.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-5/test_rag.py -k "TestRecall or TestApproximateSearch" -v`
> 4. **Indikator Sukses:** Sebanyak 8 pengujian berstatus `PASSED`, memvalidasi perhitungan fraksi recall eksak serta pembuatan dan penelusuran graf HNSW di PostgreSQL pgvector.

## @lesson Pipeline inkremental: bayar hanya untuk data yang berubah
Pendekatan naif pemula yang sering dilakukan adalah menjalankan batch job harian yang memproses ulang dan memanggil API embedding untuk seluruh koleksi dokumen dari awal setiap malam. Pola ini sangat lambat, boros biaya, dan mengabaikan fakta mendasar: *pemanggilan API embedding adalah langkah komputasi yang paling mahal, sehingga pipeline rekayasa data wajib memanggilnya sesedikit mungkin.*

### Identitas Berbasis Konten (Content-Addressed Chunks)

Lab modul ini memberikan identitas unik pada setiap potongan teks: pasangan kunci **`(document_id, hash dari konten yang dinormalisasi)`**. Pada setiap siklus sinkronisasi dokumen:

1. Dokumen baru dipotong menjadi potongan-potongan teks, dan setiap teks dihitung nilai hash-nya (spasi kosong dinormalisasi agar perubahan whitespace sepele tidak mengubah nilai hash).
2. Jika suatu nilai hash chunk sudah ada di database dan dihasilkan oleh *versi model embedding yang sedang aktif saat ini*, data tersebut **dipertahankan (kept)**; sistem hanya memperbarui nomor urut posisinya. Nol pemanggilan API embedding!
3. Jika ditemukan nilai hash baru yang belum ada di database, chunk tersebut **dikirim ke model embedding** dan di-upsert ke tabel.
4. Nilai hash lama di database yang tidak lagi muncul pada dokumen hasil pemotongan terbaru **dihapus (deleted)** dari tabel.

Arsitektur ini membuat proses sinkronisasi bersifat idempoten sempurna (menjalankan sync dua kali berturut-turut menghasilkan nol pemanggilan embedding pada putaran kedua) dan beban komputasi berbanding lurus dengan *volume perubahan data* dan bukan total ukuran dokumen. Pengujian lab modul ini membuktikannya secara presisi: sinkronisasi teks yang tidak berubah memicu 0 panggilan embedding; mengedit satu paragraf memicu tepat 1 panggilan embedding; menyisipkan satu paragraf baru di awal dokumen memicu tepat 1 panggilan embedding dan memperbarui urutan posisi chunk lainnya; serta perubahan metadata kategori tidak memicu pemanggilan embedding sama sekali. Inilah alasan mengapa structure-aware chunking sangat krusial: pada fixed-size chunking, penambahan satu kalimat akan menggeser seluruh batas pemotongan di bawahnya dan memaksa re-embedding pada seluruh sisa dokumen.

Lakukan seluruh operasi sinkronisasi sebuah dokumen di dalam **satu transaksi database tunggal (single atomic transaction)**. Jika koneksi API embedding mendadak putus di tengah-tengah pemrosesan suatu dokumen, kondisi data parsial di mana chunk lama dan chunk baru bercampur aduk jauh lebih berbahaya daripada mempertahankan kondisi lama. Transaksi atomik memastikan jika terjadi kegagalan, dokumen tetap berada pada kondisi valid sebelumnya. Di level koleksi dokumen, proses setiap dokumen secara terisolasi dan pasang mekanisme retry otomatis dengan exponential backoff dan dead-letter queue untuk dokumen yang gagal berulang kali (Modul 1.2).

### Bagaimana Perubahan Sampai ke Pipeline

Pilihan, dari yang paling sederhana: pemindaian malam yang membandingkan hash; tabel dokumen yang berubah yang diperbarui oleh sistem sumber; atau change data capture dan event (Modul 3.2) yang memicu sinkronisasi dalam hitungan detik. Pilih kesegaran data sesuai kebutuhan pengguna: chatbot kebijakan mungkin menoleransi satu hari, asisten ketersediaan stok tidak. Lacak **staleness** (usia perubahan tertua yang belum disinkronkan) sebagai metrik.

### Hak Privasi dan Penghapusan Data

Ketika seorang pengguna mengajukan hak penghapusan data pribadi (Right to be Forgotten) atau dokumen rahasia ditarik dari peredaran, seluruh data vektor terkait wajib dihapus seketika; representasi vektor numerik terbukti mampu membocorkan informasi teks aslinya melalui teknik rekonstruksi. Fungsi `delete_document` pada lab modul ini menjamin bahwa penghapusan dokumen sumber akan menghapus seluruh chunk dan vektornya dari database. Pastikan pula data tersebut dibersihkan dari backup dan cache memori dalam batas waktu regulasi hukum, serta hindari mengindeks data sensitif tanpa tujuan bisnis yang sah melalui filter sanitasi di tahap ingestion (Modul 2.5).

### Manajemen Versi Model Embedding

Sebuah representasi vektor hanya memiliki makna jika dipadukan dengan model embedding spesifik yang menghasilkannya. Dua model embedding yang berbeda memproyeksikan makna ke dalam ruang koordinat multidimensi yang sepenuhnya berlainan: membandingkan vektor dari Model A dengan vektor dari Model B akan menghasilkan angka acak tanpa arti, **tanpa melempar satu pun pesan error!** Oleh karena itu, identitas nama dan versi model wajib disimpan pada setiap baris data vektor di database, query pencarian wajib menyertakan filter `WHERE model = ...` untuk hanya membandingkan vektor dari model yang sama, dan migrasi ke model baru wajib memicu re-embedding menyeluruh. Pada sistem produksi berskala besar, lakukan migrasi model menggunakan strategi **Blue/Green Deployment**: bangun indeks kedua secara lengkap menggunakan model baru di samping indeks lama, jalankan benchmark evaluasi pada kedua indeks, dan alihkan lalu lintas query aplikasi hanya jika model baru terbukti memberikan akurasi yang lebih unggul.

> 💡 **Jeda Praktik 4 (Sinkronisasi Inkremental Idempoten & Penghapusan Atomik):**
> 1. Buka file `labs/mod-3-5/rag.py` di teks editor Anda.
> 2. Implementasikan fungsi `sync_document(conn, doc_id, category, text, model, embed_fn)` di dalam blok transaksi atomik (`with conn.transaction():`) yang hanya memanggil embedding pada hash atau model baru, serta fungsi `delete_document(conn, doc_id)`.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-5/test_rag.py -k TestSync -v`
> 4. **Indikator Sukses:** Sebanyak 11 pengujian berstatus `PASSED`, memvalidasi 0 panggilan embedding saat teks tidak berubah, 1 panggilan saat 1 paragraf diedit, serta rollback transaksi yang aman saat terjadi kegagalan.

## @lesson Evaluasi metrik dan pengoperasian pipeline data RAG
Anda tidak dapat menilai apakah sistem retrieval bekerja dengan baik hanya dengan membaca respon kalimat chatbot yang terdengar sopan dan lancar. Bangun **dataset evaluasi resmi (evaluation set)**: kumpulan ratusan pertanyaan nyata atau representatif yang masing-masing telah dipasangkan dengan dokumen (atau potongan teks) yang menjadi kunci jawaban benarnya. Dataset praktikum lab menghasilkan 116 pasangan pertanyaan dan jawaban berlabel. Dua metrik evaluasi retrieval yang menjadi standar industri:

- **Hit Rate @ k**: persentase proporsi pertanyaan di mana dokumen jawaban yang benar berhasil masuk ke dalam daftar $k$ hasil pencarian teratas.
- **MRR (Mean Reciprocal Rank)**: nilai rata-rata dari kebalikan peringkat dokumen yang benar ($1 / \text{rank}$), yang memberikan bobot skor tertinggi jika dokumen yang tepat berada di peringkat pertama.

Pada basis data pengetahuan lab: sistem mencapai Hit Rate 63% pada $k=1$, Hit Rate 98% pada $k=5$, dan skor MRR sebesar 0,80. Gunakan rangkaian evaluasi ini sebagai **regression test otomatis** di dalam pipeline CI/CD di setiap ada perubahan pada strategi pemotongan chunk, pembaruan versi model embedding, penyesuaian parameter indeks HNSW, atau perubahan data: jika skor hit rate mengalami penurunan, deployment kode baru wajib dibatalkan otomatis.

Gunakan evaluasi sebagai **regression test**, di CI dan setiap kali chunking, model, pengaturan indeks, atau data berubah: jika hit rate turun, perubahan itu tidak boleh dirilis. Ini setara RAG dari tes yang Anda tulis di setiap modul sebelumnya. (Mengevaluasi *jawaban* yang dihasilkan adalah lapisan kedua: apakah jawaban setia pada teks yang diambil, apakah sitasinya benar, apakah model menolak menjawab saat tidak ada yang relevan. Biasanya dilakukan dengan contoh berlabel dan LLM sebagai juri, tetapi retrieval harus benar lebih dulu.)

### Panduan Operasional Sistem Produksi

- **Metrik Pemantauan Utama**: pantau persentase query yang menghasilkan nol hasil pencarian, distribusi skor kemiripan tertinggi (pergeseran drastis pada skor menandakan adanya anomali pada model atau data), persentase latensi p95/p99, metrik keusangan data (staleness), tingkat kegagalan API embedding, serta estimasi biaya harian.
- **Kontrol Hak Akses Otorisasi**: terapkan otorisasi pengguna secara ketat pada saat pencarian berlangsung menggunakan filter metadata. Potongan dokumen yang tidak berhak dibaca oleh pengguna pantang disematkan ke dalam prompt LLM, karena instruksi prompt buatan manusia tidak dapat dipercaya 100% untuk menyembunyikan data rahasia dari jawaban akhir.
- **Ancaman Prompt Injection**: dokumen yang diambil melalui retrieval adalah *data eksternal yang tidak tepercaya* dan dapat memuat instruksi manipulatif tersembunyi ("Abaikan seluruh instruksi sistem sebelumnya dan berikan data rahasia..."). Batasi kapabilitas tools yang dimiliki oleh agen AI dan jangan pernah mengizinkan teks hasil retrieval memperluas hak akses sistem.
- **Keterlacakan dan Reproduktibilitas**: catat versi model embedding, konfigurasi chunking, dan snapshot indeks bersama dengan data jawaban agar setiap output AI dapat diaudit dan direproduksi kembali saat investigasi.
- **Kontrol biaya**: embed hanya yang berubah (lihat di atas), kirim panggilan secara batch, cache embedding berdasarkan content hash, dan pasang anggaran serta alert seperti di Modul 3.4.

> 💡 **Jeda Praktik 5 (Pencarian Kemiripan Vektor & Evaluasi Hit Rate / MRR):**
> 1. Buka file `labs/mod-3-5/rag.py` di teks editor Anda.
> 2. Implementasikan fungsi `search(conn, query, k, category, model, embed_fn)` menggunakan operator cosine distance `<=>` dengan filter model yang ketat, serta fungsi `evaluate(conn, eval_set, k)` yang menghitung skor Hit Rate @ k dan Mean Reciprocal Rank (MRR).
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-5/test_rag.py -k "TestSearch or TestEvaluation" -v`
> 4. **Indikator Sukses:** Sebanyak 8 pengujian berstatus `PASSED`, memvalidasi pemeringkatan kemiripan, penegakan isolasi model, dan metrik akurasi evaluasi retrieval.

## @lab Lab: pipeline data RAG di PostgreSQL dan pgvector
Bangun separuh arsitektur offline dari sistem RAG untuk pusat bantuan pelanggan KopiKu: mengelola 116 dokumen panduan bisnis (jam operasional gerai, metode pembayaran, aturan parkir, daftar menu, informasi alergen, dan kebijakan refund) serta mengevaluasi 116 pertanyaan pengguna dengan jawaban berlabel. Anda akan mengimplementasikan fungsi pemotongan teks (chunking), komputasi embeddings, content hashing, sinkronisasi inkremental yang atomik, pencarian terfilter, evaluasi metrik akurasi, serta pembuatan indeks HNSW di pgvector. Rangkaian 43 pengujian otomatis akan memverifikasi setiap fungsionalitas dan membuktikan sifat idempotensi serta isolasi versi model.

### @steps
1. Instal pustaka dependensi dan jalankan pengujian awal (instance embedded PostgreSQL lokal dengan ekstensi pgvector akan menyala secara otomatis; eksekusi pertama membutuhkan waktu beberapa detik untuk inisialisasi):

```bash
python -m pip install -r labs/mod-3-5/requirements.txt
pytest labs/mod-3-5 -v        # seluruh pengujian akan gagal pada awalnya
```

2. Pelajari file generator data `labs/shared/kbgen.py` dan kerangka kode yang telah disediakan di `labs/mod-3-5/rag.py` (definisi skema tabel, fungsi `tokens`, dan `vec_literal`). Perhatikan bahwa primary key tabel didefinisikan sebagai kombinasi `(doc_id, content_hash)`.
3. Implementasikan fungsi-fungsi murni terlebih dahulu sesuai urutan: `chunk_text`, `embed`, `content_hash`, dan `recall_at_k`. Jalankan pengujian parsial via `pytest labs/mod-3-5 -k "Chunking or Embed or Hash or Recall"`. Gunakan docstring sebagai spesifikasi teknis dan perhatikan penanganan kasus-kasus batas (edge cases).
4. Implementasikan fungsi `sync_document` dan `delete_document`. Mulai dari skenario normal, lalu lengkapi dengan penanganan transaksi atomik agar pengujian skenario kegagalan lulus sempurna. Jalankan pengujian via `pytest labs/mod-3-5 -k Sync`.
5. Implementasikan fungsi `search` dan `evaluate`. Cetak 3 hasil pencarian teratas untuk pertanyaan riil seperti "apakah saya bisa menggunakan dua voucher dalam satu pesanan?" dan amati skor kemiripan jarak vektornya.
6. Implementasikan fungsi `create_hnsw_index` dan `ann_top_k`, lalu jalankan pengujian via `pytest labs/mod-3-5 -k Approximate`. Verifikasi penggunaan indeks menggunakan perintah query `EXPLAIN` di sesi shell Python.
7. Lakukan eksperimen mandiri menggunakan kode Anda: (a) sinkronkan seluruh dokumen sebanyak dua kali berturut-turut dan buktikan jumlah pemanggilan embedding pada putaran kedua bernilai 0; (b) ubah parameter `max_words` pada chunking dan amati pergeseran metrik `hit_rate`; (c) hapus filter `WHERE model = ...` pada query pencarian, sinkronkan separuh dokumen dengan `model="v2"` dan amati bagaimana hit rate anjlok menjadi 50%; (d) variasikan parameter `m`, `ef_construction`, dan `ef_search` lalu petakan grafik hubungan recall vs waktu eksekusi di komputer Anda.

> 💡 **Jeda Praktik 6 (Verifikasi Menyeluruh & Bukti Kelulusan):**
> 1. Di terminal, jalankan seluruh rangkaian 43 pengujian:
>    `pytest labs/mod-3-5/test_rag.py -v`
> 2. Hasilkan token bukti verifikasi kelulusan:
>    `python3 scripts/prove.py mod-3-5`
> 3. **Indikator Sukses:** Seluruh 43 pengujian berstatus `PASSED` dan token bukti kelulusan dicetak ke terminal untuk verifikasi.

### @files
- labs/mod-3-5/rag.py :: File kerja implementasi: fungsi chunking, embedding, sync atomik, search, evaluasi, dan HNSW :: starter
- labs/mod-3-5/test_rag.py :: Suite pengujian otomatis yang mencakup 43 pengujian komprehensif :: test
- labs/shared/kbgen.py :: Generator deterministik untuk basis pengetahuan dokumen dan dataset pertanyaan berlabel :: data
- labs/mod-3-5/requirements.txt :: Konfigurasi dependensi pustaka pytest, numpy, psycopg, dan pgserver :: config
- labs/mod-3-5/reference/rag.py :: Solusi referensi lengkap (jadikan pembanding setelah mencoba mandiri!) :: reference

### @deliverables
- Seluruh 43 pengujian di `test_rag.py` lulus dengan sukses
- Mampu melaporkan angka riil dari pengujian Anda: hit rate pada k=1 dan k=5, jumlah pemanggilan API embedding saat initial sync versus saat satu paragraf diedit, serta skor recall pada `ef_search` 10 dan 400
- Ringkasan penjelasan teknis singkat yang menguraikan apa yang terjadi pada sistem jika query beralih ke model baru sebelum seluruh vektor di database selesai di-re-embed

### @verify
```bash
pytest labs/mod-3-5 -v
```

Verifikasi terhadap kode referensi: jalankan dengan prefix `LAB_DIR=reference pytest labs/mod-3-5 -v`. Jika ingin menggunakan instance PostgreSQL mandiri (dengan ekstensi pgvector aktif), arahkan variabel `DATABASE_URL` ke database pengujian Anda.

## @chaos Upgrade model embedding yang merusak sistem secara diam-diam
### @scenario
Sebuah asisten AI internal bertugas menjawab pertanyaan operasional staf perusahaan berdasarkan 40.000 potongan dokumen panduan kerja. Suatu hari, penyedia model AI merilis model embedding generasi baru yang menawarkan harga pemrosesan token 50% lebih murah. Seorang pengembang memperbarui konfigurasi layanan query asisten tersebut agar langsung menggunakan model baru tersebut melalui satu baris perubahan konfigurasi yang lolos proses code review ("dimensi vektornya sama-sama 1.536, drop-in replacement"). Sementara itu, pipeline sinkronisasi malam hari yang hanya memproses *dokumen yang mengalami perubahan* mulai menghasilkan vektor menggunakan model baru hanya untuk segelintir dokumen yang diedit hari itu. Tidak ada instruksi untuk melakukan re-embedding pada seluruh dokumen lama.

Tidak ada satu pun sistem yang mengalami error. Tidak ada exception traceback di log server, tidak ada request timeout, dan seluruh dashboard pemantauan berstatus hijau normal. Namun, asisten AI mulai memberikan jawaban yang melantur, mengarang fakta, atau menjawab bahwa ia tidak menemukan informasi relevan, karena langkah retrieval kini mengembalikan potongan dokumen yang hampir acak sehingga model LLM berusaha menebak-nebak jawabannya. Tiga minggu kemudian, setelah gelombang keluhan staf memuncak akibat mengikuti instruksi kerja yang keliru, insiden tersebut baru disadari oleh tim pimpinan.

### @cause
Vektor yang dihasilkan oleh model embedding yang berbeda tidak dapat dibandingkan satu sama lain, meskipun keduanya memiliki jumlah dimensi koordinat yang persis sama. Vektor pertanyaan diturunkan dari model baru, sementara mayoritas vektor di database diturunkan dari model lama; akibatnya, operasi pencarian nearest-neighbor membandingkan representasi angka yang memiliki arti semantik yang sepenuhnya berlainan. Berdasarkan pengukuran empiris di lab modul ini: 116 pertanyaan yang sama menghasilkan hit rate 98,3% saat query dan dokumen menggunakan model yang sama, namun akurasinya anjlok drastis menjadi hanya **2,6%** (setara dengan tebakan acak murni) saat query menggunakan model yang berbeda dengan dokumen di database. Ketika separuh dokumen termigrasi tanpa filter pemisah model, hit rate terpangkas menjadi 50%: separuh pengetahuan perusahaan mendadak lenyap secara hening.

Pipeline inkremental memperparah insiden ini justru karena efisiensinya: ia mendeteksi teks yang tidak berubah dan secara sah mempertahankan vektor lama. Kelemahan fatal arsitektur terletak pada: ketiadaan atribut pengikat antara vektor dengan versi modelnya di database, ketiadaan filter model pada query pencarian, serta ketiadaan pengujian otomatis berbasis dataset pertanyaan berlabel yang dapat mengubah dashboard hijau menjadi merah saat akurasi retrieval runtuh.

### @fix
1. Simpan **identitas nama dan versi model secara eksplisit pada setiap baris data vektor**, dan wajibkan fungsi query pencarian untuk hanya membandingkan vektor dari model yang identik. Di lab modul ini, ketidakcocokan model menghasilkan *nol hasil pencarian* yang berbunyi nyaring, dan bukan hasil pencarian salah yang merusak secara diam-diam.
2. Perlakukan pergantian model embedding sebagai **prosedur migrasi arsitektur (Blue/Green Migration)**: bangun indeks baru menggunakan model baru berdampingan dengan indeks lama, jalankan benchmark evaluasi pada kedua indeks, dan alihkan lalu lintas query aplikasi hanya jika indeks baru terbukti memiliki akurasi yang setara atau lebih baik.
3. Integrasikan **evaluasi berbasis dataset pertanyaan berlabel ke dalam pipeline CI/CD dan jadwal monitoring produksi berkala**, serta pasang alarm peringatan darurat jika nilai hit rate atau distribusi skor kemiripan mengalami penurunan signifikan.
4. Jadikan konfigurasi model embedding sebagai konfigurasi terpadu yang mengikat pipeline data sekaligus layanan query secara selaras dalam satu siklus deployment.
5. Tambahkan mekanisme pengujian berkala (Canary Queries): ajukan sekumpulan pertanyaan standar setiap jam dan verifikasi bahwa dokumen sumber yang diharapkan selalu berhasil diambil oleh sistem retrieval.

### @pattern
Sebuah vektor hanya bermakna jika dipadukan dengan model yang memproduksinya. Selalu sematkan versi model bersama data, evaluasi kualitas retrieval secara kontinu, dan pastikan setiap ketidaksesuaian versi model gagal secara eksplisit (fail loudly).

## @quiz
### Masalah fundamental apa yang diselesaikan oleh arsitektur Retrieval-Augmented Generation (RAG)?
- [ ] Membuat model bahasa berjalan jauh lebih cepat dengan mengompresi bobot parameternya agar muat di server kecil
- [ ] Menghilangkan kebutuhan untuk menyimpan file dokumen karena model mampu menghafal seluruh teks yang pernah dilihatnya
- [ ] Menjamin bahwa jawaban yang dihasilkan pasti benar 100% karena model tidak lagi memiliki kemampuan membuat kesalahan
- [x] Memungkinkan model menjawab dari data terkini dan privat perusahaan dengan menyematkan teks relevan ke dalam prompt

> Model bahasa tidak mengetahui data privat atau data terbaru perusahaan Anda. RAG mengambil kutipan teks yang relevan pada saat pertanyaan diajukan dan menginstruksikan model untuk menjawab berdasarkan dokumen tersebut, meminimalkan halusinasi secara signifikan.

### Pada lab modul ini, sebuah paragraf baru disisipkan di awal dokumen. Mengapa proses sinkronisasi hanya memicu tepat satu pemanggilan embedding?
- [ ] Model embedding secara otomatis diberitahu karakter mana yang berubah dan hanya mengembalikan pembaruan untuk karakter tersebut
- [x] Setiap chunk diidentifikasi oleh hash kontennya, sehingga chunk lama yang tidak berubah ditemukan dan dipertahankan apa adanya
- [ ] Pipeline sinkronisasi secara otomatis melewati dokumen yang perubahannya kurang dari satu paragraf penuh
- [ ] Database secara otomatis menghitung ulang vektor untuk chunk lama tanpa perlu melibatkan model embedding

> Identitas unik potongan teks adalah pasangan (doc_id, content_hash). Potongan teks yang tidak berubah mempertahankan vektor lamanya dan hanya diperbarui nomor urut posisinya. Sebaliknya, metode fixed-size chunking akan menggeser seluruh batas potongan berikutnya dan memaksa re-embedding pada seluruh dokumen.

### Sebuah model embedding hosted digantikan oleh model generasi baru yang memiliki jumlah dimensi yang persis sama. Apa yang wajib dilakukan terhadap vektor lama di database?
- [ ] Tidak perlu melakukan apa pun, karena jumlah dimensi sama persis sehingga vektor lama dapat langsung dibandingkan dengan model yang baru
- [x] Seluruh vektor wajib dihitung ulang (re-embedded) menggunakan model baru, karena vektor dari model yang berbeda tidak kompatibel
- [ ] Cukup menormalisasi ulang panjang setiap vektor ke satuan 1, sehingga secara otomatis vektor antar model langsung menjadi kompatibel
- [ ] Menghapus seluruh vektor lama secara permanen karena asisten AI hanya dapat bekerja optimal menggunakan vektor model terbaru

> Makna semantik dari setiap dimensi koordinat sepenuhnya ditentukan oleh arsitektur internal model. Mencampuradukkan dua model berbeda akan menghasilkan perbandingan acak tanpa pesan error. Lakukan re-embedding (blue/green), evaluasi akurasinya, lalu alihkan sistem.

### Apa dampak dari menaikkan parameter `ef_search` pada indeks HNSW di pgvector?
- [ ] Membuat indeks memakan lebih banyak memori RAM karena struktur graf menambah jumlah link koneksi antar node
- [ ] Membuat proses build indeks berjalan lebih lambat karena graf wajib dibangun ulang setiap kali parameter diubah
- [x] Menaikkan recall dan memperlambat setiap query, karena lebih banyak kandidat dievaluasi saat menelusuri graf
- [ ] Menurunkan skor recall dan mempercepat latensi query karena kandidat yang dievaluasi saat pencarian dipangkas

> Parameter `ef_search` menentukan luas penelusuran graf saat runtime query. Pada pengujian lab, recall@10 melonjak dari 0,31 pada nilai 10 menjadi 1,00 pada nilai 400 dengan konsekuensi latensi query naik dari 0,7 ms menjadi 5,8 ms. Parameter `m` dan `ef_construction` adalah konfigurasi saat indeks dibangun.

### Apa perbedaan mendasar antara metrik ANN Recall dengan Retrieval Hit Rate?
- [ ] Keduanya adalah metrik pengukuran yang sama persis dengan nama berbeda dan dapat digunakan bergantian untuk membandingkan model
- [ ] Recall hanya diukur pada data pelatihan model, sedangkan hit rate hanya diukur pada lalu lintas produksi langsung
- [x] Recall menguji kesamaan terhadap pencarian eksak, sedangkan hit rate menguji apakah dokumen yang tepat berhasil ditemukan
- [ ] Hit rate mengukur kecepatan durasi query, sedangkan recall mengukur total jumlah vektor yang ditampung oleh indeks

> Indeks ANN dengan recall sempurna yang berjalan di atas embedding model yang buruk tetap akan mengembalikan dokumen yang salah bagi pengguna. Recall tidak memerlukan label data manusia (cukup dibandingkan terhadap exact KNN); sedangkan hit rate membutuhkan dataset pertanyaan berlabel.

### Sebuah query pencarian yang difilter ke kategori yang populasinya langka hanya mengembalikan 2 hasil padahal parameter k disetel ke 5. Apa penyebab paling mungkin?
- [ ] Model embedding menolak mengembalikan representasi vektor untuk kategori data yang jarang ditemui sebelumnya
- [ ] Tipe kolom vektor terlalu pendek sehingga baris-baris data setelah baris kedua terpotong secara diam-diam
- [x] Pencarian perkiraan mengambil kandidat terdekat terlebih dahulu, lalu filter kategori membuang sebagian besar kandidat itu
- [ ] Operator jarak cosine distance secara otomatis membatasi hasil pencarian maksimum dua baris saat filter kategori diterapkan

> Melakukan post-filtering terhadap daftar kandidat tetangga terdekat yang terbatas dapat menyisakan hasil yang lebih sedikit dari nilai $k$. Ujilah selalu filter Anda terhadap nilai kategori yang langka, perlebar batas pencarian, atau manfaatkan fitur iterative scan di pgvector.

### Seorang pelanggan mengajukan permohonan resmi untuk menghapus seluruh data pribadinya. Tindakan apa yang wajib diambil pada indeks RAG?
- [ ] Tidak perlu melakukan apa pun, karena vektor hanyalah deretan angka numerik yang tidak dapat dikembalikan menjadi teks asli
- [ ] Menyembunyikan dokumen pelanggan dari prompt chatbot namun tetap mempertahankan chunk dan vektornya di dalam indeks
- [ ] Menghapus dokumen mentah sumbernya saja, karena data embedding akan dibangun ulang dari awal beberapa minggu kemudian
- [x] Menghapus seluruh chunk dan vektor dokumen itu dari database, lalu membersihkannya dari backup dalam batas waktu hukum

> Vektor dan teks potongan dokumen diturunkan langsung dari data pribadi dan berisiko membocorkan informasi aslinya. Prosedur penghapusan wajib mencakup indeks database, layer cache, dan sistem backup lengkap dengan pencatatan jejak audit kepatuhan.

### Praktik rekayasa data mana yang paling efektif melindungi sistem RAG dari penurunan kualitas jawaban yang terjadi secara diam-diam?
- [ ] Menggunakan model LLM berukuran parameter raksasa pada tahap generate agar mampu mengatasi kelemahan pada tahap retrieval
- [ ] Menggelar rapat mingguan di mana tim membaca beberapa sampel jawaban chatbot dan memberikan penilaian subjektif
- [ ] Menambahkan teks instruksi panjang di prompt yang memerintahkan LLM untuk tidak menjawab jika konteks dokumen tampak meragukan
- [x] Menjalankan dataset pertanyaan berlabel sebagai regression test di CI/CD, dengan alert saat hit rate atau skor anjlok

> Kualitas retrieval adalah metrik terukur. Jalankan evaluasi matematis secara otomatis di setiap ada pembaruan kode, model, atau data, sehingga degradasi kualitas yang hening langsung terdeteksi sebagai test failure yang membunyikan alarm.

## @resources
- [Ekstensi pgvector untuk PostgreSQL](https://github.com/pgvector/pgvector)
- [Paper Ilmiah: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al.)](https://arxiv.org/abs/2005.11401)
- [Paper Ilmiah: HNSW Approximate Nearest Neighbor Search (Malkov & Yashunin)](https://arxiv.org/abs/1603.09320)
- [MTEB: Massive Text Embedding Benchmark](https://huggingface.co/spaces/mteb/leaderboard)
- [Panduan Keamanan OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Dokumentasi Pustaka Sentence Transformers](https://www.sbert.net/)

