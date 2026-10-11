---
title: Infrastructure as Code (Terraform) dan FinOps
duration: 3 minggu
summary: Lakukan provisi bucket data lakehouse yang aman, terenkripsi, dan berprinsip least-privilege menggunakan Terraform serta evaluasi perubahannya melalui execution plan, kemudian bangun model pembiayaan, guardrails, dan prakiraan anggaran untuk mencegah platform data cloud membakar biaya perusahaan secara tak terkendali.
why: Tutorial pemula umumnya mengajarkan cara mengklik tombol-tombol di web console cloud. Di lingkungan korporat, tidak ada seorang pun yang bisa me-review, mereproduksi, atau me-rollback sebuah klik mouse. Dan satu kesalahan cross join SQL di data warehouse berukuran besar sanggup menghabiskan kuota anggaran biaya sebulan hanya dalam kurun waktu satu akhir pekan.
---

## @outcomes
- Menjelaskan paradigma deklaratif Infrastructure as Code (IaC), manajemen Terraform state, alur kerja plan/apply, serta membaca eksekusi plan layaknya code review perangkat lunak
- Menulis konfigurasi Terraform modular dengan variabel input, validasi aturan kustom, locals, data sources, outputs, dan konfigurasi per lingkungan (dev vs prod)
- Membangun storage bucket S3 lakehouse yang aman: blokir akses publik, enkripsi KMS kustom, aturan rotasi lifecycle, dan kebijakan IAM berprinsip least-privilege, serta mengujinya langsung dari artefak plan
- Memodelkan komponen biaya platform data (waktu aktif warehouse dan auto-suspend, penagihan berbasis scan data, serta tingkatan cold storage) dan mengalokasikan beban biaya ke divisi terkait menggunakan tag
- Memasang sistem guardrails otomatis (statement timeouts, batas anggaran kuota, alert anomali, model forecasting) serta menangkap query liar sebelum tagihan invoice membengkak

## @prereq
Modul 1.1 (Linux, Docker, skrip automasi), Modul 2.2 (arsitektur lakehouse dan object storage), dan Modul 2.4 (orkestrasi). Bagian A membutuhkan Terraform CLI (versi 1.5 atau lebih baru) dan ruang disk sekitar 700 MB untuk mengunduh plugin AWS provider (tidak memerlukan akun AWS aktif). Bagian B menggunakan kode Python murni.

## @lesson Mengapa Infrastructure as Code
Bayangkan sebuah bucket object storage tempat seluruh pipeline analitik perusahaan menulis data transaksi setiap hari. Seseorang membuatnya delapan bulan lalu melalui antarmuka web AWS console. Konfigurasi enkripsi apa yang sebenarnya aktif di sana? Siapa saja pengguna atau service account yang memiliki izin membaca? Mengapa salinan bucket di lingkungan staging berperilaku berbeda dengan lingkungan produksi? Tidak ada seorang pun di tim yang dapat menjawabnya dengan pasti, karena kebenaran arsitektur hanya tersimpan di halaman web dan ingatan manusia yang fana.

**Infrastructure as Code (IaC)** mendeskripsikan seluruh topologi infrastruktur komputasi dan penyimpanan ke dalam file teks deklaratif yang disimpan rapi di dalam Git. Pendekatan ini menghadirkan disiplin rekayasa perangkat lunak modern ke dunia infrastruktur data:

- **Dapat Ditinjau (Reviewable).** Setiap perubahan hak akses atau penambahan resource baru diajukan melalui Pull Request (PR) yang wajib dibaca dan disetujui rekan kerja sebelum dieksekusi secara fisik.
- **Dapat Direproduksi (Repeatable).** Lingkungan development, staging, dan production dibangun dari basis kode sumber yang sama persis, sehingga perbedaannya hanya terletak pada parameter variabel yang Anda definisikan secara eksplisit.
- **Dapat Diaudit (Auditable).** Riwayat `git log` menjawab secara transparan siapa yang memperluas izin akses, kapan tindakan tersebut dilakukan, dan tiket bisnis apa yang melandasinya.
- **Dapat Dipulihkan dari Bencana (Recoverable).** Jika seluruh data center cloud di suatu region mengalami kebakaran atau akun diretas, Anda dapat membangun kembali seluruh infrastruktur data dari kode dalam hitungan menit tanpa mengandalkan ingatan manusia.
- **Dapat Diuji secara Otomatis (Testable).** Seperti yang akan Anda buktikan di lab, konfigurasi infrastruktur dapat diverifikasi keamanannya oleh skrip otomatis *sebelum* resource tersebut benar-benar dibuat di cloud.

Alat IaC terbagi ke dalam dua gaya arsitektur. Pendekatan **imperatif** mendeskripsikan *langkah demi langkah (how)*: "buat bucket, lalu aktifkan enkripsi, lalu pasang policy". Pendekatan **deklaratif** mendeskripsikan *kondisi akhir yang diinginkan (what)*: "sebuah bucket dengan konfigurasi keamanan X, Y, dan Z harus ada". Engine IaC kemudian membandingkan deklarasi Anda dengan kondisi nyata di cloud dan menghitung langkah-langkah transisinya. Terraform (beserta fork open-source-nya, OpenTofu), AWS CloudFormation, dan Pulumi menganut paradigma deklaratif. Alat deklaratif aman untuk dieksekusi berkali-kali: eksekusi kedua tidak akan melakukan apa pun jika kondisi nyata sudah sesuai. Karakteristik ini—**idempotensi**—adalah prinsip yang sama persis dengan yang Anda terapkan pada pipeline data di Modul 0.1.

Praktik mengonfigurasi cloud secara manual lewat browser ("ClickOps") dilarang bukan karena mengklik mouse itu sulit. Praktik ini dilarang karena perubahan konsol tidak meninggalkan jejak review, mustahil direproduksi secara identik, dan menjadi sumber bencana pertama saat terjadi insiden di tengah malam.

