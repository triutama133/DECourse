---
title: Di Luar SQL: Database Key-Value, Dokumen, Wide-Column, dan Graf
duration: 2 minggu
summary: Pelajari mengapa keluarga database lain ada, apa kelebihan dan kekurangan masing-masing, dan cara memilih berdasarkan pola akses. Anda membangun ulang inti key-value store, document store, cincin consistent hashing, replikasi quorum, dan tabel wide-column dalam Python murni, lalu melihat apa yang harus dilakukan data engineer ketika data berada di sistem seperti itu.
why: Bootcamp bilang "pakai MongoDB untuk data fleksibel dan Cassandra untuk skala" lalu berhenti. Tanpa tahu cara kerjanya Anda tidak bisa memilih, tidak bisa memodelkan data untuknya, dan tidak bisa dengan andal memasukkan datanya ke warehouse, tempat sebagian besar pekerjaan data engineering dimulai.
---

## @outcomes
- Menjelaskan apa keunggulan database relasional, dan tekanan apa yang melahirkan database key-value, dokumen, wide-column, dan graf
- Menyatakan teorema CAP dengan benar, dan menjelaskan arti eventual consistency dalam praktik
- Memilih di antara keluarga database berdasarkan pola akses, dan menjelaskan trade-off-nya
- Menjelaskan partition key, clustering key, consistent hashing, serta baca dan tulis quorum, dan mengapa partition key yang buruk menciptakan titik panas
- Menjelaskan bagaimana data diekstrak dari sistem seperti itu (change stream, ekspor) dan mengapa analitik tidak boleh dijalankan di operational store
- Meratakan dokumen menjadi tabel dan menangani schema drift saat ingestion

## @prereq
Modul 0.3 (dasar SQL), 1.2 (kelas Python dengan `__init__`, `self`, dan pytest), dan 1.3 (index) membantu. Tidak ada database yang perlu dipasang.

## @part Keluarga database utama

## @lesson Mengapa ada database lain
Database relasional unggul dalam satu hal: menjaga **data terstruktur dan saling terkait tetap benar** sementara banyak orang membaca dan mengubahnya, dan menjawab **pertanyaan yang tidak Anda rencanakan** dengan SQL. Tabel, key, join, dan transaksi (Modul 0.3) menyelesaikan rentang masalah yang sangat luas, dan untuk kebanyakan aplikasi ia tetap pilihan pertama yang tepat.

Keluarga lain muncul karena **tekanan** yang kurang ditangani baik oleh satu server relasional:

- **Skala dan volume tulis.** Satu mesin punya batas. Menyebar satu database logis ke banyak mesin (sharding) mungkin dilakukan dengan SQL tetapi sulit, karena join dan transaksi lintas mesin lambat dan rumit.
- **Latensi.** Beberapa pertanyaan harus dijawab dalam satu milidetik ("apakah sesi ini valid?"), yang menyarankan menyimpan data di memori dengan pencarian paling sederhana.
- **Bentuk data.** Sebagian data bersarang dan berbeda dari record ke record (katalog produk yang tiap kategorinya punya atribut berbeda), atau sebagian besar berupa *relasi* (jejaring sosial).
- **Ketersediaan.** Keranjang belanja yang tidak bisa ditulis ketika satu pusat data tidak terjangkau kehilangan penjualan.

Keluarga NoSQL adalah jawaban atas tekanan ini, dan setiap jawaban ada harganya. Pertukaran utamanya: **melepas sebagian kekuatan umum SQL (query ad hoc, join, transaksi ketat) demi skala, kecepatan, atau fleksibilitas untuk pola akses tertentu**. Jadi pertanyaannya tidak pernah "mana yang lebih baik" tetapi "**bagaimana data ini akan diakses?**".

Dua gagasan membantu Anda bernalar tentang pertukaran itu. **Teorema CAP** menyatakan bahwa ketika **partisi jaringan** terjadi (sebagian mesin tidak bisa berbicara dengan yang lain), sistem terdistribusi harus memilih antara **konsistensi** (setiap pembacaan melihat tulisan terbaru, sehingga sebagian permintaan harus ditolak) dan **ketersediaan** (setiap permintaan mendapat jawaban, yang mungkin basi). Partisi tidak bisa dikesampingkan, jadi pilihan sesungguhnya adalah C atau A *selama* partisi. **PACELC** menambahkan kasus sehari-hari: bahkan tanpa partisi ada pertukaran antara **latensi** dan **konsistensi**, karena menunggu lebih banyak replika itu lebih lambat. Banyak sistem NoSQL memilih ketersediaan dan latensi rendah dan menawarkan **eventual consistency**: jika penulisan berhenti, semua replika konvergen, tetapi pembacaan bisa sesaat mengembalikan nilai lama. Yang lain membiarkan Anda memilih per query, seperti yang akan Anda lihat pada quorum.

ACID (transaksi atomik, konsisten, terisolasi, tahan lama) adalah janji relasional. Sebagian sistem NoSQL melonggarkannya (kadang bercanda disebut BASE: basically available, soft state, eventually consistent), dan banyak yang kemudian menambahkan transaksi terbatas. Selalu baca apa yang dijamin produk tertentu.

> 🛠 **Coba sendiri (5 menit, pena dan kertas, pemanasan intuisi).** Tebak dulu memakai intuisi Anda, lalu baca *Bandingkan*, Pelajaran 2–5 membahas tiap keluarga secara rinci. Untuk setiap kebutuhan, sebutkan keluarganya, relasional (tabel SQL), key-value (pencarian cepat lewat key), dokumen (JSON bersarang), wide-column (tabel berpartisi untuk volume tulis tinggi), graf (node/edge yang saling terhubung), pencarian (peringkat teks penuh), atau time-series (metrik berstempel waktu), dan tekanan yang dijawabnya: (a) "apakah sesi login ini masih berlaku?" dalam waktu di bawah satu milidetik; (b) katalog produk yang setiap kategorinya punya atribut berbeda; (c) 5 juta pembacaan sensor per jam, di-query berdasarkan rentang waktu; (d) teman dari teman yang membeli barang ini; (e) pencarian teks bebas dengan peringkat; (f) faktur yang tidak boleh pernah tidak konsisten.
>
> *Bandingkan:* (a) key-value (latensi), (b) dokumen (bentuk data), (c) time-series atau wide-column (volume tulis), (d) graf, (e) mesin pencari, (f) relasional (kebenaran). Lalu tulis satu kalimat tentang apa yang Anda korbankan saat meninggalkan SQL untuk (a).

:::ask Saat terjadi partisi jaringan, database terdistribusi harus memilih. Apa dua pilihan dalam teorema CAP?
@options
kecepatan atau harga, tergantung penyedia cloud
* konsistensi (menolak) atau ketersediaan (mungkin basi)
membaca atau menulis, tetapi tidak pernah keduanya
@why
Saat mesin tidak bisa saling berkomunikasi, sistem menolak permintaan yang mungkin mengembalikan data basi (konsistensi) atau menjawab dengan apa yang ia punya (ketersediaan). Keduanya tidak gratis.
:::

## @lesson Key-value store: database paling sederhana
Key-value store adalah dictionary raksasa: Anda **set** sebuah nilai di bawah sebuah **key** dan **get** kembali lewat key itu. Itu saja. Tampaknya terlalu sederhana untuk berguna, tetapi justru itu yang membuatnya sangat cepat: tidak ada yang perlu direncanakan, diurai, atau di-join. Contoh: **Redis**, Memcached, dan DynamoDB dalam bentuk paling sederhananya.

**Redis** menyimpan data di memori dan juga menawarkan *struktur* data sebagai nilai: string, hash (dictionary kecil), list, set, dan **sorted set** (set yang diurutkan menurut skor, sempurna untuk papan peringkat). Ia bisa menulis ke disk (snapshot, atau log append-only) agar data bertahan setelah restart, tetapi kekuatannya adalah kecepatan, bukan menyimpan segalanya selamanya.

