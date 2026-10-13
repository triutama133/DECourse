---
title: Transformasi dengan dbt: SQL Model, Pengujian, dan Pemuatan Inkremental
duration: 3 minggu
summary: Bangun lapisan transformasi data teruji dan terdokumentasi menggunakan dbt: model staging dan mart, pengujian kualitas data, model inkremental yang tangguh terhadap data yang terlambat berubah, dan snapshot histori SCD Tipe 2, lalu jalankan dua kali dan buktikan eksekusi kedua menghasilkan angka yang presisi.
why: Banyak tutorial dbt hanya memperlihatkan pembuatan beberapa model sederhana tanpa pengujian data sama sekali. Di dunia kerja nyata, data mentah berubah setelah dimuat, model inkremental diam-diam menghasilkan angka usang, dan tidak ada yang menyadarinya sampai laporan di meja direksi menampilkan data yang keliru.
---

## @outcomes
- Menjelaskan fungsi (dan batasan) dbt dalam arsitektur ELT modern, serta menyusun struktur folder proyek yang rapi ke dalam lapisan sources, staging, dan marts
- Menulis model SQL modular memanfaatkan fungsi Jinja `ref()` dan `source()`, memilih materialisasi yang tepat, serta membaca output log `dbt build`
- Menerapkan pengujian generic dan singular test dengan tingkat severity yang proporsional, serta mengonfigurasi dokumentasi dan freshness check
- Merancang model inkremental yang tangguh terhadap pembaruan data dan mutasi yang datang terlambat (late-arriving data), serta menjelaskan mengapa logika "hanya filter tanggal baru" berbahaya
- Membangun tabel histori SCD Tipe 2 menggunakan dbt snapshot, dan menerapkan mekanisme slim CI agar pull request hanya menguji model yang terdampak perubahan

## @prereq
Modul 1.3 dan 1.4 (window function, pemodelan dimensional) serta Modul 2.1 (DuckDB). Jalankan `pip install -r labs/mod-2-3/requirements.txt` untuk memasang dbt Core beserta adapter DuckDB; tidak memerlukan akun cloud data warehouse.

## @lesson Paradigma ELT dan posisi strategis dbt
Modul 0.1 telah memperkenalkan pendekatan **ELT**: muat data mentah ke dalam storage/warehouse terlebih dahulu, baru kemudian lakukan transformasi data *di dalam* warehouse menggunakan SQL. Pendekatan ini sangat efektif (daya komputasi warehouse murah dan scalable, serta data mentah asli selalu terjaga utuh), namun menyisakan tantangan praktis di lapangan. Lapisan transformasi yang ditulis sebagai tumpukan skrip SQL mentah sangat rapuh: tidak ada yang tahu urutan dependensi antar-skrip, urutan eksekusi mana yang benar, apakah hasil tabel valid, atau apa arti bisnis dari kolom-kolom tertentu.

**dbt** (data build tool) membawa praktik rekayasa perangkat lunak (software engineering) ke dalam lapisan SQL tersebut. Anda menulis setiap transformasi sebagai sebuah **model**: satu perintah `SELECT` mandiri di dalam satu file berekstensi `.sql`. dbt kemudian secara otomatis:

- Menyusun **grafik dependensi berarah (DAG - Directed Acyclic Graph)** dari relasi antar-model, dan mengeksekusinya dalam urutan yang tepat;
- Melakukan **materialisasi (materialization)** dari setiap model menjadi SQL view atau tabel fisik (termasuk tabel inkremental) dengan membungkus query `SELECT` Anda ke dalam sintaks DDL `CREATE ... AS`;
- Menjalankan **pengujian kualitas data (data tests)** terhadap tabel hasil transformasi, serta menerbitkan **dokumentasi interaktif** lengkap dengan visualisasi data lineage;
- Mendukung pemisahan **lingkungan (environments)**, sehingga kode SQL yang sama persis dapat dibangun di skema pengembang lokal, lingkungan CI GitHub Actions, maupun lingkungan produksi;
- Mengelola seluruh kode di dalam **sistem kontrol versi Git**: ditinjau melalui pull request, berversi, dan dapat direproduksi kapan saja.

Hal yang *tidak* dilakukan oleh dbt: dbt tidak mengekstrak atau memuat data dari API/database sumber (alat terpisah seperti Airbyte atau Flink bertugas membawa data mentah masuk; Modul 2.4 akan mengorkestrasi keduanya) dan dbt tidak menyimpan data atau menghitung komputasi sendiri. dbt menerjemahkan kode Anda menjadi query SQL murni dan mengirimkannya ke mesin data warehouse Anda (Snowflake, BigQuery, PostgreSQL, DuckDB, dll melalui **adapter**). **dbt Core** adalah tool command-line sumber terbuka (open-source) yang kita gunakan di kursus ini; dbt Cloud menambahkan antarmuka web dan orkestrasi terkelola di atasnya.

Contoh satu model dbt utuh:

```sql
-- models/marts/dim_customers.sql
select
    customer_id,
    full_name,
    coalesce(city, 'Unknown') as city,
    tier
from {{ ref('stg_customers') }}
```

Sintaks kurung kurawal ganda `{{ ... }}` adalah **Jinja**, bahasa templating yang dievaluasi oleh dbt sebelum SQL dikirim ke engine. Pemanggilan `ref('stg_customers')` menjalankan dua fungsi krusial: pertama, menerjemahkan nama tabel menjadi nama fisik yang sesuai dengan lingkungan saat ini (`dev_alice.stg_customers` atau `analytics.stg_customers`), dan kedua, mencatat dependensi ke dalam DAG sehingga dbt menjamin model `stg_customers` selesai dibangun sebelum `dim_customers` mulai dieksekusi.

## @lesson Anatomi proyek dbt dan perintah-perintah CLI inti
Struktur direktori standar proyek dbt:

```text
kopiku_dbt/
  dbt_project.yml        nama proyek, struktur folder, konfigurasi bawaan per folder
  profiles.yml           koneksi database (di proyek nyata disimpan di luar git; lab memakai env var)
  models/
    sources.yml          deklarasi tabel mentah yang dibaca dbt namun tidak dibuat oleh dbt
    staging/             stg_*.sql  (+ file schema.yml berisi tes dan deskripsi)
    marts/               dim_*.sql, fct_*.sql
  snapshots/             tabel histori perubahan data (SCD Tipe 2)
  tests/                 singular tests: file SQL kustom yang mengembalikan baris yang rusak
  macros/                fungsi Jinja modular yang dapat digunakan berulang
```

Dua fungsi utama yang menghubungkan kode SQL ke dalam grafik DAG:

- **`source('raw', 'orders')`** merujuk ke tabel mentah yang tidak dibuat oleh dbt (dimuat oleh pipeline ingestion eksternal). Deklarasi tabel sumber di `sources.yml` mendokumentasikan skema, memusatkan nama tabel di satu tempat, dan memungkinkan dbt memeriksa keterbaruan data (**freshness check**).
- **`ref('model')`** merujuk ke model dbt lain di dalam proyek, seperti yang telah dijelaskan di atas.

Daftar perintah CLI dbt yang akan rutin Anda gunakan:

| Perintah | Fungsi Eksekusi |
|---|---|
| `dbt run` | Membangun seluruh model (membuat view/tabel fisik di database) |
| `dbt test` | Menjalankan seluruh pengujian kualitas data |
| `dbt build` | Menjalankan model, tes, snapshot, dan seed **dalam urutan dependensi DAG**, otomatis melewati (skip) model turunan jika model induk gagal |
| `dbt compile` | Menerjemahkan template Jinja menjadi query SQL murni tanpa menjalankannya (`target/compiled/`) |
| `dbt ls --select ...` | Menampilkan daftar model yang cocok dengan kriteria seleksi |
| `dbt docs generate` | Menerbitkan website dokumentasi interaktif dan diagram lineage grafis |

Anda dapat memilih sub-grafik tertentu menggunakan argumen flag `--select`: `stg_orders` (satu model saja), `stg_orders+` (model tersebut beserta seluruh model hilir yang bergantung padanya), `+fct_daily_revenue` (model tersebut beserta seluruh model hulu yang dibutuhkannya), `tag:daily`, atau `state:modified+` (hanya model yang kodenya berubah dibanding rilis produksi; lihat panduan CI di bawah). Output dari eksekusi build pertama proyek KopiKu:

```text
Done. PASS=21 WARN=1 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=22
```

Dua puluh dua entitas dieksekusi: tujuh model (empat view, tiga tabel, salah satunya tabel inkremental), satu snapshot histori, dan empat belas pengujian data. Jika ada satu model yang gagal kompilasi atau tesnya bernilai error, perintah `dbt build` secara cerdas menandai model dan pengujian di hilirnya sebagai `SKIP`, sehingga data yang rusak tidak akan pernah mengalir mencemari lapisan data mart pelaporan.

> 💡 **Jeda Praktik 1 (Eksplorasi CLI & Struktur Proyek):**
> 1. Aktifkan virtual environment di terminal: `source .venv/bin/activate`.
> 2. Siapkan data mentah KopiKu dan buat database DuckDB:
>    `python3 labs/shared/shopgen.py --out data`
>    `export KOPIKU_DB=$PWD/kopiku.duckdb`
>    `python3 labs/mod-2-3/load_raw.py data $KOPIKU_DB`
> 3. Pindai seluruh model dan sumber data dbt yang telah dideklarasikan tanpa mengeksekusi transformasi:
>    `dbt ls --project-dir labs/mod-2-3/kopiku_dbt --profiles-dir labs/mod-2-3/kopiku_dbt`
> 4. **Indikator Sukses:** Terminal menampilkan ringkasan `Found 7 models, 1 snapshot, 14 data tests, 5 sources` beserta daftar lengkap model staging, mart, dan test.

## @lesson Arsitektur lapisan model dan strategi materialisasi
Konvensi arsitektur yang telah terbukti keandalannya di ribuan perusahaan teknologi membagi model ke dalam tiga lapisan:

1. **Staging** (`stg_`): satu model per tabel sumber, berfungsi sebagai lapisan pembersihan awal yang ramping. Bertugas mengganti nama kolom, casting tipe data, standardisasi format string, deduplikasi rekaman identik, dan memilih versi terbaru dari setiap entitas. Lapisan ini tidak boleh memuat logika bisnis rumit atau join antar-tabel. Dimaterialisasikan sebagai **view** (ringan, tanpa biaya penyimpanan, dan selalu mencerminkan data sumber terbaru).
2. **Intermediate** (`int_`, opsional): lapisan perantara yang modular untuk menggabungkan atau menyederhanakan logika transformasi sebelum masuk ke mart.
3. **Marts** (`dim_`, `fct_`): entitas bisnis final yang siap dikonsumsi langsung oleh analis dan dashboard BI, dirancang mengikuti kaidah star schema Modul 1.4. Dimaterialisasikan sebagai **tabel fisik** (atau tabel inkremental) demi kecepatan respon query analitik.

(Pola ini selaras dengan arsitektur *Medallion*: data mentah adalah Bronze, staging dan intermediate adalah Silver, dan marts adalah Gold. Yang terpenting adalah menjaga batas tanggung jawab tiap lapisan dan memastikan arah dependensi selalu satu arah dari hulu ke hilir.)

Opsi **Materialisasi** menentukan bagaimana dbt menyimpan hasil query di database:

| Tipe Materialisasi | Format Penyimpanan | Biaya Saat `dbt run` | Performa Query Analis | Kasus Penggunaan Ideal |
|---|---|---|---|---|
| `view` | SQL View tersimpan | Nol | Query dihitung ulang tiap kali diakses | Staging, transformasi ringan |
| `table` | Tabel fisik utuh | Membangun ulang seluruh tabel tiap run | Sangat cepat | Marts berukuran kecil s.d. menengah |
| `incremental` | Tabel fisik yang diperbarui bertahap | Hanya memproses data baru/berubah | Sangat cepat | Tabel fakta transaksi berukuran masif |
| `ephemeral` | Disisipkan sebagai CTE inline | Nol | Bagian dari query hilir | Logika helper kecil yang tidak perlu jadi tabel |

