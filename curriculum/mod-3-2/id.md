---
title: Event Streaming dan Change Data Capture (CDC)
duration: 3 minggu
summary: Pahami abstraksi commit log Kafka, partisi, offset, dan consumer groups, jaminan delivery guarantees yang menyertainya, serta bagaimana perubahan data di PostgreSQL ditransformasikan menjadi event stream yang andal melalui write-ahead log (WAL) menggunakan kode yang dapat diuji pada setiap tingkatan.
why: Banyak tutorial pemula hanya mengirim pesan teks acak ke Kafka lalu menampilkannya dengan print(). Di sistem produksi nyata, Anda wajib menangani duplikasi pesan pasca-crash, lonjakan consumer lag, pesan beracun (poison messages), serta replication slot database yang dapat memenuhi kapasitas disk server produksi saat connector terhenti.
---

## @outcomes
- Menjelaskan abstraksi log (topics, partitions, offsets, retention, log compaction) serta bagaimana penentuan key menghasilkan pengurutan data deterministik dan skalabilitas paralel
- Memahami trade-off jaminan pengiriman pesan producer dan consumer (at-most-once, at-least-once, exactly-once effect) dan merancang consumer yang idempoten
- Menjelaskan leader, follower, dan in-sync replica, apa yang dijamin `acks=all` bersama `min.insync.replicas`, dan seperti apa kegagalan broker
- Menguraikan arsitektur consumer groups, algoritma assignment partisi, rebalancing, dan metrik consumer lag, serta memantaunya secara real-time
- Menjelaskan mekanisme kerja log-based CDC dalam membaca PostgreSQL WAL (publications, replication slots, replica identity) serta anatomi payload event Debezium
- Mengonsumsi event CDC ke dalam tabel replika yang tetap konsisten terhadap duplikasi dan perubahan urutan pesan, serta memitigasi risiko operasionalnya
- Mengubah skema dengan aman memakai schema registry (mode kompatibilitas, default, urutan upgrade) dan membaca wire format registry

## @prereq
Modul 1.2 (idempotensi), Modul 2.2 (open table formats), dan Modul 2.4 (orkestrasi). Bagian A dari lab praktikum tidak membutuhkan instalasi eksternal apa pun. Bagian B membutuhkan Kafka-compatible broker (`docker compose up -d redpanda`, atau Kafka standar). Bagian C membutuhkan PostgreSQL dengan logical decoding (embedded PostgreSQL otomatis diinstal via `pip`). Di Python 3.14 `pip` melewati `pgserver` (belum ada build untuk 3.14), jadi jalankan PostgreSQL di Docker: `docker run -d --name kopiku-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg16 -c wal_level=logical`, lalu `docker exec kopiku-pg psql -U postgres -c "CREATE DATABASE lab32"` dan `export DATABASE_URL=postgresql://postgres:dev@localhost:5432/lab32`. Satu container itu melayani Modul 1.3, 3.2, dan 3.5 (ada pgvector dan logical decoding); diukur di Python 3.14, referensinya lulus 23 tes Bagian A dan C dengan cara ini.

## @part Dasar Kafka

## @lesson The log: mengapa sistem streaming ada
Sampai tahap ini, data dalam kurikulum dipindahkan secara **batch**: sebuah batch job terjadwal menyalin rekaman transaksi kemarin malam. Namun kebutuhan bisnis modern sering kali menuntut latensi yang jauh berbeda: deteksi penipuan finansial dalam hitungan milidetik, dashboard operasional toko yang memperbarui angka saat pesanan tiba, indeks pencarian Elasticsearch yang mengikuti perubahan database produk seketika, serta puluhan tim analitik berbeda yang ingin membaca aliran data transaksi tanpa membebani database operasional. Untuk kebutuhan inilah sistem bertukar data dalam bentuk aliran **events** secara kontinu.

Pondasi utama dari Apache Kafka (dan Redpanda, yang mengimplementasikan protokol Kafka murni menggunakan C++) berpusat pada struktur data yang sangat sederhana namun revolusioner: **The Log**, yaitu **urutan rekaman data yang bersifat append-only, terurut (ordered), dan persisten (durable)**. Producer menambahkan rekaman baru hanya di ujung akhir log; consumer membaca dari posisi mana pun yang diinginkan dan mengingat posisinya sendiri. Rekaman data **tidak dihapus saat dibaca**; rekaman tersebut tetap tersimpan aman di disk hingga batas aturan retensi (retention policy) membersihkannya.

Karakteristik ini sangat berbeda dengan antrean pesan tradisional (Message Queue seperti RabbitMQ), di mana pesan akan langsung lenyap setelah dikonsumsi:

| Karakteristik | Message Queue Tradisional | Commit Log (Apache Kafka) |
|---|---|---|
| Pasca-Pembacaan | Pesan langsung dihapus dari antrean | Rekaman data tetap tersimpan; setiap pembaca melacak posisinya sendiri |
| Banyak Consumer | Saling berebut (competing consumers) atas satu pesan | Setiap consumer group membaca keseluruhan aliran data secara independen |
| Replay (Putar Ulang) | Tidak dimungkinkan | Bebas memutar ulang (rewind) ke offset masa lalu: memproses ulang riwayat data, recovery dari bug |
| Jaminan Urutan | Sering kali lemah saat paralelisme naik | Dijamin terurut secara ketat di dalam partisi yang sama |

Kemampuan **replayability (dapat diputar ulang)** inilah yang menjadikan Kafka sebagai tulang punggung platform data modern: consumer baru dapat mulai membaca data dari titik awal sejarah; bug logika pada consumer diperbaiki dengan cara memutar mundur offset dan membaca ulang event masa lalu; serta sistem producer dan consumer **terisolasi secara independen (decoupled)** baik dari segi waktu maupun kecepatan pemrosesan.

Penerapan umum bagi data engineer: **Change Data Capture (CDC)** (mengalirkan mutasi database sebagai event stream), analitik clickstream aplikasi, buffer pelindung lonjakan beban antar sistem, serta memberi makan engine stream processing (Modul 3.3) dan tabel lakehouse streaming (Modul 2.2).

> 🛠 **Coba sendiri (10 menit, Python).** Bangun sebuah log dalam 10 baris: list `log`, `append(x)` yang menambah di akhir dan mengembalikan offset-nya, dan `read(offset, n=100)` yang mengembalikan potongan tanpa menghapus apa pun. Tambahkan `order-1` sampai `order-5`. Pembaca A membaca semuanya; pembaca B hanya membaca dua yang pertama dan mengingat offset-nya. Tambahkan `order-6` sampai `order-8`, lalu biarkan setiap pembaca melanjutkan dari offset-nya sendiri. Terakhir, putar ulang dari offset 0.
>
> **Seharusnya Anda melihat:** A sudah membaca 5 dan berikutnya melanjutkan dengan `order-6`, `order-7`, `order-8`; B melanjutkan dari offset 2 dengan `order-3` sampai `order-8`; pemutaran ulang dari 0 mengembalikan seluruh delapan record (`order-1` sampai `order-8`) dari awal log. Membaca tidak menghapus apa pun, dan setiap pembaca memegang posisinya sendiri, persis hal yang tidak bisa dilakukan sebuah antrean.

:::trace Satu log dengan dua pembaca
@code
log = []
for event in ["a", "b", "c"]:
    log.append(event)
offsets = {"billing": 0, "search": 0}
offsets["billing"] = 2
offsets["search"] = 3
print(log[offsets["billing"]:])
@notes
3 | Produser **menambahkan** di akhir; tidak ada yang disisipkan atau diubah di tengah. Posisi dalam log adalah **offset**: a bernilai 0, b 1, c 2.
5 | `billing` sudah membaca dua rekaman (offset 0 dan 1) dan berada di 2. Tiap pembaca menyimpan penanda sendiri; membaca tidak menghapus apa pun.
6 | `search` sudah sepenuhnya mengejar di 3. Log yang sama melayani keduanya, hal yang tidak bisa dilakukan antrean klasik.
7 | `billing` masih punya rekaman pada offset 2 untuk dibaca. Jika ia crash lalu restart, ia melanjutkan dari offset tersimpan.
:::

:::ask Apa beda topic Kafka dengan antrean pesan klasik?
@options
* rekaman tetap di log untuk konsumen lain
rekaman dihapus begitu satu konsumen membacanya
rekaman bisa diedit langsung setelah ditulis
@why
Log bersifat append-only dan tahan lama; tiap consumer group melacak offsetnya sendiri. Ini memungkinkan tim baru membaca seluruh riwayat, dan konsumen memutar ulang setelah bug diperbaiki.
:::

## @lesson Blok pembangun Kafka: topics, partitions, offsets, dan replication
- **Topic** adalah nama logis dari sebuah aliran data, misalnya `orders`.
- Sebuah topic dipecah menjadi beberapa **partitions**. Setiap partisi adalah log fisik tersendiri yang terurut dan independen. **Partisi adalah unit fundamental untuk paralelisme sekaligus unit penjamin keterurutan (ordering).**
- Setiap rekaman data di dalam suatu partisi memiliki **offset**, yaitu nomor urut monotonik yang dimulai dari 0. Identitas unik sebuah rekaman diidentifikasi secara presisi oleh kombinasi (topic, partition, offset).
- **Producer** menentukan ke partisi mana sebuah pesan akan dikirim. Jika pesan menyertakan **key**, nilai hash dari key tersebut menentukan nomor partisi target, sehingga **seluruh pesan yang memiliki key yang sama dijamin mendarat di partisi yang sama, dalam urutan waktu yang sama**. Jika pesan dikirim tanpa key, pesan akan disebarkan secara merata melintasi seluruh partisi. (Fungsi hashing bergantung pada client: Java client menggunakan *murmur2*, sedangkan client berbasis librdkafka seperti pustaka Python menggunakan CRC32; gunakan keluarga client yang konsisten atau tentukan fungsi partisi secara eksplisit).
- **Brokers** adalah server-server yang menyimpan partisi data di disk. Setiap partisi **direplikasi**: satu broker bertindak sebagai **Leader** (menangani seluruh request baca dan tulis) dan broker lainnya bertindak sebagai **Followers** (follower yang selalu menyusul leader dicatat sebagai *in-sync replicas*, dibahas rinci di Pelajaran 3). Topic produksi standar biasanya menggunakan replication factor bernilai 3.

:::talk Satu pelanggan, tiga kejadian
@teacher Pesanan pelanggan 7 menghasilkan tiga kejadian: `paid`, `shipped`, `delivered`. Topic punya 3 partisi. Producer mengirim kejadian tanpa key, sehingga Kafka menyebarkannya ke partisi-partisi.
@ask Apa yang bisa dilihat consumer?
@choice * Kejadian bisa tiba tidak berurutan: "delivered" bisa terbaca sebelum "paid", karena urutan hanya terjaga di dalam satu partisi | Betul. Kafka menjamin urutan hanya di dalam satu partisi. Tanpa key, kejadian satu pelanggan mendarat di partisi berbeda dan tidak ada yang mengikatnya.
@choice Selalu `paid`, `shipped`, `delivered`, karena Kafka menjaga urutan seluruh topic | Kafka mengurutkan pesan per partisi, bukan lintas topic. Coba lagi.
@choice Hanya kejadian terakhir, karena Kafka hanya menyimpan pesan terbaru | Kafka menyimpan setiap pesan sampai retensi menghapusnya. Coba lagi.
@teacher Pakai id pelanggan sebagai key pesan: key yang sama selalu masuk ke partisi yang sama, sehingga kejadian tiap pelanggan tetap berurutan.
:::

