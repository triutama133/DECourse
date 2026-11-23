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

## @part Infrastructure as code dan keamanan

## @lesson Mengapa Infrastructure as Code
Bayangkan sebuah bucket object storage tempat seluruh pipeline analitik perusahaan menulis data transaksi setiap hari. Seseorang membuatnya delapan bulan lalu melalui antarmuka web AWS console. Konfigurasi enkripsi apa yang sebenarnya aktif di sana? Siapa saja pengguna atau service account yang memiliki izin membaca? Mengapa salinan bucket di lingkungan staging berperilaku berbeda dengan lingkungan produksi? Tidak ada seorang pun di tim yang dapat menjawabnya dengan pasti, karena kebenaran arsitektur hanya tersimpan di halaman web dan ingatan manusia yang fana.

**Infrastructure as Code (IaC)** mendeskripsikan seluruh topologi infrastruktur komputasi dan penyimpanan ke dalam file teks deklaratif yang disimpan rapi di dalam Git. Pendekatan ini menghadirkan disiplin rekayasa perangkat lunak modern ke dunia infrastruktur data:

- **Dapat Ditinjau (Reviewable).** Setiap perubahan hak akses atau penambahan resource baru diajukan melalui Pull Request (PR) yang wajib dibaca dan disetujui rekan kerja sebelum dieksekusi secara fisik.
- **Dapat Direproduksi (Repeatable).** Lingkungan development, staging, dan production dibangun dari basis kode sumber yang sama persis, sehingga perbedaannya hanya terletak pada parameter variabel yang Anda definisikan secara eksplisit.
- **Dapat Diaudit (Auditable).** Riwayat `git log` menjawab secara transparan siapa yang memperluas izin akses, kapan tindakan tersebut dilakukan, dan tiket bisnis apa yang melandasinya.
- **Dapat Dipulihkan dari Bencana (Recoverable).** Jika seluruh data center cloud di suatu region mengalami kebakaran atau akun diretas, Anda dapat membangun kembali seluruh infrastruktur data dari kode dalam hitungan menit tanpa mengandalkan ingatan manusia.
- **Dapat Diuji secara Otomatis (Testable).** Seperti yang akan Anda buktikan di lab, konfigurasi infrastruktur dapat diverifikasi keamanannya oleh skrip otomatis *sebelum* resource tersebut benar-benar dibuat di cloud.

Alat IaC terbagi ke dalam dua gaya arsitektur. Pendekatan **imperatif** mendeskripsikan *langkah demi langkah (how)*: "buat bucket, lalu aktifkan enkripsi, lalu pasang policy". Pendekatan **deklaratif** mendeskripsikan *kondisi akhir yang diinginkan (what)*: "sebuah bucket dengan konfigurasi keamanan X, Y, dan Z harus ada". Engine IaC kemudian membandingkan deklarasi Anda dengan kondisi nyata di cloud dan menghitung langkah-langkah transisinya. Terraform (beserta fork open-source-nya, OpenTofu), AWS CloudFormation, dan Pulumi menganut paradigma deklaratif. Alat deklaratif aman untuk dieksekusi berkali-kali: eksekusi kedua tidak akan melakukan apa pun jika kondisi nyata sudah sesuai. Karakteristik ini—**idempotensi**—adalah prinsip yang sama persis dengan yang Anda terapkan pada pipeline data di Modul 0.2.

Praktik mengonfigurasi cloud secara manual lewat browser ("ClickOps") dilarang bukan karena mengklik mouse itu sulit. Praktik ini dilarang karena perubahan konsol tidak meninggalkan jejak review, mustahil direproduksi secara identik, dan menjadi sumber bencana pertama saat terjadi insiden di tengah malam.

> 🛠 **Coba sendiri (15 menit, Python).** Modelkan alat deklaratif. `desired` adalah dict resource: `raw-bucket` (`encryption: True, versioning: True`), `curated-bucket` (`encryption: True, versioning: False`), dan `etl-role` (`policy: "read-raw"`). `actual` berisi `raw-bucket` (`encryption: False, versioning: True`), `old-bucket` (`encryption: True`), dan `etl-role` (`policy: "read-raw"`). Tulis `plan(desired, actual)` yang mengembalikan list `("create" | "update" | "destroy", name)` dan `apply(...)` yang membuat `actual` sama dengan yang diinginkan. Cetak plan-nya, terapkan, lalu cetak plan-nya lagi.
>
> **Seharusnya Anda melihat:** `[('create', 'curated-bucket'), ('update', 'raw-bucket'), ('destroy', 'old-bucket')]` lalu `[]`. Run kedua tidak menemukan apa pun untuk dikerjakan: itulah arti "aman dijalankan dua kali", dan itulah inti `terraform plan` dan `apply`. Baris `destroy` adalah baris yang dibaca dua kali oleh reviewer yang teliti.

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
- **Resource**: objek fisik yang dibuat, diperbarui, dan dihancurkan oleh Terraform di cloud. Sebaliknya, **Data Source** (`data "..."`) hanya membaca atau menghitung metadata tanpa membuat infrastruktur baru. Pada lab modul ini, dokumen kebijakan **IAM** (Identity and Access Management) didefinisikan sebagai data source: ia mengompilasi struktur JSON policy izin akses secara matematis tanpa membuat resource IAM role baru.
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