Konfigurasikan nilai bawaan per direktori di file `dbt_project.yml` (`staging: +materialized: view`) dan override pada model tertentu menggunakan blok konfigurasi `{{ config(materialized='incremental') }}`.

**Model staging nyata** dari lab KopiKu. Tabel mentah `orders` bersifat append-only: pembaruan status pesanan tiba sebagai *baris baru* dengan timestamp `_loaded_at` yang lebih baru. Staging bertugas mengambil versi terkini dari tiap order dan membersihkan kekacauan format teks:

```sql
with ranked as (
    select
        order_id::bigint as order_id,
        coalesce(try_strptime(order_ts, '%Y-%m-%dT%H:%M:%S'),
                 try_strptime(order_ts, '%d/%m/%Y %H:%M')) as order_ts,
        lower(trim(status)) as status,
        try_cast(replace(regexp_replace(total_idr, '^\s*[Rr][Pp]\s*', ''), '.', '') as bigint) as total_idr,
        _loaded_at,
        row_number() over (partition by order_id order by _loaded_at desc) as rn   -- versi terbaru menang (Modul 1.3)
    from {{ source('raw', 'orders') }}
)
select order_id, order_ts, cast(order_ts as date) as order_date, status, total_idr, _loaded_at
from ranked
where rn = 1 and order_ts is not null and total_idr > 0
```

Fungsi `try_strptime` dan `try_cast` mengembalikan nilai NULL alih-alih melempar error saat menghadapi input string yang rusak, memungkinkan Anda memfilter atau mengisolasi data anomali secara terkendali. (Dialek SQL bervariasi: Snowflake menggunakan `try_to_timestamp`, BigQuery menggunakan `safe_cast`. Kita dapat menyatukannya melalui macro Jinja).

> 💡 **Jeda Praktik 2 (Membangun Model Staging):**
> 1. Buka teks editor Anda (VS Code / Cursor), navigasikan ke file `labs/mod-2-3/kopiku_dbt/models/staging/stg_orders.sql` dan `labs/mod-2-3/kopiku_dbt/models/staging/stg_customers.sql` (jangan mengeksekusi file `.sql` langsung di bash terminal).
> 2. Terapkan pembersihan data sesuai panduan materi: gunakan CTE `ranked` dengan `row_number() over (partition by order_id order by _loaded_at desc)` untuk mengambil baris versi terkini, serta standardisasi format string dan casting angka rupiah.
> 3. Jalankan kompilasi dan materialisasi khusus untuk lapisan staging:
>    `dbt run --select staging --project-dir labs/mod-2-3/kopiku_dbt --profiles-dir labs/mod-2-3/kopiku_dbt`
> 4. **Indikator Sukses:** Log dbt menampilkan status `OK created sql view model staging.stg_orders` dan `staging.stg_customers` tanpa syntax error.

## @lesson Pengujian otomatis dan dokumentasi: membangun kepercayaan data
Fitur testing dbt mengubah harapan verbal "data ini seharusnya tidak boleh duplikat" menjadi kode program teruji yang otomatis dievaluasi pada setiap proses build. Terdapat dua kategori pengujian:

**Generic Tests**, dideklarasikan di dalam file YAML tepat di samping model bersangkutan, adalah pengujian berparameter yang disediakan bawaan oleh dbt:

```yaml
models:
  - name: stg_orders
    columns:
      - name: order_id
        data_tests: [unique, not_null]
      - name: status
        data_tests:
          - accepted_values:
              arguments:
                values: [paid, shipped, delivered, cancelled, refunded]
  - name: fct_order_items
    columns:
      - name: customer_id
        data_tests:
          - relationships:
              arguments: { to: ref('dim_customers'), field: customer_id }
              config: { severity: warn }
```

Tes `unique` dan `not_null` menguji integritas kunci utama; `accepted_values` memvalidasi himpunan status yang sah; `relationships` menguji integritas referensial foreign key (memastikan setiap pelanggan di tabel fakta benar-benar terdaftar di dimensi pelanggan). Secara teknis, setiap tes dbt adalah query SQL yang **mengembalikan baris-baris data yang melanggar aturan**; tes dinyatakan lolos (PASS) jika query tersebut mengembalikan 0 baris.

**Singular Tests** adalah query SQL kustom Anda sendiri yang disimpan di dalam folder `tests/`, yang juga bertugas mengembalikan baris data anomali:

```sql
-- tests/assert_line_total_matches_qty_times_price.sql
select order_id, line_no
from {{ ref('fct_order_items') }}
where line_total_idr <> qty * unit_price_idr
```

**Tingkat Keparahan (Severity)** adalah keputusan perancangan: level `error` (default) akan menggagalkan build dan melewati model-model hilirnya; level `warn` mencatat temuan peringatan dan tetap melanjutkan eksekusi. Gunakan `error` untuk pelanggaran fatal yang merusak integritas angka (seperti primary key duplikat), dan gunakan `warn` untuk anomali yang perlu **dipantau tanpa memblokir operasional bisnis**. Pada lab praktis, pengujian `relationships` memunculkan peringatan `WARN 32`: 32 baris pesanan milik pelanggan yatim yang belum terdaftar di master data pelanggan (kasus yang sama seperti di Modul 1.4). Menghentikan seluruh pipeline harian karena anomali minor ini akan merugikan bisnis; namun mendiamkannya tanpa pemantauan jauh lebih berbahaya. Konfigurasi `store_failures: true` dapat diaktifkan agar baris-baris yang gagal otomatis disimpan ke dalam tabel audit untuk diinvestigasi.