Jaminan urutan adalah konsep yang paling sering disalahpahami. Kafka menjamin keterurutan data **hanya di dalam partisi yang sama (within a partition)**. Jika seluruh event transaksi milik pelanggan nomor 7 harus diproses secara berurutan, berikan key berupa `customer_id` agar seluruh event pelanggan tersebut selalu dialirkan ke satu partisi yang sama; event milik pelanggan yang berbeda dapat bercampur tanpa masalah. Pilihlah key yang selaras dengan kebutuhan urutan bisnis dan mendistribusikan volume secara merata (hot key akan menghasilkan partisi yang timpang: masalah data skew yang kita pelajari di Modul 3.1).

**Berapa jumlah partisi yang ideal?** Jumlah partisi menentukan batas throughput maksimum dan batas paralelisme dari sebuah consumer group, di dalam satu group, setiap partisi hanya dibaca oleh paling banyak satu consumer pada satu waktu, sehingga consumer berlebih akan menganggur (Pelajaran 4 menjelaskan cara kerja assignment dan rebalancing). Partisi yang terlalu sedikit membatasi skalabilitas; partisi yang terlalu banyak menambah overhead memori broker. Yang terpenting: Anda **hanya dapat menambah jumlah partisi dan tidak dapat menguranginya**, dan menambah partisi akan mengubah pemetaan hash key di masa depan sehingga merusak konsistensi urutan per-key data lama. Rencanakan jumlah partisi dengan kapasitas cadangan masa depan (misalnya 6 hingga 30 partisi untuk topic berukuran sedang).

**Kebijakan Retensi (Retention).** Secara default, broker Kafka menghapus data yang lebih tua dari batas retensi waktu (misalnya 7 hari) atau saat batas ukuran storage terlampaui. Namun jika Anda mengonfigurasi `cleanup.policy=compact`, broker akan mempertahankan **rekaman data paling mutakhir untuk setiap key** selamanya: mekanisme ini disebut **log compaction**, yang mengubah topic Kafka menjadi changelog representasi *state terkini* dari setiap entitas. Pesan yang membawa key namun bernilai **value null** disebut **tombstone**, yang menginstruksikan proses compaction untuk menghapus key tersebut dari log. Compacted topic adalah cara utama tabel database direpresentasikan di dalam Kafka.

**Daya Tahan (Durability).** Dikendalikan oleh konfigurasi klaster: `replication.factor` dan `min.insync.replicas` menentukan berapa banyak salinan replica yang wajib mengonfirmasi penulisan; dikombinasikan dengan setting producer `acks=all`, penulisan yang telah diakui dijamin aman meskipun salah satu broker mengalami crash.

Pada Bagian A lab praktikum modul ini, Anda akan membangun konsep-konsep ini dari nol ke dalam implementasi mini Kafka in-memory, sehingga Anda menguasai aturan internalnya secara mendalam: pemetaan key-to-partition yang deterministik, pelacakan offset per partisi, perhitungan lag, algoritma range assignment, serta mekanisme log compaction lengkap dengan penanganan tombstone. (Di `minilog.py`, `Record` memakai `@dataclass(frozen=True)` untuk membuat objek immutable `Record(partition, offset, key, value)` yang field-nya tidak bisa diubah setelah dibuat.)

### Lihat sendiri: partisi, offset, dan kompaksi

Setiap partisi adalah lognya sendiri yang berurutan, dan setiap record punya **offset** (posisinya di partisi itu). Perhatikan record mendapat `(partition, offset)`:

:::trace Setiap record mendapat partisi dan offset
@code
topic = {0: [], 1: []}

def produce(key, value):
    p = len(key) % 2
    topic[p].append(value)
    return p, len(topic[p]) - 1

print(produce("ab", "order-1"))
print(produce("abc", "order-2"))
print(produce("cd", "order-3"))
@notes
4 | Key menentukan partisi (di sini pengganti hash). Key yang sama selalu mendarat di partisi yang sama, yang menjaga urutan event key itu.
5 | Record ditambahkan di akhir log partisinya.
6 | Offset adalah posisi di dalam partisi **itu**: 0 untuk record pertama, 1 untuk kedua...
10 | `"cd"` sepanjang `"ab"`, jadi ia bergabung ke partisi yang sama, di offset berikutnya.
:::

Sekarang aturan kompaksi log: simpan **record terbaru per key**, dan perlakukan nilai `None` (sebuah **tombstone**) sebagai "key ini dihapus".

:::trace Kompaksi menyimpan nilai terbaru, tombstone menghapus
@code
log = [("c1", "Jakarta"), ("c2", "Medan"), ("c1", "Bandung"), ("c2", None)]
latest = {}
for key, value in log:
    latest[key] = value
compacted = {k: v for k, v in latest.items() if v is not None}
print(compacted)
@notes
4 | Record yang lebih baru untuk key yang sama **menggantikan** yang lebih lama (`c1` pindah dari Jakarta ke Bandung), dan nilai `None` (`c2`) mencatat sebuah **tombstone**.
5 | Tombstone menghapus key dari hasil kompaksi: `c2` hilang, `c1` adalah Bandung.
:::

:::ask Sebuah topic punya 3 partisi dan consumer group berisi 4 consumer. Berapa consumer yang menganggur?
@options
tidak ada: Kafka otomatis menambah partisi keempat
* satu: tiap partisi paling banyak satu pembaca
keempatnya berbagi tiap partisi secara merata
@why
Dalam sebuah consumer group setiap partisi ditugaskan ke tepat satu consumer, jadi paralelisme group dibatasi jumlah partisi. Consumer keempat tidak punya apa pun untuk dibaca sampai sebuah consumer pergi atau partisi ditambah.
:::

:::drill python Padatkan sebuah log
Tulis `compact(log)`: `log` adalah list record `(key, value)` berurutan. Kembalikan dictionary dengan nilai **terbaru** setiap key, dan **hapus** key yang nilai terbarunya `None` (tombstone).
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("compact") ## Definisikan compact(log).
compact([("c1", "Jakarta"), ("c2", "Medan"), ("c1", "Bandung")]) == {"c1": "Bandung", "c2": "Medan"} ## Record yang lebih baru untuk c1 menang.
compact([("c1", "Jakarta"), ("c1", None)]) == {} ## Tombstone menghapus key.
compact([("c1", None), ("c1", "Medan")]) == {"c1": "Medan"} ## Nilai setelah tombstone mengembalikan key.
compact([]) == {} ## Log kosong dipadatkan menjadi kosong.
@hint
Ulangi recordnya dan simpan `latest[key] = value`; di akhir simpan hanya entri yang nilainya bukan `None`.
@solution
def compact(log):
    latest = {}
    for key, value in log:
        latest[key] = value
    return {k: v for k, v in latest.items() if v is not None}
:::

Karena consumer Kafka umumnya berjalan dengan jaminan **at-least-once delivery** (Pelajaran 4), crash sebelum offset di-commit bisa membuat pasangan `(partition, offset)` yang sama terkirim dua kali:

:::drill python Lewati yang sudah diproses
Consumer tidak boleh menerapkan record dua kali (pengiriman bisa berulang). Tulis `fresh(events)`: `events` adalah list dict dengan `"partition"` dan `"offset"`; kembalikan event dengan urutan sama, **membuang yang pasangan `(partition, offset)`-nya sudah terlihat sebelumnya** dalam list.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("fresh") ## Definisikan fresh(events).
fresh([{"partition": 0, "offset": 5, "v": "a"}, {"partition": 0, "offset": 5, "v": "a"}, {"partition": 1, "offset": 5, "v": "b"}]) == [{"partition": 0, "offset": 5, "v": "a"}, {"partition": 1, "offset": 5, "v": "b"}] ## (partition, offset) yang sama dua kali: simpan yang pertama. Offset 5 di partisi lain adalah record berbeda.
fresh([]) == [] ## List kosong menghasilkan list kosong.
len(fresh([{"partition": 0, "offset": i % 2, "v": i} for i in range(6)])) == 2 ## Enam event tetapi hanya dua pasangan (partition, offset) yang berbeda: 2.
@hint
Simpan set `seen` berisi tuple `(partition, offset)`: tambahkan event hanya ketika pasangannya tidak ada di `seen`, lalu masukkan pasangannya.
@solution
def fresh(events):
    seen = set()
    out = []
    for event in events:
        pair = (event["partition"], event["offset"])
        if pair not in seen:
            seen.add(pair)
            out.append(event)
    return out
:::