:::talk Alamat yang tersimpan di cache
@teacher Sebuah toko web menyimpan profil setiap pelanggan di Redis dengan TTL satu jam. Pukul 10:00 seorang pelanggan mengubah alamat pengirimannya di database utama. Pukul 10:10 ia membuka halaman profilnya.
@ask Alamat mana yang ditampilkan halaman itu?
@choice Yang baru, karena Redis selalu bertanya ke database utama | Cache tidak bertanya: ia menjawab dari salinannya sendiri sampai salinan itu kedaluwarsa. Coba lagi.
@choice * Yang lama, sampai key kedaluwarsa sekitar pukul 11:00, kecuali aplikasi menghapus atau memperbarui key di cache saat alamat berubah | Betul. TTL adalah janji bahwa data paling tua selama itu. Untuk data yang harus berubah seketika, perbarui atau hapus key saat penulisan.
@choice Error, karena kedua penyimpanan tidak sepakat | Tidak ada yang mendeteksi ketidaksepakatan itu. Coba lagi.
@teacher Cache menukar kesegaran dengan kecepatan: putuskan seberapa basi setiap data boleh.
:::

Dua fitur menentukan bagaimana key-value store dipakai:

- **TTL (time to live).** Sebuah key bisa kedaluwarsa otomatis setelah sejumlah detik. Sesi, one-time password, dan hasil cache memakainya. `KeyValueStore` di lab mengedaluwarsakan key ketika `clock() >= waktu_set + ttl`; fungsi clock diteruskan sebagai argumen sehingga tes tidak perlu menunggu.
- **Eviction.** Memori terbatas. Ketika penuh, store harus membuang sesuatu; **LRU** (least recently used) membuang key yang paling lama tidak disentuh. `collections.OrderedDict` di Python mengingat urutan penyisipan: `od.move_to_end(key)` memindahkan key yang diakses ke ujung "terbaru" dalam O(1) (waktu konstan, dijelaskan di bawah), dan `od.popitem(last=False)` membuang key paling lama dari ujung depan (`del` menghapus key apa pun).

**Untuk apa:** meng-cache hasil query mahal, sesi, rate limiting (hitung permintaan per pengguna per menit), penghitung, papan peringkat, feature flag, antrean job kecil. **Bukan untuk:** menanyakan "semua pelanggan di Jakarta yang belanja di atas 1 juta", karena satu-satunya pintu masuk adalah key. Jika Anda perlu menemukan data lewat hal selain key, Anda harus memelihara key tambahan sendiri, dan pada titik itu keluarga lain mungkin lebih cocok.

Data engineer bertemu key-value store sebagai *lapisan penyajian* pipeline (feature store, pencarian real-time) dan sebagai cache yang membuat data pipeline tampak basi. Ingat bahwa cache adalah **salinan**: ketika sumber berubah, salinan itu salah sampai ia kedaluwarsa atau di-invalidasi.

### Big-O dalam satu menit: mengapa pencarian di dictionary cepat

Saat engineer berkata sebuah pencarian **O(1)**, artinya usahanya tidak bertambah seiring jumlah data: menemukan satu key butuh waktu hampir sama pada 10 key maupun 10 juta. **O(N)** berarti usahanya tumbuh seiring data: mencari di list satu item sekali waktu butuh waktu dua kali lipat untuk item dua kali lipat. Lihat keduanya:

:::trace Satu per satu, atau langsung ke sasaran
@code
items = ["a", "b", "c", "d", "e"]
steps = 0
for x in items:
    steps += 1
    if x == "d":
        break
print(steps)
table = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
print(table["d"])
@notes
4 | Mencari di list berarti melihat item satu demi satu, satu langkah masing-masing. Ini **O(N)**: dengan 5 item butuh 4 langkah, dengan sejuta item bisa sampai sejuta.
7 | Pemindaian itu butuh 4 langkah untuk menemukan `"d"`.
9 | Dictionary melompat langsung ke key lewat hash-nya, dalam sekitar satu langkah, sebesar apa pun ia. Ini **O(1)**, dan itulah mengapa key-value store cepat.
:::

:::ask Sebuah list berisi 1.000.000 id pelanggan dicari satu per satu untuk satu id. Apa yang kira-kira terjadi pada kerjanya bila list menjadi dua kali lipat?
@options
tetap sama, karena pencariannya O(1)
kira-kira dikuadratkan, karena tiap id dibandingkan dengan semua yang lain
* kira-kira menjadi dua kali lipat, karena kerja tumbuh seiring data (O(N))
@why
Mencari satu item sekali waktu melihat sekitar setengah dari item rata-rata, jadi item dua kali lipat berarti kerja dua kali lipat: O(N). Dictionary (atau indeks) menghindarinya dengan melompat langsung ke key.
:::

### Lihat sendiri: eviction LRU dengan OrderedDict

Kapasitas 2. Perhatikan key mana yang dibuang ketika cache penuh:

:::trace Key yang paling lama tidak dipakai dibuang lebih dulu
@code
from collections import OrderedDict

cache = OrderedDict()
capacity = 2

for key in ["a", "b", "a", "c"]:
    if key in cache:
        cache.move_to_end(key)
    else:
        cache[key] = key.upper()
        if len(cache) > capacity:
            cache.popitem(last=False)

print(list(cache))
@notes
8 | `"a"` dipakai lagi, jadi ia pindah ke ujung **paling baru**. Sekarang `"b"` yang paling lama tidak tersentuh.
10 | Key baru ditambahkan di ujung paling baru.
12 | Melebihi kapasitas: `popitem(last=False)` membuang dari **depan**, key yang paling lama tidak dipakai. Kali ini itu `"b"`, bukan `"a"`.
14 | Yang tersisa: `a` (baru dipakai) dan `c` (terbaru).
:::

:::ask Kapasitas 2. Anda menyimpan `a`, menyimpan `b`, membaca `a`, lalu menyimpan `c`. Key mana yang dibuang?
@options
* `b`, karena `a` lebih baru disentuh
`a`, karena ia disimpan pertama
`c`, karena ia baru
@why
LRU membuang key yang **paling lama tidak tersentuh**. Membaca `a` dihitung sebagai pemakaian, jadi `b` sekarang yang tertua. Urutan penyisipan saja (FIFO) akan membuang `a`.
:::

:::drill python Cache LRU kecil
Tulis `put(cache, key, value, capacity)`: simpan nilainya, tandai key sebagai **paling baru dipakai**, dan ketika cache menyimpan lebih dari `capacity` key, buang yang **paling lama tidak dipakai**. `cache` adalah `OrderedDict`.
@starter
from collections import OrderedDict

# tulis fungsi Anda di bawah baris ini

@check
defines("put") ## Definisikan put(cache, key, value, capacity).
(lambda c: (put(c, "a", 1, 2), put(c, "b", 2, 2), put(c, "c", 3, 2), list(c))[-1] == ["b", "c"])(OrderedDict()) ## Setelah a, b, c dengan kapasitas 2, key tertua (a) dibuang: ["b", "c"].
(lambda c: (put(c, "a", 1, 2), put(c, "b", 2, 2), put(c, "a", 9, 2), put(c, "c", 3, 2), list(c), c["a"])[-2:] == (["a", "c"], 9))(OrderedDict()) ## Menulis "a" lagi membuatnya baru: setelah a, b, a(9), c, key-nya ["a", "c"] dan a berisi 9.
@hint
Tetapkan nilai key di `cache`, lalu pindahkan key tersebut ke ujung paling baru dipakai pada `OrderedDict`. Jika jumlah entri melebihi `capacity`, buang satu item dari ujung paling lama (depan).
@solution
from collections import OrderedDict