Pengujian penting lainnya: **Source Freshness** (`freshness: {warn_after: {count: 12, period: hour}}` dengan kolom `loaded_at_field` memicu alarm jika data mentah tidak diperbarui melebihi batas waktu), **Unit Tests** (sejak dbt 1.8: menguji logika transformasi model menggunakan mock data kecil independen), dan **Model Contracts** (`contract: {enforced: true}` yang menjamin skema kolom output model tidak berubah, melindungi konsumen hilir dari schema drift; dibahas mendalam di Modul 2.5).

**Dokumentasi Terintegrasi** hidup berdampingan dengan kode: atribut `description:` pada file YAML otomatis dirangkum oleh perintah `dbt docs generate` menjadi website dokumentasi interaktif lengkap dengan **lineage graph** yang memperlihatkan peta aliran data hulu ke hilir. Sebuah model yang tidak memiliki dokumentasi definisi grain dianggap belum selesai dikerjakan.

> 💡 **Jeda Praktik 3 (Pengujian Kualitas Data & Singular Tests):**
> 1. Buka teks editor Anda, tinjau deklarasi tes di file `labs/mod-2-3/kopiku_dbt/models/staging/schema.yml` dan `labs/mod-2-3/kopiku_dbt/models/marts/schema.yml`. Perhatikan aturan `unique`, `not_null`, serta `relationships` dengan `config: { severity: warn }` pada customer.
> 2. Buka file singular test `labs/mod-2-3/kopiku_dbt/tests/assert_line_total_matches_qty_times_price.sql` untuk memastikan tidak ada item pesanan yang nilai totalnya tidak sama dengan perkalian kuantitas dan harga satuan.
> 3. Jalankan pengujian di terminal:
>    `dbt test --project-dir labs/mod-2-3/kopiku_dbt --profiles-dir labs/mod-2-3/kopiku_dbt`
> 4. **Indikator Sukses:** Seluruh pengujian menghasilkan `PASS` dengan tepat 1 `WARN` (32 pelanggan yatim yang terpantau tanpa menggagalkan pipeline).

## @lesson Model inkremental: titik rawan hilangnya kebenaran data
Model berjenis tabel fisik membangun ulang seluruh isi data pada setiap kali dijalankan. Ketika tabel fakta telah mencapai miliaran baris transaksi, membangun ulang dari awal menjadi sangat lambat dan memboroskan biaya komputasi. **Model inkremental (incremental model)** hanya memproses data baru atau data yang berubah sejak proses terakhir dan menyisipkannya ke tabel yang sudah ada:

```sql
{{ config(materialized='incremental', unique_key='order_date', incremental_strategy='delete+insert') }}

select ...
from {{ ref('fct_order_items') }}
{% if is_incremental() %}
where <hanya data yang baru atau berubah sejak run terakhir>
{% endif %}
```

- Fungsi `is_incremental()` bernilai `true` saat tabel target sudah terbentuk di database dan perintah dijalankan tanpa flag `--full-refresh`.
- Objek `{{ this }}` merujuk langsung ke tabel target yang sedang dibangun, memungkinkan Anda mengecek "apa nilai timestamp tertinggi yang sudah tersimpan di tabel ini?" (konsep **watermark**).
- Atribut `unique_key` beserta **incremental strategy** menentukan cara baris baru diterapkan: strategi `append` (hanya insert; hanya valid jika data mustahil berubah atau berulang), `merge` (update baris yang cocok, insert baris baru), atau `delete+insert` (hapus partisi/kunci yang terdampak, lalu masukkan data baru).

Kesalahan paling klasik dalam model inkremental adalah **salah memilih kolom watermark**. Godaan terbesar engineer adalah memfilter "hanya proses tanggal transaksi yang lebih baru dari tanggal transaksi terbesar di tabel (`order_date > max(order_date)`)". Logika ini **keliru fatal** setiap kali data transaksi masa lalu dapat mengalami perubahan status. Pada lab praktis, muatan data batch kedua tiba membawa 50 pesanan baru di tanggal baru, **sekaligus** 20 transaksi refund dan pembatalan pesanan untuk tanggal 25 Januari yang sudah dimuat kemarin. Data perubahan tersebut masuk sebagai baris baru (dengan nilai `_loaded_at` yang lebih baru) di tabel mentah. Model naif yang hanya memfilter tanggal transaksi baru akan mengabaikan perubahan tanggal 25 Januari tersebut: dashboard tetap mencatat 106 pesanan senilai Rp 39.370.000, padahal angka riil setelah refund adalah **86 pesanan senilai Rp 32.585.000**—sebuah penggelembungan angka sebesar **20,8%** yang tidak akan pernah terkoreksi selamanya karena pipeline tidak pernah menengok tanggal tersebut lagi.

Logika inkremental yang benar wajib menghitung ulang **setiap tanggal yang tersentuh oleh baris data yang baru tiba sejak run terakhir**:

```sql
with orders as (
    select order_date, _loaded_at from {{ ref('stg_orders') }}
),
lines as (
    select * from {{ ref('fct_order_items') }}
    {% if is_incremental() %}
    where order_date in (
        select distinct order_date from orders
        where _loaded_at > (select max(max_loaded_at) from {{ this }})
    )
    {% endif %}
)
select order_date, count(distinct ...) as orders, sum(...) as revenue_idr, max(loaded_at) as max_loaded_at
from lines group by order_date
```

Tiga aturan emas yang akan Anda buktikan di lab:

- **Gunakan waktu ingestion (`_loaded_at`) sebagai watermark**, bukan waktu bisnis transaksi (`order_date`). Waktu bisnis menyatakan kapan transaksi terjadi di dunia nyata; waktu ingestion menyatakan kapan data tersebut tiba di sistem Anda. Data susulan dan pembatalan membawa tanggal bisnis masa lalu tetapi memiliki waktu ingestion terkini.
- **Deklarasikan `ref()` di luar blok `is_incremental()`.** dbt membaca seluruh pemanggilan `ref()` saat pertama kali menyusun grafik DAG, sebelum dbt mengetahui apakah proses tersebut berjalan secara inkremental atau full-refresh. Menaruh `ref()` di dalam blok kondisional akan memicu error "dbt was unable to infer all dependencies"; deklarasikan di CTE paling atas.
- **Buktikan dengan pengujian rekonsiliasi.** Pengujian unit test di lab membandingkan output tabel inkremental dengan hasil perhitungan kalkulasi ulang penuh dari data mentah setelah muatan kedua tiba. Selalu sertakan tes rekonsiliasi semacam ini, karena model inkremental yang salah secara logika tetap terlihat normal dan berjalan tanpa error. Jalankan `dbt run --full-refresh` secara berkala sebagai jaring pengaman produksi.