## @lesson Praktik Terraform di dunia nyata
Sebuah proyek Terraform tersusun dari sekumpulan file berekstensi `.tf` yang ditulis menggunakan HCL (HashiCorp Configuration Language). Blok-blok penyusun utama yang akan Anda gunakan secara konstan:

```hcl
variable "env" {                       # input parameter dari luar
  type        = string
  description = "Deployment environment."
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod."
  }
}

locals {                               # variabel kalkulasi lokal internal
  bucket_name = "${var.project}-lakehouse-${var.env}"
}

resource "aws_s3_bucket" "lakehouse" { # objek fisik yang dikelola oleh Terraform
  bucket = local.bucket_name
}

output "bucket_name" {                 # nilai output yang dapat dibaca sistem lain
  value = local.bucket_name
}
```

- **Provider**: plugin perangkat lunak yang menjembatani Terraform dengan API platform cloud target (`aws`, `google`, `snowflake`, `kubernetes`). Plugin diunduh saat Anda menjalankan perintah `terraform init`. Ukuran plugin AWS provider cukup besar (sekitar 650 MB di lab), sehingga tim data umumnya berbagi direktori cache plugin lokal.
- **Resource**: objek fisik yang dibuat, diperbarui, dan dihancurkan oleh Terraform di cloud. Sebaliknya, **Data Source** (`data "..."`) hanya membaca atau menghitung metadata tanpa membuat infrastruktur baru. Pada lab modul ini, dokumen kebijakan IAM didefinisikan sebagai data source: ia mengompilasi struktur JSON policy secara matematis tanpa membuat resource IAM role baru.
- **Variables**: parameter yang memungkinkan basis kode yang sama melayani berbagai target lingkungan. Nilainya diinjeksikan melalui file `-var-file=prod.tfvars`, argumen CLI, atau environment variables. Blok `validation` menolak nilai konfigurasi yang salah sedini mungkin (pengujian lab membuktikan bahwa nilai `env=staging` langsung ditolak seketika).
- **Relasi Referensi**: pemanggilan seperti `aws_s3_bucket.lakehouse.id` menyusun graf dependensi otomatis. Terraform secara cerdas membangun bucket terlebih dahulu sebelum membuat konfigurasi blokir akses publik yang merujuk padanya, serta mengeksekusi resource yang independen secara paralel.

### Alur Kerja (Workflow) dan State File

```bash
terraform init      # mengunduh provider plugins dan menginisialisasi backend state
terraform fmt       # menstandarisasi format indentasi kode; CI menjalankannya dengan opsi -check
terraform validate  # memvalidasi keabsahan sintaks dan tipe data tanpa memanggil API cloud
terraform plan      # membandingkan kode vs state vs kondisi nyata; menampilkan simulasi perubahan
terraform apply     # mengeksekusi perubahan fisik ke cloud (meminta konfirmasi persetujuan manusia)
```

Terraform menyimpan riwayat pemetaan infrastruktur di dalam sebuah **State File** yang mencatat relasi antara nama deklarasi di kode dengan identitas ID objek nyata di cloud (`aws_s3_bucket.lakehouse` dipetakan ke bucket fisik `kopiku-lakehouse-prod`). Tanpa state file, Terraform tidak akan mampu membedakan antara perintah "buat resource baru" dengan "resource ini sudah ada". Oleh karena itu, file state sangat bernilai dan sensitif: ia dapat memuat rahasia plaintext dan token kredensial. Jangan pernah men-commit file state ke dalam repositori Git publik. Di lingkungan tim korporat, state file disimpan di **Remote Backend** terpusat (seperti bucket Amazon S3 dengan enkripsi dan versioning aktif, atau Terraform Cloud) yang mendukung fitur **State Locking**, sehingga dua insinyur tidak dapat mengeksekusi apply pada detik yang sama dan merusak integritas state.

Perintah `terraform plan` adalah jantung keselamatan IaC. Tampilan plan menggunakan simbol: `+` untuk penambahan resource baru, `~` untuk pembaruan atribut di tempat (in-place update), dan `- / +` untuk **penghancuran dan pembuatan ulang (destroy and re-create)**. Latihlah mata Anda untuk selalu waspada terhadap simbol `-/+`: mengubah nama bucket atau database tidak sekadar me-rename objek, melainkan menghapus objek lama dan membuat objek baru yang kosong, yang berarti menghapus seluruh data produksi Anda! Penambahan atribut `lifecycle { prevent_destroy = true }` memaksa Terraform menolak keras perintah penghancuran resource kritis perusahaan.

Perubahan manual yang dilakukan seseorang di cloud console di luar kendali Terraform disebut **Drift**. Eksekusi `terraform plan` akan mendeteksi drift tersebut sebagai selisih yang harus dikembalikan ke konfigurasi kode resmi—satu lagi alasan kuat untuk mencabut hak akses write console dari mayoritas personel.

### Manajemen Environment dan Modules

Lingkungan dev dan prod umumnya berbagi file arsitektur `.tf` yang sama namun menggunakan file variabel `.tfvars` yang berbeda; pada lab praktikum, file `dev.tfvars` mengarsipkan data mentah setelah 30 hari sementara `prod.tfvars` menyimpannya selama 90 hari dan hanya lingkungan prod yang mengaktifkan fitur object versioning. Pada sistem berskala enterprise, blok-blok kode yang berulang diabstraksikan ke dalam **Modules** mandiri dan setiap environment memiliki file state yang terisolasi total, idealnya di akun cloud yang berbeda. Kesalahan konfigurasi fatal di dev pantang menjalar ke produksi.

## @lesson Mengamankan data lakehouse
Lab modul ini memandu Anda membangun lapisan penyimpanan lakehouse dari Modul 2.2 menggunakan Terraform, dengan empat pilar pengamanan wajib standar enterprise:

**1. Blokir Akses Publik (Block Public Access).** Kebocoran data pelanggan akibat bucket yang terbuka bebas di internet umumnya berakar dari kelalaian konfigurasi manual. Mendeklarasikan resource `aws_s3_bucket_public_access_block` dengan keempat parameter disetel ke `true` secara permanen mencegah bucket terekspos ke publik, apa pun kebijakan ACL atau policy yang mungkin ditulis seseorang secara tergesa-gesa di masa depan.

**2. Enkripsi Terkelola Mandiri (Customer-Managed KMS Encryption).** Secara default S3 mengenkripsi data menggunakan kunci bawaan AWS. Menggunakan kunci **KMS (Key Management Service)** milik organisasi Anda sendiri menambahkan lapisan proteksi ganda: pembaca data wajib memiliki izin pada data bucket sekaligus izin dekripsi pada kunci KMS, mencatat jejak audit akses di CloudTrail, serta memungkinkan pencabutan izin secara instan dari satu titik pusat. Aktifkan fitur **rotasi kunci otomatis (key rotation)** agar risiko kebocoran kunci lama terisolasi dalam rentang waktu tertentu.

**3. Hak Akses Paling Minimal (Least Privilege).** Kebijakan IAM policy mendefinisikan siapa yang boleh mengeksekusi *tindakan apa (Action)* pada *resource mana (Resource)*, dan dalam *kondisi apa (Condition)*. Kesalahan fatal yang kerap dijumpai di korporat adalah penyematan izin sapu jagat `"Action": "s3:*", "Resource": "*"` yang dibuat demi alasan "agar cepat jalan" dan tidak pernah diperbaiki. Sebuah pipeline pemrosesan data kurasi yang hanya bertugas membaca dan menulis layer silver dan gold wajib menerima izin yang presisi:

| Pernyataan Izin (Statement) | Tindakan yang Diizinkan (Actions) | Target Resource |
|---|---|---|
| Baca dan tulis data kurasi | `s3:GetObject`, `s3:PutObject` | `bucket/silver/*`, `bucket/gold/*` |
| Listing isi direktori bucket | `s3:ListBucket` | bucket, dibatasi hanya jika kondisi `s3:prefix` cocok dengan `silver/*` atau `gold/*` |

Pipeline tersebut sama sekali tidak diizinkan menghapus data (no delete), tidak dapat menyentuh direktori `raw/` mentah atau folder tim lain, dan tidak dapat mengubah bucket policy. Jika token kredensial pipeline bocor, dampak kerusakannya terisolasi ketat. Menulis policy hanyalah separuh tugas: uji policy tersebut secara otomatis! Pengujian lab memvalidasi bahwa tidak ada aksi wildcard `*`, tidak ada izin delete, dan tidak ada target resource global `*` di dalam artefak plan JSON.

**4. Aturan Daur Hidup Penyimpanan (Lifecycle Rules).** Data mentah umumnya ditulis sekali dan jarang dibaca kembali setelah lewat beberapa minggu. Lifecycle rule secara otomatis memindahkan objek di direktori `raw/` ke kelas penyimpanan dingin (colder storage) yang lebih murah setelah durasi hari tertentu, serta membatalkan **multipart upload yang tidak tuntas (incomplete multipart uploads)** setelah 7 hari. (Proses upload file raksasa yang gagal di tengah jalan meninggalkan serpihan part tersembunyi yang terus memakan biaya penyimpanan bulanan tanpa disadari).

### Menguji Kode Infrastruktur Sebelum Provisi Fisik

Bagaimana cara menguji kode infrastruktur tanpa perlu membayar sewa cloud dan tanpa membuat resource fisik? Terapkan strategi pengujian berlapis:

1. `terraform fmt -check` dan `terraform validate`: verifikasi sintaksis instan tanpa akses internet.
2. **Static Policy Scanners** (seperti Trivy/tfsec, Checkov, OPA/Conftest): memindai celah keamanan seperti bucket terbuka publik, ketiadaan enkripsi, atau wildcard IAM.
3. **Plan-Based Automated Tests**: jalankan `terraform plan -out=plan` lalu ekstrak ke format JSON via `terraform show -json plan` dan jalankan assertions menggunakan pytest. Inilah metodologi yang diterapkan pada lab modul ini, berjalan sepenuhnya offline menggunakan dummy credentials.
4. Uji provisi fisik di akun sandbox sekali pakai (throwaway environment), jalankan integrasi test, lalu hancurkan via `terraform destroy`.

Catatan arsitektur krusial dari lab: Jika dokumen IAM policy Anda merujuk langsung ke atribut `aws_s3_bucket.lakehouse.arn`, nilai ARN tersebut berstatus *baru diketahui setelah apply (known after apply)*, sehingga isi JSON policy tidak dapat dibaca oleh reviewer pada tahap plan dan hanya menampilkan teks `(known after apply)`. Namun jika Anda mengonstruksi string ARN langsung dari nama bucket (`arn:aws:s3:::${local.bucket_name}`), keseluruhan detail teks kebijakan keamanan dapat dievaluasi secara transparan pada tahap plan review. Desainlah konfigurasi Terraform Anda agar fakta keamanan selalu terlihat jelas saat code review.

**Tagging Resources.** Konfigurasikan blok `default_tags` pada provider AWS agar setiap resource otomatis disematkan tag `Project`, `Environment`, `Owner`, dan `CostCenter`. Tagging inilah yang menjadi kunci transparansi biaya pada materi FinOps berikutnya.

## @lesson Di mana platform data cloud menghabiskan anggaran Anda
Model penetapan harga layanan cloud pada dasarnya terbagi ke dalam tiga pola utama:

**1. Anda membayar selama komputasi menyala (Uptime-Based Billing).** Data warehouse modern seperti Snowflake, klaster Apache Spark Databricks, AWS EMR, dan Amazon Redshift menagih biaya berdasarkan durasi menyala (uptime), terlepas dari apakah mesin sedang bekerja keras atau menganggur. Dua parameter yang menentukan tagihan:
- **Auto-Suspend**: berapa lama durasi mesin menganggur (idle) sebelum otomatis tidur (sleep). Setiap kali query selesai, Anda tetap membayar argo komputasi sepanjang durasi jendela suspend ini.
- **Minimum Billing Duration**: banyak platform memberlakukan tagihan minimum 60 detik setiap kali warehouse terbangun (resume). Aliran query mini yang datang sporadis dan terus membangunkan warehouse akan memicu biaya yang sangat mahal.

**2. Anda membayar berdasarkan volume data yang di-scan (Scan-Based Billing).** Serverless query engine seperti Google BigQuery on-demand dan AWS Athena menagih biaya per terabyte data yang dibaca dari disk storage. Di sini efisiensi biaya sepenuhnya ditentukan oleh tata letak data fisik: partisi, clustering, format columnar Parquet, dan query yang hanya memilih kolom yang benar-benar dibutuhkan (Modul 2.1 dan 2.2). Query yang sama terhadap tabel yang tidak terpartisi dapat berbiaya sepuluh kali lipat lebih mahal.

**3. Anda membayar untuk kapasitas storage dan transfer data (Storage & Egress).** Object storage berbiaya murah per gigabyte namun menagih tanpa henti setiap detik. Mengalihkan data ke kelas penyimpanan dingin (Glacier / Coldline) memang memangkas biaya per GB, namun mengenakan biaya tambahan saat data dibaca kembali (retrieval fees) dan memiliki durasi penyimpanan minimum. Memindahkan data yang masih sering diakses ke tier dingin justru akan **melipatgandakan tagihan biaya Anda**, sebuah paradoks yang diuji langsung dalam lab modul ini.

### Hasil Pengukuran Nyata dari Lab

Log query lab modul ini mencakup 2.083 transaksi query selama 30 hari yang merepresentasikan 33 jam durasi komputasi nyata dari tiga tim (marketing, finance, data-engineering). Menggunakan simulasi warehouse terpadu (1 kredit per jam dengan estimasi harga $3 per kredit), variasi parameter auto-suspend menghasilkan perbedaan biaya yang dramatis:

| Konfigurasi Auto-Suspend | Total Jam yang Ditagihkan | Estimasi Biaya |
|---|---|---|
| 0 detik (tetap berlaku batas minimum 60 detik) | 52,6 jam | $158 |
| 60 detik | 62,5 jam | $188 |
| 5 menit | 148,9 jam | $447 |
| 10 menit | 209,2 jam | $628 |
| 30 menit | 287,2 jam | $861 |
| 1 jam | 331,8 jam | $995 |

Beban kerja riil hanya 33 jam. Satu parameter konfigurasi yang sering diabaikan membuat tagihan melonjak dari $158 menjadi $995 untuk hasil kerja yang sama persis! Hal ini terjadi karena query tiba secara sporadis dan setiap celah waktu idle yang lebih pendek dari jendela auto-suspend memaksa argo mesin tetap berjalan. Memasang durasi suspend yang terlalu agresif (seperti 0 detik) akan menghilangkan cache lokal dan menambah latensi resume beberapa detik bagi pengguna dashboard interaktif; itulah sebabnya warehouse BI interaktif umumnya menggunakan rentang 60 hingga 300 detik, sedangkan warehouse batch pipeline terjadwal harus di-suspend segera setelah job selesai.

### Alokasi Biaya: Siapa yang Menghabiskan Anggaran?

Faktur tagihan bulanan yang hanya mencantumkan "Total Biaya Compute: $4.200" akan memicu perdebatan kusir antar divisi. Namun laporan FinOps yang merinci: "Marketing $1.900, Finance $600, Data Engineering $1.700, Unallocated $0" membuka ruang pengambilan keputusan strategis. Kunci transparansi ini terletak pada **penyematan tag wajib pada setiap resource dan query**: tag Terraform di level cloud, serta query tag atau service account terisolasi per tim di level warehouse. Jadikan kelengkapan tagging sebagai syarat kelulusan PR review. Pengeluaran yang tidak bertuan (unallocated spend) adalah pengeluaran yang tidak akan pernah dihemat oleh siapa pun.

Kuasai terminologi standar **FinOps**: *Showback* (menampilkan transparansi biaya kepada setiap divisi tanpa memotong anggaran mereka), *Chargeback* (menagihkan biaya komputasi langsung ke pos anggaran departemen terkait), *Unit Economics* (menghitung biaya komputasi per unit bisnis, misalnya biaya cloud per 1.000 pesanan yang diproses), serta *Commitments* (pembelian komitmen kapasitas jangka panjang dengan diskon besar yang hanya menguntungkan untuk baseline beban kerja konstan).

## @lesson Guardrails, anggaran biaya, dan prakiraan pembengkakan
Anda tidak bisa mengandalkan kehati-hatian manusia pada pukul 22:30 di Jumat malam. Sistem pembatas kendali biaya (**guardrails**) harus bekerja secara otomatis:

**Pencegahan (Preventive Controls):**
- **Statement Timeouts**: tetapkan batas durasi eksekusi query maksimum di setiap warehouse dan service account (misalnya, batas 1 jam akan langsung mematikan cross join yang keliru jauh sebelum akhir pekan berakhir).
- **Resource Monitors dan Kuota Anggaran**: suspensi warehouse secara otomatis atau kirimkan notifikasi darurat saat konsumsi kredit mencapai ambang batas tertentu (50%, 80%, dan 100% dari alokasi bulanan).
- **Scan Limits**: batasi batas kuota pembacaan data per query pada serverless engine (misalnya BigQuery `maximum_bytes_billed`), sehingga query yang lupa menyertakan filter partisi akan langsung gagal sebelum menagih biaya terabyte.
- **Isolasi Warehouse Berdasarkan Karakteristik Beban Kerja**: pisahkan warehouse untuk dashboard BI, warehouse untuk analisis ad-hoc data scientist, dan warehouse untuk pipeline batch produksi. Query liar dari seorang analis tidak boleh menghabiskan resource atau memperlambat pipeline produksi harian.
- **Right-Sizing**: memilih ukuran kapasitas klaster yang tepat. Klaster yang terlalu besar untuk query kecil hanya akan membuang kredit sia-sia. Lakukan pengukuran berbasis metrik, jangan menebak.