> 💡 **Jeda Praktik 1 (MiniLog Topic, Partisi CRC32 & Log Compaction):**
> 1. Buka file `labs/mod-3-2/minilog.py` di teks editor Anda. Jangan eksekusi file ini langsung di terminal tanpa pytest.
> 2. Implementasikan class `Topic`: method `__init__`, `partition_for(key)` menggunakan `zlib.crc32(str(key).encode()) % partitions` (atau round-robin jika key `None`), `produce(key, value)`, `end_offsets()`, dan `compact()`.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-2/test_minilog.py -k "TestProducing or TestCompaction" -v`
> 4. **Indikator Sukses:** Sebanyak 7 pengujian berstatus `PASSED`, membuktikan bahwa offset berurutan per partisi, kunci yang sama selalu ke partisi yang sama, dan compaction mempertahankan nilai terbaru serta menghapus tombstone.

## @lesson Di dalam cluster: leader, in-sync replica, dan bertahan dari kegagalan broker
"Replication factor 3" mudah diucapkan. Apa yang sebenarnya terjadi ketika sebuah broker mati? Kami menjalankan cluster Apache Kafka 4.0.0 tiga broker sungguhan (mode KRaft, tanpa ZooKeeper; `labs/mod-3-2/cluster/docker-compose.yml`) dan sengaja merusaknya. Pertama topiknya:

```text
$ kafka-topics.sh --create --topic orders --partitions 3 --replication-factor 3 --config min.insync.replicas=2
$ kafka-topics.sh --describe --topic orders
Partition: 0  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
Partition: 1  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
Partition: 2  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
```

Setiap partisi punya satu **leader** (semua baca dan tulis lewat dia) dan dua **follower** yang terus-menerus mengambil dari leader untuk menyalin lognya. `Replicas` mendaftar broker yang seharusnya menyimpan salinan (yang pertama adalah leader *pilihan utama*, sehingga leader tersebar di seluruh broker). `Isr` mendaftar **in-sync replicas**: follower yang sudah menyusul. Hanya replika in-sync yang boleh menjadi leader, itulah sebabnya leader baru tidak pernah kekurangan record yang sudah di-acknowledge.

:::talk Apakah pengaturan paling ketat yang terbaik?
@teacher Sebuah topic punya 3 replika. Seorang pembelajar membaca bahwa lebih ketat lebih aman dan mengatur `min.insync.replicas=3` bersama `acks=all`. Saat restart bergulir, satu broker mati selama dua menit.
@ask Apa yang terjadi pada para producer selama dua menit itu?
@choice Tidak ada: semua penulisan berjalan seperti biasa | Dengan `min.insync.replicas=3`, sebuah penulisan butuh ketiga replika tersinkron, dan salah satunya mati. Coba lagi.
@choice * Penulisan mereka ditolak (`NOT_ENOUGH_REPLICAS`), karena hanya dua replika yang tersinkron dan tiga diperlukan | Betul. Ketahanan yang lebih ketat mengorbankan ketersediaan. Dengan `min.insync.replicas=2` dan `acks=all`, sebuah penulisan tetap butuh dua salinan, dan klaster selamat dari satu broker yang gagal.
@choice Data diam-diam ditulis ke hanya dua replika | Itu yang akan dilakukan pengaturan yang lebih lemah. Dengan 3 yang diwajibkan, Kafka menolak. Coba lagi.
@teacher Ketahanan dan ketersediaan menarik ke arah berlawanan. Pilih pengaturan yang cocok dengan kegagalan yang harus Anda lewati.
:::

**Arti `acks=all` dan `min.insync.replicas` bersama-sama.** Dengan `acks=all`, leader menjawab hanya setelah **setiap replika yang saat ini ada di ISR** memiliki record itu. `min.insync.replicas=2` menambahkan batas bawah: jika ISR lebih kecil dari 2, leader **menolak** tulisan alih-alih menerimanya dengan salinan lebih sedikit. Jadi `replication.factor=3`, `min.insync.replicas=2`, dan `acks=all` adalah resep standar: satu broker mana pun boleh gagal tanpa kehilangan record yang sudah di-acknowledge *dan* tanpa menghentikan penulis.

**Eksperimen 1: crash leader saat ada beban.** Kami menjalankan producer yang mengirim 20 record per detik dengan `acks=all` dan, setelah sekitar 9 detik, mematikan paksa (`docker kill`, sebuah crash, bukan shutdown bersih) broker yang memimpin partisi 0. Producer menerima `NOT_LEADER_OR_FOLLOWER`, **mencoba ulang sendiri**, dan selesai: semua 500 record terkirim, yang paling lambat memakan **7,46 detik**, dan throughput pada interval itu turun dari 20 menjadi 7,5 record per detik. `describe` lalu menunjukkan dunia baru para penyintas: `Leader: 3, Isr: 3,1`. Setelah broker dihidupkan kembali ia bergabung lagi ke setiap ISR (`Isr: 3,1,2`) dalam 40 detik yang kami tunggu, tetapi kepemimpinan tetap di broker 3; Kafka memindahkan leader kembali ke broker pilihan utama kemudian, di latar belakang. Offset akhir berjumlah **507 = 6 + 500 + 1** (6 record uji awal + 500 record beban + 1 sentinel), persis record yang kami kirim: tanpa kehilangan dan tanpa duplikat, karena producer Java bersifat idempoten secara default ketika `acks=all` (sejak Kafka 3.0).

**Eksperimen 2: harga batas bawah yang ketat.** Kami membuat topik kedua berpartisi 1 dengan `min.insync.replicas=3` (setiap replika harus ada) dan mematikan satu broker. Producer dengan `acks=all` gagal dengan **`NOT_ENOUGH_REPLICAS`** sampai broker kembali: topik itu memilih *konsistensi daripada ketersediaan*. Producer dengan `acks=1` terus berhasil, menulis ke leader yang hanya punya dua salinan: **ketersediaan menang dan janji durabilitas diturunkan secara diam-diam**. Topik dengan `min.insync.replicas=2` menerima tulisan `acks=all` dengan satu broker mati, itulah mengapa 2 adalah nilai yang umum. Ingat bahwa `acks=1` atau `acks=0` bisa kehilangan record yang hanya di-acknowledge oleh leader yang kemudian crash.

**Pantau.** `kafka-topics.sh --describe --under-replicated-partitions` mendaftar partisi dengan replika in-sync lebih sedikit daripada replikanya (pada eksperimen: keempat partisi, 3 pada `orders` ditambah 1 pada topik ketat, saat satu broker mati), dan `--under-min-isr-partitions` mendaftar yang **menolak tulisan `acks=all`** (topik yang ketat). Keduanya harus kosong dan merupakan alert pertama seorang operator Kafka. Pengaturan terkait: `unclean.leader.election.enable` (default `false`) akan membiarkan replika yang *tidak in-sync* menjadi leader ketika tidak ada yang in-sync, memulihkan ketersediaan dengan **membuang record yang sudah di-acknowledge**; biarkan mati untuk data penting. Penempatan sadar rak (`broker.rack`) menyebar replika ke seluruh zona kegagalan.

**Siapa yang menentukan leader?** Dalam mode KRaft, sebuah kuorum node **controller** menyimpan metadata cluster dengan protokol Raft dan memilih leader partisi. Pada cluster kecil kami setiap node adalah broker sekaligus controller. Broker yang kami matikan pada percobaan pertama juga controller aktif, dan yang lain memilih controller baru dalam **5 detik** (log menunjukkan controller baru tercatat tepat 5,0 detik setelah dimatikan). Raft butuh **mayoritas**: tiga controller bertahan dari satu kegagalan, lima bertahan dari dua. Cluster produksi karena itu menjalankan 3 atau 5 node controller khusus yang terpisah dari broker, agar broker yang sibuk tidak menghabiskan sumber daya otak cluster.

> 🛠 **Coba sendiri (15 menit, Python).** Modelkan satu partisi dengan tiga replika sebagai list: broker `A` (leader) dan `B` menyimpan pesan 1 sampai 10, broker `C` hanya menyimpan 1 sampai 7 dan sudah keluar dari himpunan in-sync, jadi ISR-nya `[A, B]`. Kesepuluh pesan sudah di-acknowledge dengan `acks=all`. Matikan `A`. Tulis `elect(isr, unclean)`: pemilihan bersih memilih anggota ISR yang masih hidup, pemilihan tidak bersih boleh memilih replika hidup mana pun (ambil `C`). Untuk masing-masing, cetak leader baru dan pesan yang sudah di-acknowledge tetapi tidak ada lagi di sana. Lalu tambahkan fungsi `produce` yang menolak penulisan jika ISR memiliki kurang dari `min_isr` anggota, dan periksa dengan `min_isr=2` dan `min_isr=3` pada ISR `[A, B]`.
>
> **Seharusnya Anda melihat:** pemilihan bersih memilih `B` dan kehilangan `[]`; pemilihan tidak bersih memilih `C` dan kehilangan `[8, 9, 10]`: record yang sudah di-acknowledge, tanpa suara. Dengan ISR `[A, B]`, penulisan diterima untuk `min_isr=2` dan ditolak untuk `min_isr=3`, situasi `NOT_ENOUGH_REPLICAS` dari Eksperimen 2.

:::ask Sebuah partisi punya replication factor 3, `acks=all`, dan `min.insync.replicas=2`. Dua broker mati, menyisakan satu di ISR. Apa yang terjadi pada penulisan produser?
@options
berhasil, karena leader partisi masih hidup
* ditolak: ISR jatuh di bawah batas 2
berhasil lalu disalin ulang nanti
@why
`min.insync.replicas=2` menetapkan batas bawah. Dengan hanya satu replika yang sinkron, leader menolak penulisan (NotEnoughReplicas) daripada menerima data yang bisa hilang jika broker terakhir itu juga gagal.
:::

## @part Producer, consumer, dan skema

## @lesson Producer dan consumer: jaminan pengiriman pesan
**Konfigurasi Esensial Producer:**

- **`acks`**: `0` (tidak menunggu konfirmasi broker sama sekali, sangat rawan hilang), `1` (menunggu konfirmasi dari partition leader), `all` (menunggu konfirmasi penuh dari seluruh in-sync replicas). Selalu gunakan `all` untuk data finansial dan transaksional yang pantang hilang.
- **Retry dan Idempotensi.** Koneksi jaringan bisa putus sesaat sehingga producer melakukan retry; jika retry dilakukan setelah broker sebenarnya berhasil menulis data namun acknowledgement gagal sampai, data akan terduplikasi. Fitur **Idempotent Producer** (`enable.idempotence=true`) menyematkan ID producer dan sequence number pada setiap pesan sehingga broker menolak duplikasi akibat retry di dalam partisi yang sama tanpa merusak urutan pesan. Selalu aktifkan fitur ini di produksi. (Java client mengaktifkannya secara default sejak Kafka 3.0; client berbasis librdkafka, seperti paket `confluent-kafka` yang dipakai di lab, harus mengaturnya secara eksplisit.)
- **Batching dan Kompresi** (`linger.ms`, `batch.size`, algoritma `snappy`/`zstd`): menahan pengiriman sesaat untuk menggabungkan banyak pesan ke dalam satu paket jaringan, menukar sedikit latensi demi lonjakan throughput yang masif.
- **Selalu tangani Delivery Callbacks.** Fungsi `produce()` berjalan secara asinkron: ia hanya memasukkan pesan ke dalam buffer antrean lokal. Kegagalan penulisan dilaporkan nanti melalui fungsi callback. Mengabaikan callback akan menghilangkan data secara hening. Selalu panggil `flush()` sebelum proses aplikasi berhenti.

:::talk Sepuluh consumer, enam partisi
@teacher Sebuah topic punya 6 partisi. Anda memulai consumer group dengan 10 consumer, berharap lebih banyak consumer berarti membaca lebih cepat.
@ask Berapa dari 10 consumer itu yang benar-benar menerima data?
@choice Semua 10: Kafka memecah partisi menjadi potongan lebih kecil | Partisi adalah unit terkecil yang dibagikan Kafka. Ia tidak pernah dibagi antara consumer dalam group yang sama. Coba lagi.
@choice * Enam: setiap partisi diberikan ke tepat satu consumer, jadi empat lainnya menganggur | Betul. Di dalam sebuah group, satu partisi punya satu pembaca pada satu waktu. Jumlah partisi adalah batas atas pembacaan paralel.
@choice Lima: Kafka menyimpan separuh consumer sebagai cadangan | Tidak ada aturan cadangan semacam itu. Coba lagi.
@teacher Jadi pilih jumlah partisi dengan paralelisme masa depan dalam pikiran: consumer yang lebih banyak daripada partisi tidak pernah membantu, hanya partisi yang lebih banyak yang membantu.
:::

**Consumer dan Offset Management.** Sebuah consumer membaca pesan dalam perulangan loop (`poll`) dan setelah memproses data, ia **meng-commit** offset terbarunya ke topic internal Kafka (`__consumer_offsets`). Saat restart, consumer dalam **consumer group** yang sama akan melanjutkan pembacaan dari offset terakhir yang telah di-commit. *Kapan* Anda melakukan commit menentukan level jaminan pengiriman pesan Anda:

| Waktu Commit Offset | Skenario jika Consumer Crash di Tengah Eksekusi | Jaminan Pengiriman (Guarantee) |
|---|---|---|
| **Sebelum** data selesai diproses | Pesan terlewatkan dan hilang: offset sudah ditandai selesai padahal data belum diproses | **At-most-once** (risiko kehilangan data) |
| **Setelah** data selesai diproses | Pesan yang sama akan dibaca dan diproses ulang saat restart | **At-least-once** (risiko data duplikat) |
| Setelah data diproses, **dengan efek pemrosesan idempoten** | Pesan diproses ulang, namun operasi kedua tidak mengubah status akhir data | **Exactly-once effect** (aman mutlak) |

Pilihan standar industri enterprise adalah **at-least-once dengan pemrosesan idempoten**: lakukan commit offset setelah data selesai diproses, dan rancang logika pemrosesan agar aman dieksekusi berulang kali (seperti operasi SQL upsert by primary key, penulisan tabel lakehouse berbasis kunci `(partition, offset)`, atau tabel deduplikasi sementara). Lab modul ini menguji prinsip ini secara langsung: simulasi crash sebelum commit menyebabkan pesan terduplikasi, dan consumer yang melacak `(partition, offset)` membuktikan bahwa hasil akhirnya tetap menghasilkan tepat satu efek per pesan.

**Consumer Groups.** Sekumpulan consumer yang berbagi nilai `group.id` yang sama akan **berbagi beban pembacaan** sebuah topic: setiap partisi dialokasikan ke **tepat satu** anggota consumer group pada satu waktu. Dua consumer group yang berbeda (misalnya group billing dan group analitik) masing-masing akan menerima aliran data lengkap secara independen. Konsekuensi penting:

- Skalabilitas paralel maksimum sebuah consumer group dibatasi oleh **jumlah partisi topic**; jika ada 6 partisi dan 10 consumer, 4 consumer sisanya akan menganggur tanpa pekerjaan.
- Alokasi partisi dihitung menggunakan strategi assignment (misalnya Range Assigner yang membagikan blok partisi berurutan) dan mengalami **rebalance** setiap kali ada anggota yang bergabung, keluar, atau crash. Selama rebalance klasik ("eager"), seluruh consumer berhenti sejenak; strategi modern **Cooperative Sticky Assigner** meminimalkan downtime dengan hanya memindahkan partisi yang memang perlu dipindahkan.
- Consumer yang tidak memanggil `poll` dalam batas waktu `max.poll.interval.ms` (default 5 menit) dianggap mati dan dikeluarkan dari group; consumer yang berhenti mengirim heartbeat dikeluarkan setelah melewati batas `session.timeout.ms`. Langkah pemrosesan data yang lambat dan memblokir thread utama dapat memicu **rebalance storm**: pisahkan komputasi berat ke worker pool terpisah atau batasi jumlah batch record per poll.

**Consumer Lag** adalah selisih antara offset data paling akhir yang ada di partisi broker dengan offset terakhir yang telah di-commit oleh consumer group. Lag adalah **metrik kesehatan paling vital** dalam ekosistem streaming. Lag yang terus merangkak naik menandakan bahwa consumer Anda kewalahan dan kalah cepat dibandingkan laju kedatangan data dari producer. Pantau metrik lag ini dan siapkan alarm peringatan. Bagian B lab membacanya dari broker sungguhan: consumer group baru di atas 60 pesan menunjukkan lag 60, dan 0 setelah semua pesan dikonsumsi.

**Pesan Beracun (Poison Messages).** Sebuah rekaman data yang cacat atau berformat korup tidak boleh menghentikan pemrosesan seluruh partisi selamanya, dan tidak boleh dibuang diam-diam tanpa jejak. Tangkap error tersebut, kirimkan pesan cacat beserta konteks error dan koordinat partisinya ke sebuah **Dead-Letter Topic (DLT)**, lakukan commit offset pada partisi utama, dan lanjutkan pembacaan: ini adalah pola karantina yang konsisten dengan Modul 1.2 dan 2.5.

> 💡 **Jeda Praktik 2 (Consumer Groups, Range Assignment & Idempoten Commit):**
> 1. Buka file `labs/mod-3-2/minilog.py` di teks editor Anda.
> 2. Implementasikan fungsi `assign(partitions, members)` dengan strategi range assignment berurutan.
> 3. Implementasikan class `Consumer`: `__init__` (melanjutkan dari committed offset), `poll(max_records)`, `commit()`, serta method `lag(group)` pada `Topic`.
> 4. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-2/test_minilog.py -k "TestConsuming or TestGroupsAndAssignment" -v`
> 5. **Indikator Sukses:** Sebanyak 8 pengujian berstatus `PASSED`, memvalidasi alokasi partisi tanpa tumpang tindih, pembacaan resume dari offset komit, dan penanganan crash sebelum komit dengan logika pemrosesan idempoten.