> 💡 **Jeda Praktik 1 (Deklarasi Variabel & Validasi Lingkungan Terraform):**
> 1. Buka file `labs/mod-3-4/terraform/variables.tf` di teks editor Anda. Jangan jalankan file Terraform secara langsung tanpa CLI.
> 2. Deklarasikan variabel input: `env` (dengan validasi kondisi hanya menerima dev atau prod), `project`, `owner`, `cost_center`, `raw_archive_days`, dan `enable_versioning` lengkap dengan tipe data dan deskripsinya.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-4/test_terraform.py -k TestHygiene -v`
> 4. **Indikator Sukses:** Seluruh pengujian di kelas `TestHygiene` berstatus `PASSED` (atau dilewati secara rapi jika Terraform CLI belum terpasang), memvalidasi format HCL, sintaksis yang benar, dan penolakan otomatis terhadap nilai lingkungan yang tidak valid.

## @lesson Mengamankan data lakehouse
Lab modul ini memandu Anda membangun lapisan penyimpanan lakehouse dari Modul 2.2 menggunakan Terraform, dengan empat pilar pengamanan wajib standar enterprise:

**1. Blokir Akses Publik (Block Public Access).** Kebocoran data pelanggan akibat bucket yang terbuka bebas di internet umumnya berakar dari kelalaian konfigurasi manual. Mendeklarasikan resource `aws_s3_bucket_public_access_block` dengan keempat parameter disetel ke `true` secara permanen mencegah bucket terekspos ke publik, apa pun kebijakan **ACL** (Access Control List, daftar aturan akses lama) atau policy yang mungkin ditulis seseorang secara tergesa-gesa di masa depan.

**2. Enkripsi Terkelola Mandiri (Customer-Managed KMS Encryption).** Secara default S3 menjalankan **SSE** (Server-Side Encryption, enkripsi sisi server otomatis sebelum disimpan ke disk) memakai kunci bawaan AWS. Menggunakan kunci **KMS (Key Management Service)** milik organisasi Anda sendiri menambahkan lapisan proteksi ganda: pembaca data wajib memiliki izin pada data bucket sekaligus izin dekripsi pada kunci KMS, mencatat jejak audit akses di CloudTrail, serta memungkinkan pencabutan izin secara instan dari satu titik pusat. Aktifkan fitur **rotasi kunci otomatis (key rotation)** agar risiko kebocoran kunci lama terisolasi dalam rentang waktu tertentu.

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

Catatan arsitektur krusial dari lab: Jika dokumen IAM policy Anda merujuk langsung ke atribut `aws_s3_bucket.lakehouse.arn` (**ARN** = *Amazon Resource Name*, alamat pengenal unik global AWS seperti `arn:aws:service:region:account:resource`), nilai ARN tersebut berstatus *baru diketahui setelah apply (known after apply)*, sehingga isi JSON policy tidak dapat dibaca oleh reviewer pada tahap plan dan hanya menampilkan teks `(known after apply)`. Namun jika Anda mengonstruksi string ARN langsung dari nama bucket (`arn:aws:s3:::${local.bucket_name}`), keseluruhan detail teks kebijakan keamanan dapat dievaluasi secara transparan pada tahap plan review. Desainlah konfigurasi Terraform Anda agar fakta keamanan selalu terlihat jelas saat code review.

**Tagging Resources.** Konfigurasikan blok `default_tags` pada provider AWS agar setiap resource otomatis disematkan tag `Project`, `Environment`, `Owner`, dan `CostCenter`. Tagging inilah yang menjadi kunci transparansi biaya pada materi FinOps berikutnya.

:::ask VPC Anda adalah `10.0.0.0/16`. Anda membaginya menjadi subnet `/20`. Berapa subnet yang Anda dapat?
@options
4 subnet, satu per langkah prefiks
* 16 subnet: empat bit tambahan membuat 2 x 2 x 2 x 2
256 subnet, satu per bit host
@why
`/20` punya 4 bit jaringan lebih banyak daripada `/16`, jadi ada 2^4 = 16 subnet, masing-masing 4.096 alamat (4.091 dapat dipakai di AWS, yang menyimpan 5). Ukuran sulit diubah kemudian, jadi rencanakan sebelum membangun.
:::

:::ask Sebuah job hanya perlu membaca file di bawah `s3://lake/raw/`. Kebijakan IAM mana yang mengikuti least privilege?
@options
`"Action": "s3:*"` pada `"Resource": "*"`
kebijakan terkelola `AdministratorAccess`
* `"Action": "s3:GetObject"` pada `arn:aws:s3:::lake/raw/*`
@why
Least privilege hanya memberikan **aksi** dan **resource** yang dibutuhkan job: membaca objek, di bawah satu prefix. Wildcard mengubah satu kredensial yang bocor menjadi akses ke segalanya.
:::