**Deteksi Dini (Detective Controls):**
- **Prakiraan Anggaran Bulanan (Monthly Forecasting)**. Fungsi `forecast_month` pada lab modul ini menghitung akumulasi biaya berjalan, memproyeksikan rata-rata biaya 7 hari terakhir ke sisa hari di bulan tersebut, dan menghitung pada tanggal berapa batas anggaran akan jebol. Satu lonjakan biaya liar pada hari ke-6 akan langsung membunyikan alarm peringatan pada hari ke-6 tersebut, bukan menunggu tanggal 31 saat invoice tagihan sudah terbit.
- **Deteksi Query Liar Menggunakan Median, Bukan Rata-Rata**. Fungsi `find_runaway` menandai query yang durasi jalannya melampaui 10 kali lipat nilai median durasi timnya sendiri. Mengapa median? Pengujian lab membuktikan: pada lima query berdurasi 10, 10, 10, 10, dan 1.000 detik, nilai rata-rata (mean) melonjak menjadi 208 detik sehingga aturan berbasis mean akan menganggap query 1.000 detik sebagai variasi wajar; sebaliknya, nilai median tetap berada di 10 detik dan sukses menangkap query anomali 1.000 detik tersebut. Outlier ekstrem mendistorsi rata-rata yang Anda gunakan untuk mendeteksinya!
- **Evaluasi Berdasarkan Pola Normal Masing-Masing Kelompok**: durasi 900 detik adalah hal rutin bagi batch job data engineering, namun sangat tidak wajar bagi query dashboard eksekutif.

**Titik Pemborosan Cloud yang Wajib Diburu Rutin:** warehouse dengan jendela auto-suspend yang terlalu lama; klaster eksperimen yang lupa dimatikan; lingkungan development yang menyala di malam hari dan akhir pekan (pasang skrip penjadwal stop otomatis); multipart upload yang menggantung; snapshot dan volume disk yatim piatu (orphaned volumes); duplikasi tabel mentah; query `SELECT *` pada tabel lebar; serta dashboard BI yang me-refresh data setiap satu menit padahal data sumber hanya diperbarui sehari sekali.

### Menjalankan Disiplin IaC dan FinOps Bersama Tim

- Jalankan `fmt -check`, `validate`, security scanning, dan `plan` di setiap Pull Request, lalu sematkan output plan sebagai komentar di PR; eksekusi `apply` secara otomatis hanya setelah PR di-merge ke branch utama via pipeline CI/CD, pantang mengeksekusi apply dari laptop pribadi.
- Jauhkan kredensial rahasia dari file `.tf`, `.tfvars`, dan state file (gunakan cloud secrets manager dan alirkan hanya referensinya).
- Berikan service role CI izin yang cukup untuk membuat resource namun dibatasi dari hak mengubah IAM global.
- Sertakan estimasi perubahan biaya pada setiap review PR (menggunakan tools seperti Infracost) agar penambahan warehouse baru terlihat implikasi biayanya sebelum kode di-merge.
- Rancang setiap lingkungan development dengan konsep pembersihan mudah: eksekusi `terraform destroy` untuk resource dev harus menjadi rutinitas kerja yang biasa dan aman.

## @lab Lab: bucket lakehouse aman dan perangkat kendali biaya FinOps
Lab ini terbagi menjadi dua bagian: Bagian A melengkapi konfigurasi Terraform hingga menghasilkan execution plan offline yang memvalidasi bahwa storage bucket S3 lakehouse Anda terisolasi privat, terenkripsi KMS kustom, memiliki aturan lifecycle otomatis, bertag lengkap, dan hanya dapat diakses melalui kebijakan least-privilege. Bagian B membangun fungsi-fungsi Python untuk kendali FinOps: pemodelan penagihan warehouse, alokasi biaya per tim, deteksi query liar berbasis median, forecasting proyeksi anggaran, serta simulasi analisis tiering penyimpanan data.

### @steps
1. Instal pytest dan Terraform CLI (versi 1.5 atau lebih baru; atau OpenTofu). Pasang direktori cache plugin agar proses pengunduhan provider tidak diulang berkali-kali:

```bash
python -m pip install -r labs/mod-3-4/requirements.txt
export TF_PLUGIN_CACHE_DIR=$HOME/.terraform.d/plugin-cache && mkdir -p "$TF_PLUGIN_CACHE_DIR"
pytest labs/mod-3-4 -v          # seluruh pengujian awal akan gagal
```