:::ask Sebuah konsumen meng-commit offset-nya **sebelum** memproses tiap rekaman, lalu crash di tengah rekaman. Setelah restart, apa jaminan pengirimannya?
@options
at-least-once: rekaman diproses lagi
exactly-once: tidak ada yang hilang atau berulang
* at-most-once: rekaman bisa hilang
@why
Commit lebih dulu berarti crash setelah commit tetapi sebelum kerja akan melewatkan rekaman itu. Commit setelah memproses menghasilkan at-least-once: crash menyebabkan pengulangan, yang harus ditoleransi konsumen.
:::

## @lesson Skema, serialisasi, dan Kafka Connect
Pesan di Kafka pada dasarnya hanyalah deretan byte mentah; format serialisasinya ditentukan oleh aplikasi Anda. Format **JSON** sangat ramah manusia dan mudah di-debug, namun mengulang nama setiap field di setiap pesan dan tidak memiliki penegakan tipe yang kaku. Format biner seperti **Apache Avro** (baris biner ringkas yang menyimpan skemanya terpisah dan hanya menyematkan ID skema 4-byte pada pesan) dan **Protocol Buffers (Protobuf)** (field biner bertipe yang diidentifikasi lewat nomor tag) jauh lebih hemat dan dirancang untuk evolusi skema jangka panjang. Penggunaan Avro umumnya dipadukan dengan **schema registry**: sebuah layanan terpusat yang menyimpan versi skema data, menyematkan ID skema berukuran 4 byte pada setiap payload pesan, dan menegakkan **aturan kompatibilitas skema** saat skema diperbarui (Backward, Forward, atau Full Compatibility). Ini adalah wujud nyata dari konsep data contract (Modul 2.5) pada dunia streaming: producer tidak akan diizinkan mempublikasikan perubahan skema yang merusak aplikasi consumer downstream.

**Kafka Connect** adalah kerangka kerja siap pakai untuk memindahkan data masuk dan keluar dari Apache Kafka **tanpa perlu menulis kode aplikasi dari nol**. **Source Connectors** menarik data dari sistem eksternal ke dalam Kafka topic (seperti Debezium untuk database PostgreSQL); sedangkan **Sink Connectors** menyalurkan isi topic ke sistem penyimpanan tujuan (seperti Amazon S3, Google Cloud Storage, Apache Iceberg, Snowflake, Elasticsearch, atau ClickHouse). Kafka Connect secara otomatis mengelola skalabilitas worker, pelacakan offset, penanganan retry, transformasi pesan ringan (**Single Message Transforms / SMT**), dan perutean error ke Dead-Letter Queue. Untuk pipeline "database replika menuju data lakehouse", kombinasi Debezium source connector dan cloud storage sink connector sering kali sudah mencukupi kebutuhan produksi tanpa ribuan baris kode kustom.

> 🛠 **Coba sendiri (20 menit, Python).** Encode record `{"id": 1, "customer": "Budi", "total": 150000}` dengan cara producer Avro berbasis registry, dengan tangan. Aturannya: pesan dimulai dengan byte `0` dan schema id (1) sebagai 4 byte, big-endian. Sebuah integer Avro dikodekan **zig-zag** (`(n << 1) ^ (n >> 63)`), lalu ditulis dalam kelompok 7 bit, kelompok terendah lebih dulu, dengan bit tertinggi menyala di setiap byte kecuali yang terakhir. Sebuah string adalah panjangnya yang ditulis sebagai integer, lalu byte UTF-8-nya. Cetak hasilnya sebagai hex dengan `.hex()` beserta panjangnya, dan bandingkan dengan panjang record yang sama sebagai JSON ringkas (`json.dumps(rec, separators=(",", ":"))`).
>
> **Seharusnya Anda melihat:** `0000000001020842756469e0a712`, yaitu `14` byte, dibanding `41` byte JSON ringkas (`json.dumps(rec, separators=(",", ":"))`; `json.dumps` bawaan menambah spasi dan menghasilkan `46`). Bandingkan dengan wire format Schema Registry yang ditunjukkan di Pelajaran 6: `00`, `00000001`, `02`, `08`, `42756469` ("Budi"), `e0a712`. Record itu sama sekali tidak memuat nama field: siapa pun yang membacanya butuh skemanya, itulah sebabnya schema id ikut dikirim bersamanya.

:::ask Mengapa tim memasang Avro dengan schema registry pada topic, bukan JSON biasa?
@options
* rekaman ringkas dan versi skema tervalidasi
broker Kafka tidak bisa menyimpan pesan JSON biasa
Avro menghilangkan kebutuhan produser
@why
JSON mengulang setiap nama field di setiap pesan dan tidak menegakkan tipe. Avro menyimpan skema sekali di registry dan mengirim id pendek, dan registry menolak perubahan yang akan merusak konsumen.
:::

## @lesson Schema Registry dalam praktik: mengubah topik tanpa merusak consumer
Schema registry dari pelajaran sebelumnya menjadi nyata ketika sebuah tim ingin *mengubah* pesan. Kami menjalankan registry bawaan Redpanda, yang berbicara dengan REST API sama seperti milik Confluent, dengan subject Avro `orders-value` dan aturan default, **BACKWARD** ("consumer yang memakai skema baru bisa membaca data yang ditulis dengan skema lama"). Mulai dari `{id: int, customer: string, total: int}`, kami bertanya kepada registry apakah setiap perubahan diizinkan:

| Perubahan skema | BACKWARD | FORWARD | FULL |
|---|---|---|---|
| Menambah field **opsional** (`["null","string"]`, default `null`) | diterima | diterima | diterima |
| Menambah field **wajib** tanpa default | **ditolak** | diterima | **ditolak** |
| **Menghapus** field yang tak punya default (`total`) | diterima | **ditolak** | **ditolak** |

(Kolom-kolom ini berasal dari tes pada subject yang sama setelah mengganti pengaturan kompatibilitasnya. Mengubah tipe, `int` menjadi `string`, **ditolak** pada BACKWARD, karena Avro hanya bisa mempromosikan tipe numerik, misalnya `int` ke `long`.) Mendaftarkan skema yang ditolak mengembalikan **HTTP 409** beserta alasannya, misalnya `READER_FIELD_MISSING_DEFAULT_VALUE: the field 'channel' has no default value and is missing in the old schema`. Registry dengan demikian menghentikan tim producer mengirim perubahan yang merusak; ia **tidak** membuat consumer Anda benar, hanya membuat kedua skema kompatibel.

Aturan praktis:

- **Selalu beri field baru sebuah default** (atau jadikan opsional). Ini kebiasaan tunggal yang menjauhkan Anda dari masalah.
- **Jangan pernah memakai ulang nama field dengan arti atau tipe berbeda.** Tambahkan field baru, migrasikan pembaca, dan pensiunkan yang lama kemudian.
- **Pilih urutan upgrade.** BACKWARD berarti *upgrade consumer lebih dulu* (mereka bisa membaca data lama dan baru); FORWARD berarti *upgrade producer lebih dulu*; FULL mengizinkan urutan mana pun. Kompatibilitas **lintas semua versi** (`BACKWARD_TRANSITIVE`) penting ketika data lama tetap ada di topik berbulan-bulan atau selamanya, seperti pada topik compacted.
- **Uji perubahan sebelum mendaftarkan** dengan endpoint `/compatibility/subjects/<subject>/versions/latest` di CI. Pemeriksaan yang gagal di CI lebih murah daripada insiden.

**Apa isi pesannya.** Dengan registry, producer tidak menyematkan skema di setiap record. Kami memproduksi `{"id":1,"customer":"Budi","total":150000}` lewat registry dan membaca byte mentahnya: `00 00000001 02 08 42756469 e0a712`. Byte pertama adalah **magic byte** (0), empat byte berikutnya adalah **schema id** (1), dan sisanya adalah biner Avro yang ringkas: **14 byte total, dibanding 41 byte untuk record yang sama sebagai JSON**. Consumer membaca id, mengambil (dan men-cache) skema dari registry, lalu mendekode. Itu juga sebabnya registry yang mati hanya merugikan consumer yang menemui id yang belum di-cache.