> 💡 **Jeda Praktik 4 (Model Inkremental dengan Watermark Ingestion):**
> 1. Buka teks editor Anda, buka file `labs/mod-2-3/kopiku_dbt/models/marts/fct_daily_revenue.sql`.
> 2. Konfigurasikan header model: `{{ config(materialized='incremental', unique_key='order_date', incremental_strategy='delete+insert') }}`.
> 3. Tuliskan blok kondisional `{% if is_incremental() %}` dengan menyaring tanggal yang terdampak oleh `_loaded_at > (select max(max_loaded_at) from {{ this }})` (bukan memfilter `order_date`).
> 4. Uji eksekusi awal di terminal:
>    `dbt run --select fct_daily_revenue --project-dir labs/mod-2-3/kopiku_dbt --profiles-dir labs/mod-2-3/kopiku_dbt`
> 5. **Indikator Sukses:** dbt berhasil mematerialisasikan tabel fakta harian pertama dengan ringkasan transaksi yang valid.

## @lesson Snapshots, macros, dan integrasi CI/CD
**dbt Snapshots** menangkap histori perubahan dari tabel sumber yang ditimpa di tempat (in-place update), menghasilkan dimensi **Slowly Changing Dimension (SCD) Tipe 2** (Modul 1.4) secara otomatis tanpa penulisan query merge manual:

```sql
{% snapshot customers_snapshot %}
{{ config(target_schema='snapshots', unique_key='customer_id', strategy='check', check_cols=['city', 'tier']) }}
select customer_id, city, tier from {{ ref('stg_customers') }}
{% endsnapshot %}
```

Setiap kali dijalankan, dbt membandingkan data aktif saat ini dengan histori yang tersimpan. Pada strategi `check`, jika kolom `city` atau `tier` mengalami perubahan nilai, dbt secara otomatis menutup baris lama (mengisi timestamp `dbt_valid_to`) dan menyisipkan baris versi baru (mengisi `dbt_valid_from`, dengan `dbt_valid_to` bernilai NULL). (Strategi `timestamp` menggunakan kolom `updated_at` bawaan sumber dan lebih hemat komputasi jika kolom tersebut tersedia). Pada lab praktis, setelah muatan data kedua di mana 5 pelanggan berpindah domisili, tabel snapshot mencatat **1.005 baris**: 1.000 pelanggan aktif ditambah 5 baris histori versi lama. Catatan penting: snapshot hanya merekam apa yang ia *lihat* pada saat dieksekusi (perubahan di antara dua jadwal eksekusi tidak tertangkap), dan tabel snapshot sulit dibangun ulang dari nol jika rusak, sehingga perlakukan tabel ini dengan proteksi tinggi.

**Macros** adalah fungsi Jinja yang menghasilkan potongan sintaks SQL untuk logika yang sering digunakan berulang:

```sql
{% macro parse_rupiah(column) -%}
    try_cast(replace(regexp_replace({{ column }}, '^\s*[Rr][Pp]\s*', ''), '.', '') as bigint)
{%- endmacro %}

-- Digunakan di model sebagai:   {{ parse_rupiah('total_idr') }} as total_idr
```

Paket-paket dbt eksternal (**dbt packages** seperti `dbt_utils` dan `dbt_expectations`) menyediakan kumpulan macro dan pengujian siap pakai; pasang melalui konfigurasi file `packages.yml` dan jalankan perintah `dbt deps`. Hindari penggunaan Jinja berlebihan: kode SQL yang mudah dibaca selalu lebih baik daripada template yang terlalu rumit.

**Integrasi CI/CD (Slim CI).** Karena kode dbt tersimpan murni sebagai file teks di repositori Git, setiap pull request dapat memicu automated testing di GitHub Actions: membangun model-model yang diubah ke dalam skema sandbox sementara dan menjalankan seluruh pengujian terkait. Membangun seluruh isi proyek pada setiap pull request sangat lambat dan boros biaya, sehingga terapkan **State Comparison (Slim CI)**. Simpan file `manifest.json` dari proses build produksi; pada pull request jalankan `dbt build --select state:modified+ --defer --state path/to/prod-state`. Argumen `state:modified+` berarti "bangun hanya model yang kodenya berubah beserta seluruh model hilirnya"; argumen `--defer` memerintahkan dbt membaca tabel hulu yang tidak berubah langsung dari skema produksi alih-alih membangunnya ulang. Pada proyek lab, mengubah file `stg_order_items` hanya akan menyeleksi model tersebut dan model-model hilirnya (`fct_order_items` dan `fct_daily_revenue`) beserta pengujiannya, sementara `dim_customers` dan `stg_customers` tidak akan tersentuh sama sekali.

Alur kerja profesional yang sehat: kembangkan fitur di skema pribadi lokal, buka pull request, biarkan Slim CI memvalidasi kebenaran data dan tes, lakukan peer review kode, merge ke cabang main, dan biarkan orchestrator menjalankan pipeline produksi secara terjadwal (Modul 2.4). Perlakukan pengujian yang gagal sebagai insiden produksi, bukan sekadar kebisingan notifikasi.