2. **Bagian A: Infrastruktur Lakehouse.** Buka direktori `labs/mod-3-4/terraform/`. File `versions.tf`, `provider.tf`, serta file `.tfvars` dev dan prod telah disediakan. Deklarasikan variabel input di `variables.tf`, lalu selesaikan daftar instruksi TODO di file `main.tf` dan `outputs.tf`.
3. Gunakan Terraform CLI lokal secara interaktif saat menulis kode: `cd labs/mod-3-4/terraform && terraform init -backend=false && terraform validate && terraform plan -var-file=dev.tfvars`. Tinjau output plan layaknya seorang code reviewer. Jalankan perintah `terraform fmt` sebelum menjalankan pengujian otomatis.
4. Eksekusi pengujian Bagian A via `pytest labs/mod-3-4/test_terraform.py -v`. Pengujian akan membedah representasi JSON dari artefak plan untuk lingkungan dev dan prod.
5. Cermati pengujian kebijakan IAM policy. Pengujian ini menegaskan aksi yang presisi, pembatasan target direktori, dan kondisi awalan `s3:prefix`. Amati bagaimana penggunaan nama bucket langsung memungkinkan evaluasi policy secara transparan pada tahap plan.
6. **Bagian B: Toolkit Kendali Biaya FinOps.** Buka `labs/mod-3-4/finops.py` dan implementasikan kelima fungsi analitik biaya. Data log query berasal dari generator deterministik `labs/shared/querylog.py`. Jalankan pengujian otomatis via `pytest labs/mod-3-4/test_finops.py -v`.
7. Eksplorasi mandiri: gunakan fungsi yang telah Anda bangun untuk menganalisis durasi auto-suspend mana yang paling optimal; identifikasi tim pemilik query liar 11 jam; kalkulasikan akumulasi biaya harian dan uji fungsi `forecast_month` dengan target anggaran $75 pada hari ke-15 dan hari ke-16 (saat query liar terjadi). Pahami mengapa proyeksi hari ke-16 bersifat pesimistis dan bagaimana integrasi `find_runaway` mampu menormalisasi prakiraan tersebut.

### @files
- labs/mod-3-4/terraform/variables.tf :: File kerja Bagian A: deklarasi variabel input Terraform :: starter
- labs/mod-3-4/terraform/main.tf :: File kerja Bagian A: deklarasi resource lakehouse S3, KMS, dan IAM :: starter
- labs/mod-3-4/terraform/outputs.tf :: File kerja Bagian A: definisi output Terraform :: starter
- labs/mod-3-4/terraform/provider.tf :: Konfigurasi AWS provider offline dan default tags bawaan :: config
- labs/mod-3-4/terraform/versions.tf :: Konfigurasi versi Terraform dan provider yang diwajibkan :: config
- labs/mod-3-4/terraform/dev.tfvars :: Parameter konfigurasi untuk lingkungan development :: config
- labs/mod-3-4/terraform/prod.tfvars :: Parameter konfigurasi untuk lingkungan production :: config
- labs/mod-3-4/test_terraform.py :: Suite pengujian Bagian A (12 pengujian memverifikasi plan JSON) :: test
- labs/mod-3-4/finops.py :: File kerja Bagian B: implementasi lima fungsi kalkulasi biaya FinOps :: starter
- labs/mod-3-4/test_finops.py :: Suite pengujian Bagian B (29 pengujian unit test) :: test
- labs/shared/querylog.py :: Dataset deterministik 30 hari riwayat query dengan simulasi query liar :: data
- labs/mod-3-4/requirements.txt :: Dependensi pustaka pytest dan catatan instalasi CLI :: config
- labs/mod-3-4/reference/terraform/main.tf :: Solusi referensi Bagian A: main.tf (coba mandiri terlebih dahulu!) :: reference
- labs/mod-3-4/reference/terraform/variables.tf :: Solusi referensi Bagian A: variables.tf :: reference
- labs/mod-3-4/reference/terraform/outputs.tf :: Solusi referensi Bagian A: outputs.tf :: reference
- labs/mod-3-4/reference/finops.py :: Solusi referensi Bagian B :: reference

### @deliverables
- Bagian A: seluruh 12 pengujian di `test_terraform.py` lulus untuk plan dev dan prod, serta lolos validasi `terraform fmt -check`
- Bagian B: seluruh 29 pengujian di `test_finops.py` lulus dengan sukses
- Ringkasan evaluasi singkat (5 baris) yang memuat rekomendasi durasi auto-suspend, tim pemilik query liar 11 jam, serta analisis respons fungsi forecasting terhadap lonjakan biaya tersebut

### @verify
```bash
pytest labs/mod-3-4/test_terraform.py -v
pytest labs/mod-3-4/test_finops.py -v
```

Verifikasi terhadap kode referensi: tambahkan prefix `LAB_DIR=reference`. Pengujian Terraform otomatis dilewati jika CLI tidak terpasang.

## @chaos Query sebelas jam yang membakar anggaran
### @scenario
Waktu menunjukkan Jumat pukul 22:30 malam. Seorang analis dari divisi marketing menjalankan query eksploratif di data warehouse untuk mencari pelanggan yang membeli dua varian produk secara bersamaan. Karena terburu-buru ingin pulang, ia menggabungkan (join) tabel transaksi pesanan ke dirinya sendiri tanpa menyertakan klausul kondisi join (terjadi Cartesian cross product). Data warehouse bersama yang digunakan memiliki ukuran kapasitas besar, tidak memiliki konfigurasi batas waktu statement timeout, dan durasi auto-suspend disetel ke 1 jam. Query tersebut tidak mengalami error. Ia berjalan membakar komputasi sepanjang malam, berlanjut sepanjang hari Sabtu hingga Sabtu malam, berjalan nonstop selama 11 jam dan membaca 40 TB data.

Tidak ada yang menyadarinya: dashboard analitik harian tetap terbuka normal karena ukuran warehouse cukup besar untuk mengeksekusi query lain di samping query monster tersebut. Pada hari Senin pagi, tim finance terkejut melihat tagihan mingguan cloud dan menanyakan mengapa biaya platform data selama satu akhir pekan melampaui total biaya dua minggu sebelumnya. Pada model simulasi lab, query ini menelan biaya $33 pada warehouse 1-kredit; namun pada warehouse enterprise 16-kredit, 11 jam tersebut membakar biaya $528, dan pada serverless engine berbasis scan data, pembacaan 40 TB menelan tambahan ratusan dolar.