**Di mana pemrosesan stream berada.** Kafka sendiri menyimpan dan mengirimkan record; mengubahnya adalah lapisan lain. **Kafka Streams** adalah pustaka Java yang Anda sematkan di aplikasi sendiri (tanpa cluster terpisah) untuk memfilter, menggabungkan, dan mengagregasi topik, menyimpan state-nya di store lokal yang dicadangkan ke *changelog topic* di Kafka. **ksqlDB** menawarkan SQL atas topik. **Flink** dan **Spark Structured Streaming** (Modul 3.3) adalah engine terpisah untuk job yang lebih besar atau lebih kompleks. Ini deskripsi dari dokumentasi proyek-proyeknya: lab tidak menjalankannya.

> 🛠 **Coba sendiri (20 menit, Python).** Tulis pemeriksa kompatibilitas. Representasikan skema sebagai `{field: (type, has_default)}`, dengan titik awal dari pelajaran `{id: (int, False), customer: (string, False), total: (int, False)}`. `backward(old, new)` (pembaca dengan skema baru membaca data yang ditulis dengan skema lama) gagal jika skema baru punya field yang tidak ada di skema lama dan tidak punya default, atau jika sebuah field berubah tipe. `forward(old, new)` adalah pemeriksaan yang sama dengan peran ditukar. Jalankan empat perubahan: menambah field opsional `channel` dengan default, menambah `channel` tanpa default, menghapus `total`, dan mengubah `total` dari `int` menjadi `string`. Cetak backward, forward, dan full (keduanya) untuk masing-masing.
>
> **Seharusnya Anda melihat:** tambah opsional: backward `True`, forward `True`; tambah wajib: backward `False`, forward `True`; hapus `total`: backward `True`, forward `False`; `int` ke `string`: keduanya `False`. Itu mereproduksi tabel di pelajaran ini. Dari keempatnya, mana yang akan ditolak registry dengan aturan default BACKWARD dengan HTTP 409?

:::ask Seorang produser ingin mengubah tipe field dari `int` menjadi `string` di bawah kompatibilitas BACKWARD. Apa yang dilakukan registry?
@options
ia menerima dan mengonversi semua pesan lama
* ia menolak perubahan tipe yang merusak
ia menerima dan membuang field itu
@why
Kompatibilitas BACKWARD berarti konsumen dengan skema baru bisa membaca data lama. int ke string merusaknya, jadi ditolak; menambah field opsional dengan nilai default adalah perubahan yang aman.
:::

## @part Change data capture

## @lesson Change Data Capture: mengubah database transaksional menjadi event stream
Bagaimana cara terbaik mengekstrak mutasi data dari database transaksional operasional ke platform analitik? Pendekatan amatir yang kerap digunakan adalah **query-based polling**: mengeksekusi query berkala setiap beberapa menit seperti `SELECT * FROM orders WHERE updated_at > :last_run`. Kelemahan fatal metode ini: ia **kehilangan operasi DELETE** (baris yang dihapus di database lenyap begitu saja tanpa jejak), melewatkan status mutasi perantara (dua kali update yang terjadi di antara siklus polling hanya terlihat sebagai satu status akhir), sangat bergantung pada kolom timestamp yang rawan tidak akurat, serta membebani CPU database produksi dengan query scanning berulang.

:::talk Baris yang menghilang
@teacher Setiap menit sebuah pekerjaan bertanya ke tabel pesanan: "beri saya baris yang `updated_at`-nya lebih baru dari pemeriksaan terakhir saya". Pada tengah hari seseorang menghapus pesanan 2 dari tabel.
@ask Apakah pekerjaan polling itu tahu bahwa pesanan 2 dihapus?
@choice Ya, karena `updated_at` baris yang dihapus adalah yang terbaru | Baris yang dihapus sudah tiada: tidak ada yang tersisa di tabel untuk membawa `updated_at`. Coba lagi.
@choice Ya, karena database memperingatkan setiap klien | Database tidak mengumumkan perubahan kepada klien yang hanya mengajukan pertanyaan. Coba lagi.
@choice * Tidak: polling hanya bisa melihat baris yang masih ada, jadi penghapusan tak terlihat, begitu pula perubahan di antara dua polling | Betul. Change data capture berbasis log justru membaca log perubahan milik database sendiri, dan log itu mencatat setiap insert, update, dan delete, secara berurutan.
@teacher Karena itu pipeline yang serius menangkap perubahan dari log, bukan dengan bertanya ke tabel "apa yang baru?".
:::

**Log-based Change Data Capture (CDC)** membaca langsung dari catatan jurnal mutasi internal database alih-alih melakukan polling tabel. PostgreSQL menulis setiap perubahan data secara berurutan ke **Write-Ahead Log (WAL)** (jurnal pemulihan crash append-only di disk) *sebelum* mengubah file fisik tabel. Dengan parameter `wal_level = logical`, WAL mencatat detail baris yang cukup bagi **logical decoding** PostgreSQL untuk mengalirkan perubahan lewat tiga komponen utama (`publication`, `replication slot`, dan plugin dekoder biner `pgoutput`; tiap rekaman membawa **LSN**, Log Sequence Number, alamat posisi byte di dalam WAL):

- **Publication**: objek database yang mendeklarasikan tabel mana saja yang perubahannya akan dipublikasikan (`CREATE PUBLICATION pub FOR TABLE orders`).
- **Replication Slot**: penanda posisi (bookmark) di sisi server PostgreSQL untuk consumer tertentu: engine PostgreSQL berjanji untuk **mempertahankan seluruh file segmen WAL yang belum dikonfirmasi oleh slot tersebut** (`pg_create_logical_replication_slot('slot', 'pgoutput')`).
- **Output Plugin**: komponen decoder yang memformat aliran data biner WAL menjadi pesan yang dapat dibaca; **pgoutput** adalah plugin biner native bawaan PostgreSQL yang dibaca langsung oleh Debezium.

File `pgoutput.py` pada lab modul ini mendecode aliran data biner nyata tersebut secara langsung. Menjalankannya mengungkap misteri cara kerja CDC: sebuah transaksi database tiba sebagai pesan `Begin`, diikuti pesan metadata `Relation` yang mendeskripsikan tipe kolom tabel, disusul oleh deretan mutasi `Insert`, `Update`, atau `Delete`, dan diakhiri dengan pesan `Commit`. Prinsip penting yang teramati:

- **Setiap mutasi membawa koordinat posisi commit (LSN / Log Sequence Number)**, dan seluruh perubahan di dalam satu transaksi database yang sama memiliki nilai LSN yang identik. Nomor urut mutasi di dalam transaksi tersebut melengkapi koordinat keterurutan global: pasangan nilai `(lsn, seq)`.
- **Replica Identity menentukan informasi apa yang dibawa oleh event Update dan Delete.** Secara default (`REPLICA IDENTITY DEFAULT`), event **Update hanya membawa baris data baru**, dan event **Delete hanya membawa nilai primary key** (kolom lainnya bernilai NULL). Jika ada update yang mengubah nilai primary key, ia akan menyertakan key lama. Namun jika Anda mengeksekusi perintah `ALTER TABLE orders REPLICA IDENTITY FULL`, event update dan delete akan membawa **seluruh nilai baris data lama secara lengkap (before-image)**, dengan konsekuensi volume file WAL yang lebih besar. Jika kebutuhan analitik Anda membutuhkan riwayat audit komparatif nilai lama, Anda wajib mengaktifkan opsi FULL ini.

  Apa yang ditampilkan Debezium untuk baris yang sama, diukur pada stack Docker lab: dengan identitas default, event update memiliki `before: null`, dan event delete memiliki `before` yang berisi key tetapi **nilai karangan untuk kolom lainnya** (customer 0, amount "0.00", status "PENDING", yaitu nilai default kolom), bukan nilai lama yang sebenarnya. Tidak ada tanda yang menandainya sebagai palsu. Setelah `ALTER TABLE orders REPLICA IDENTITY FULL`, operasi yang sama membawa before image yang benar (customer 9, amount "99.00", status "DONE"). Consumer yang memercayai `before` pada tabel dengan identitas default akan menulis riwayat yang salah.
- Pada tabel dengan konfigurasi FULL, aliran data menandai seluruh kolom sebagai identitas baris, sehingga **consumer wajib mengetahui primary key tabel yang sebenarnya** melalui katalog skema.

**Anatomi Event Debezium.** Debezium membungkus mutasi WAL tersebut ke dalam format amplop JSON standar industri yang dipublikasikan ke topic Kafka bernama `<prefix>.<schema>.<table>` (misalnya `shop.public.orders`) dengan partisi berdasarkan nilai primary key baris data:

```json
{ "before": { "order_id": 1, "status": "paid",    "total_idr": 100000 },
  "after":  { "order_id": 1, "status": "shipped", "total_idr": 100000 },
  "source": { "db": "production", "table": "orders", "lsn": 21683720, "ts_ms": 1767225600000 },
  "op": "u", "ts_ms": 1767225600123 }
```

Nilai atribut `op` menandakan tipe operasi: `c` (create/insert), `u` (update), `d` (delete), atau `r` (read/snapshot awal). Setiap operasi delete diikuti oleh sebuah pesan **tombstone** (key dengan payload value null) sehingga topic Kafka yang terkompaksi dapat menghapus key tersebut dari log. Fungsi `to_events` pada lab modul ini membangun struktur envelope event ini dari aliran biner yang telah didecode.

**Snapshot Awal, lalu Streaming Kontinu.** Saat pertama kali dihubungkan, Debezium mengambil **snapshot konsisten** dari seluruh data tabel yang ada (dipancarkan sebagai event dengan `op = r`), lalu secara mulus beralih ke streaming real-time tepat dari posisi LSN saat snapshot diambil, menjamin tidak ada satu pun transaksi yang tercecer di antara kedua fase tersebut. Penambahan kolom baru di database hulu akan otomatis muncul sebagai field baru di event hilir; sementara penggantian nama kolom atau perubahan tipe data membutuhkan koordinasi kontrak lintas tim.

> 🛠 **Coba sendiri (20 menit, Python).** Bandingkan polling dengan change capture di SQLite. Buat `orders(order_id INTEGER PRIMARY KEY, status TEXT, updated_at INTEGER)` dan tabel `changes(seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT, order_id INT, before TEXT, after TEXT)`, ditambah tiga trigger (`AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE` pada `orders`) yang masing-masing menulis satu baris `changes`, memakai `new.` dan `old.`. Masukkan pesanan 1, 2, 3 sebagai `paid` dengan `updated_at = 1`. Lalu ubah pesanan 1 menjadi `shipped` (`updated_at = 2`), ubah lagi menjadi `delivered` (`updated_at = 3`), dan hapus pesanan 2. Lakukan polling dengan `SELECT order_id, status FROM orders WHERE updated_at > 1`. Cetak tabel `changes`, lalu putar ulang ke sebuah dict (`op = 'd'` menghapus key-nya) dan bandingkan dengan tabel aslinya.
>
> **Seharusnya Anda melihat:** polling hanya mengembalikan `[(1, 'delivered')]`: ia melewatkan penghapusan pesanan 2 dan status antara `shipped`. Tabel `changes` berisi 6 baris: tiga `c`, lalu `u` (`paid` ke `shipped`), `u` (`shipped` ke `delivered`), dan sebuah `d` dengan before `paid`. Memutarnya ulang menghasilkan `{1: 'delivered', 3: 'paid'}`, sama dengan tabelnya. CDC berbasis log yang sesungguhnya memberi Anda bentuk event yang sama tanpa trigger dan tanpa beban pada tabel.