> 💡 **Jeda Praktik 5 (Snapshot SCD Tipe 2 untuk Mutasi Pelanggan):**
> 1. Buka teks editor Anda, buka file `labs/mod-2-3/kopiku_dbt/snapshots/customers_snapshot.sql`.
> 2. Deklarasikan blok `{% snapshot customers_snapshot %}` dengan konfigurasi `strategy='check'` dan `check_cols=['city', 'tier']` serta sumber data `{{ ref('stg_customers') }}`.
> 3. Jalankan perintah snapshot di terminal:
>    `dbt snapshot --project-dir labs/mod-2-3/kopiku_dbt --profiles-dir labs/mod-2-3/kopiku_dbt`
> 4. **Indikator Sukses:** Snapshot terbentuk dengan status `PASS`, siap mendeteksi perubahan domisili kota dan tier pelanggan ketika data batch kedua dimuat.

## @lab Lab: membangun proyek dbt teruji dengan dua siklus eksekusi
Anda dibekali database DuckDB berisi tabel-tabel mentah KopiKu (append-only, tidak rapi, dengan duplikasi data) dan proyek dbt dengan konfigurasi sumber yang sudah disiapkan serta kerangka model awal. Tugas Anda adalah melengkapi lapisan staging, data marts, model inkremental, rangkaian tes data, dan dbt snapshot. Unit test lab akan menjalankan perintah `dbt build`, lalu mensimulasikan **muatan data kedua (second load)** yang membawa pesanan baru, pembatalan pesanan masa lalu, dan mutasi pelanggan, kemudian menjalankan build kembali untuk memverifikasi bahwa tabel inkremental Anda menghasilkan angka yang identik dengan kalkulasi ulang penuh.

### @steps
1. Pasang dependensi yang diperlukan dan muat dataset mentah awal:

```bash
python -m pip install -r labs/mod-2-3/requirements.txt
python3 labs/shared/shopgen.py --out data
export KOPIKU_DB=$PWD/kopiku.duckdb
python3 labs/mod-2-3/load_raw.py data $KOPIKU_DB
```

2. Eksplorasi tabel-tabel mentah menggunakan CLI DuckDB (`duckdb kopiku.duckdb` atau Python). Temukan anomali yang ada: baris duplikat, dua format timestamp berbeda, nominal berawalan `Rp`, dan status dengan huruf besar-kecil tidak seragam. Jalankan `select count(*), count(distinct order_id) from raw.orders`.
3. Buka folder kerja `labs/mod-2-3/kopiku_dbt/`. Setiap kerangka file model telah dilengkapi komentar spesifikasi teknis. Bangun **lapisan staging terlebih dahulu** (`stg_customers`, `stg_products`, `stg_orders`, `stg_order_items`) dan uji secara bertahap:

```bash
cd labs/mod-2-3/kopiku_dbt
dbt run --select staging --profiles-dir .
```

4. Bangun lapisan data marts: `dim_customers`, `fct_order_items` (grain: satu baris per item pesanan), lalu `fct_daily_revenue` sebagai **model inkremental**. Baca ulang materi watermark sebelum menulis filter kondisionalnya.
5. Tambahkan deklarasi pengujian pada kedua file `schema.yml` (komentar TODO merincikan daftar tes yang dibutuhkan), satu singular test di folder `tests/`, dan file snapshot di folder `snapshots/`. Jalankan pengujian menyeluruh:

```bash
dbt build --profiles-dir .
```

   Pastikan seluruh tes berstatus PASS dengan tepat satu peringatan WARN untuk pelanggan yatim.
6. Simulasikan pemuatan batch kedua dan jalankan build kembali. Kemudian bandingkan isi `fct_daily_revenue` dengan hasil rebuild penuh (`dbt run --select fct_daily_revenue --full-refresh`): kedua angka wajib identik tanpa selisih:

```bash
python3 ../load_raw.py ../../../data $KOPIKU_DB --next
dbt build --profiles-dir .
```

7. Jalankan rangkaian pengujian otomatis pytest yang akan menguji seluruh skenario di atas di dalam database isolasi sementara yang bersih:

```bash
pytest labs/mod-2-3 -v
```

> 💡 **Jeda Praktik 6 (Verifikasi Dua Siklus & Uji Rekonsiliasi):**
> 1. Jalankan pengujian menyeluruh di terminal:
>    `pytest labs/mod-2-3 -v`
> 2. Pytest akan mengeksekusi build awal, memuat batch kedua (`load_raw.py --next`), menjalankan build kedua, dan memvalidasi rekonsiliasi angka revenue serta riwayat snapshot.
> 3. **Indikator Sukses:** Seluruh 13 pengujian pytest berstatus `PASSED` (`TestFirstBuild` dan `TestSecondLoad` 100% lulus).

8. Eksplorasi mandiri: simpan file `target/manifest.json` ke folder terpisah, modifikasi satu model staging, dan jalankan perintah `dbt ls --select state:modified+ --state <folder> --profiles-dir .` untuk melihat cara kerja seleksi Slim CI. Kemudian, coba sengaja rusak logika inkremental (filter pada `order_date` alih-alih `_loaded_at`), jalankan pytest kembali, dan amati unit test mana yang berhasil menangkap anomali tersebut.

### @files
- labs/mod-2-3/kopiku_dbt/dbt_project.yml :: Konfigurasi proyek dbt (disediakan) :: config
- labs/mod-2-3/kopiku_dbt/models/sources.yml :: Deklarasi tabel sumber mentah (disediakan) :: config
- labs/mod-2-3/kopiku_dbt/models/staging/stg_orders.sql :: Kerangka model staging orders (lengkapi pembersihan data) :: starter
- labs/mod-2-3/kopiku_dbt/models/staging/stg_customers.sql :: Kerangka model staging customers (lengkapi) :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/fct_order_items.sql :: Kerangka model mart order items: satu baris per item pesanan :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/fct_daily_revenue.sql :: Kerangka model inkremental harian (bagian inti logika) :: starter
- labs/mod-2-3/kopiku_dbt/models/staging/schema.yml :: File konfigurasi pengujian generic untuk staging :: starter
- labs/mod-2-3/kopiku_dbt/models/marts/schema.yml :: File konfigurasi pengujian generic untuk marts :: starter
- labs/mod-2-3/load_raw.py :: Script pembuat data mentah dan simulator muatan batch kedua :: data
- labs/mod-2-3/test_lab.py :: Pengujian komprehensif pytest: build awal, batch kedua, perbandingan nilai :: test
- labs/mod-2-3/reference/kopiku_dbt/models/marts/fct_daily_revenue.sql :: Solusi referensi model inkremental (coba kerjakan sendiri dulu!) :: reference
- labs/mod-2-3/reference/kopiku_dbt/models/staging/stg_orders.sql :: Solusi referensi staging orders :: reference
- labs/mod-2-3/reference/kopiku_dbt/snapshots/customers_snapshot.sql :: Solusi referensi snapshot SCD Tipe 2 :: reference