> 💡 **Jeda Praktik 2 (Keamanan Bucket S3 & Kebijakan IAM Least-Privilege):**
> 1. Buka file `labs/mod-3-4/terraform/main.tf` dan `labs/mod-3-4/terraform/outputs.tf` di teks editor Anda.
> 2. Lengkapi resource S3 bucket, blokir akses publik (`aws_s3_bucket_public_access_block` keempat flag bernilai `true`), kunci KMS terkelola mandiri dengan rotasi aktif, enkripsi SSE default, aturan lifecycle penyimpanan raw, dan kebijakan IAM policy yang membatasi aksi hanya pada layer silver dan gold.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-4/test_terraform.py -v`
> 4. **Indikator Sukses:** Seluruh 12 pengujian di `test_terraform.py` berstatus `PASSED` (atau dilewati jika CLI belum terpasang), membuktikan bahwa execution plan offline dev dan prod memenuhi seluruh standar keamanan korporat.

### Siapa mengamankan apa, dan jaringan di sekitar data

**Tanggung jawab bersama.** AWS menggambarkan pembagiannya sebagai keamanan "dari" cloud (*of the cloud*) versus keamanan "di dalam" cloud (*in the cloud*). AWS melindungi infrastrukturnya: hardware, software, jaringan, dan fasilitas yang menjalankan layanannya. Anda bertanggung jawab atas apa yang Anda bangun di atasnya, dan seberapa banyak itu bergantung pada layanannya: di mesin virtual Anda juga menambal sistem operasinya; di S3 Anda mengatur akses, enkripsi, dan lifecycle. Setiap perlindungan di atas ada di sisi Anda: provider tidak akan memblokir akses publik, menulis policy least-privilege, atau merotasi kunci Anda untuk Anda.

**Jaringan.** **VPC** (Virtual Private Cloud) adalah jaringan privat terisolasi Anda di dalam satu region cloud. Anda memilih rentang alamatnya dalam notasi **CIDR** (Classless Inter-Domain Routing): `10.0.0.0/16` berarti 16 bit pertama tetap, sehingga tersisa 2¹⁶ = 65.536 alamat. Anda memotongnya menjadi **subnet** (di AWS antara `/16` dan `/28`), dan AWS mencadangkan empat alamat pertama dan satu alamat terakhir di setiap subnet, jadi sebuah subnet selalu punya 5 alamat terpakai lebih sedikit daripada ukurannya. Subnet **publik** punya rute ke internet; subnet **privat** tidak. Database, komputasi warehouse, dan worker pipeline tempatnya di subnet privat: tidak ada apa pun di internet yang bahkan bisa mencoba menjangkaunya.

Dua jenis aturan firewall mengatur lalu lintas, dan perilakunya berbeda:

| | Security group | Network ACL |
|---|---|---|
| Dipasang pada | sebuah resource (network interface-nya) | seluruh subnet |
| Status | **stateful**: balasan untuk lalu lintas yang diizinkan otomatis diizinkan | **stateless**: balasan butuh aturannya sendiri |
| Aturan | hanya aturan **allow**; grup baru tidak mengizinkan apa pun masuk | aturan allow **dan** deny, bernomor |

Alat sehari-harinya adalah security group: "database warehouse hanya menerima port 5432 dari subnet privat". Aturan dengan `0.0.0.0/0` (seluruh internet) pada port database adalah versi jaringan dari bucket publik.

Pipeline terus-menerus membaca S3. Tanpa bantuan, lalu lintas itu dari subnet privat butuh jalan ke internet. **Gateway endpoint** untuk S3 justru menambahkan rute di route table subnet, sehingga data tidak pernah keluar dari jaringan AWS, dan AWS mendokumentasikan "no additional charge for using gateway endpoints". Layanan lain bisa dijangkau secara privat melalui **interface endpoint** (AWS PrivateLink).

**Keamanan sebagai kebiasaan.** *Fundamentals of Data Engineering* membedakan teater keamanan (aturan di atas kertas) dari kebiasaan keamanan (apa yang Anda lakukan setiap hari). Kebiasaan yang paling penting dalam pekerjaan data: least privilege sebagai bawaan; tidak ada yang publik tanpa alasan tertulis; rahasia tidak pernah di dalam kode (Modul 0.1); anggap kredensial suatu hari akan bocor dan batasi apa yang bisa dijangkaunya; baca setiap plan untuk perubahan yang menyangkut keamanan; dan jalankan `plan` secara terjadwal supaya perubahan buatan tangan ditemukan oleh Anda, bukan oleh penyerang.

**Autentikasi Cloud Tanpa Kunci Statis (Workload Identity / OIDC vs. Static Access Keys).** Kunci statis berumur panjang (`AWS_ACCESS_KEY_ID` atau file `.json` service account GCP) berbahaya karena ia berfungsi bagi siapa pun yang menemukannya, dari mana pun, sampai ada yang menyadari dan mencabutnya; kunci yang ter-commit ke Git atau tertinggal di laptop adalah persis cara hal itu terjadi. Di lingkungan produksi modern, platform data menggunakan **identitas sementara tanpa kunci statis (keyless identity)**:
- Container atau worker yang berjalan di EC2, ECS, EKS, Cloud Run, atau GKE menggunakan **IAM Role / Service Account terlampir** (melalui AWS IRSA, GCP Workload Identity, atau Azure Managed Identity). Platform memberikan kredensial sementara kepada container, yang kedaluwarsa dan diganti otomatis.
- Pipeline CI/CD GitHub Actions yang menjalankan `terraform plan` atau `dbt build` masuk menggunakan **federasi OpenID Connect (OIDC)**: GitHub mengirimkan token bertanda tangan untuk repositori dan branch tersebut, lalu layanan token cloud mengembalikan kredensial sementara (untuk `aws-actions/configure-aws-credentials` masa berlaku bawaannya satu jam, bisa diubah dengan `role-duration-seconds`). Tidak ada rahasia permanen yang disimpan di GitHub.

**Peta Rosetta Multi-Cloud (AWS vs. GCP vs. Azure untuk Data Engineer).** Dari 1.130 lowongan data engineering yang diukur di TalentHub (2026-07-23 sampai 2026-11-20), **65,3%** menyebut minimal satu cloud utama (AWS, GCP, atau Azure). Karena hukum fisika jaringan, object storage, dan IAM di ketiganya sama, pahami mekanisme dasarnya sekali lalu petakan nama layanannya di ketiga cloud:

| Kapabilitas Arsitektur Cloud | Amazon Web Services (AWS) | Google Cloud Platform (GCP) | Microsoft Azure |
|---|---|---|---|
| **Object Storage (Fondasi Lakehouse)** | Amazon S3 (`s3://`) | Google Cloud Storage (`gs://`) | Azure Data Lake Storage Gen2 (`abfss://`) |
| **Identitas Tanpa Kunci (Workload IAM)** | IAM Roles, STS & IRSA (OIDC) | IAM Service Accounts & Workload Identity | Entra ID (Azure AD) Managed Identities |
| **Enkripsi KMS & Brankas Rahasia** | AWS KMS + Secrets Manager | Cloud KMS + Secret Manager | Azure Key Vault |
| **Jaringan Privat ke Object Storage** | S3 Gateway Endpoint & AWS PrivateLink | Private Google Access & Private Service Connect | Virtual Network Service Endpoints & Private Link |
| **Cloud Data Warehouse** | Amazon Redshift (RA3 / Serverless) | Google BigQuery (On-Demand / Editions) | Azure Synapse Analytics / Microsoft Fabric |
| **Managed Spark & Komputasi Lakehouse** | AWS EMR / AWS Glue / Databricks | Cloud Dataproc / BigQuery Spark | Azure Databricks / HDInsight / Fabric |
| **Event Streaming & Antrean Pesan** | Amazon MSK (Kafka) / Kinesis | Cloud Pub/Sub / Managed Kafka | Azure Event Hubs |