def put(cache, key, value, capacity):
    cache[key] = value
    cache.move_to_end(key)
    if len(cache) > capacity:
        cache.popitem(last=False)
:::

> 💡 **Jeda Praktik: Membangun Key-Value Store & Eviction LRU**
> 1. Buka file `labs/mod-1-7/nosql_lab.py` di Text Editor (VS Code / Cursor). Jangan mengeksekusi file Python langsung di bash terminal tanpa interpreter.
> 2. Temukan kelas `KeyValueStore` (Bagian 1). Implementasikan method `__init__`, `set`, `get`, `delete`, `ttl`, dan `keys`. Gunakan `collections.OrderedDict` bersama method `move_to_end()` untuk menjaga urutan kebaruan (LRU) serta periksa apakah key telah kedaluwarsa (`clock() >= expires_at`).
> 3. Jalankan pengujian unit spesifik di terminal untuk memverifikasi logika cache Anda:
> `pytest labs/mod-1-7/test_lab.py -v -k TestKeyValueStore`
> 4. Pastikan ke-7 pengujian lulus (`7 passed`). Amati bagaimana kunci yang paling lama tidak diakses terbuang secara otomatis saat kapasitas maksimum tercapai.

## @lesson Database dokumen: bentuk yang fleksibel
Database dokumen menyimpan **dokumen**, biasanya JSON (MongoDB menyimpan bentuk biner bernama BSON; batas 16 MB per dokumen), dikelompokkan dalam **collection**. Sebuah dokumen bisa berisi objek bersarang dan array, dan dua dokumen dalam collection yang sama bisa punya field berbeda. Contoh: **MongoDB**, Couchbase, Firestore.

```json
{ "_id": "1001", "customer": {"name": "Sari", "city": "Jakarta"},
  "items": [ {"sku": "KS-1", "qty": 2}, {"sku": "ES-9", "qty": 1} ], "status": "paid" }
```

Seluruh pesanan, beserta barisnya, adalah **satu dokumen**: Anda membaca dan menulisnya dalam satu operasi, tanpa join. Itulah pilihan pemodelan utama, **embedding versus referencing**. Embed data yang dibaca bersama dan milik induknya (baris pesanan di dalam pesanan). Referensikan (simpan sebuah id) data yang dipakai bersama atau tumbuh tanpa batas, seperti semua pesanan seorang pelanggan, yang akan membuat satu dokumen pelanggan tumbuh selamanya.

:::talk Dua nama untuk hal yang sama
@teacher Sebuah database dokumen menerima bentuk apa pun. Selama dua tahun dokumen pesanan punya field `total`. Seorang developer yang terburu-buru mulai menulis dokumen baru dengan field `amount`. Database menerimanya tanpa sepatah kata.
@ask Apa yang terjadi pada laporan yang menjumlahkan `total`?
@choice Database menghentikan laporan dengan error tentang field yang tidak dikenal | Tanpa skema yang ditegakkan, tidak ada yang bisa mengeluh: kedua bentuk adalah dokumen yang sah. Coba lagi.
@choice Database mengubah `amount` menjadi `total` secara otomatis | Database tidak menebak bahwa dua nama berarti hal yang sama. Coba lagi.
@choice * Laporan diam-diam hanya menghitung dokumen lama, sehingga pendapatan turun sejak hari perubahan itu dirilis | Betul. Tidak ada yang gagal, angkanya saja yang salah. Skema tidak hilang, ia pindah ke kepala setiap pembaca, itulah mengapa pemeriksaan schema drift di Modul 1.6 penting.
@teacher "Tanpa skema" sebenarnya berarti "skema saat dibaca": siapa pun yang membaca data harus siap menghadapi setiap bentuk yang pernah ada.
:::

Database ini **tidak menegakkan skema secara bawaan**; strukturnya adalah apa pun yang ditulis aplikasi. Ini **schema on read**, gagasan yang sama dengan Hive (Modul 3.0). Cepat untuk memulai dan berbahaya kemudian: field yang dieja dua cara, angka yang disimpan sebagai teks di sebagian dokumen, field yang hilang di dokumen lama. Aturan validasi ada, tetapi Anda harus mengaktifkannya.

Anda mengkueri dengan bahasa berbentuk dokumen: `{"customer.city": "Jakarta", "total": {"$gte": 100000}}` (`DocumentStore.find` di lab mendukung path bertitik dan operator `$gt $gte $lt $lte $ne $in`). **Index** penting persis seperti di SQL: tanpanya, sebuah query **memindai setiap dokumen**. Mencari satu pengguna di antara 10.000 dokumen memindai **10.000** dokumen tanpa index dibanding hanya dokumen yang cocok (misalnya **10**) dengan index; `TestDocumentStore` di lab memverifikasi hal ini langsung pada fixture 4 dokumen (`last_scanned` turun dari **4** menjadi **1**). Aggregation pipeline (filter, group, sort, project secara bertahap) mencakup pertanyaan bergaya analitik, dan sejak versi 4.0 MongoDB mendukung transaksi multi-dokumen, meskipun tujuan desainnya tetap menyimpan data terkait dalam satu dokumen.

**Untuk apa:** konten, katalog, profil pengguna, apa pun yang bersarang dan berkembang, tempat aplikasi membaca objek utuh. **Jebakan:** array tanpa batas di dalam dokumen, tanpa join (sehingga data yang berulang harus diperbarui di banyak tempat), dan schema drift.

**Bagi data engineer** ini adalah sumber NoSQL yang paling umum. Dokumen harus **diratakan** menjadi baris: objek bersarang menjadi kolom (`customer_city`), array menjadi tabel anak dengan satu baris per elemen dan id induknya (`items` di atas menjadi tabel `order_items`). Rencanakan untuk field yang muncul dan hilang, dan untuk perubahan tipe, dengan gagasan kontrak dari Modul 2.5.