### @deliverables
- Seluruh 13 pengujian pytest di `test_lab.py` berhasil lolos (PASS), termasuk pengujian rekonsiliasi yang membandingkan tabel inkremental dengan kalkulasi ulang penuh setelah muatan data kedua
- Perintah `dbt build` menunjukkan seluruh tes berhasil lolos dengan tepat satu peringatan WARN (pelanggan yatim)
- Anda mampu menjelaskan mengapa filter inkremental wajib menggunakan kolom `_loaded_at` dan mengapa pemanggilan `ref()` harus berada di luar blok `is_incremental()`

### @verify
```bash
pytest labs/mod-2-3 -v        # Berlangsung sekitar 30 detik: mengeksekusi dua siklus build dbt
```

Jalankan pengujian terhadap solusi referensi pembanding: `LAB_DIR=reference pytest labs/mod-2-3 -v`.

## @chaos Angka pendapatan yang tidak pernah terkoreksi
### @scenario
Tabel pendapatan harian KopiKu dibangun menggunakan model inkremental: "setiap malam, proses dan tambahkan tanggal transaksi yang lebih baru dari tanggal transaksi terbaru yang sudah ada di tabel". Dashboard berjalan lancar, seluruh tes generic bernilai PASS, dan tidak ada engineer yang menyentuh model tersebut selama berbulan-bulan.

Saat proses tutup buku akhir bulan, tim keuangan mencocokkan laporan dengan payment gateway dan menemukan bahwa pendapatan di dashboard untuk tanggal 25 Januari 20,8% lebih tinggi daripada mutasi rekening asli: tercatat 106 transaksi senilai Rp 39,4 juta, padahal data bank mencatat 86 transaksi senilai Rp 32,6 juta. Setelah ditelusuri, pada tanggal 26 Januari terdapat 20 pesanan dari tanggal 25 yang dibatalkan dan direfund. Setiap transaksi refund yang pernah diterbitkan memiliki efek serupa: angka omset harian membeku permanen pada nilai saat hari itu pertama kali dimuat.

### @cause
Kolom watermark yang digunakan adalah waktu bisnis transaksi (`order_date`). Perubahan status atau pembatalan transaksi masa lalu membawa nilai `order_date` lama, sehingga jatuh di luar syarat "lebih baru dari tanggal terakhir", dan model tidak pernah menghitung ulang tanggal tersebut. Tabel mentah sebenarnya mencatat transaksi refund dengan benar sebagai baris baru dengan waktu ingestion yang lebih baru; logika model inkremental-lah yang tidak pernah menanyakan "data apa saja yang berubah sejak proses terakhir?".

Model tersebut lolos seluruh pengujian dbt karena pengujian yang dipasang hanya menguji struktur (tanggal unik, nilai tidak null), bukan menguji apakah angka tersebut sama dengan hasil rekonsiliasi data mentah.

### @fix
1. Ubah kolom watermark menjadi **waktu ingestion** (`_loaded_at`), dan hitung ulang **setiap tanggal yang tersentuh oleh baris data yang dimuat sejak run terakhir**, menggunakan strategi `delete+insert` pada kunci tanggal sehingga data baru menggantikan data lama.
2. Perbaiki histori data: jalankan `dbt run --select fct_daily_revenue --full-refresh` untuk merekonstruksi seluruh tanggal dari data mentah yang sudah bersih; informasikan ke tim keuangan bahwa data telah direvisi secara resmi.
3. Tambahkan **tes rekonsiliasi otomatis** yang membandingkan output tabel inkremental dengan hasil kalkulasi ulang data mentah (atau sampel tanggal) dan jalankan pada setiap proses build pipeline.
4. Jadwalkan eksekusi full refresh berkala sebagai jaring pengaman otomatis, dan pasang alert pemantauan jika terjadi perubahan nilai signifikan pada periode buku yang sudah ditutup.
5. Dokumentasikan asumsi model inkremental dan batasan toleransi terhadap keterlambatan data secara transparan di dokumen ADR.

### @pattern
Sebuah model inkremental hanya dapat dinyatakan benar jika mampu menangani data yang mengalami perubahan setelah pertama kali tiba. Pilihlah watermark berdasarkan waktu data *tiba* di sistem, dan selalu buktikan kebenaran kalkulasinya terhadap hasil rebuild penuh.

## @quiz
### Di dalam proyek dbt, apa fungsi utama dari pemanggilan `{{ ref('stg_orders') }}`?
- [ ] Menyalin data model tersebut langsung ke file saat ini agar query dapat berjalan tanpa operasi join
- [x] Menentukan nama tabel sesuai lingkungan aktif dan mencatat dependensinya di grafik DAG
- [ ] Memuat ulang data sumber dari sistem aplikasi operasional setiap kali query dieksekusi
- [ ] Menandai model tersebut sebagai model privat sehingga tidak dapat dibaca oleh model lain di proyek

> Fungsi `ref()` memastikan dbt membangun model yang dirujuk terlebih dahulu dan mengganti nama skema/tabel yang sesuai dengan lingkungan aktif (developer lokal, CI, atau produksi).

### Pernyataan manakah yang paling tepat mengenai perintah `dbt build`?
- [ ] Hanya membuat model tabel di database dan membiarkan pengguna menjalankan pengujian secara terpisah
- [ ] Memuat data mentah dari sistem sumber ke dalam data warehouse sebelum melakukan transformasi
- [x] Menjalankan model, tes, dan snapshot sesuai urutan DAG, serta melewati node hilir dari yang gagal
- [ ] Menghapus dan membuat ulang seluruh database warehouse agar setiap eksekusi dimulai dari kondisi kosong