> 🛠 **Coba sendiri (10 menit, Python).** VPC Anda adalah `10.0.0.0/16`. Dengan modul `ipaddress`, pecah menjadi subnet `/20`. Ada berapa, berapa alamat di masing-masing, dan berapa yang bisa Anda pakai di AWS? Subnet mana yang berisi `10.0.37.5`? Berapa subnet `/24` yang muat dalam satu `/20`?
>
> **Seharusnya Anda melihat:** `16` subnet berisi `4096` alamat, `4091` bisa dipakai di AWS (5 dicadangkan); `10.0.37.5` ada di `10.0.32.0/20`, subnet ketiga; dan satu `/20` memuat `16` `/24`. Ukuran sulit diubah belakangan: ubah rentang sebuah subnet dan plan Terraform menyatakan subnet itu `must be replaced` (`# forces replacement`), sehingga semua yang berjalan di dalamnya harus pindah. Sisakan ruang untuk tumbuh.

> 🛠 **Coba sendiri (25 menit, terminal, opsional: perlu AWS tiruan dari pelajaran terakhir modul ini).** Di folder baru, salin `versions.tf` dari lab dan `labs/mod-3-4/local-aws/local_aws_override.tf`, tambahkan blok provider dengan `region = "ap-southeast-3"`, lalu tulis jaringannya sendiri: VPC `10.0.0.0/16`; subnet publik dan privat yang dibuat dengan `cidrsubnet(…, 4, 0)` dan `cidrsubnet(…, 4, 1)`; route table yang dikaitkan ke subnet privat; security group `warehouse-db` yang hanya mengizinkan TCP 5432 dari rentang subnet privat; dan S3 gateway endpoint (`com.amazonaws.ap-southeast-3.s3`) pada route table itu. Terapkan, lalu periksa dengan `aws --endpoint-url http://127.0.0.1:5055 ec2 describe-subnets --query 'Subnets[].[CidrBlock,AvailableIpAddressCount]'`. Terakhir, buka database ke seluruh dunia dengan tangan, `aws --endpoint-url http://127.0.0.1:5055 ec2 authorize-security-group-ingress --group-id <id grup Anda> --protocol tcp --port 5432 --cidr 0.0.0.0/0`, lalu jalankan `terraform plan -detailed-exitcode`.
>
> **Seharusnya Anda melihat:** `Apply complete! Resources: 7 added` (sekitar 15 detik); kedua subnet dengan `4091` alamat tersedia, angka dari Coba sendiri pertama; dan rute di route table privat ke prefix list S3 (`pl-…`) melalui endpoint (`vpce-…`). Setelah perubahan buatan tangan itu, plan keluar dengan kode `2`, menyatakan security group `will be updated in-place`, menunjukkan `- "0.0.0.0/0"`, dan diakhiri `Plan: 0 to add, 1 to change, 0 to destroy.`; `apply` menutup lubangnya. Diukur dengan Terraform 1.17.2, AWS provider 5.100.0, dan moto 5.2.5; `destroy` memakan sekitar 17 detik.

## @part Biaya dan arsitektur

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

:::ask Pipeline di subnet privat membaca S3 sepanjang hari lewat NAT gateway, yang menagih per GB yang diproses. Jalur apa yang lebih murah dan lebih privat?
@options
NAT gateway yang lebih besar dengan kapasitas lebih
* gateway endpoint S3: rute yang melewati NAT
kirim data lewat internet publik
@why
Gateway endpoint menambahkan rute ke S3 tanpa mengirim lalu lintas lewat NAT gateway, jadi tidak ada biaya pemrosesan NAT per GB dan lalu lintas tidak pernah meninggalkan jaringan AWS. Jalur jaringan adalah satu baris tagihan, bukan renungan belakangan.
:::

> 💡 **Jeda Praktik 3 (Pemodelan Biaya Warehouse & Alokasi Tag FinOps):**
> 1. Buka file `labs/mod-3-4/finops.py` di teks editor Anda.
> 2. Implementasikan fungsi `query_cost(seconds, credits_per_hour, price_per_credit)` untuk menghitung biaya komputasi warehouse, `billed_seconds(queries, auto_suspend_s, minimum_s)` yang memodelkan penagihan waktu idle dan batas minimum 60 detik, serta `cost_by_tag(log)` untuk mengalokasikan total biaya per tim departemen.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestQueryCost or TestBilledSeconds or TestCostByTag" -v`
> 4. **Indikator Sukses:** Sebanyak 14 pengujian berstatus `PASSED` dalam hitungan milidetik murni Python, memvalidasi kalkulasi tagihan uptime warehouse dan alokasi biaya per tim.

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

:::advanced Pipeline CI/CD produksi untuk Terraform (GitHub Actions)
**Pipeline CI/CD GitHub Actions Produksi untuk Terraform (Keyless OIDC + Pemindai Keamanan Trivy + Plan Review).** Berikut adalah workflow GitOps standar yang digunakan tim Data Engineering produksi untuk memeriksa format, memindai celah keamanan IAM/S3, membuat `plan` pada Pull Request, dan mengeksekusi `apply` tanpa menyimpan satu pun kunci statis AWS di GitHub:

```yaml
# .github/workflows/terraform-lakehouse.yml
name: Terraform Lakehouse CI/CD
on:
  pull_request:
    paths: ["terraform/**"]
  push:
    branches: ["main"]
    paths: ["terraform/**"]

permissions:
  id-token: write        # Wajib untuk federasi OIDC AWS tanpa kunci statis
  contents: read
  pull-requests: write   # Wajib untuk menulis hasil terraform plan ke komentar PR

jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: terraform
    steps:
      - uses: actions/checkout@v5
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: "1.17.2"

      # 1. Pemeriksaan statis cepat (tanpa kredensial cloud)
      - name: Format & Syntax Check
        run: |
          terraform fmt -check -recursive
          terraform init -backend=false
          terraform validate

      # 2. Policy-as-Code Security Scan (Menolak PR jika ada bucket publik, tanpa KMS, atau IAM '*')
      - name: Trivy IaC Security Scan
        uses: aquasecurity/trivy-action@v0.36.0   # sematkan rilis (atau SHA commit), jangan pernah @master
        with:
          scan-type: "config"
          scan-ref: "terraform/"
          exit-code: "1"
          severity: "HIGH,CRITICAL"

      # 3. Autentikasi OIDC Tanpa Kunci Statis ke AWS (kredensial sementara, bawaannya satu jam)
      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsTerraformRole
          aws-region: ap-southeast-3

      # 4. Buat plan terhadap remote state dengan penguncian (state locking)
      - name: Terraform Init & Plan
        run: |
          terraform init
          terraform plan -var-file=prod.tfvars -out=tfplan

      # 5. Jalankan Apply HANYA setelah PR disetujui dan di-merge ke branch main
      - name: Terraform Apply (Main Branch Only)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan
```
:::

> 💡 **Jeda Praktik 4 (Guardrails FinOps: Deteksi Query Liar, Forecasting & Tiering Storage):**
> 1. Buka file `labs/mod-3-4/finops.py` di teks editor Anda.
> 2. Implementasikan fungsi `find_runaway(log, factor)` menggunakan median durasi tim untuk menangkap outlier ekstrem, `forecast_month(daily_costs, days_in_month, budget)` untuk memproyeksikan tanggal jebolnya anggaran bulanan, serta `storage_cost(objects, archive_after_days)` untuk memodelkan trade-off biaya arsip dingin vs retribusi retrieval.
> 3. Jalankan pengujian di terminal:
>    `pytest labs/mod-3-4/test_finops.py -k "TestFindRunaway or TestForecast or TestStorageCost" -v`
> 4. **Indikator Sukses:** Sebanyak 15 pengujian berstatus `PASSED` dalam hitungan milidetik murni Python, membuktikan guardrails deteksi anomali query, proyeksi anggaran, dan analisis tiering data bekerja akurat.

## @lesson Di bawah cloud: kecepatan storage, biaya jaringan, dan memilih teknologi
> **Intinya:** Cloud tetap terbuat dari disk, memori, dan kabel jaringan, dan setiap lapisan di bawahnya jauh lebih lambat dari lapisan di atasnya. Memindahkan data antar-zone, antar-region, dan ke internet ditagih per gigabyte, dan pada klaster yang sibuk biayanya bisa melebihi biaya komputasi. Saat memilih teknologi, hitung juga waktu engineering yang akan dihabiskannya selain tagihannya, dan utamakan keputusan yang bisa dibatalkan.

Pelajaran ini bersumber dari bab 3, 4, dan 6 serta lampiran B *Fundamentals of Data Engineering*.

### 1. Seberapa jauh datanya?
Latensi byte pertama yang umum untuk setiap lapisan, dan di mana data engineer menemuinya:

| Lapisan | Latensi umum | Di mana Anda menemuinya |
|---|---|---|
| Cache CPU | sekitar 1 sampai 10 nanodetik | Engine tervektorisasi (DuckDB, Arrow) bekerja pada batch yang muat di cache |
| Memori (RAM) | sekitar 100 nanodetik | Hash table untuk join, broadcast join, Redis, indeks vektor |
| SSD NVMe lokal | sekitar 0,1 milidetik | State streaming (RocksDB), spill shuffle Spark, cache warehouse |
| Disk jaringan (EBS) atau hard disk | sekitar 1 sampai 10 milidetik | File data PostgreSQL, segmen log Kafka |
| Object storage (S3, GCS) | puluhan milidetik per request | File Parquet dan Iceberg di lakehouse |
| Arsip (S3 Glacier) | menit hingga jam untuk dipulihkan | Data mentah lama yang disimpan untuk audit |

Lompatan dari memori ke object storage adalah faktor ratusan ribu kali. Itulah sebabnya setiap request ke S3 sebaiknya mengambil banyak data (file 100 MB atau lebih, bukan jutaan file kecil; Modul 3.0) dan mengapa job yang spill ke disk tiba-tiba melambat.

### 2. Biaya jaringan
Di dalam satu *availability zone* (AZ: satu pusat data di dalam region), lalu lintas antar-mesin biasanya gratis. Di luar itu, di AWS dengan harga daftar (cek halaman harga terbaru; cloud lain mirip):

- **Antar-zone di region yang sama:** $0,01 per GB ditagih di setiap sisi, jadi $0,02 untuk setiap GB yang menyeberang. Klaster yang tersebar di tiga zone dan melakukan shuffle 50 TB sehari mengirim sekitar dua pertiganya ke zone lain: 33.000 GB × $0,02 ≈ **$667 sehari, sekitar $20.000 sebulan**, hanya untuk memindahkan data.
- **Antar-region, atau keluar ke internet:** sekitar $0,02 sampai $0,09 per GB. Tempatkan komputasi di region yang sama dengan storage-nya. Ini disebut *data gravity*: data mahal untuk dipindahkan, jadi pekerjaanlah yang mendatangi data.
- **NAT gateway:** (Network Address Translation — gerbang agar server di subnet privat bisa mengirim request keluar tanpa membuka akses masuk dari internet) lalu lintas dari mesin privat ke S3 melalui NAT gateway membayar biaya pemrosesan $0,045 per GB. *S3 gateway endpoint* mengirim lalu lintas yang sama secara gratis.