### @cause
Tidak ada pembatas kendali otomatis (*guardrails*) apa pun yang terpasang di antara kesalahan pengetikan sintaks SQL dengan penerbitan faktur tagihan invoice. Rincian kegagalan sistem: ketiadaan batas statement timeout sehingga query diizinkan berjalan selamanya; penggunaan satu warehouse bersama untuk kebutuhan dashboard BI, analis ad-hoc, dan pipeline batch sehingga query liar tidak terisolasi; ketiadaan sistem forecasting atau alert harian sehingga lonjakan biaya 5x lipat di akhir pekan tidak membunyikan alarm darurat; serta ketiadaan monitor kuota kredit yang dapat mematikan warehouse. Evaluasi biaya selama ini hanya dilakukan sebulan sekali oleh staf finance yang tidak memahami asal-usul query teknis.

Faktor pendukung lainnya adalah lambatnya proses pelacakan sumber masalah: tanpa adanya tag tim dan query tag yang konsisten, proses pencarian identitas pelaku membutuhkan investigasi log manual selama dua hari, di mana fokus tim terlanjur bergeser ke saling melempar kesalahan alih-alih memperbaiki sistem kendali.

### @fix
1. Segera batalkan (kill) proses query liar tersebut, dan periksa ringkasan konsumsi kredit aktual melalui usage views penyedia cloud.
2. Pasang batas **statement timeouts** yang ketat pada setiap warehouse dan user role (misalnya 1 jam untuk analis ad-hoc, dan alokasi lebih panjang untuk batch pipeline), serta terapkan **maximum bytes billed** pada serverless scan-based engine.
3. Pisahkan warehouse berdasarkan karakteristik beban kerja (warehouse BI, warehouse ad-hoc analis, warehouse pipeline data), lengkapi masing-masing dengan alokasi kuota anggaran dan **resource monitor** yang memicu peringatan di 50% dan 80% serta men-suspend komputasi di 100%.
4. Integrasikan fungsi deteksi seperti `find_runaway` dan `forecast_month` ke dalam job terjadwal harian yang menganalisis query log; model proyeksi seharusnya sudah membunyikan alarm darurat pada Sabtu pagi.
5. Wajibkan penyematan tag identitas tim dan tag query pada setiap transaksi (ditegakkan via konfigurasi Terraform dan role warehouse), serta gelar sesi evaluasi mingguan untuk meninjau 10 query dengan biaya termahal.
6. Tuangkan seluruh parameter pembatas ini ke dalam kode Terraform agar tidak dapat diubah seenaknya melalui klik mouse dan agar setiap warehouse baru otomatis mewarisi konfigurasi keamanan biaya secara default.

### @pattern
Biaya infrastruktur adalah metrik produksi. Pasang pembatas otomatis di dalam kode, buat proyeksi prakiraan biaya setiap hari, dan pastikan setiap rupiah pengeluaran cloud dapat dilacak ke tim pemiliknya sebelum insiden terjadi, bukan setelahnya.

## @quiz
### Apa fungsi utama dari file Terraform state, dan mengapa pengelolaannya wajib dilakukan secara ekstra hati-hati?
- [ ] Mencatat seluruh riwayat commit Git dari konfigurasi infrastruktur, sehingga file state wajib di-commit ke repositori Git
- [x] Memetakan resource di kode ke objek nyata di cloud dan dapat memuat rahasia, sehingga dikelola di remote backend yang terkunci
- [ ] Menyimpan cache plugin provider agar proses pembuatan plan berjalan lebih cepat, itulah sebabnya file ini aman dibagikan ke publik
- [ ] Menyimpan password akun cloud utama agar Terraform dapat melakukan login, dan tidak ada informasi lain yang disimpan di dalamnya

> Tanpa state file, Terraform tidak dapat membedakan operasi penambahan baru dengan pembaruan objek yang sudah ada. State file memuat atribut fisik dan terkadang rahasia, sehingga disimpan di remote backend terenkripsi dengan fitur state locking agar tidak terjadi apply ganda simultan.

### Pada eksekusi `terraform plan`, Anda melihat simbol `-/+` di samping deklarasi database produksi setelah sebuah perubahan kecil. Apa artinya dan apa tindakan Anda?
- [ ] Database akan diperbarui di tempat tanpa downtime, sehingga rancangan plan dapat langsung disetujui
- [ ] Terraform hanya mendeteksi perubahan sepele pada tag, yang ditampilkan dengan simbol ini dan aman bagi data
- [x] Database akan dihancurkan lalu dibuat ulang dari awal, jadi hentikan dan cari atribut mana yang memicu penggantian
- [ ] Database kedua akan dibuat berdampingan dengan database pertama agar lalu lintas traffic dapat dialihkan secara mulus

> Simbol `-/+` menandakan tindakan replacement (penghancuran dan pembuatan baru). Mengubah nama atau atribut immutable akan menghancurkan resource lama, yang pada database berarti menghapus seluruh data produksi Anda! Lindungi database penting dengan atribut `prevent_destroy`.

### Mengapa lab modul ini mengonstruksi ARN bucket langsung dari nama bucket alih-alih menggunakan atribut `arn` bawaan resource bucket?
- [ ] Nama bucket dijamin unik melintasi seluruh akun AWS, sedangkan format ARN tidak unik sehingga berisiko bentrok
- [ ] Terraform melarang data source untuk merujuk pada atribut apa pun dari resource yang berada di dalam konfigurasi yang sama
- [x] Nilai yang diturunkan dari nama sudah diketahui saat tahap plan, sehingga seluruh isi kebijakan IAM terlihat di plan
- [ ] Atribut `arn` pada resource bucket hanya didukung pada versi provider versi lama yang sudah tidak digunakan lagi

> Atribut yang ditetapkan oleh cloud berstatus "known after apply", yang menyembunyikan isi teks policy dari peninjau code review dan pengujian otomatis berbasis plan. Menurunkannya dari input nama membuat seluruh fakta keamanan dapat ditinjau sejak tahap plan.