:::ask Mengapa CDC berbasis log menangkap sesuatu yang terlewat oleh `WHERE updated_at > :last_run`?
@options
insert, yang sama sekali tak terdeteksi polling
update, yang tak pernah mengubah updated_at
* delete: log mencatatnya, scan tak pernah melihatnya
@why
Query polling hanya melihat baris yang masih ada. Write-ahead log mencatat setiap insert, update, dan delete yang ter-commit secara berurutan, sehingga delete menjadi event, bukan keheningan.
:::

## @lesson Mengonsumsi event CDC secara aman dan benar
Sebuah CDC consumer umumnya bertugas menyinkronkan data ke tabel replika target, seperti **tabel lakehouse** yang mencerminkan kondisi terkini (misalnya operasi Apache Iceberg `MERGE INTO`, Modul 2.2) atau indeks pencarian. Karena pengiriman pesan Kafka bersifat at-least-once dan consumer dapat mengalami crash atau rebalancing sewaktu-waktu, proses pengaplikasian event ke tabel target **wajib bersifat idempoten dan kebal terhadap perubahan urutan pesan (order-safe)**. Fungsi `apply_events` pada lab modul ini mendemonstrasikan pola arsitektur esensial tersebut:

- Gunakan **Primary Key** baris data sebagai kunci identitas replika, jangan pernah menggunakan urutan waktu kedatangan event.
- Catat untuk setiap key koordinat posisi **`(lsn, seq)` dari event terakhir yang berhasil diaplikasikan**, dan **abaikan (skip) setiap event baru yang posisinya tidak lebih baru**. Dengan aturan ini, memutar ulang log event yang sama berkali-kali atau menerima event yang datang tidak berurutan akan selalu menghasilkan kondisi akhir data yang konsisten sempurna.
- Operasi **DELETE menghapus baris data dari replika namun tetap mempertahankan rekaman koordinat posisinya**, sehingga jika ada event INSERT lama yang tiba terlambat karena replay, data yang sudah dihapus tidak akan bangkit kembali (resurrection bug).
- Perubahan primary key ditangani dengan menghapus baris dengan key lama dan membuat baris baru dengan key baru.
- Perubahan data di dalam transaksi yang sama diaplikasikan secara ketat mengikuti nomor urut mutasinya.

Praktik operasional terbaik: simpan seluruh aliran **raw event log** ke storage penyimpanan dingin (Bronze Layer) sebagai jaminan audit pemulihan; pertahankan retensi topic CDC cukup lama untuk memberi waktu recovery; buat tabel **riwayat historis (SCD Type 2)** terpisah jika analis bisnis membutuhkan jejak audit perubahan dari waktu ke waktu (Modul 1.4); serta lakukan rekonsiliasi berkala untuk membandingkan jumlah baris atau checksum antara database sumber dan replika (Modul 2.5).

**Risiko Operasional Nyata dari Log-Based CDC:**

1. **Replication Slot Menahan Segment WAL.** PostgreSQL dilarang menghapus segmen file WAL yang belum dikonfirmasi pembacaannya oleh replication slot aktif. Jika connector Debezium berhenti berjalan (akibat crash worker, jaringan putus, atau consumer macet), slot akan menahan seluruh WAL dan **kapasitas disk server database produksi akan terisi penuh hingga 100%**, melumpuhkan sistem operasional perusahaan seketika. Pada lab modul ini, slot yang tidak dibaca menahan **118 MB WAL hanya dari 450.000 mutasi baris**, sementara konfigurasi `max_slot_wal_keep_size` PostgreSQL bernilai default `-1` (tanpa batas!). Mitigasi: pasang alarm pemantauan **slot lag** (`pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)` pada view `pg_replication_slots`); tentukan batas aman pada parameter `max_slot_wal_keep_size`; segera hapus slot yang ditinggalkan (abandoned slots); dan kirim event heartbeat berkala agar posisi slot tetap maju meskipun tabel sedang sepi mutasi.
2. **Transaksi Massal (Bulk Update)** menghasilkan lonjakan jutaan event instan yang memicu lonjakan lag secara tiba-tiba.
3. **Perubahan Skema Mendadak (Schema Drift)** di database transaksional dapat mematahkan pipeline consumer hilir.
4. **Beban Snapshot Awal** pada tabel raksasa berukuran ratusan gigabyte membutuhkan waktu lama dan membebani resource I/O database.
5. **Failover Database Utama**: saat terjadi pergantian server PostgreSQL primer ke replika standby, status replication slot harus disinkronkan secara hati-hati agar tidak terjadi celah log yang memaksa pengambilan snapshot ulang dari awal.

**Pola Transaksional Outbox (The Outbox Pattern)** adalah solusi alternatif saat Anda ingin memancarkan *domain application events* (seperti `OrderPlaced` atau `PaymentCompleted`) alih-alih sekadar mutasi baris mentah: aplikasi backend menulis payload event bisnis ke tabel `outbox` di dalam transaksi database yang sama dengan mutasi bisnisnya, kemudian konektor CDC membaca dan mempublikasikan baris-baris dari tabel outbox tersebut ke Kafka. Pola ini memberikan atomisitas transaksi sempurna tanpa memerlukan two-phase commit yang rumit.

**Kapan Sebaiknya TIDAK Menggunakan Streaming.** Sistem streaming menambah komponen infrastruktur bergerak, kompleksitas state, dan beban siaga on-call yang tinggi. Jika keputusan bisnis masih dapat ditoleransi dengan keterlambatan data satu jam, batch pipeline yang idempoten jauh lebih sederhana dan hemat biaya (Modul 0.2). Gunakan streaming hanya untuk kebutuhan yang benar-benar sensitif terhadap latensi detik, skenario data yang dibutuhkan oleh banyak consumer sekaligus, atau replikasi database berfrekuensi tinggi dengan operasi delete.

> 💡 **Jeda Praktik 3 (Idempoten CDC State Replication & Tombstones):**
> 1. Buka file `labs/mod-3-2/cdc.py` di teks editor Anda.
> 2. Implementasikan fungsi `to_events(changes, pk)` untuk memetakan mutasi WAL PostgreSQL ke dalam format envelope event Debezium standar.
> 3. Implementasikan `apply_events(state, events)` dengan pelacakan posisi `(lsn, seq)` per primary key untuk mengabaikan duplikasi dan event out-of-order, serta `materialize(state, table)`.
> 4. Jalankan pengujian di terminal (butuh PostgreSQL; pada Python 3.14 `pgserver` dilewati, jadi mulai Postgres lokal lewat Docker dan set `DATABASE_URL` seperti di bagian `@verify` lab):
>    `pytest labs/mod-3-2/test_cdc.py -v`
> 5. **Indikator Sukses:** Seluruh pengujian CDC lulus (atau dilewati secara anggun jika service database lokal belum aktif), mengonfirmasi replikasi state yang idempoten dan bebas bug kebangkitan baris yang telah dihapus.

*(Pemanasan di browser, versi ringkas dengan LSN tunggal dan tanpa menghapus baris; di `labs/mod-3-2/cdc.py` Anda memakai pasangan `(lsn, seq)` dan menangani tombstone.)*

:::drill python Terapkan hanya event yang lebih baru
Sebuah konsumen CDC menjaga replika sebuah tabel. Tulis `apply_events(events)`: tiap event adalah dictionary `{"key": ..., "lsn": angka, "value": ...}`. Kembalikan replika sebagai dictionary `{key: value}`. Untuk tiap key simpan hanya event dengan `lsn` **tertinggi**; event dengan `lsn` lebih lama (atau sama) dari yang sudah diterapkan dilewati, walaupun datang belakangan.
@starter
# tulis fungsi Anda di bawah baris ini

@check
defines("apply_events") ## Definisikan apply_events(events).
apply_events([{"key": 1, "lsn": 10, "value": "a"}, {"key": 1, "lsn": 20, "value": "b"}]) == {1: "b"} ## Perubahan yang lebih baru menang.
apply_events([{"key": 1, "lsn": 20, "value": "b"}, {"key": 1, "lsn": 10, "value": "a"}]) == {1: "b"} ## Datang tidak berurutan: event lama dilewati.
apply_events([{"key": 1, "lsn": 5, "value": "x"}, {"key": 1, "lsn": 5, "value": "x"}]) == {1: "x"} ## Duplikat hasil replay tidak mengubah apa pun.
apply_events([{"key": 1, "lsn": 1, "value": "a"}, {"key": 2, "lsn": 2, "value": "b"}]) == {1: "a", 2: "b"} ## Key saling independen.
@hint
Simpan dua dictionary: `latest_lsn` dan `replica`. Terapkan event hanya jika `lsn > latest_lsn.get(key, -1)`.
@solution
def apply_events(events):
    latest_lsn = {}
    replica = {}
    for e in events:
        if e["lsn"] > latest_lsn.get(e["key"], -1):
            latest_lsn[e["key"]] = e["lsn"]
            replica[e["key"]] = e["value"]
    return replica
:::

:::ask Mengapa replika dikunci dengan primary key dan mengingat posisi terakhir yang diterapkan per key?
@options
* replay dan event terlambat tak menimpa data baru
konsumen tak pernah perlu meng-commit offset
topic bisa dikompaksi sampai nol rekaman
@why
Pengiriman bersifat at-least-once dan konsumen restart serta rebalance, jadi event yang sama bisa datang dua kali atau terlambat. Melewati apa pun yang tidak lebih baru membuat penerapan event idempoten.
:::

## @lab Lab: mini Kafka, broker Kafka nyata, dan CDC dari WAL PostgreSQL nyata
Lab ini terbagi ke dalam tiga tingkatan yang dapat diuji secara terpisah: Bagian A membangun implementasi mini Kafka in-memory untuk menguasai semantik dasar commit log. Bagian B berinteraksi langsung dengan broker Kafka/Redpanda nyata (producer dengan idempotensi, consumer dengan manual offset commit, serta kalkulasi metrik lag). Bagian C mendecode aliran replikasi biner PostgreSQL nyata dan mengonsumsi event CDC ke dalam tabel replika yang idempoten terhadap replay dan pengacakan urutan event.

### @steps
> Sudah menyelesaikan Bagian A dan C lewat Jeda Praktik 1–3? Langsung loncat ke Langkah 3 (Bagian B broker nyata) dan Jeda Praktik 5 untuk membuat kode bukti.

1. Instal dependensi yang dibutuhkan (Bagian A hanya membutuhkan pytest):

```bash
python -m pip install -r labs/mod-3-2/requirements.txt
```

2. **Bagian A: Mini Commit Log.** Buka `labs/mod-3-2/minilog.py` dan implementasikan kelas `Topic` (manajemen partisi, operasi produce, pelacakan end offset, perhitungan lag, dan log compaction), fungsi `assign` (algoritma alokasi partisi range assignment), serta kelas `Consumer` (resume dari offset yang di-commit, operasi poll, dan commit). Jalankan pengujian otomatis via `pytest labs/mod-3-2/test_minilog.py -v`. Perhatikan pengujian skenario at-least-once di mana crash sebelum commit menghasilkan rekaman duplikat, dan bagaimana pengujian idempoten menangani anomali tersebut dengan sempurna.

> 💡 **Jeda Praktik 4 (Verifikasi Menyeluruh MiniLog):**
> 1. Di terminal, jalankan seluruh rangkaian uji Bagian A:
>    `pytest labs/mod-3-2/test_minilog.py -v`
> 2. Uji kesesuaian terhadap solusi referensi:
>    `LAB_DIR=reference pytest labs/mod-3-2/test_minilog.py -v`
> 3. **Indikator Sukses:** Seluruh 15 pengujian di `test_minilog.py` berstatus `PASSED` dalam < 0.1 detik murni Python tanpa server eksternal apa pun.