### 3. Memilih teknologi
- **Keputusan yang bisa dan yang sulit dibatalkan.** Menyimpan tabel dalam format terbuka (Parquet, Iceberg) mudah dibatalkan: Anda bisa beralih dari DuckDB ke Trino atau Spark tanpa memindahkan data. Menaruh seluruh logika bisnis di stored procedure milik satu vendor sulit dibatalkan. Curahkan kehati-hatian Anda pada keputusan yang sulit dibatalkan.
- **Total biaya kepemilikan dan biaya peluang.** Buku ini memisahkan total cost of ownership (lisensi, tagihan cloud, orang) dari *biaya peluang* (opportunity cost): apa yang tidak dibangun tim Anda selama ia menjalankan sistem itu. Klaster self-hosted yang "gratis" tetapi menyibukkan tiga engineer selama lima bulan telah menghabiskan lima bulan pekerjaan lain.
- **Benchmark.** Waspadai benchmark vendor: dataset kecil ("big data untuk tahun 1990-an", kata buku ini), sistem yang di-tuning melawan pesaing yang tidak di-tuning, perbandingan yang tidak setara. Uji dengan query Anda sendiri, skew data Anda, dan jumlah pengguna Anda.

> 🛠 **Coba sendiri (10 menit, kertas).** Sebuah job Spark melakukan shuffle 20 TB sehari antar-node di tiga zone, dan dua pertiga lalu lintas itu menyeberangi batas zone. Job itu juga membaca 5 TB sehari dari S3 melalui NAT gateway. Dengan harga di atas, hitung biaya jaringan selama 30 hari. Lalu sebutkan dua perubahan yang menghapus sebagian besarnya, dan berapa yang dihemat masing-masing.
>
> **Seharusnya Anda melihat:** antar-zone: 13.333 GB × $0,02 ≈ $267 sehari; NAT: 5.000 GB × $0,045 = $225 sehari; totalnya sekitar $492 sehari, atau sekitar $14.750 untuk 30 hari. Menjalankan shuffle di dalam satu zone menghemat sekitar $8.000 sebulan, tetapi jika zone itu gagal, job berhenti; trade-off ini layak diucapkan dengan jelas. S3 gateway endpoint menghemat $6.750 biaya NAT tanpa risiko. Bersama-sama keduanya menghapus hampir semuanya.

### 4. Merancang untuk kegagalan dan untuk perubahan
Gagasan dari bab 3 buku ini muncul di setiap wawancara system design, dan masing-masing adalah keputusan dengan angka di belakangnya, bukan slogan.

**Rencanakan kegagalan: RTO dan RPO.** Sepakati dua angka dengan bisnis sebelum Anda memilih skema backup. **Recovery time objective** (RTO) adalah berapa lama sebuah sistem boleh mati. **Recovery point objective** (RPO) adalah berapa banyak data, diukur dalam waktu, yang boleh hilang. Backup tiap malam berarti Anda bisa kehilangan data sampai satu hari; jika bisnis berkata "paling banyak 15 menit", Anda butuh replikasi berkelanjutan dari log database (log yang sama yang dibaca change data capture, Modul 3.2). Untuk lakehouse, menjaga file raw tetap tidak berubah (Modul 2.2) adalah perlindungan terbaik Anda: setiap tabel turunan bisa dibangun ulang darinya, sehingga pertanyaan sesungguhnya menjadi berapa lama pembangunan ulang itu. Dan pulihkan sebuah backup dengan sengaja sesekali: backup yang belum pernah dipulihkan siapa pun adalah harapan, bukan rencana.

**Loose coupling.** Ketika layanan A memanggil B, yang memanggil C, dan masing-masing harus menjawab sebelum yang berikutnya bisa lanjut, ketersediaannya saling dikalikan: tiga layanan yang masing-masing hidup 99,9% dari waktu, bersama-sama hanya hidup sekitar 99,7%. **Loose coupling** memutus rantai itu: produsen menulis event ke log atau antrean (Kafka, Modul 3.2) atau file ke object storage, dan setiap konsumen membaca dengan kecepatannya sendiri. Jika sebuah konsumen gagal, produsen tetap berjalan dan konsumen menyusul belakangan (lag-nya, Modul 3.3). Itulah **event-driven architecture**. Jebakan sebaliknya adalah **distributed monolith**: layanan yang harus di-deploy bersamaan, berbagi satu skema database, dan saling memanggil dalam rantai sinkron yang panjang. Ia menanggung semua biaya sistem terdistribusi tanpa kemandiriannya. Satu aplikasi yang terstruktur baik (*modular monolith*) sering kali titik awal yang lebih baik.

**Teknologi yang membosankan bertahan lama.** Buku ini membedakan teknologi *immutable*, yang sudah bertahan puluhan tahun dan kemungkinan bertahan puluhan tahun lagi, dari teknologi *transitory* yang datang dan pergi. Aturan praktis di baliknya, *Lindy effect*, menyatakan bahwa semakin lama sebuah teknologi sudah bertahan, semakin lama pula kemungkinan ia bertahan. SQL dan shell Unix berasal dari tahun 1970-an; object storage dan file kolumnar adalah dasar setiap lakehouse. Pelajari itu secara mendalam, dan perlakukan alat yang sedang tren di sekitarnya sebagai lapisan yang bisa Anda ganti (keputusan yang bisa dibatalkan, bagian 3).

**Cloud atau server sendiri.** Cloud unggul ketika beban sulit diprediksi atau perusahaannya kecil dan masa depannya belum pasti; menyewa kapasitas yang berjalan penuh 24 jam sehari menjadi mahal. Pada Juni 2023, 37signals (perusahaan di balik Basecamp dan HEY) menulis bahwa mereka telah meninggalkan cloud dan bahwa "the back of the napkin math is that we'll save at least $1.5 million per year by owning our own hardware rather than renting it from Amazon", tanpa menambah tim operasionalnya. Tulisan yang sama menyebut syaratnya: pertumbuhan yang "mostly predictable" dan staf ahli untuk menjalankan mesinnya, dan menyatakan cloud tetap masuk akal bagi perusahaan yang pengeluarannya kecil atau masa depannya belum pasti. Bagi kebanyakan tim data yang baru mulai, orang lebih mahal daripada server, jadi layanan terkelola biasanya menang; tinjau ulang pertanyaan ini ketika tagihannya besar dan bebannya datar.