> 💡 **Jeda Praktik: Membangun Document Store & Indexing**
> 1. Di Text Editor, buka `labs/mod-1-7/nosql_lab.py` dan arahkan ke kelas `DocumentStore` (Bagian 2).
> 2. Implementasikan method `insert(doc)` (tetapkan `_id` otomatis jika belum ada dan simpan salinan dokumen), `find(query)` yang mendukung dot-path bersarang seperti `"address.city"` serta operator `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, dan `$in`.
> 3. Implementasikan `create_index(field)` dan pastikan atribut `last_scanned` mencerminkan jumlah dokumen yang benar-benar dipindai (hanya subset index, bukan seluruh koleksi).
> 4. Jalankan pengujian unit dokumen di terminal Anda:
> `pytest labs/mod-1-7/test_lab.py -v -k TestDocumentStore`
> 5. Pastikan ke-9 pengujian lulus (`9 passed`). Perhatikan bagaimana pembuatan index memangkas `last_scanned` dari seluruh dokumen di fixture (4) menjadi hanya yang cocok (1), lompatan yang sama yang berskala dari 10.000 dokumen menjadi segelintir di produksi.

:::ask Sebuah pesanan dan item-itemnya selalu dibaca bersamaan. Di database dokumen, bagaimana sebaiknya menyimpannya?
@options
taruh tiap item di koleksinya sendiri dan join belakangan
simpan hanya tautan dan ambil item dari sebuah CSV
* sematkan item di pesanan: sekali baca, tanpa join
@why
Sematkan data yang milik induk dan dibaca bersamanya. Referensikan (simpan id) data yang dibagi atau tumbuh tanpa batas, seperti daftar komentar yang tidak terbatas.
:::

## @lesson Wide-column dan store berpartisi: skala sejak desain
Cassandra, ScyllaDB, DynamoDB, Bigtable, dan HBase dibangun untuk menyebar data ke **banyak mesin** dan tetap bekerja saat sebagian gagal. Meski bernama "wide-column", cara terbaik memahaminya adalah lewat **primary key**, yang punya dua bagian:

- **Partition key** menentukan *mesin mana* yang menyimpan baris. Semua baris dengan partition key yang sama tinggal bersama.
- **Clustering key** (DynamoDB: sort key) menentukan **urutan baris di dalam** partisi, yang secara fisik terurut.

`WideColumnTable("customer_id", "order_ts")` di lab memodelkan ini: semua pesanan seorang pelanggan membentuk satu partisi, diurutkan menurut waktu, sehingga "10 pesanan terakhir pelanggan 7" atau "pesanan pelanggan 7 pada Januari" adalah pembacaan cepat atas **satu** irisan terurut. Menanyakan "semua pesanan Januari untuk setiap pelanggan" tidak punya jawaban efisien, dan lab menolak query tanpa partition key. Inilah **pemodelan berbasis query**: di database relasional Anda merancang tabel dari data dan menulis query apa pun kemudian; di sini Anda **mendaftar query lebih dulu**, lalu merancang satu tabel per query, mengulang (denormalisasi) data seperlunya. Ini pergeseran mental terbesar.

**Bagaimana partisi ditempatkan.** Cara naifnya `hash(key) % jumlah_node`, tetapi saat Anda menambah satu node hampir semua key berpindah. Saat diukur pada 10.000 key dari 4 ke 5 node, **modulo hashing memindahkan 79,5% key**. **Consistent hashing** menaruh node (dan banyak posisi *virtual* per node) pada sebuah cincin; sebuah key menjadi milik node berikutnya searah jarum jam. Di Python, `zlib.crc32(text.encode())` mengubah string apa pun secara deterministik menjadi integer 32-bit (`0` sampai `2**32 - 1`), dan modul bawaan Python `bisect` (`bisect` atau `bisect_left` pada list terurut berisi tuple `(position, node)`) menemukan posisi pertama `>= target` menggunakan binary search dalam O(log n) (membelah dua sisa list di tiap langkah, sekitar 10 langkah untuk 1.000 entri), lalu memutar kembali ke indeks `0` bila `target` melampaui posisi terbesar. Menambah node hanya mengambil bagiannya: pada 10.000 key tersebut `HashRing` memindahkan **19,9%**, sekitar seperlima, dan setiap key yang pindah menuju node baru (dan `test_lab.py` memverifikasi pada 3.000 key bahwa perpindahan tetap di kisaran 10%–32%). Virtual node penting untuk keseimbangan: dengan satu posisi per node, tiga node memegang 0,2%, 99,4%, dan 0,4% dari 10.000 key; dengan 200 posisi masing-masing mereka memegang 28%, 33%, dan 39%.

### Lihat sendiri: mengapa penempatan modulo adalah jebakan

:::talk Menambah satu server
@teacher Dua belas kunci, bernomor 1 sampai 12, disebar ke 3 server dengan `key % 3`. Lalu lalu lintas bertambah, sehingga Anda menambah server keempat dan aturannya menjadi `key % 4`. Kunci 1 tetap di server 1, kunci 2 tetap di server 2, dan kunci 12 tetap di server 0.
@ask Kira-kira berapa dari 12 kunci itu yang berpindah ke server lain?
@choice Tidak ada, karena server lama mempertahankan kuncinya | Aturannya berubah dari `% 3` menjadi `% 4`, jadi sebagian besar kunci sekarang dipetakan ke tempat lain. Coba lagi.
@choice * Sembilan dari dua belas: hampir setiap kunci berpindah | Betul. Hanya kunci 1, 2, dan 12 yang tetap di servernya. Di klaster sungguhan itu berarti hampir seluruh data harus disalin hanya karena satu server bergabung.
@choice Tiga dari dua belas, seperempatnya, untuk mengisi server baru | Itu yang ideal. Tetapi aturan modulo mengocok kunci di antara server lama juga. Coba lagi.
@teacher Consistent hashing memperbaikinya: ketika sebuah server bergabung, ia hanya mengambil sekitar 1/N kunci, dan yang lain mempertahankan kuncinya.
:::

Enam key di 3 node. Kita menambah node keempat dan melihat ke mana setiap key pergi (indeks mewakili hash key):

:::trace Menambah satu node dengan hash modulo
@code
keys = ["a", "b", "c", "d", "e", "f"]
before = {k: i % 3 for i, k in enumerate(keys)}
after = {k: i % 4 for i, k in enumerate(keys)}
moved = [k for k in keys if before[k] != after[k]]
print(len(moved), "of", len(keys), "keys moved")
@notes
2 | Penempatan dengan 3 node: nomor node adalah `hash % 3`.
3 | Key yang sama dengan 4 node: `hash % 4`. Bandingkan kedua dictionary di kanan.
4 | Hanya key yang nomor node-nya tetap yang tidak pindah. Separuhnya (3 dari 6) pindah di sini; dengan hash sungguhan, ~75% pindah.
5 | Memindahkan sebanyak itu berarti menyalin data sebanyak itu antar mesin. Consistent hashing hanya memindahkan sekitar 1/N di antaranya.
:::

:::ask Cincin consistent-hash punya 4 node dan mendapat node ke-5. Kira-kira berapa bagian key yang pindah?
@options
sekitar 80% key, hampir semuanya
* sekitar 1/5 (20%) key, bagian node baru
tidak ada key sama sekali
@why
Di cincin, setiap key milik node berikutnya searah jarum jam. Node baru hanya mengambil alih key di antara dirinya dan pendahulunya, sekitar 1/N dari total. Lab mengukur modulo hashing memindahkan 79,5% key pada perubahan yang sama.
:::

> 💡 **Jeda Praktik: Menguji Cincin Consistent Hashing**
> 1. Di Text Editor pada `labs/mod-1-7/nosql_lab.py`, buka kelas `HashRing` (Bagian 3).
> 2. Implementasikan `add_node`, `remove_node`, dan `node_for(key)`. Gunakan `zlib.crc32` untuk memetakan nama node dan `vnodes` posisi virtual ke dalam cincin lingkaran terurut, serta `bisect` untuk menemukan node terdekat searah jarum jam.
> 3. Uji cincin consistent hashing Anda di terminal:
> `pytest labs/mod-1-7/test_lab.py -v -k TestHashRing`
> 4. Pastikan ke-6 pengujian lulus (`6 passed`). Perhatikan mengapa penambahan atau penghapusan node hanya memindahkan sekitar seper-N bagian kunci, bukan merombak seluruh klaster.

**Replikasi dan konsistensi yang bisa diatur.** Setiap partisi disalin ke *N* replika (umumnya 3). Sebuah penulisan diakui setelah **W** replika mengonfirmasi; sebuah pembacaan bertanya ke **R** replika dan mengembalikan versi terbaru. Jika **R + W > N**, himpunan baca mana pun beririsan dengan himpunan tulis mana pun, sehingga pembacaan **pasti** melihat tulisan terakhir yang diakui. Dengan N = 3: W=2, R=2 aman ("quorum"); W=1, R=1 cepat tetapi bisa mengembalikan data basi; W=3, R=1 aman untuk pembacaan tetapi penulisan gagal jika satu replika mati. `ReplicaSet` di lab memperlihatkan persis ini, termasuk `Unavailable` ketika terlalu sedikit replika hidup. Anda membayar konsistensi dengan latensi dan ketersediaan, itulah PACELC dalam praktik.

**Penulisan murah** karena desain log-structured: penulisan ditambahkan ke commit log dan tabel memori, lalu di-flush ke file terurut yang tidak bisa diubah (SSTable) yang digabung kemudian (**compaction**). Penghapusan tidak benar-benar menghapus: ia menulis **tombstone**, yang baru dibuang setelah masa aman; banyak tombstone memperlambat pembacaan.

**Apa yang salah:** **hot partition** (satu partition key menerima sebagian besar lalu lintas, seperti tanggal hari ini) membebani satu mesin sementara yang lain tidur; partisi yang tumbuh tanpa batas; dan query yang butuh pemindaian penuh. **DynamoDB** menambah operasi terkelola dan batas keras 400 KB per item, dan Anda membayar menurut kapasitas atau per permintaan.

### Quorum dalam satu baris

:::talk Membaca dari satu server
@teacher Tiga server masing-masing menyimpan salinan data (N = 3). Sebuah penulisan dikonfirmasi begitu W server menyimpannya, dan sebuah pembacaan bertanya ke R server lalu mengambil jawaban terbaru. Saat ini W = 1 dan R = 1. Sebuah penulisan mendarat di server A dan dikonfirmasi. Server B dan C belum menerimanya. Lalu sebuah pembacaan datang dan bertanya ke server B.
@ask Apa yang dikembalikan pembacaan itu?
@choice * Nilai lama: B belum menerima penulisan itu, dan bertanya ke satu server tidak bisa mengungkapkannya | Betul. Dengan W + R = 2, yang tidak lebih besar dari N = 3, sebuah pembacaan bisa mendarat di server yang tidak pernah melihat penulisan itu.
@choice Nilai baru, karena penulisannya sudah dikonfirmasi | "Dikonfirmasi" berarti satu server sudah menyimpannya, bukan ketiganya. B belum tahu. Coba lagi.
@choice Error, karena server-servernya tidak sepakat | Tidak ada yang menyadari ketidaksepakatan kalau hanya satu server yang ditanya. Coba lagi.
@teacher Buat himpunannya saling tumpang tindih: dengan W = 2 dan R = 2 (jadi W + R = 4, lebih dari N = 3), setiap pembacaan bertanya ke setidaknya satu server yang memegang penulisan terbaru.
:::

Dengan `N` replika, penulisan yang diakui oleh `W` di antaranya, dan pembacaan yang bertanya ke `R` di antaranya, pembacaan **dijamin** melihat penulisan terakhir yang diakui ketika himpunan baca dan himpunan tulis harus beririsan: `R + W > N`.

:::ask Dengan N = 3 replika, apakah W = 1 dan R = 1 aman (pembacaan selalu melihat penulisan terakhir yang diakui)?
@options
ya, satu replika sudah cukup untuk quorum
hanya jika jam semua server cukup akurat
* tidak: baca bisa kena replika lama
@why
Penulisan mungkin mencapai replika A; pembacaan mungkin bertanya ke replika B, yang belum mendengarnya. Dengan W = 2 dan R = 2 dua replika mana pun beririsan di setidaknya satu, jadi pembacaan selalu bertemu replika yang memegang penulisan terakhir.
:::

:::drill python Apakah himpunannya beririsan?
Tulis `quorum_ok(n, w, r)` yang mengembalikan `True` ketika pembacaan `r` replika dijamin beririsan dengan penulisan `w` replika di antara `n`, dan `False` kalau tidak.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("quorum_ok") ## Definisikan quorum_ok(n, w, r).
quorum_ok(3, 2, 2) is True ## N=3, W=2, R=2 beririsan: True.
quorum_ok(3, 1, 1) is False ## N=3, W=1, R=1 bisa saling meleset: False.
quorum_ok(5, 3, 3) is True ## N=5, W=3, R=3: True.
quorum_ok(3, 3, 1) is True ## Menulis ke ketiganya berarti satu pembacaan pun melihatnya: True.
quorum_ok(5, 2, 3) is False ## 2 + 3 tidak lebih besar dari 5: False.
@hint
Pikirkan soal irisan: jika penulisan menyentuh `w` replika dari `n` dan pembacaan menghubungi `r` replika dari `n`, kapan kedua himpunan pasti berbagi minimal satu replika? Bandingkan jumlah gabungan keduanya dengan `n`.
@solution
def quorum_ok(n, w, r):
    return r + w > n
:::

> 💡 **Jeda Praktik: Quorum Replication & Wide-Column Table**
> 1. Di Text Editor pada `labs/mod-1-7/nosql_lab.py`, buka Bagian 4 (`quorum_overlaps`, `ReplicaSet`) dan Bagian 5 (`WideColumnTable`).
> 2. Lengkapi fungsi `quorum_overlaps(n, r, w)` dengan rumus `r + w > n`, serta kelas `ReplicaSet` (menyimpan daftar `(version, value)` tiap node di `self.replicas`) yang mensimulasikan penulisan versi dan pembacaan dengan node replika yang sedang down.
> 3. Lengkapi kelas `WideColumnTable`: kelompokkan baris berdasarkan `partition_key`, urutkan berdasarkan `clustering_key`, dukung upsert jika primary key sama, serta tolak query tanpa partition key (`ValueError`).
> 4. Jalankan pengujian untuk replikasi dan wide-column di terminal:
> `pytest labs/mod-1-7/test_lab.py -v -k "TestQuorum or TestWideColumnTable"`
> 5. Pastikan ke-14 pengujian lulus (`14 passed`).

## @part Keluarga lain, dan cara memilih

## @lesson Graf, pencarian, time-series, dan lainnya
Beberapa pola akses bukan satu pun dari yang di atas.

**Database graf** (Neo4j, Amazon Neptune) menyimpan **node** dan **relasi** (edge), keduanya dengan properti, dan menjadikan *menelusuri relasi* sebagai operasi cepat. Di SQL, "teman dari teman dari teman" butuh satu self-join per lompatan dan cepat melambat; database graf berjalan langsung di edge. Pakai bila pertanyaannya tentang koneksi: jaringan fraud (akun yang berbagi perangkat dan alamat), rekomendasi, analisis jaringan dan dependensi, data lineage. Bahasa query Neo4j adalah Cypher, misalnya `MATCH (a:Account)-[:USES]->(d:Device)<-[:USES]-(b:Account) RETURN a, b`. Ia bukan pilihan pertama untuk pelaporan tabular.

**Mesin pencari** (Elasticsearch, OpenSearch) membangun **inverted index** (kata ke daftar dokumen) sehingga bisa mencocokkan teks, meranking hasil menurut relevansi, dan memfilter dengan cepat. Mereka untuk kotak pencarian dan penjelajahan log, bukan sistem pencatat utama.

**Database time-series** (TimescaleDB, InfluxDB) disetel untuk data yang banyak ditambah dan diindeks menurut waktu (metrik, pembacaan sensor), dengan retensi dan downsampling otomatis. **Database vektor** menyimpan embedding untuk pencarian kemiripan (Modul 3.5). Banyak dari ini adalah fitur sistem lain: PostgreSQL melakukan time series dengan ekstensi dan pencarian vektor dengan pgvector.

:::talk Mencari kata
@teacher KopiKu punya 10 juta ulasan produk. Seorang pembelajar mencari kata "dark" dengan `WHERE review LIKE '%dark%'`. Seorang rekan berkata mesin pencari akan jauh lebih cepat.
@ask Mengapa mesin pencari lebih cepat untuk ini?
@choice Ia punya server yang lebih besar | Kecepatannya berasal dari cara data diatur, bukan dari ukuran. Coba lagi.
@choice * Ia membangun inverted index lebih dulu: untuk setiap kata, daftar ulasan yang memuatnya, sehingga "dark" dicari di indeks, bukan dipindai | Betul. `LIKE '%dark%'` harus membaca setiap ulasan setiap kali. Inverted index menemukan ulasan yang cocok langsung, dan bisa memeringkatnya juga.
@choice Ia menyimpan ulasan dalam graf | Graf menyimpan hubungan. Triknya di sini adalah indeks dari kata ke dokumen. Coba lagi.
@teacher Setiap keluarga database ada karena satu pola akses membutuhkan tata letak data yang berbeda. Cocokkan tata letak dengan pertanyaannya.
:::

Pelajaran untuk disimpan: sebuah keluarga database adalah kumpulan **optimasi untuk sebuah pola akses**. Jika Anda tahu polanya, keluarganya biasanya mengikuti; jika Anda belum tahu polanya, mulailah dengan database relasional dan pelajari polanya dulu.

> 🛠 **Coba sendiri (12 menit, Python).**
> 1. Bangun **inverted index** untuk enam nama produk KopiKu (`Gayo Medium 250g`, `Toraja Dark 250g`, `Kintamani Light 250g`, `Flores Medium 250g`, `Mandheling Dark 250g`, `Java Preanger Light 250g`): sebuah dict dari setiap kata huruf kecil ke himpunan posisi nama-nama yang memuatnya. Cari `dark`, lalu `dark` dan `250g` bersama-sama.
> 2. Bangun dict pertemanan (`budi: siti, agus`; `siti: budi, dewi`; `agus: budi`; `dewi: siti, rina`; `rina: dewi`) dan tulis **breadth-first search**, simpan antrean jalur mulai dari `[["budi"]]` dan set `visited`, ambil dari depan, lalu masukkan tiap tetangga yang belum dikunjungi lapis demi lapis sampai mencapai `"rina"`, untuk mengembalikan jalur terpendek dari `budi` ke `rina`.
>
> **Seharusnya Anda melihat:** `dark` menghasilkan posisi `[1, 4]` (Toraja Dark dan Mandheling Dark), `dark` dan `250g` bersama-sama menghasilkan dua yang sama, dan jalur `['budi', 'siti', 'dewi', 'rina']`. Dalam sekitar 15 baris, Anda sudah membangun inti sebuah mesin pencari dan penelusuran graf.

:::ask Pertanyaan mana yang cocok untuk database graf?
@options
* teman dari teman: lompatan demi lompatan
total penjualan tiap bulan selama setahun terakhir
teks persis dari satu halaman web yang tersimpan
@why
Database graf menjadikan penelusuran relasi sebagai operasi yang cepat. Di SQL setiap lompatan tambahan butuh self-join lagi dan cepat melambat. Total bulanan adalah kerja analitik, dan halaman tersimpan adalah dokumen.
:::

## @lesson Memilih, dan apa yang dilakukan data engineer dengannya
Panduan keputusan singkat, didorong oleh cara data dibaca:

| Pola akses utama | Biasanya |
|---|---|
| Banyak pertanyaan berbeda, join, kebenaran ketat | relasional (PostgreSQL, MySQL) |
| Mencari satu hal lewat id, cepat; cache; sesi; penghitung | key-value (Redis, DynamoDB) |
| Membaca dan menulis objek bersarang utuh; bentuknya bervariasi | dokumen (MongoDB) |
| Volume tulis sangat besar, query diketahui lewat key dan waktu, selalu menyala | wide-column (Cassandra, DynamoDB, Bigtable) |
| Pertanyaannya tentang relasi dan jalur | graf (Neo4j) |
| Teks bebas dan relevansi | mesin pencari (Elasticsearch) |
| Metrik sepanjang waktu | time-series |
| Analitik atas riwayat yang sangat besar | **bukan ini**: warehouse atau lakehouse (Modul 2.2 dan 2.6) |

Perusahaan memakai beberapa sekaligus (**polyglot persistence**): PostgreSQL untuk pesanan, Redis untuk sesi, Elasticsearch untuk pencarian, Cassandra untuk event. Itu melipatgandakan tempat data berada, dan itulah mengapa data engineer ada.

**Tugas Anda di sekitarnya.**

1. **Jangan pernah menjalankan analitik di operational store.** Pemindaian atas MongoDB atau Cassandra produksi bersaing dengan pelanggan dan sering gagal karena timeout. Salin data ke analytical store.
2. **Ekstrak secara inkremental.** Pakai change feed sistemnya: change stream MongoDB, DynamoDB Streams, CDC Cassandra, atau konektor Debezium (Modul 3.2). Gunakan ekspor penuh ke object storage untuk data kecil atau yang jarang berubah.
3. **Ratakan dan beri tipe.** Ubah dokumen menjadi tabel seperti pelajaran 3, putuskan cara menangani field yang hilang dan **field polimorfik** (field yang tipenya berubah-ubah antar baris, misalnya berupa string di satu dokumen dan list di dokumen lain), serta catat skema yang Anda asumsikan.
4. **Perhatikan konsistensi.** Membaca dari replika bisa mengembalikan data lama, dan snapshot yang diambil saat penulisan berlanjut bisa tidak konsisten antar partisi. Catat kapan dan dari mana Anda membaca.
5. **Hormati pola akses.** Jika Anda harus mengkueri atribut yang tidak diindeks store, minta tim aplikasi menambah index atau tabel turunan, daripada memindai.

Kini Anda bisa menjawab pertanyaan yang lazim: "Mengapa tidak MongoDB untuk semuanya?" (tanpa join, schema drift, analitik terbatas). "Apa itu partition key?" (menentukan penempatan dan satuan penskalaan). "Apa arti R + W > N?" (pembacaan beririsan dengan penulisan, jadi melihat tulisan terbaru, dengan harga latensi dan ketersediaan). "Mengapa consistent hashing?" (menambah atau membuang node memindahkan sebagian kecil key, bukan hampir semuanya).

> 💡 **Jeda Praktik: Verifikasi Akhir Seluruh Pola Database NoSQL**
> 1. Setelah semua lima komponen di `labs/mod-1-7/nosql_lab.py` selesai diimplementasikan, jalankan seluruh rangkaian pengujian dari terminal:
> `pytest labs/mod-1-7/test_lab.py -v`
> 2. Pastikan ke-36 pengujian lulus sempurna tanpa kesalahan (`36 passed`).
> 3. Hasilkan kode bukti resmi untuk disalin ke portal pembelajaran dengan menjalankan perintah:
> `python3 scripts/prove.py mod-1-7`

:::drill python Ratakan dokumen pesanan bersarang menjadi baris tabel
Untuk memuat dokumen JSON bersarang ke tabel warehouse, Anda meratakan objek bersarang menjadi kolom dan memecah array menjadi satu baris per item. Tulis `flatten_order(doc)`: `doc` adalah dictionary dengan `"_id"`, dictionary `"customer"` opsional (yang mungkin memuat `"city"`), dan list `"items"` berisi dictionary `{"sku": ..., "qty": ...}`. Kembalikan list berisi dictionary datar `{"order_id": ..., "customer_city": ..., "sku": ..., "qty": ...}`, satu per item. Jika `"customer"` atau `"city"` tidak ada, gunakan `"unknown"` untuk `customer_city`.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("flatten_order") ## Definisikan flatten_order(doc).
flatten_order({"_id": "1001", "customer": {"city": "Jakarta"}, "items": [{"sku": "KS-1", "qty": 2}, {"sku": "ES-9", "qty": 1}]}) == [{"order_id": "1001", "customer_city": "Jakarta", "sku": "KS-1", "qty": 2}, {"order_id": "1001", "customer_city": "Jakarta", "sku": "ES-9", "qty": 1}] ## Satu baris datar per item, membawa order_id dan customer_city.
flatten_order({"_id": "1002", "items": [{"sku": "BL-3", "qty": 4}]}) == [{"order_id": "1002", "customer_city": "unknown", "sku": "BL-3", "qty": 4}] ## Objek customer yang hilang memakai "unknown" untuk customer_city.
flatten_order({"_id": "1003", "customer": {"name": "Budi"}, "items": [{"sku": "KS-1", "qty": 1}]}) == [{"order_id": "1003", "customer_city": "unknown", "sku": "KS-1", "qty": 1}] ## Field city yang hilang di dalam customer juga memakai "unknown".
flatten_order({"_id": "1004", "customer": {"city": "Bandung"}, "items": []}) == [] ## Daftar items kosong mengembalikan list baris kosong.
@hint
Baca `customer_city` secara aman dengan `.get(...)` sehingga `"customer"` atau `"city"` yang hilang bernilai `"unknown"`. Lalu ulangi setiap elemen di `doc.get("items", [])` dan tambahkan satu dictionary datar per item berisi `order_id`, `customer_city`, `sku`, dan `qty`.
@solution
def flatten_order(doc):
    city = doc.get("customer", {}).get("city", "unknown")
    rows = []
    for item in doc.get("items", []):
        rows.append({
            "order_id": doc["_id"],
            "customer_city": city,
            "sku": item["sku"],
            "qty": item["qty"],
        })
    return rows
:::

:::ask Analis ingin menjalankan laporan besar pada MongoDB produksi yang melayani aplikasi. Apa yang sebaiknya dilakukan data engineer?
@options
membiarkan mereka menjalankan laporan langsung pada malam hari
* menyalin data ke penyimpanan analitik, memakai change feed
memberi mereka password root agar cepat
@why
Pemindaian atas penyimpanan operasional produksi bersaing dengan pelanggan dan sering kena timeout. Ekstrak secara inkremental dari change feed sistem dan biarkan analis menanyai salinannya.
:::

## @lab Lab: lima gagasan database dalam Python murni
Bangun lima model kecil yang deterministik: **key-value store** dengan TTL dan eviction LRU, **document store** dengan query dan index, **cincin consistent hashing**, **replikasi quorum**, dan **tabel wide-column**. Tesnya (36) memeriksa setiap perilaku yang dijelaskan pelajaran: index yang memangkas `last_scanned` dari seluruh 4 dokumen fixture menjadi 1 (mekanisme yang sama yang berskala dari 10.000 dokumen menjadi ~10), consistent hashing atas 3.000 key di mana menambah node ke-5 memindahkan 10%–32% key (dibanding ~79,5% untuk modulo hashing pada 10.000 key), dan aturan quorum.

### @steps
> **Sudah menyelesaikan Jeda Praktik di Pelajaran 2–6?** File `labs/mod-1-7/nosql_lab.py` Anda sudah selesai diimplementasikan! Anda bisa langsung melompat ke latihan refleksi pada langkah 3–6 dan menjalankan `python3 scripts/prove.py mod-1-7` di langkah 7.

1. Aktifkan virtual environment Anda (Modul 0.1), pasang requirements lab (`pip install -r labs/mod-1-7/requirements.txt`), lalu baca `labs/mod-1-7/nosql_lab.py` dari atas ke bawah. Docstring tiap class adalah spesifikasinya, beserta pelajaran yang menjelaskannya.
2. Kerjakan sesuai urutan file dan jalankan tes setelah SETIAP class:

```bash
pytest labs/mod-1-7/test_lab.py -v
pytest labs/mod-1-7/test_lab.py -v -k TestKeyValueStore       # satu kelompok pada satu waktu
```

3. **Key-value dulu.** Sebelum menjalankan, tebak apa yang dikembalikan `keys()` setelah `set a, set b, get a, set c` dengan `max_items=2`. Lalu tulis class-nya dan periksa.
4. **Dokumen.** Bangun `insert` dan `find` biasa; lalu operator; lalu index. Cetak `last_scanned` sebelum dan sesudah `create_index` dan catat selisihnya.
5. **Cincin dan quorum.** Setelah `HashRing` lulus, ukur sendiri berapa dari 10.000 key yang pindah dengan `zlib.crc32(key.encode()) % n` ketika n naik dari 4 ke 5, dan bandingkan dengan cincin Anda. Untuk `ReplicaSet`, isi tabel pasangan (R, W) untuk N = 3 dan tandai mana yang bisa mengembalikan data basi; periksa dengan kode Anda.
6. **Wide-column.** Tebak apa yang dilakukan `query` dengan partition key yang hilang dan mengapa sistem sungguhan menolaknya.
7. **Kerjakan yang sesungguhnya.** Tulis kodenya lagi di virtual environment Anda sendiri **tanpa menyalin**, lalu jalankan `python3 scripts/prove.py mod-1-7` untuk mendapat kode bukti bagi kotak **Bukti** di halaman lab ini.

### @files
- labs/mod-1-7/nosql_lab.py :: File kerja Anda: implementasikan lima class TODO dan satu fungsi TODO :: starter
- labs/mod-1-7/test_lab.py :: Ke-36 tes yang memeriksa pekerjaan Anda :: test
- labs/mod-1-7/requirements.txt :: pytest :: config
- labs/mod-1-7/reference/nosql_lab.py :: Satu solusi yang mungkin (coba sendiri dulu!) :: reference

### @deliverables
- Semua 36 tes lulus **di komputer Anda sendiri, dijalankan dari terminal Anda sendiri**
- Anda bisa menjelaskan mengapa `R + W > N` menjamin pembacaan melihat tulisan terbaru, dan menyebut satu pasangan (R, W) untuk N = 3 yang bisa mengembalikan data basi
- Anda bisa menjelaskan mengapa consistent hashing memindahkan jauh lebih sedikit key daripada modulo hashing, memakai angka 19,9% dan 79,5%
- Anda bisa menyebut keluarga mana yang Anda pilih untuk sesi, untuk katalog pesanan dengan atribut bervariasi, dan untuk laju tulis sangat tinggi pembacaan sensor, beserta alasannya

### @verify
```bash
pytest labs/mod-1-7/test_lab.py -v
python3 scripts/prove.py mod-1-7
```

Jalankan yang diketahui benar: awali perintah pertama dengan `LAB_DIR=reference`.

## @chaos Partition key yang berupa tanggal
### @scenario
Sebuah tim memindahkan log event dari PostgreSQL ke store wide-column "agar skalanya besar". Tabelnya dirancang sebagai `PRIMARY KEY (event_date, event_id)`: partition key-nya tanggal, event satu hari diurutkan menurut id. Dalam tes, dengan beberapa ribu baris, semuanya cepat. Query-nya persis yang dibutuhkan produk: "semua event pada hari tertentu".

Di produksi, pada hari dengan 20 juta event, masalah dimulai tengah malam. Setiap penulisan hari berjalan masuk ke **satu partisi**, yang tinggal di tiga mesin dari klaster tiga puluh. Ketiga mesin itu mencapai CPU 100%, latensi tulis naik dari milidetik menjadi detik, penulisan mulai timeout dan dicoba ulang, dan percobaan ulang memperburuknya. Dua puluh tujuh mesin lain nyaris menganggur. Menambah mesin tidak mengubah apa-apa. Keesokan paginya, dengan hari yang sudah selesai, partisi lama itu tenang sempurna dan hari baru mengulang masalahnya.

### @cause
Partition key menentukan di mana data tinggal, dan **tanggal adalah key berkardinalitas rendah yang tumbuh sepanjang hari di tempat yang sama**: pada saat mana pun, semua penulisan berbagi satu nilai. Kapasitas klaster hanya jumlah mesinnya jika beban tersebar; dengan satu hot partition kapasitasnya adalah milik tiga mesin. Lab menunjukkan efek yang sama dalam skala kecil: dengan satu posisi virtual per node, cincin menaruh 99,4% key di satu node; dan `WideColumnTable` yang dipartisi menurut konstanta menaruh semua barisnya dalam satu partisi, berapa pun jumlah node.

Query "semua event suatu hari" tampak seperti pola akses, tetapi itu pola **baca**. Pola **tulis** (apa yang ditulis pada saat yang sama) sama pentingnya saat memilih partition key.

### @fix
1. Ganti partition key menjadi sesuatu dengan **kardinalitas tinggi yang menyebar penulisan**: misalnya `(event_date, bucket)` dengan `bucket = hash(event_id) % 64`, atau `(customer_id, event_date)`. Membaca satu hari penuh lalu berarti mengkueri 64 bucket secara paralel dan menggabungkan, pertukaran yang disengaja.
2. Jaga **ukuran partisi tetap terbatas** (partisi tidak boleh tumbuh tanpa batas): masukkan bucket waktu seperti jam ke dalam key.
3. **Uji dengan ketimpangan data (skew) yang realistis**, bukan beberapa ribu baris yang merata: uji beban dengan laju puncak sebenarnya dan lihat beban per partisi dan per node, bukan rata-rata klaster.
4. **Pantau metrik per partisi** (partisi terpanas, permintaan yang di-throttle), bukan hanya CPU rata-rata. DynamoDB dan Cassandra sama-sama menyediakannya.
5. Untuk analitik ("semua event satu hari untuk setiap pelanggan"), jangan pakai tabel ini: alirkan event ke lakehouse (Modul 2.2) dan kueri di sana.

### @pattern
Rancang partition key untuk pola tulis sekaligus pola baca. Kapasitas store terdistribusi hanya sebesar penyebaran bebannya.

## @quiz
### Pada key-value store, apa yang dilakukan TTL?
- [ ] Ia membatasi berapa banyak key yang boleh dimuat store, dan membuang key tertua saat batas tercapai
- [x] Ia membuat key kedaluwarsa otomatis setelah sejumlah detik, sehingga sesi dan cache membersihkan diri
- [ ] Ia menentukan jumlah replika yang harus mengonfirmasi penulisan, agar store tetap bisa konsisten
- [ ] Ia mengurutkan key menurut waktu perubahan terakhir, sehingga query rentang menurut waktu jadi mungkin

> TTL adalah masa kedaluwarsa (time to live). Batas ukuran dengan eviction LRU adalah fitur lain, dan jumlah replika adalah pengaturan replikasi.

### Mengapa index membuat query dokumen jauh lebih cepat?
- [ ] Ia menyalin seluruh collection ke memori agar setiap query bisa berjalan tanpa menyentuh disk sama sekali
- [ ] Ia membuang dokumen duplikat dari collection agar lebih sedikit dokumen yang perlu dibandingkan
- [x] Ia membiarkan database langsung melompat ke dokumen yang cocok, bukan memindai semuanya satu per satu
- [ ] Ia mengubah setiap dokumen menjadi baris tabel, sehingga database bisa memakai join SQL biasa

> Index memungkinkan database hanya membuka entri yang cocok: pada 10.000 dokumen itu memangkas pemindaian dari 10.000 menjadi segelintir kecocokan (dan `TestDocumentStore` memverifikasi lompatan yang sama persis dari 4 dokumen yang dipindai menjadi 1).

### Apa yang dikatakan teorema CAP tentang partisi jaringan?
- [ ] Sistem hanya bisa terpartisi bila memakai database relasional dengan transaksi yang ketat
- [ ] Partisi membuat konsistensi dan ketersediaan sama-sama mustahil, jadi sistem harus dihentikan
- [x] Saat partisi, sistem memilih konsistensi (menolak permintaan) atau ketersediaan (jawaban basi)
- [ ] Sistem selalu bisa menjaga konsistensi dan ketersediaan sekaligus jika menambah replika setiap item

> Partisi tidak bisa dikesampingkan pada sistem terdistribusi, jadi pilihan sesungguhnya adalah C atau A selama partisi. PACELC menambahkan latensi versus konsistensi saat tidak ada partisi.

### Dengan N = 3 replika, pengaturan mana yang menjamin pembacaan melihat tulisan terakhir yang diakui?
- [ ] W = 1 dan R = 1, karena satu replika yang menerima tulisan juga yang melayani pembacaan
- [x] W = 2 dan R = 2, karena R + W lebih besar dari N, jadi setiap himpunan baca beririsan dengan himpunan tulis
- [ ] W = 1 dan R = 2, karena membaca dari lebih banyak replika daripada yang ditulis selalu menemukan nilai terbaru
- [ ] Pengaturan apa pun, asalkan replika berada di pusat data berbeda dan punya jaringan cepat

> Aturannya R + W > N. Dengan W = 1 dan R = 2, himpunan 1 dan 2 dari 3 replika tidak harus beririsan, dan ReplicaSet di lab memperlihatkan pembacaan basi.

### Mengapa consistent hashing lebih disukai daripada `hash(key) % jumlah_node` saat ukuran klaster berubah?
- [ ] Ia membuat fungsi hash sendiri lebih cepat dihitung, sehingga setiap pencarian key lebih murah
- [ ] Ia menjamin setiap node memegang jumlah key yang persis sama, setimpang apa pun datanya
- [x] Menambah atau membuang node hanya memindahkan sebagian kecil key, bukan hampir semuanya
- [ ] Ia menghapus kebutuhan replikasi, karena setiap key otomatis tersimpan di setiap node

> Pengukuran pada 10.000 key saat naik dari 4 ke 5 node memindahkan 79,5% dengan modulo hashing dan 19,9% dengan cincin (dan `TestHashRing` memeriksa pada 3.000 key bahwa perpindahan tetap di kisaran 10%–32%). Virtual node menjaga keseimbangan.

### Apa arti "pemodelan berbasis query" untuk database wide-column seperti Cassandra?
- [ ] Anda menulis query aplikasi hanya setelah tabel ada, karena database akan menyesuaikan diri dengannya
- [x] Anda mendaftar query lebih dulu dan merancang satu tabel untuk tiap query, mengulang data seperlunya
- [ ] Anda menormalisasi semua data ke bentuk normal ketiga agar query apa pun bisa dijawab dengan join
- [ ] Anda membiarkan database memilih partition key dengan menganalisis query pertama setelah peluncuran

> Store ini menjawab query lewat partition key secara efisien dan tidak bisa join, jadi tabel dibentuk oleh query-nya dan data diduplikasi dengan sengaja.

### Sebuah tabel dipartisi menurut tanggal event, dan hari ini menerima semua penulisan. Apa masalah yang paling mungkin?
- [ ] Klaster kehabisan ruang disk di setiap mesin pada saat yang sama karena format tanggal
- [ ] Query menurut tanggal gagal, karena tanggal tidak bisa menjadi partition key di database semacam itu
- [x] Hot partition: mesin satu partisi kelebihan beban sementara sisa klaster nyaris menganggur
- [ ] Replika tidak sepakat soal tanggal, sehingga pembacaan mengembalikan data hari yang salah ke aplikasi

> Partition key menentukan penempatan, dan tanggal memusatkan semua penulisan terkini di satu tempat. Tambahkan bucket atau pakai key berkardinalitas tinggi.

### Mengapa analitik tidak boleh dijalankan langsung di operational NoSQL store, dan apa yang dilakukan sebagai gantinya?
- [ ] Store NoSQL tidak bisa dibaca lebih dari satu klien sekaligus, jadi datanya diekspor setahun sekali
- [ ] Analitik membutuhkan data terenkripsi penuh, yang tidak pernah diizinkan pada operational store
- [x] Pemindaian besar bersaing dengan pelanggan dan sering timeout, sehingga data disalin ke warehouse
- [ ] Operational store menghapus datanya setiap hari, sehingga analis harus menyalinnya sebelum hilang

> Operational store melayani satu pola akses. Ekstrak secara inkremental dengan change stream atau CDC, ratakan dokumennya, dan kueri salinannya.

## @resources
- [Dokumentasi Redis: tipe data](https://redis.io/docs/latest/develop/data-types/)
- [Manual MongoDB](https://www.mongodb.com/docs/manual/)
- [Dokumentasi Apache Cassandra](https://cassandra.apache.org/doc/latest/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [Neo4j: manual Cypher](https://neo4j.com/docs/cypher-manual/current/)
- [Dynamo: Amazon's Highly Available Key-value Store (makalah)](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html)