### Sebuah pipeline hanya membutuhkan izin membaca dan menulis pada layer `silver/` dan `gold/`. Kebijakan IAM mana yang mematuhi prinsip least privilege?
- [ ] Memberikan izin aksi `s3:*` khusus pada bucket tunggal tersebut saja, karena cakupannya sudah terbatas pada satu proyek
- [ ] Memberikan izin `s3:GetObject` dan `s3:PutObject` pada seluruh bucket di akun cloud agar pipeline dapat digunakan kembali di proyek lain
- [x] Memberikan izin `s3:GetObject` dan `s3:PutObject` pada `silver/*` dan `gold/*`, dengan listing dibatasi pada prefix tersebut
- [ ] Memberikan hak akses Administrator penuh yang dinonaktifkan secara otomatis oleh kondisi policy di luar jam kerja kantor

> Berikan hanya izin aksi yang memang dibutuhkan pada target resource yang spesifik. Jika kredensial pipeline tersebut bocor, penyerang tidak dapat menghapus data, membaca folder `raw/`, atau mengubah kebijakan keamanan bucket.

### Pada warehouse yang menagih biaya per detik selama aktif, durasi auto-suspend diubah dari 60 detik menjadi 1 jam untuk beban query yang sama. Apa yang terjadi pada tagihan?
- [ ] Tagihan tetap sama persis, karena penagihan hanya menghitung detik-detik di mana query benar-benar sedang dieksekusi di prosesor
- [ ] Tagihan akan turun, karena warehouse yang terus aktif mempertahankan cache lokal sehingga query berikutnya selesai lebih cepat
- [x] Tagihan melonjak drastis, karena setiap jeda yang lebih pendek dari jendela suspend membuat warehouse tetap aktif dan ditagih
- [ ] Tagihan hanya berubah untuk query pertama di hari tersebut, karena warehouse hanya perlu dinyalakan tepat satu kali

> Anda membayar durasi waktu aktif mesin (uptime), termasuk waktu menganggur pasca query selesai. Pada pengujian lab modul ini, beban kerja riil 33 jam yang sama menelan biaya $188 pada auto-suspend 60 detik dan membengkak ke $995 pada durasi 1 jam.

### Mengapa lab modul ini menggunakan nilai median dari durasi query tim, dan bukan nilai rata-rata (mean), untuk mendeteksi query liar?
- [ ] Nilai median jauh lebih cepat dihitung pada dataset log berukuran besar, sedangkan rata-rata membutuhkan iterasi berulang
- [ ] Nilai rata-rata tidak dapat dikalkulasikan untuk satuan waktu, sehingga secara matematis hanya nilai median yang terdefinisi
- [x] outlier raksasa mendistorsi rata-rata hingga menyamarkan dirinya sendiri, sedangkan median tetap stabil di batas normalnya
- [ ] Nilai median secara langsung menunjukkan query dengan durasi terpanjang dalam kelompok tanpa perlu perbandingan tambahan

> Satu query berdurasi 1.000 detik di antara empat query 10 detik mengangkat nilai rata-rata menjadi 208 detik, sehingga aturan deteksi 10x rata-rata akan melewatkannya. Sebaliknya nilai median tetap di 10 detik dan sukses menangkap query 1.000 detik tersebut.

### Mengapa memindahkan data yang sering dibaca ke kelas penyimpanan dingin (colder tier) justru dapat menghasilkan biaya yang lebih mahal?
- [ ] Kelas penyimpanan dingin selalu mengenakan enkripsi ganda yang melipatgandakan tarif biaya per gigabyte yang tersimpan
- [ ] Aturan lifecycle ditagihkan per aturan dan per objek, sehingga biaya aturan melampaui penghematan kapasitas yang diperoleh
- [x] Kelas penyimpanan dingin mengenakan tarif biaya per GB data yang dibaca (retrieval fee) dan memiliki syarat durasi simpan minimum
- [ ] Penyimpanan dingin dilarang keras untuk dibaca sama sekali, sehingga data harus disalin kembali ke kelas standar sebelum dapat diakses

> Kelas penyimpanan dingin memang menawarkan tarif kapasitas simpan per GB yang lebih murah, namun menambahkan biaya pengambilan data (retrieval fees) dan batas minimal durasi sewa. Mengarsipkan data yang aktif diakses akan menghapus penghematan biaya tersebut.

### Langkah kendali otomatis mana yang paling efektif dan berbiaya paling murah untuk menghentikan query liar 11 jam di awal kejadian?
- [ ] Menggelar rapat evaluasi mingguan untuk meninjau tagihan invoice sehingga anomali akhir pekan dapat didiskusikan bersama tim
- [ ] Membuat peraturan tertulis bahwa analis wajib memberi tahu tim data sebelum mengeksekusi query yang diperkirakan berukuran besar
- [x] Memasang batas statement timeout pada konfigurasi warehouse, didampingi alert kuota anggaran yang memicu peringatan dini otomatis
- [ ] Mengalokasikan warehouse berkapasitas lebih besar untuk seluruh perusahaan agar query tunggal memakan persentase waktu lebih kecil

> Mengandalkan disiplin manusia pada Jumat malam pukul 22:30 tidak realistis. Statement timeout secara otomatis mematikan query yang menggantung, dan monitor anggaran membunyikan alarm sebelum tagihan akhir bulan membengkak.

## @resources
- [Dokumentasi Resmi Terraform](https://developer.hashicorp.com/terraform/docs)
- [Dokumentasi AWS Provider untuk Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Dokumentasi OpenTofu](https://opentofu.org/docs/)
- [Panduan Keamanan IAM Best Practices AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Panduan Kelas Penyimpanan Amazon S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
- [Kerangka Kerja dan Prinsip FinOps Foundation](https://www.finops.org/framework/)
- [Checkov: Policy-as-Code Scanner untuk Terraform](https://www.checkov.io/)
- [Infracost: Estimasi Biaya Cloud pada Pull Request](https://www.infracost.io/docs/)