> 🛠 **Coba sendiri (10 menit, Python atau kertas).** Sebuah request dashboard melewati tiga layanan yang masing-masing harus menjawab, dan masing-masing tersedia 99,9% dari waktu. Hitung ketersediaan rantai itu dan menit downtime dalam sebulan 30 hari (43.200 menit), untuk satu layanan dan untuk rantai tiga; lalu untuk rantai lima. Berikutnya, database di belakangnya di-backup setiap 6 jam: berapa kehilangan data terburuk dan rata-ratanya jika ia gagal pada saat acak? Apa yang dibutuhkan untuk RPO 15 menit?
>
> **Seharusnya Anda melihat:** satu layanan: 99,90% dan `43.2` menit; tiga dalam rantai: 99,70% (`0.999 ** 3`) dan `129.5` menit, tiga kali lipat downtime-nya; lima: 99,50% dan `215.6` menit. Dengan backup setiap 6 jam Anda kehilangan data sampai 6 jam dan rata-rata 3 jam; 15 menit butuh backup atau log shipping paling tidak setiap 15 menit, biasanya replikasi berkelanjutan. Memisahkan rantai itu dengan antrean membuat layanan pertama tetap menerima pekerjaan saat layanan setelahnya mati.

> 🛠 **Coba sendiri (5 menit, Python atau kertas).** Sebuah perusahaan ingin memindahkan 100 TB data historis ke cloud. Berapa hari yang dibutuhkan lewat jalur 1 Gbit/s pada kecepatan penuh, lewat jalur yang sama ketika hanya 70% yang bisa dipakai dalam praktik, dan lewat jalur kantor 100 Mbit/s? (1 TB = 10¹² byte, 1 byte = 8 bit.)
>
> **Seharusnya Anda melihat:** `9.3` hari pada kecepatan penuh, `13.2` hari pada 70%, dan `92.6` hari lewat 100 Mbit/s; jalur 10 Gbit/s pada 70% butuh `1.3` hari. Ketika jaringan butuh berminggu-minggu, mengirim disk yang menang: inilah sebabnya cloud besar menyewakan perangkat transfer fisik (di AWS: Snowball) yang Anda isi di lokasi lalu kirim balik lewat kurir.

> 🛠 **Coba sendiri (20 menit, di terminal Anda sendiri).** Gabungkan tiga perhitungan dari modul ini ke dalam satu skrip, `cloud_architect.py`, dengan tiga fungsi:
> 1. `plan_iac_diff(desired, actual)`: kedua argumen memetakan `resource_name -> properties_dict`. Kembalikan list tuple `(action, resource_name)` yang diurutkan menurut nama, dengan `"create"` untuk resource yang hanya ada di `desired`, `"destroy"` untuk yang hanya ada di `actual`, dan `"update"` jika keduanya punya dengan properti berbeda. Jangan masukkan resource yang tidak berubah (planner dari pelajaran 1).
> 2. `audit_vpc_and_egress(vpc_cidr, new_prefix, daily_shuffle_gb, zones, daily_s3_gb, has_s3_endpoint)`: pecah `vpc_cidr` (misalnya `"10.0.0.0/16"`) menjadi subnet berukuran `/new_prefix` dan kembalikan dict berisi `num_subnets`; `usable_ips_per_subnet` di AWS (pelajaran 3); `monthly_cross_az_usd`, biaya 30 hari dari shuffle harian dengan tarif $0,02 per GB, dengan asumsi data tersebar merata di `zones` zona sehingga hanya bagian yang keluar dari zona node itu sendiri yang ditagih (nol jika hanya satu zona); `monthly_nat_s3_usd`, 30 hari trafik S3 melalui NAT gateway dengan tarif $0,045 per GB, atau `0.0` jika `has_s3_endpoint` bernilai true; dan `monthly_endpoint_savings_usd`, penghematan S3 gateway endpoint dalam 30 hari. Bulatkan nilai dolar ke 2 desimal.
> 3. `chain_sla_and_rpo(num_services, service_sla, backup_interval_hours, target_rpo_minutes)`: untuk `num_services` layanan yang dipanggil berurutan, masing-masing tersedia `service_sla` dari waktu (misalnya `0.999`), kembalikan `combined_sla` dibulatkan ke 6 desimal, `monthly_downtime_min` dalam bulan 30 hari (43.200 menit) dibulatkan ke 1 desimal, dan `needs_continuous_cdc`: `True` jika jarak antar-backup lebih lebar daripada yang diizinkan target RPO (bagian 4 pelajaran 6).
>
> **Periksa:** `python3 labs/tryit/check.py 3.4-1 ~/practice` (buntu? tambahkan `--hint 1`, lalu 2 dan 3)

## @part Opsional: terapkan sungguhan

## @lesson Terapkan sungguhan, di AWS tiruan di laptop Anda {optional}
Lab ini hanya membuat *plan*: provider memakai kredensial palsu dan tidak pernah menghubungi AWS. Separuh lain pekerjaan Terraform, yaitu benar-benar membuat, memeriksa, memperbaiki, dan menghapus resource, butuh endpoint AWS. Akun AWS sungguhan butuh kartu pembayaran; **moto** tidak butuh apa pun. moto adalah program Python open-source yang menjawab panggilan API yang sama dengan AWS (S3, IAM, KMS, dan banyak lagi) di komputer Anda sendiri. Terraform, command line `aws`, dan `boto3` tidak bisa membedakannya, jadi Anda melatih alat dan alur kerja yang sungguhan; hanya cloud di belakangnya yang tiruan.

**Yang tidak bisa diajarkan AWS tiruan.** moto tidak memeriksa izin kecuali Anda memintanya, jadi policy IAM yang akan ditolak di akun sungguhan tetap berjalan di sini; ia tidak punya harga dan tidak punya jeda jaringan sungguhan; dan sebagian layanan baru diimplementasikan sebagian. Anggap seperti simulator penerbangan: kemudi dan prosedurnya nyata, akibatnya tidak.