3. **Bagian B: Broker Kafka Riil.** Jalankan klaster Kafka atau Redpanda (beserta web UI-nya). Menggunakan Docker dari repositori course: jalankan perintah `docker compose up -d redpanda redpanda-console` (port eksternal `localhost:19092`). Implementasikan lima fungsi di `labs/mod-3-2/real_kafka.py` (`create_topic`, `topic_config`, `produce_orders`, `consume_with_manual_commit`, dan `group_lag`), lalu jalankan pengujian:

```bash
KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v
```

   Tanpa environment variable `KAFKA_BOOTSTRAP`, pengujian ini akan dilewati secara otomatis. Amati topic Anda melalui web console (Redpanda Console di http://localhost:8080) dan saksikan nilai consumer lag group bergerak dari 60 menjadi 0 setelah seluruh pesan dikonsumsi.
4. **Bagian C: CDC PostgreSQL.** Pelajari docstring modul `labs/mod-3-2/pgoutput.py` yang telah disediakan dan pahami alur decode binernya. Buka file kerja `labs/mod-3-2/cdc.py`, implementasikan fungsi `to_events`, `apply_events`, dan `materialize`, lalu jalankan suite pengujian via `pytest labs/mod-3-2/test_cdc.py -v` (di Python 3.14, ekspor `DATABASE_URL` ke container Docker PostgreSQL dari Prasyarat terlebih dahulu). Pengujian akan menyalakan instance embedded PostgreSQL dengan konfigurasi `wal_level=logical` (atau memakai `DATABASE_URL`), membuat publication dan replication slot, mengeksekusi operasi insert, update, delete, serta mutasi primary key, dan membandingkan integritas data tabel replika Anda dengan tabel sumber di database.
5. Eksplorasi mandiri: cetak pesan mutasi biner yang didecode untuk melihat perbedaan struktur payload dengan dan tanpa konfigurasi `REPLICA IDENTITY FULL`; aplikasikan event-event mutasi dalam urutan acak dan buktikan bahwa replika Anda menghasilkan kondisi akhir yang tetap identik; buka sesi terminal `psql`, buat slot baru secara manual, lakukan serangkaian transaksi tanpa membacanya, dan amati bagaimana view `pg_replication_slots` menahan akumulasi file segmen WAL di disk.
6. Opsional, menggunakan Docker: nyalakan seluruh stack dari repositori (`docker compose up -d --wait postgres redpanda redpanda-console connect`), daftarkan konfigurasi konektor Debezium menggunakan file `labs/mod-3-2/debezium-orders.json`, dan saksikan aliran event nyata tiba di Kafka saat Anda mengubah data pada tabel `orders` (bagian ini memakai Docker dan tidak tercakup tes otomatis; sudah diverifikasi manual pada Debezium 2.7 dan Redpanda):

```bash
curl -s -X POST -H 'Content-Type: application/json' --data @labs/mod-3-2/debezium-orders.json localhost:8083/connectors
docker compose exec postgres psql -U postgres -d production -c "UPDATE orders SET status='SHIPPED' WHERE order_id=1"
docker compose exec redpanda rpk topic consume shop.public.orders -o start
```

   Anda akan melihat tiga rekaman snapshot awal (`op: "r"`) untuk tiga baris data awal, disusul oleh event update (`op: "u"`), serta event tombstone pasca operasi delete. Ulangi eksperimen setelah menjalankan `ALTER TABLE orders REPLICA IDENTITY FULL` dan amati perbedaan isi atribut `before`. Buka Redpanda Console di browser untuk memantau metrik lag secara visual.
7. Opsional, dengan Docker (sekitar 1,5 GB memori): **rusak cluster sungguhan**. Nyalakan tiga broker Apache Kafka dengan `docker compose -f labs/mod-3-2/cluster/docker-compose.yml up -d`, tunggu sekitar 30 detik, dan jalankan alat Kafka di dalam sebuah broker:

```bash
K="docker exec df_kafka1 /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --create --topic orders --partitions 3 --replication-factor 3 --config min.insync.replicas=2
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --describe --topic orders           # siapa memimpin, siapa in-sync
docker kill df_kafka2                                                                  # crash sebuah broker
$K/kafka-topics.sh --bootstrap-server kafka1:9092 --describe --under-replicated-partitions
docker start df_kafka2                                                                 # saksikan kolom Isr pulih
docker compose -f labs/mod-3-2/cluster/docker-compose.yml down -v                      # bersihkan setelah selesai
```

   Sebelum mematikan broker, **prediksikan** `Leader` dan `Isr` baru tiap partisi, lalu bandingkan. Berikutnya buat topik dengan `--config min.insync.replicas=3`, matikan satu broker, dan produksi dengan `kafka-console-producer.sh ... --producer-property acks=all`; jelaskan `NOT_ENOUGH_REPLICAS` yang Anda dapat. Untuk schema registry, `docker compose up -d redpanda` juga membukanya di `localhost:8081`: daftarkan skema Avro dengan `POST /subjects/orders-value/versions`, lalu periksa perubahan yang tidak kompatibel lewat `POST /compatibility/subjects/orders-value/versions/latest` dan lihat jawabannya berubah ketika Anda mengatur `FORWARD` atau `FULL` dengan `PUT /config/orders-value`. (Bagian-bagian ini dijalankan manual terhadap Apache Kafka 4.0.0 dan Redpanda; tidak tercakup tes otomatis.)

> 💡 **Jeda Praktik 5 (Verifikasi Penuh Broker & CDC):**
> 1. Pastikan Redpanda berjalan (`docker compose up -d redpanda redpanda-console`) lalu jalankan pengujian broker Kafka nyata:
>    `KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v`
> 2. Hasilkan token bukti verifikasi (sertakan `KAFKA_BOOTSTRAP` agar `prove.py` memverifikasi Bagian B bersama Bagian A dan C; di Python 3.14 pertahankan `DATABASE_URL` tetap terekspor):
>    `KAFKA_BOOTSTRAP=localhost:19092 python3 scripts/prove.py mod-3-2`
> 3. **Indikator Sukses:** Seluruh 27 pengujian (15 Bagian A + 4 Bagian B + 8 Bagian C) berstatus `PASSED` dan token bukti kelulusan dicetak ke terminal.

### @files
- labs/mod-3-2/minilog.py :: File kerja Bagian A: implementasi mini Kafka in-memory :: starter
- labs/mod-3-2/test_minilog.py :: Suite pengujian Bagian A (15 pengujian) :: test
- labs/mod-3-2/real_kafka.py :: File kerja Bagian B: interaksi dengan broker Kafka nyata :: starter
- labs/mod-3-2/test_real_kafka.py :: Suite pengujian Bagian B (4 pengujian; membutuhkan KAFKA_BOOTSTRAP) :: test
- labs/mod-3-2/pgoutput.py :: Pustaka parser decoding biner replikasi logis PostgreSQL bawaan :: data
- labs/mod-3-2/cluster/docker-compose.yml :: Opsional: cluster Kafka tiga broker sungguhan untuk dirusak dengan sengaja :: config
- labs/mod-3-2/cdc.py :: File kerja Bagian C: transformasi event CDC dan replika idempoten :: starter
- labs/mod-3-2/test_cdc.py :: Suite pengujian Bagian C (8 pengujian) :: test
- labs/mod-3-2/debezium-orders.json :: Konfigurasi konektor Debezium PostgreSQL untuk stack Docker (langkah 6) :: config
- labs/mod-3-2/requirements.txt :: Konfigurasi pustaka dependensi lab :: config
- labs/mod-3-2/reference/minilog.py :: Solusi referensi Bagian A (coba kerjakan mandiri terlebih dahulu!) :: reference
- labs/mod-3-2/reference/real_kafka.py :: Solusi referensi Bagian B :: reference
- labs/mod-3-2/reference/cdc.py :: Solusi referensi Bagian C :: reference

### @deliverables
- Bagian A: seluruh 15 pengujian di `test_minilog.py` lulus dengan sukses
- Bagian B: seluruh 4 pengujian di `test_real_kafka.py` lulus terhadap broker nyata
- Bagian C: seluruh 8 pengujian di `test_cdc.py` lulus, termasuk skenario replay dan pengacakan urutan event
- Mampu menjelaskan fungsi koordinat posisi `(lsn, seq)`, perbedaan payload event delete dengan dan tanpa `REPLICA IDENTITY FULL`, serta mekanisme bagaimana CDC consumer yang macet dapat melumpuhkan database produksi sumber

### @verify
```bash
pytest labs/mod-3-2/test_minilog.py labs/mod-3-2/test_cdc.py -v
KAFKA_BOOTSTRAP=localhost:19092 pytest labs/mod-3-2/test_real_kafka.py -v
KAFKA_BOOTSTRAP=localhost:19092 python3 scripts/prove.py mod-3-2
```

Verifikasi terhadap kode referensi: tambahkan prefix `LAB_DIR=reference`.

## @chaos Replication slot yang memenuhi seluruh kapasitas disk produksi
### @scenario
Konektor Debezium CDC KopiKu bertugas mereplikasi tabel transaksi `orders` ke Apache Kafka secara real-time. Pada Jumat malam, salah satu kontainer worker Kafka Connect direstart untuk pembaruan patch sistem operasi, namun kontainer tersebut gagal menyala kembali; insiden ini tidak disadari oleh tim mana pun karena dashboard bisnis masih menampilkan data transaksi (meski data tersebut berumur 24 jam) dan notifikasi peringatan konektor terkirim ke kanal Slack tim data yang tidak dipantau selama akhir pekan.

Pada Minggu malam, server database utama PostgreSQL produksi tiba-tiba menolak seluruh transaksi penulisan baru: kapasitas storage disk yang menampung direktori data utama dilaporkan penuh 100%. Alur checkout pelanggan di aplikasi lumpuh total. Tim Database Administrator (DBA) yang melakukan investigasi menemukan bahwa direktori `pg_wal` membengkak hingga menyedot 410 GB ruang disk akibat tumpukan ribuan file segmen WAL yang tertahan.

### @cause
Replication slot logis di PostgreSQL terikat langsung pada konektor Debezium. Engine PostgreSQL diwajibkan secara internal untuk mempertahankan seluruh file segmen WAL yang belum dikonfirmasi posisinya oleh replication slot tersebut, karena sistem berasumsi sang konsumen sewaktu-waktu akan kembali aktif dan membutuhkannya. Karena konektor Debezium mati selama dua hari penuh, slot tidak pernah mengonfirmasi pembacaan baru, sehingga seluruh file WAL hasil transaksi normal akhir pekan menumpuk tanpa pernah dibersihkan hingga memenuhi seluruh kapasitas disk. Di sisi lain, parameter `max_slot_wal_keep_size` dibiarkan pada nilai default `-1`, yang berarti *tanpa batas retensi maksimum*.

(Efek ini mudah direproduksi: di lab, slot yang tidak dibaca menahan 118 MB WAL hanya setelah 450.000 perubahan baris.) Pipa analitik data hilir yang seharusnya hanya membaca data pasif secara tidak sengaja melumpuhkan sistem transaksional operasional yang menjadi urat nadi bisnis perusahaan.

### @fix
1. **Tindakan Darurat (Immediate)**: kosongkan ruang disk secara aman. Menghapus replication slot yang bermasalah (`SELECT pg_drop_replication_slot('debezium_orders')`) akan langsung membebaskan file-file segmen WAL yang tertahan sehingga database produksi dapat kembali menerima transaksi, dengan konsekuensi konektor CDC nantinya harus melakukan **snapshot ulang dari awal**.
2. Tetapkan nilai batas aman pada parameter `max_slot_wal_keep_size` (misalnya dialokasikan sebesar batas kuota persentase disk tertentu), sehingga slot yang macet akan otomatis diinvalidasi oleh PostgreSQL *sebelum* kapasitas disk habis dan melumpuhkan database produksi (pengambilan snapshot ulang jauh lebih dapat diterima daripada downtime sistem checkout).
3. **Pasang pemantauan dan alert terpusat pada metrik slot lag dan status konektor** yang diarahkan ke kanal siaga on-call 24/7: pantau metrik `pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)` pada setiap slot, serta utilisasi ruang disk volume WAL.
4. Perlakukan layanan CDC connector sebagai **layanan tier-1 berstatus produksi** yang dilengkapi infrastruktur redundansi otomatis dan runbook insiden; kirimkan sinyal event heartbeat berkala agar slot tetap memperbarui posisinya meskipun tabel sedang sepi transaksi.
5. Gelar sesi evaluasi post-mortem dan lakukan simulasi berkala: matikan konektor di staging environment untuk memvalidasi bahwa sistem pemantauan dan alert darurat berfungsi dengan benar.

### @pattern
Replication slot adalah janji komitmen penyimpanan dari database sumber. CDC consumer yang berhenti tidak sekadar mengalami keterlambatan data: ia berpotensi menghabiskan seluruh kapasitas disk server sumber. Batasi ukurannya, pantau metrik lag-nya, dan siapkan peringatan darurat.

## @quiz
### Pada Apache Kafka, apa fungsi utama dari sebuah message key?
- [ ] Menentukan consumer spesifik mana di dalam consumer group yang akan menerima pesan tersebut
- [x] Menentukan partisi mana yang akan dituju, sehingga pesan-pesan dengan key yang sama dijamin tiba secara terurut
- [ ] Menentukan durasi berapa lama pesan tersebut akan dipertahankan oleh broker sebelum akhirnya dihapus oleh aturan retensi
- [ ] Menentukan apakah producer harus menunggu konfirmasi acknowledgement dari seluruh follower replica di partisi tersebut

> Nilai key di-hash untuk menentukan nomor partisi tujuan. Kafka menjamin keterurutan data di dalam partisi yang sama, sehingga pesan-pesan yang memiliki key yang sama selalu dikonsumsi sesuai urutan produksinya.

### Seorang consumer meng-commit offset-nya SEBELUM memproses setiap pesan dan mengalami crash di tengah eksekusi batch. Apa konsekuensi yang akan terjadi?
- [ ] Sebagian pesan akan diproses sebanyak dua kali, karena offset baru di-commit setelah data selesai ditangani
- [x] Sebagian pesan tidak akan pernah diproses sama sekali, karena offset-nya sudah telanjur ditandai selesai di broker
- [ ] Tidak terjadi masalah apa pun, karena broker menyimpan salinan cadangan pesan hingga berhasil diproses dengan benar
- [ ] Seluruh isi topic akan diputar ulang dari offset nol, karena consumer group kehilangan seluruh riwayat offset-nya

> Melakukan commit sebelum pemrosesan menghasilkan jaminan at-most-once delivery: offset yang sudah ditandai selesai mungkin merujuk pada pesan yang belum sempat diproses saat crash terjadi. Lakukan commit setelah pemrosesan untuk jaminan at-least-once.

### Mengapa pola "at-least-once delivery dengan pemrosesan idempoten" menjadi standar desain yang paling umum di industri?
- [ ] Kafka tidak mampu mengirimkan pesan lebih dari satu kali, sehingga tahap pemrosesan data harus selalu dibuat sangat cepat
- [ ] Menghilangkan kebutuhan untuk melakukan commit offset sama sekali, karena kode idempoten tidak pernah perlu di-restart ulang
- [x] Duplikasi pesan menjadi tidak berbahaya, karena memproses rekaman yang sama dua kali menghasilkan kondisi akhir sama
- [ ] Menjamin bahwa seluruh pesan dikirimkan dalam urutan waktu global yang seragam ke seluruh consumer group yang ada

> Kegagalan crash memicu pengiriman ulang pesan. Jika logika pemrosesan bersifat upsert atau terikat pada kunci (partition, offset), eksekusi berulang tidak akan mengubah hasil akhir, memberikan efek exactly-once murni.

### Sebuah topic memiliki 6 partisi dan sebuah consumer group memiliki 10 anggota aktif. Berapa banyak anggota consumer group yang akan menerima aliran data?
- [ ] Kesepuluh anggota, karena broker membagi setiap partisi menjadi potongan-potongan lebih kecil untuk dibagikan ke seluruh anggota
- [ ] Sepuluh anggota, namun masing-masing anggota hanya menerima sebagian kecil pesan dari partisi yang dialokasikan kepadanya
- [x] Enam anggota: tiap partisi dialokasikan ke tepat satu anggota group, sehingga empat anggota sisanya menganggur
- [ ] Hanya satu anggota, karena consumer group selalu membaca data dari satu partisi tunggal pada satu waktu

> Di dalam satu consumer group, satu partisi hanya dikonsumsi oleh satu anggota pada satu waktu, sehingga batas paralelisme group ditentukan oleh jumlah partisi topic.

### Apa yang dimaksud dengan metrik consumer lag pada Apache Kafka?
- [ ] Durasi waktu yang dibutuhkan oleh consumer untuk membuka koneksi soket jaringan pertama ke broker saat aplikasi mulai menyala
- [ ] Jumlah pesan yang telah diantrekan secara lokal di memori producer sebelum akhirnya dikirimkan secara fisik ke broker
- [x] Untuk setiap partisi, selisih antara log end offset pada broker dikurangi offset terakhir yang di-commit oleh consumer group
- [ ] Perbedaan jam penunjuk waktu (clock drift) antara server mesin producer dengan server mesin consumer

> Consumer lag menunjukkan seberapa jauh sebuah consumer group tertinggal di belakang producer. Lag adalah metrik kesehatan utama: kenaikan lag menandakan consumer bekerja lebih lambat daripada laju kedatangan data.

### Pada konfigurasi default `REPLICA IDENTITY` di PostgreSQL, informasi apa yang terkandung di dalam event DELETE hasil logical decoding?
- [ ] Baris data yang dihapus secara lengkap mencakup seluruh kolomnya, persis sama seperti payload pada event insert
- [ ] Hanya memuat ID transaksi database dan waktu eksekusi delete, tanpa memuat informasi baris data sama sekali
- [x] Hanya kolom-kolom yang menyusun primary key dari baris yang dihapus; nilai kolom-kolom lainnya tidak disertakan
- [ ] Kondisi tampilan baris data setelah operasi delete berhasil dieksekusi, yang bersesuaian dengan baris data kosong

> Tanpa konfigurasi REPLICA IDENTITY FULL, rekaman baris lama pada event delete (atau update yang mengubah primary key) hanya membawa nilai kunci. Aktifkan konfigurasi FULL jika aplikasi consumer hilir membutuhkan rekaman before-image yang utuh.

### Mengapa consumer CDC yang idempoten wajib mencatat koordinat posisi (lsn, seq) dari event terakhir yang diaplikasikan untuk setiap kunci data?
- [ ] Untuk mengompresi ukuran payload event sehingga tabel replika membutuhkan kapasitas disk yang lebih kecil daripada database sumber
- [ ] Untuk menentukan hak akses pengguna database mana yang diizinkan untuk membaca replication slot di server sumber
- [x] Untuk mengabaikan rekaman duplikat dan event masa lalu yang tiba terlambat, sehingga pemutaran ulang log tidak merusak data
- [ ] Untuk mengkalkulasi metrik lag tabel replika, yang tidak dapat diukur menggunakan metode lainnya selain cara tersebut

> Membandingkan koordinat posisi setiap event terhadap posisi terakhir yang tercatat membuat proses replay kebal terhadap anomali duplikasi dan pengacakan urutan kedatangan pesan. Operasi delete tetap menyimpan posisinya agar event insert usang tidak membangkitkan data yang sudah dihapus.

### Mengapa konektor CDC yang berhenti berjalan berpotensi melumpuhkan server database PostgreSQL sumber?
- [ ] Konektor mempertahankan exclusive table lock pada seluruh tabel yang direplikasi selama konektor berada dalam status offline
- [x] Replication slot menahan seluruh file segmen WAL yang belum dikonfirmasi pembacaannya, sehingga WAL menumpuk hingga kapasitas disk habis
- [ ] Database server akan melakukan restart berulang kali secara otomatis jika klien replikasi gagal menyambung kembali dalam batas waktu tertentu
- [ ] Topic di Kafka mengirimkan sinyal backpressure balik ke server sumber yang mengakibatkan kehabisan memori pada proses database

> Replication slot logis menahan file segmen WAL hingga dikonfirmasi oleh consumer. Downtime berkepanjangan menyebabkan WAL menumpuk di server produksi. Batasi risikonya dengan max_slot_wal_keep_size dan pasang alarm pemantauan slot lag.

### Sebuah topik punya replication factor 3 dan `min.insync.replicas=2`. Producer memakai `acks=all`. Satu broker crash. Apa ekspektasi yang benar?
- [ ] Penulisan berhenti, karena Kafka mewajibkan ketiga replika hidup sebelum menerima data apa pun
- [x] Penulisan berlanjut dan record yang sudah di-acknowledge selamat, karena dua replika tetap in-sync
- [ ] Penulisan berlanjut, tetapi record yang sudah di-acknowledge dan disimpan broker mati itu hilang selamanya
- [ ] Penulisan berhenti sampai operator memilih leader baru, karena follower tidak pernah dipromosikan otomatis

> Dengan dua replika in-sync tersisa, ISR masih memenuhi batas bawah 2. Follower yang sudah menyusul menjadi leader dan producer mencoba ulang. Kami mengukur jeda 7,5 detik, tanpa record hilang dan tanpa duplikat.

### Sebuah tim harus menambah field `channel` ke skema Avro yang terdaftar dengan kompatibilitas BACKWARD tanpa merusak consumer yang ada. Perubahan mana yang diterima registry?
- [ ] Field wajib `channel` tanpa nilai default, karena setiap record baru toh akan memuat field itu
- [ ] Mengganti nama field `customer` menjadi `channel`, selama tipe field itu tetap string
- [x] Field opsional `channel` dengan default null, agar record yang ditulis tanpanya tetap bisa dibaca
- [ ] Mengubah `total` dari `int` menjadi `string`, karena string bisa memuat bilangan bulat apa pun sebagai teks

> Pada BACKWARD, pembaca baru harus bisa membaca data lama, sehingga field baru butuh default. Kami melihat registry menerima field opsional dan menjawab HTTP 409 untuk field wajib tanpa default.

## @resources
- [Dokumentasi Resmi Apache Kafka](https://kafka.apache.org/documentation/)
- [Dokumentasi Platform Debezium](https://debezium.io/documentation/)
- [Dokumentasi PostgreSQL: Replikasi Logis](https://www.postgresql.org/docs/current/logical-replication.html)
- [Dokumentasi PostgreSQL: Logical Decoding](https://www.postgresql.org/docs/current/logicaldecoding.html)
- [Dokumentasi Client Python confluent-kafka](https://docs.confluent.io/kafka-clients/python/current/overview.html)