> Perintah `build` menyatukan run, test, snapshot, dan seed dalam urutan grafik DAG. Jika sebuah model atau tesnya gagal, model-model di hilirnya otomatis di-skip agar data rusak tidak mencemari lapisan marts.

### Mengapa pengujian `relationships` antara tabel pesanan dan tabel pelanggan di lab dikonfigurasi dengan `severity: warn`?
- [ ] Tingkat peringatan berjalan lebih cepat daripada tingkat error sehingga menghemat waktu build proyek
- [ ] Pengujian tersebut akan otomatis menghapus baris yatim dari tabel fakta agar data tetap konsisten
- [x] Pelanggan yatim dipantau dan dilaporkan secara terbuka, tetapi tidak boleh menghentikan seluruh pipeline
- [ ] Pengujian relationships tidak memiliki kapabilitas melempar error sehingga hanya bisa menghasilkan warning

> Tingkat keparahan (severity) adalah keputusan desain arsitektur. Level error menghentikan pipeline untuk anomali data fatal; level warning memantau anomali yang dapat ditoleransi tanpa memblokir operasional bisnis.

### Sebuah model inkremental memfilter "tanggal transaksi yang lebih baru dari tanggal transaksi terbesar di tabel". Di mana letak kelemahan fatalnya?
- [ ] Query berjalan terlalu lambat karena harus memindai seluruh tabel untuk mencari nilai tanggal terbesar
- [ ] Tidak dapat bekerja dengan strategi delete+insert yang mewajibkan keunikan primary key di seluruh baris
- [x] Perubahan status transaksi lama datang terlambat dan tak pernah diproses ulang, sehingga data usang
- [ ] Model akan membuat tabel baru pada setiap eksekusi sehingga memutus referensi dari model-model lain

> Watermark berbasis waktu bisnis mengabaikan data yang diperbarui terlambat. Gunakan waktu ingestion untuk mendeteksi data baru dan hitung ulang seluruh tanggal bisnis yang terdampak.

### Mengapa dbt memunculkan error "unable to infer all dependencies" jika pemanggilan `ref()` diletakkan di dalam blok `{% if is_incremental() %}`?
- [ ] Fungsi `is_incremental()` hanya tersedia di dbt Cloud dan tidak didukung oleh dbt Core CLI
- [ ] Sintaks Jinja melarang kata kunci SQL berada di dalam blok kondisional pada file model
- [x] dbt membaca semua ref saat menyusun grafik DAG, sebelum tahu apakah proses berjalan inkremental
- [ ] Model yang dirujuk tidak dimaterialisasikan sebagai tabel fisik sehingga tidak dapat digunakan di model inkremental

> Seluruh pemanggilan ref dikumpulkan pada fase parsing awal grafik DAG. Deklarasikan ref di luar blok kondisional (misalnya di dalam blok CTE teratas) atau gunakan komentar petunjuk depends_on.

### Apa yang dilakukan oleh dbt snapshot dengan konfigurasi `strategy='check'` pada setiap kali dijalankan?
- [ ] Menghapus isi tabel dan membangunnya ulang dari awal sehingga hanya versi terkini yang tersimpan
- [x] Membandingkan kolom terpilih dengan baris tersimpan dan menambah versi baru jika nilainya berubah
- [ ] Memeriksa apakah tabel sumber memiliki baris duplikat dan menghentikan proses jika duplikasi ditemukan
- [ ] Menyalin seluruh tabel sumber ke skema baru dengan menyematkan timestamp pada penamaan tabel

> Strategi check menutup versi lama (mengisi `dbt_valid_to`) dan menyisipkan baris versi baru (`dbt_valid_from`) setiap kali nilai kolom yang dipantau berubah, menghasilkan tabel SCD Tipe 2.

### Manfaat apa yang dicapai oleh perintah `dbt build --select state:modified+ --defer --state prod-state` pada lingkungan CI?
- [ ] Membangun seluruh model di proyek lalu membandingkan hasilnya dengan tabel di database produksi
- [ ] Membangun model yang dimodifikasi di produksi untuk mengujinya terhadap data baru yang masuk
- [x] Membangun hanya model yang berubah beserta hilirnya, dengan model hulu dibaca dari produksi
- [ ] Melewati seluruh pengujian data agar eksekusi pull request dapat selesai secepat mungkin

> Argumen `state:modified+` menyeleksi model yang berubah beserta seluruh dependensi hilirnya. Argumen `--defer` memungkinkan model tersebut membaca tabel hulu yang tidak berubah langsung dari kondisi produksi, menghemat waktu dan biaya.

### Seluruh pengujian struktur pada model inkremental bernilai PASS, namun angka laporan keuangan terbukti salah. Pengujian apa yang paling efektif ditambahkan?
- [ ] Pengujian not_null pada setiap kolom tabel agar nilai yang hilang dapat terdeteksi sejak awal build
- [ ] Pengujian bahwa jumlah baris tabel hari ini selalu lebih banyak daripada jumlah baris kemarin
- [x] Tes rekonsiliasi yang membandingkan tabel inkremental dengan hitung ulang penuh dari data mentah
- [ ] Pengujian keunikan pada kolom tanggal untuk membuktikan bahwa model tidak memuat baris duplikat

> Pengujian struktur tidak dapat mendeteksi pembaruan data yang hilang atau usang. Membandingkan output secara langsung dengan hasil kalkulasi ulang dari data mentah menangkap kekeliruan logika inkremental secara presisi.

## @resources
- [dbt documentation](https://docs.getdbt.com/)
- [dbt: incremental models](https://docs.getdbt.com/docs/build/incremental-models)
- [dbt: data tests](https://docs.getdbt.com/docs/build/data-tests)
- [dbt: snapshots](https://docs.getdbt.com/docs/build/snapshots)
- [dbt-duckdb adapter](https://github.com/duckdb/dbt-duckdb)