**Persiapan (sekali, di venv Anda):** pasang AWS tiruan dan command line AWS, lalu jalankan AWS tiruan di terminalnya **sendiri** dan biarkan tetap berjalan:

```bash
python -m pip install "moto[server]" awscli
moto_server -p 5055
```

Di terminal kerja Anda, beri alat-alat itu kredensial dummy, lalu salin project Terraform **Anda** dari lab beserta file override yang mengarahkannya ke port 5055. Bekerjalah di salinan itu, supaya tes lab yang offline tetap berjalan:

```bash
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=ap-southeast-3
cp -r labs/mod-3-4/terraform ~/tf-local
cp labs/mod-3-4/local-aws/local_aws_override.tf ~/tf-local/
cd ~/tf-local && terraform init && terraform apply -var-file=dev.tfvars
```

Terraform menggabungkan setiap file yang namanya berakhiran `_override.tf` ke blok yang cocok, jadi `provider.tf` Anda tidak berubah. Baca plan-nya sebelum mengetik `yes`. Lalu lihat apa yang Anda bangun dengan perintah yang sama seperti di AWS sungguhan, misalnya `aws --endpoint-url http://127.0.0.1:5055 s3api get-bucket-tagging --bucket kopiku-lakehouse-dev`.

**Diukur** dengan project referensi lab (Terraform 1.17.2, AWS provider 5.100.0, moto 5.2.5): `apply` membuat **7 resource** dalam **64 detik**, 55 di antaranya untuk aturan lifecycle, karena provider menunggu dan memeriksa ulang setelah membuatnya, sama seperti di AWS sungguhan. Bucket-nya membawa lima tag biaya dari `default_tags`. `terraform plan` kedua mencetak `No changes. Your infrastructure matches the configuration.`, dan `terraform destroy` menghapus ketujuhnya dalam sekitar 14 detik.

> 🛠 **Coba sendiri (15 menit, terminal, perlu persiapan di atas).** Latih **drift**: perubahan yang dibuat dengan tangan di luar Terraform. Dengan project Anda sudah diterapkan, hapus perlindungan akses publik bucket seperti yang mungkin dilakukan rekan yang terburu-buru: `aws --endpoint-url http://127.0.0.1:5055 s3api delete-public-access-block --bucket kopiku-lakehouse-dev`. Jalankan `terraform plan -var-file=dev.tfvars -detailed-exitcode` dan catat exit code-nya dengan `echo $?`. Lalu `apply` untuk memperbaikinya, `plan` sekali lagi, dan terakhir `terraform destroy -var-file=dev.tfvars`.
>
> **Seharusnya Anda melihat:** plan menemukan drift-nya: `Plan: 1 to add, 0 to change, 0 to destroy.` untuk `aws_s3_bucket_public_access_block.lakehouse`, dan exit code `2` (perlu perubahan; `0` berarti tidak ada). `apply` melaporkan `1 added`, plan berikutnya `No changes`, dan `destroy` melaporkan `7 destroyed`. Inilah sebabnya tim menjalankan `terraform plan` secara terjadwal: drift diam sampai sebuah plan menunjukkannya, dan bucket yang terbuka adalah jenis drift yang membocorkan data.

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

> 💡 **Jeda Praktik 5 (Verifikasi Lengkap & Bukti Kelulusan):**
> 1. Di terminal, jalankan seluruh rangkaian uji FinOps:
>    `pytest labs/mod-3-4/test_finops.py -v`
> 2. Hasilkan token bukti verifikasi:
>    `python3 scripts/prove.py mod-3-4`
> 3. **Indikator Sukses:** Seluruh pengujian lulus dan token bukti kelulusan dicetak ke terminal untuk verifikasi.

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
- labs/mod-3-4/local-aws/local_aws_override.tf :: Pelajaran opsional: mengarahkan provider ke AWS tiruan di laptop Anda (moto) :: config
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

### Sebuah klaster Spark yang tersebar di tiga availability zone melakukan shuffle 50 TB sehari, dan dua pertiganya menyeberang zone. Dengan $0,02 per GB yang menyeberang, berapa biaya perpindahannya per hari?
- [ ] Sekitar $1.000, karena setiap gigabyte shuffle ditagih
- [ ] Gratis, karena lalu lintas di dalam satu region selalu tidak dikenai biaya
- [ ] Sekitar $0,67, karena biayanya ditagih per terabyte, bukan per gigabyte
- [x] Sekitar $667, dari 33.000 GB × $0,02 untuk lalu lintas antar-zone

> Hanya lalu lintas yang keluar dari sebuah zone yang ditagih: dua pertiga dari 50.000 GB kira-kira 33.000 GB, dikali $0,02. Itu sekitar $20.000 sebulan hanya untuk memindahkan data.

### Keputusan mana yang paling mudah dibatalkan kemudian?
- [ ] Menaruh seluruh logika bisnis di stored procedure milik satu vendor
- [x] Menyimpan tabel dalam format terbuka seperti Parquet atau Iceberg
- [ ] Membangun setiap laporan langsung di database aplikasi produksi
- [ ] Menulis pipeline dalam bahasa yang hanya dikuasai satu engineer di tim

> Dengan format terbuka Anda bisa beralih dari DuckDB ke Trino atau Spark tanpa memindahkan data. Curahkan kehati-hatian Anda pada keputusan yang sulit dibatalkan.

## @resources
- [Dokumentasi Resmi Terraform](https://developer.hashicorp.com/terraform/docs)
- [Dokumentasi AWS Provider untuk Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Dokumentasi OpenTofu](https://opentofu.org/docs/)
- [Panduan Keamanan IAM Best Practices AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Panduan Kelas Penyimpanan Amazon S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
- [Kerangka Kerja dan Prinsip FinOps Foundation](https://www.finops.org/framework/)
- [Checkov: Policy-as-Code Scanner untuk Terraform](https://www.checkov.io/)
- [Infracost: Estimasi Biaya Cloud pada Pull Request](https://www.infracost.io/docs/)

