/* Career mode for the job simulator: the story around the missions in job-sim-data.js.
   Each company has a job posting, a team, a short interview, an offer, a first-day meeting and, per mission,
   who asks for it and what your manager says when it ships. The missions themselves (brief, design question,
   spec, JOB1 check) stay in job-sim-data.js. All companies and people are fictional. */
(function (root) {
  "use strict";
  const T = (id, en) => ({ id, en });

  const COMMON = {
    levelWhen: [T("Minggu 2", "Week 2"), T("Bulan 4", "Month 4"), T("Bulan 9", "Month 9"), T("Bulan 14", "Month 14")],
    titles: [
      T("Junior Data Engineer (masa percobaan)", "Junior Data Engineer (probation)"),
      T("Junior Data Engineer", "Junior Data Engineer"),
      T("Data Engineer", "Data Engineer"),
      T("Senior Data Engineer", "Senior Data Engineer"),
      T("Lead Data Engineer", "Lead Data Engineer")
    ],
    firstTasks: [
      { id: "setup", title: T("Siapkan laptop kerja", "Set up your work laptop"),
        detail: T("Di folder kursus, jalankan `python3 scripts/job_sim.py list`. Kalau daftar misi muncul, Python dan repositorinya siap.",
                  "In the course folder, run `python3 scripts/job_sim.py list`. If the list of missions prints, Python and the repository are ready.") },
      { id: "listen", title: T("Dengarkan dulu, baru membangun", "Listen before you build"),
        detail: T("Baca ulang catatan rapat hari pertama di tab Tim. Tulis satu kalimat: masalah apa yang paling mahal bagi perusahaan ini?",
                  "Re-read the first-day meeting notes in the Team tab. Write one sentence: which problem costs this company the most?") },
      { id: "ticket", title: T("Ambil tiket pertama", "Pick up your first ticket"),
        detail: T("Tiga tugas kecil dari rekan kerja ada di Kotak Masuk: Python dasar dan satu query SQL. Tiket besar pertama datang setelahnya.",
                  "Three small tasks from your colleagues are in your Inbox: basic Python and one SQL query. The first big ticket comes after them.") }
    ]
  };

  const COMPANIES = {
    kopiku: {
      logo: { text: "Ku", bg: "#7c4a1e", fg: "#fff7ed" },
      name: "KopiKu Roastery",
      industry: T("Ritel kopi · 120 kafe + aplikasi", "Coffee retail · 120 cafés + app"),
      city: "Jakarta Selatan",
      people: {
        rina: { name: "Rina Hartono", role: T("Data Engineering Lead (atasan Anda)", "Data Engineering Lead (your manager)"), color: "#0f766e" },
        andi: { name: "Andi Wijaya", role: T("CTO", "CTO"), color: "#1d4ed8" },
        sari: { name: "Sari Utami", role: T("VP Operasional", "VP of Operations"), color: "#b45309" },
        dewi: { name: "Dewi Lestari", role: T("VP Keuangan", "VP of Finance"), color: "#7c3aed" },
        bayu: { name: "Bayu Pratama", role: T("Principal Platform Engineer", "Principal Platform Engineer"), color: "#be123c" },
        hendra: { name: "Hendra Gunawan", role: T("CFO", "CFO"), color: "#334155" }
      },
      manager: "rina",
      posting: {
        role: "Junior Data Engineer",
        type: T("Penuh waktu · Hybrid (3 hari di kantor)", "Full-time · Hybrid (3 days in office)"),
        salary: T("Rp 9–12 juta / bulan", "IDR 9–12 million / month"),
        posted: T("Diposting 2 hari lalu · 87 pelamar", "Posted 2 days ago · 87 applicants"),
        about: T("KopiKu menyangrai dan menjual kopi di 120 kafe dan lewat aplikasi pesan-antar. Tim data kami tiga orang, dan laporan penjualan harian masih dibuat dari CSV yang dikirim setiap cabang.",
                 "KopiKu roasts and sells coffee in 120 cafés and through a delivery app. Our data team is three people, and the daily sales report is still built from CSVs that every branch sends in."),
        doList: [
          T("Membangun dan merawat pipeline harian dari 120 cabang ke warehouse", "Build and look after the daily pipeline from 120 branches to the warehouse"),
          T("Menjaga angka omzet sama persis dengan catatan Keuangan", "Keep revenue numbers exactly equal to Finance's books"),
          T("Memindahkan laporan berat dari database kasir", "Move heavy reports off the checkout database"),
          T("Menulis tes untuk setiap model data", "Write tests for every data model")
        ],
        reqs: [
          { text: T("Python untuk mengolah file dan data", "Python for processing files and data"), mod: "mod-1-2" },
          { text: T("SQL: join, group by, window function", "SQL: joins, group by, window functions"), mod: "mod-1-3" },
          { text: T("Git dan bekerja lewat pull request", "Git and working through pull requests"), mod: "mod-0-2" },
          { text: T("Dasar pemodelan dimensional", "Basics of dimensional modelling"), mod: "mod-1-4" },
          { text: T("Mau belajar dbt dan cloud warehouse", "Willing to learn dbt and a cloud warehouse"), mod: "mod-2-3" }
        ],
        perks: [T("Kopi gratis, tentu saja", "Free coffee, of course"), T("Mentor senior di minggu-minggu pertama", "A senior mentor in your first weeks"), T("Anggaran belajar Rp 5 juta per tahun", "A learning budget of IDR 5 million a year")]
      },
      interview: {
        who: "rina",
        intro: T("Halo, terima kasih sudah melamar. Saya Rina, nanti saya atasan Anda. Saya tidak akan menanyakan definisi; saya ingin tahu cara Anda berpikir. Tiga pertanyaan saja.",
                 "Hi, thanks for applying. I'm Rina; I'd be your manager. I won't ask for definitions, I want to see how you think. Just three questions."),
        questions: [
          { q: T("Suatu pagi, file penjualan dari satu cabang berisi pesanan yang sama dua kali. Apa yang Anda lakukan?", "One morning a branch's sales file has the same order twice. What do you do?"),
            options: [
              { text: T("Hapus duplikatnya di Excel sebelum dimuat", "Delete the duplicate in Excel before loading"), good: false, reply: T("Itu memperbaiki hari ini saja. Besok terjadi lagi, dan tidak ada yang tahu Anda mengubah datanya.", "That fixes today only. It happens again tomorrow, and nobody knows you changed the data.") },
              { text: T("Buat proses muat menyimpan satu baris per order_id, lalu cari tahu kenapa cabang mengirim ulang", "Make the load keep one row per order_id, then find out why the branch re-sends"), good: true, reply: T("Bagus. Perbaiki di pipeline supaya otomatis, dan tanyakan penyebabnya. Itu cara kerja kami.", "Good. Fix it in the pipeline so it is automatic, and ask why it happens. That is how we work.") },
              { text: T("Biarkan saja, totalnya hanya beda sedikit", "Leave it, the total is only a little off"), good: false, reply: T("Di sini 'sedikit' bisa jutaan rupiah, dan Keuangan akan menemukannya sebelum Anda.", "Here 'a little' can be millions of rupiah, and Finance will find it before you do.") }
            ] },
          { q: T("Tim Marketing menjalankan laporan besar langsung di database kasir. Masalahnya apa?", "Marketing runs big reports directly on the checkout database. What is the problem?"),
            options: [
              { text: T("Tidak ada masalah selama query-nya benar", "No problem as long as the query is correct"), good: false, reply: T("Query yang benar pun bisa mengunci tabel yang dipakai kasir untuk melayani pelanggan.", "Even a correct query can lock the tables the tills need to serve customers.") },
              { text: T("Query berat memperlambat atau mengunci kasir; laporan sebaiknya jalan di salinan atau warehouse", "Heavy queries slow or lock the tills; reports belong on a copy or a warehouse"), good: true, reply: T("Tepat. Itu persis masalah kami setiap Senin pagi.", "Exactly. That is our problem every Monday morning.") },
              { text: T("Database kasir terlalu kecil, tinggal ditambah RAM", "The checkout database is too small, just add RAM"), good: false, reply: T("RAM membeli waktu, tetapi beban analitik dan transaksi tetap berebut di mesin yang sama.", "RAM buys time, but analytics and transactions still fight on the same machine.") }
            ] },
          { q: T("Bagaimana Anda menyimpan harga 'Rp 25.000' di tabel?", "How would you store a price of 'Rp 25.000' in a table?"),
            options: [
              { text: T("Sebagai teks 'Rp 25.000', persis seperti aslinya", "As the text 'Rp 25.000', exactly as it came"), good: false, reply: T("Teks tidak bisa dijumlahkan, dan setiap cabang menulisnya berbeda.", "Text cannot be summed, and every branch writes it differently.") },
              { text: T("Sebagai float 25000.0", "As a float, 25000.0"), good: false, reply: T("Float membulatkan. Setelah jutaan baris, totalnya selisih dengan bank.", "Floats round. After millions of rows the total drifts from the bank's.") },
              { text: T("Sebagai bilangan bulat rupiah: 25000", "As an integer number of rupiah: 25000"), good: true, reply: T("Ya. Uang selalu bilangan bulat di satuan terkecilnya.", "Yes. Money is always an integer in its smallest unit.") }
            ] }
        ]
      },
      offer: { salary: T("Rp 10.500.000 / bulan", "IDR 10,500,000 / month"), start: T("Senin depan, pukul 09.00", "Next Monday, 09:00") },
      day1: {
        room: T("Ruang rapat 'Arabika', lantai 3", "Meeting room 'Arabica', 3rd floor"),
        lines: [
          { who: "rina", text: T("Selamat datang! Sebelum Anda membuka laptop, saya ingin Anda mendengar langsung dari orang-orang yang akan Anda bantu.", "Welcome! Before you open your laptop, I want you to hear it from the people you will be helping.") },
          { who: "sari", text: T("Setiap Senin pukul sembilan, kasir di semua kafe membeku sekitar 20 menit. Antrean keluar pintu. Itu karena laporan Marketing berjalan di database yang sama.", "Every Monday at nine, the tills in every café freeze for about 20 minutes. Queues out the door. It's because Marketing's report runs on the same database.") },
          { who: "dewi", text: T("Dan angka omzet Marketing tidak pernah sama dengan angka saya. Kami menghabiskan rapat direksi berdebat soal angka mana yang benar.", "And Marketing's revenue never matches mine. We spend board meetings arguing about which number is right.") },
          { who: "andi", text: T("Kami tidak butuh teknologi paling canggih. Kami butuh data yang benar, tepat waktu, dan murah. Tahun ini juga ada 11.11, dan tagihan cloud kami terus naik.", "We don't need the fanciest technology. We need data that is right, on time and cheap. There's 11.11 this year too, and our cloud bill keeps climbing.") },
          { who: "rina", text: T("Ini yang saya harapkan dari Anda: tanya sebelum membangun, kirim perubahan kecil lewat PR, dan setiap angka yang Anda kirim harus bisa Anda jelaskan.", "Here's what I expect from you: ask before you build, ship small changes through PRs, and be able to explain every number you send.") },
          { who: "rina", text: T("Targetnya ada di papan. Minggu ini, cukup tiga hal: siapkan laptop, dengarkan, lalu ambil tiket pertama dari Bu Sari.", "The targets are on the board. This week, just three things: set up your laptop, listen, then pick up your first ticket from Sari.") }
        ],
        targets: [
          T("Kasir tidak pernah membeku lagi karena laporan", "The tills never freeze because of a report again"),
          T("Keuangan dan Marketing melihat satu angka omzet yang sama", "Finance and Marketing see one and the same revenue number"),
          T("Data 11.11 masuk utuh dan tepat waktu", "11.11 data lands complete and on time"),
          T("Tagihan cloud turun, tanpa data mitra bocor", "The cloud bill comes down, with no partner data leaking")
        ]
      },
      levels: [
        { from: "sari", after: T("Senin ini tidak ada antrean. Para barista sampai bertanya apa yang berubah. Terima kasih.", "No queue this Monday. The baristas actually asked what changed. Thank you."),
          oneOnOne: T("Masa percobaan Anda selesai lebih cepat. Anda tidak hanya menulis kode yang jalan: Anda membuat pipeline yang aman dijalankan ulang. Itu yang membedakan.", "Your probation is over early. You didn't just write code that runs: you built a pipeline that is safe to re-run. That's the difference.") },
        { from: "dewi", after: T("Untuk pertama kalinya, angka saya dan angka Marketing sama di rapat direksi.", "For the first time, my number and Marketing's matched in the board meeting."),
          oneOnOne: T("Keuangan sekarang mempercayai data kita. Mulai bulan ini Anda Data Engineer penuh, dan Anda yang memegang model omzet.", "Finance trusts our data now. From this month you're a full Data Engineer, and you own the revenue model.") },
        { from: "bayu", after: T("11.11 lewat tanpa satu pun task yang macet. Saya menidurkan pager saya untuk pertama kali dalam tiga tahun.", "11.11 passed without a single stuck task. I slept through the night for the first time in three years."),
          oneOnOne: T("Anda menangani insiden terbesar tahun ini dengan tenang. Saya mengajukan Anda sebagai Senior Data Engineer.", "You handled the biggest incident of the year calmly. I've put you forward for Senior Data Engineer.") },
        { from: "hendra", after: T("Tagihan bulan ini turun lebih dari tiga perempat, dan portal mitra lolos audit keamanan.", "This month's bill fell by more than three quarters, and the partner portal passed the security audit."),
          oneOnOne: T("Dalam setahun Anda berubah dari orang baru menjadi orang yang kami tanyai lebih dulu. Selamat: Lead Data Engineer.", "In a year you went from the new person to the one we ask first. Congratulations: Lead Data Engineer.") }
      ]
    },

    paynusa: {
      logo: { text: "PN", bg: "#1e3a8a", fg: "#e0e7ff" },
      name: "PayNusa",
      industry: T("Fintech · dompet digital & payment gateway", "Fintech · e-wallet & payment gateway"),
      city: "Jakarta Pusat",
      people: {
        fajar: { name: "Fajar Nugroho", role: T("Data Platform Manager (atasan Anda)", "Data Platform Manager (your manager)"), color: "#1d4ed8" },
        maya: { name: "Maya Kusuma", role: T("Head of Treasury", "Head of Treasury"), color: "#047857" },
        lukas: { name: "Lukas Simanjuntak", role: T("Data Protection Officer", "Data Protection Officer"), color: "#7c3aed" },
        putri: { name: "Putri Anggraini", role: T("VP Risiko", "VP of Risk"), color: "#b45309" },
        teguh: { name: "Teguh Santoso", role: T("Chief Risk Officer", "Chief Risk Officer"), color: "#be123c" }
      },
      manager: "fajar",
      posting: {
        role: "Junior Data Engineer, Ledger & Compliance",
        type: T("Penuh waktu · Di kantor", "Full-time · On-site"),
        salary: T("Rp 11–15 juta / bulan", "IDR 11–15 million / month"),
        posted: T("Diposting kemarin · 143 pelamar", "Posted yesterday · 143 applicants"),
        about: T("PayNusa memproses 2,5 juta transaksi sehari untuk dompet digital dan merchant. Setiap rupiah harus bisa dipertanggungjawabkan kepada bank, auditor, dan regulator.",
                 "PayNusa processes 2.5 million transactions a day for an e-wallet and merchants. Every rupiah has to be accounted for to banks, auditors and the regulator."),
        doList: [
          T("Memuat webhook pembayaran ke ledger tanpa duplikat", "Load payment webhooks into the ledger without duplicates"),
          T("Menjaga data pribadi nasabah tetap aman di warehouse", "Keep customers' personal data safe in the warehouse"),
          T("Rekonsiliasi harian dengan rekening bank", "Daily reconciliation against bank statements"),
          T("Menyiapkan fitur untuk model fraud", "Prepare features for the fraud model")
        ],
        reqs: [
          { text: T("Python yang rapi dan teruji", "Clean, tested Python"), mod: "mod-1-2" },
          { text: T("SQL dan pemodelan data", "SQL and data modelling"), mod: "mod-1-4" },
          { text: T("API, webhook, dan ingestion", "APIs, webhooks and ingestion"), mod: "mod-1-6" },
          { text: T("Kualitas data dan kontrak data", "Data quality and data contracts"), mod: "mod-2-5" },
          { text: T("Paham dasar keamanan data (hashing, HMAC)", "Basic data security (hashing, HMAC)"), mod: "mod-1-6" }
        ],
        perks: [T("Asuransi kesehatan keluarga", "Family health insurance"), T("Sertifikasi cloud dibiayai", "Paid cloud certifications"), T("Hari kerja tenang setiap Jumat: tanpa rapat", "Quiet Fridays: no meetings")]
      },
      interview: {
        who: "fajar",
        intro: T("Selamat siang. Saya Fajar. Di fintech, kesalahan kecil di data berarti uang hilang atau masalah dengan regulator. Saya ingin melihat insting Anda.",
                 "Good afternoon. I'm Fajar. In fintech, a small data mistake means lost money or trouble with the regulator. I want to see your instincts."),
        questions: [
          { q: T("Payment gateway bisa mengirim webhook yang sama sampai tiga kali. Bagaimana agar saldo tidak tercatat tiga kali?", "The payment gateway can send the same webhook up to three times. How do you stop the balance counting it three times?"),
            options: [
              { text: T("Simpan ID event, dan abaikan event yang ID-nya sudah pernah diproses", "Store the event ID, and ignore events whose ID was already processed"), good: true, reply: T("Ya, idempotensi. Itu baris pertama di setiap sistem pembayaran.", "Yes, idempotency. It's line one of every payment system.") },
              { text: T("Minta gateway agar hanya mengirim sekali", "Ask the gateway to send only once"), good: false, reply: T("Mereka tidak akan mengubahnya: 'at least once' adalah janji mereka, dan itu wajar.", "They won't change it: 'at least once' is their promise, and that's normal.") },
              { text: T("Jumlahkan saja; duplikat akan saling meniadakan", "Just sum them; duplicates cancel out"), good: false, reply: T("Duplikat tidak saling meniadakan, mereka bertambah. Itulah selisih Rp 4,2 juta kami.", "Duplicates don't cancel, they add up. That's our IDR 4.2 million gap.") }
            ] },
          { q: T("Kami menyimpan nomor HP nasabah sebagai sha256(nomor). Aman?", "We store customers' phone numbers as sha256(number). Is that safe?"),
            options: [
              { text: T("Aman, hash tidak bisa dibalik", "Safe, hashes can't be reversed"), good: false, reply: T("Nomor HP Indonesia hanya ratusan juta kemungkinan. Semua bisa di-hash dan dicocokkan dalam hitungan detik.", "Indonesian phone numbers are only a few hundred million possibilities. All of them can be hashed and matched in seconds.") },
              { text: T("Tidak; pakai HMAC dengan kunci rahasia agar tidak bisa dicocokkan dengan tabel hash", "No; use an HMAC with a secret key so it can't be matched against a hash table"), good: true, reply: T("Benar. Auditor kami membuktikan itu tahun lalu dalam 1,8 detik.", "Right. Our auditors proved it last year in 1.8 seconds.") },
              { text: T("Aman kalau kolomnya disembunyikan dari analis", "Safe if the column is hidden from analysts"), good: false, reply: T("Menyembunyikan membantu, tetapi data yang bisa dibalik tetap data pribadi.", "Hiding helps, but data that can be reversed is still personal data.") }
            ] },
          { q: T("Di ledger double-entry, total debit dikurangi total kredit seharusnya berapa?", "In a double-entry ledger, what should total debits minus total credits be?"),
            options: [
              { text: T("Nol, selalu", "Zero, always"), good: true, reply: T("Selalu. Kalau tidak nol, ada yang salah, dan itu harus berhenti, bukan diabaikan.", "Always. If it isn't zero something is wrong, and that has to stop the line, not be ignored.") },
              { text: T("Sama dengan saldo akhir hari", "Equal to the end-of-day balance"), good: false, reply: T("Saldo dihitung dari entri, tetapi selisih debit dan kredit harus nol.", "Balances come from the entries, but debits minus credits must be zero.") },
              { text: T("Tergantung jumlah transaksi hari itu", "Depends on how many transactions there were"), good: false, reply: T("Tidak tergantung apa pun. Itulah gunanya double-entry.", "It depends on nothing. That is the point of double entry.") }
            ] }
        ]
      },
      offer: { salary: T("Rp 13.000.000 / bulan", "IDR 13,000,000 / month"), start: T("Senin depan, pukul 08.30", "Next Monday, 08:30") },
      day1: {
        room: T("Ruang rapat 'Ledger', lantai 12", "Meeting room 'Ledger', 12th floor"),
        lines: [
          { who: "fajar", text: T("Selamat bergabung. Di sini kita bekerja dengan uang orang lain, jadi kita lambat di tempat yang tepat dan cepat di tempat lain.", "Welcome aboard. Here we work with other people's money, so we're slow in the right places and fast everywhere else.") },
          { who: "maya", text: T("Laporan settlement kami selisih Rp 4,2 juta dengan rekening escrow di bank. Saya harus menjelaskan selisih itu setiap pagi, dan saya tidak bisa.", "Our settlement report is IDR 4.2 million off the escrow account at the bank. I have to explain that gap every morning, and I can't.") },
          { who: "lukas", text: T("Audit bank sentral bulan depan. Kalau ada data pribadi mentah di warehouse, kita kena temuan.", "The central bank audit is next month. If there's raw personal data in the warehouse, we get a finding.") },
          { who: "putri", text: T("Dan tim risiko mulai tidak percaya angka harian. Kadang volume transfer di laporan jauh lebih besar dari kenyataan.", "And the risk team is starting to distrust the daily numbers. Sometimes the transfer volume in the report is far bigger than reality.") },
          { who: "fajar", text: T("Yang saya harapkan: setiap angka bisa ditelusuri ke sumbernya, tidak ada data pribadi mentah di laporan, dan tes Anda ditulis sebelum Anda bilang selesai.", "What I expect: every number traces back to its source, no raw personal data in reports, and your tests written before you say done.") },
          { who: "fajar", text: T("Minggu ini: siapkan laptop, dengarkan, lalu ambil tiket dari Bu Maya. Selisih settlement itu prioritas pertama.", "This week: set up your laptop, listen, then take Maya's ticket. The settlement gap is priority one.") }
        ],
        targets: [
          T("Ledger seimbang: selisih Rp 0 dengan bank", "A balanced ledger: IDR 0 gap with the bank"),
          T("Lolos audit: tidak ada data pribadi mentah", "Pass the audit: no raw personal data"),
          T("Laporan risiko tanpa angka yang menggelembung", "Risk reports without inflated numbers"),
          T("Model fraud yang jujur, dan pemulihan bencana yang teruji", "An honest fraud model, and tested disaster recovery")
        ]
      },
      levels: [
        { from: "maya", after: T("Selisihnya nol pagi ini. Saya tidak ingat kapan terakhir saya bisa bilang begitu.", "The gap is zero this morning. I can't remember the last time I could say that."),
          oneOnOne: T("Anda menolak webhook palsu dan duplikat tanpa kehilangan satu pun transaksi asli. Masa percobaan Anda selesai.", "You rejected forged and duplicate webhooks without losing a single real transaction. Your probation is over.") },
        { from: "lukas", after: T("Auditor tidak menemukan apa pun. Mereka bahkan bertanya bagaimana kita melakukan crypto-shredding.", "The auditors found nothing. They even asked how we did crypto-shredding.") ,
          oneOnOne: T("Kepatuhan bukan pekerjaan yang terlihat, tetapi Anda melakukannya dengan benar. Anda sekarang Data Engineer penuh.", "Compliance isn't visible work, but you did it right. You're a full Data Engineer now.") },
        { from: "putri", after: T("Volume di laporan risiko sekarang sama dengan sistem sumber. Tim saya bisa bekerja lagi.", "The volume in the risk report now matches the source system. My team can work again."),
          oneOnOne: T("Anda menemukan fan-out yang tidak terlihat orang lain selama berbulan-bulan. Saya mengajukan Anda sebagai Senior.", "You found a fan-out nobody else saw for months. I've put you forward for Senior.") },
        { from: "teguh", after: T("Model fraud yang baru berperilaku sama di produksi dan di pengujian. Itu yang kami butuhkan.", "The new fraud model behaves the same in production as in testing. That's what we needed."),
          oneOnOne: T("Anda membuat tim AI dan tim risiko mempercayai data yang sama. Selamat: Lead Data Engineer.", "You got the AI team and the risk team trusting the same data. Congratulations: Lead Data Engineer.") }
      ]
    },

    gokirim: {
      logo: { text: "GK", bg: "#15803d", fg: "#f0fdf4" },
      name: "GoKirim Express",
      industry: T("Logistik · 20.000 kurir", "Logistics · 20,000 couriers"),
      city: "Surabaya",
      people: {
        nadia: { name: "Nadia Rahman", role: T("Lead Data Engineer (atasan Anda)", "Lead Data Engineer (your manager)"), color: "#15803d" },
        agus: { name: "Agus Setiawan", role: T("Head of Fleet Telemetry", "Head of Fleet Telemetry"), color: "#1d4ed8" },
        yuli: { name: "Yuli Astuti", role: T("VP Operasional Logistik", "VP of Logistics Operations"), color: "#b45309" },
        rizky: { name: "Rizky Ramadhan", role: T("Direktur Dispatch", "Director of Dispatch"), color: "#be123c" },
        made: { name: "Made Suarta", role: T("VP Engineering", "VP of Engineering"), color: "#334155" }
      },
      manager: "nadia",
      posting: {
        role: "Junior Data Engineer, Fleet Data",
        type: T("Penuh waktu · Remote (Indonesia)", "Full-time · Remote (Indonesia)"),
        salary: T("Rp 10–13 juta / bulan", "IDR 10–13 million / month"),
        posted: T("Diposting 5 hari lalu · 61 pelamar", "Posted 5 days ago · 61 applicants"),
        about: T("GoKirim mengantar paket di tiga zona waktu, dari Sumatra sampai Papua. Setiap kurir mengirim posisi GPS beberapa detik sekali, dan harga, gaji kurir, serta SLA dihitung dari data itu.",
                 "GoKirim delivers parcels across three time zones, from Sumatra to Papua. Every courier sends a GPS position every few seconds, and prices, courier pay and SLAs are all computed from that data."),
        doList: [
          T("Membersihkan data GPS yang datang terlambat dan rusak", "Clean GPS data that arrives late and broken"),
          T("Memodelkan perjalanan dan shift kurir", "Model courier trips and shifts"),
          T("Membangun agregasi streaming per 5 menit", "Build 5-minute streaming aggregations"),
          T("Menjaga infrastruktur tetap aman dan murah", "Keep the infrastructure safe and cheap")
        ],
        reqs: [
          { text: T("Python, termasuk generator dan memori", "Python, including generators and memory"), mod: "mod-1-2" },
          { text: T("SQL dan tipe data bersarang", "SQL and nested data types"), mod: "mod-1-3" },
          { text: T("Dasar streaming: event time dan window", "Streaming basics: event time and windows"), mod: "mod-3-3" },
          { text: T("Linux dan Docker", "Linux and Docker"), mod: "mod-1-1" },
          { text: T("Mau belajar Terraform", "Willing to learn Terraform"), mod: "mod-3-4" }
        ],
        perks: [T("Kerja dari mana saja di Indonesia", "Work from anywhere in Indonesia"), T("Tunjangan internet dan listrik", "Internet and power allowance"), T("Offsite tim dua kali setahun", "Team offsite twice a year")]
      },
      interview: {
        who: "nadia",
        intro: T("Halo! Saya Nadia. Data kami datang dari motor yang melaju di jalan, terowongan, dan pegunungan, jadi tidak pernah rapi. Mari lihat cara Anda menghadapinya.",
                 "Hi! I'm Nadia. Our data comes from motorbikes on roads, in tunnels and over mountains, so it is never tidy. Let's see how you'd deal with it."),
        questions: [
          { q: T("Satu ping GPS menunjukkan lintang 999. Apa yang Anda lakukan?", "A GPS ping says the latitude is 999. What do you do?"),
            options: [
              { text: T("Ubah menjadi 0 agar tidak error", "Change it to 0 so nothing errors"), good: false, reply: T("Lintang 0 ada di tengah laut. Sekarang kurirnya terlihat berenang.", "Latitude 0 is in the middle of the sea. Now the courier appears to be swimming.") },
              { text: T("Pisahkan ke karantina dengan alasannya; lintang hanya -90 sampai 90", "Move it to quarantine with the reason; latitude only runs from -90 to 90"), good: true, reply: T("Ya. Jangan buang diam-diam, jangan perbaiki dengan tebakan.", "Yes. Don't drop it silently, and don't fix it with a guess.") },
              { text: T("Hentikan seluruh pipeline", "Stop the whole pipeline"), good: false, reply: T("Satu ping rusak tidak boleh menghentikan data 20.000 kurir lainnya.", "One broken ping mustn't stop the data of 20,000 other couriers.") }
            ] },
          { q: T("Kurir di Makassar mengirim jam WITA, di Jayapura WIT. Bagaimana Anda menyimpan waktunya?", "Couriers in Makassar send WITA times, in Jayapura WIT. How do you store the time?"),
            options: [
              { text: T("Ubah semua ke UTC, dan simpan zona aslinya kalau perlu", "Convert everything to UTC, and keep the original zone if needed"), good: true, reply: T("Tepat. Satu jam acuan, lalu tampilkan sesuai zona saat dibaca.", "Exactly. One reference clock, then display in the local zone when reading.") },
              { text: T("Simpan apa adanya; semua di Indonesia", "Store them as they are; it's all Indonesia"), good: false, reply: T("Selisihnya sampai dua jam. Perjalanan akan tampak selesai sebelum dimulai.", "They differ by up to two hours. Trips will look finished before they start.") },
              { text: T("Ubah semua ke WIB karena kantor pusat di sana", "Convert all to WIB because head office is there"), good: false, reply: T("Bisa jalan, tetapi UTC menghindari kebingungan dengan sistem lain dan musim panas di luar negeri.", "It can work, but UTC avoids confusion with other systems and with daylight saving abroad.") }
            ] },
          { q: T("Kurir keluar dari terowongan dan mengirim 30 menit data sekaligus. Data itu masuk ke jendela waktu yang mana?", "A courier leaves a tunnel and sends 30 minutes of data at once. Which time window does it belong to?"),
            options: [
              { text: T("Jendela saat data tiba di server", "The window when it arrived at the server"), good: false, reply: T("Itu yang membuat lonjakan palsu: 30 menit aktivitas tampak terjadi dalam satu menit.", "That's what creates fake spikes: 30 minutes of activity looks like it happened in one minute.") },
              { text: T("Jendela saat kejadian sebenarnya di jalan (event time)", "The window when it actually happened on the road (event time)"), good: true, reply: T("Benar. Itu inti misi ketiga Anda nanti.", "Right. That's the heart of your third mission later.") },
              { text: T("Buang saja, sudah terlambat", "Drop it, it's too late"), good: false, reply: T("Itu data gaji kurir. Kita butuh setiap menitnya.", "That's courier pay data. We need every minute of it.") }
            ] }
        ]
      },
      offer: { salary: T("Rp 11.500.000 / bulan", "IDR 11,500,000 / month"), start: T("Senin depan, kick-off lewat video call 09.00 WIB", "Next Monday, video kick-off at 09:00 WIB") },
      day1: {
        room: T("Video call: #kickoff-data-armada", "Video call: #fleet-data-kickoff"),
        lines: [
          { who: "nadia", text: T("Selamat datang di tim! Kita semua remote, jadi tulisan Anda adalah wajah Anda. Kenalan dulu dengan yang paling sering akan meminta bantuan Anda.", "Welcome to the team! We're all remote, so your writing is your face. Meet the people who will ask you for help most.") },
          { who: "agus", text: T("Data GPS kami kotor: koordinat mustahil, paket yang terkirim ulang, dan tiga zona waktu bercampur. Dashboard armada sering menunjukkan kurir di tengah laut.", "Our GPS data is dirty: impossible coordinates, re-sent packets and three time zones mixed up. The fleet dashboard often shows couriers in the middle of the sea.") },
          { who: "yuli", text: T("Gaji kurir dihitung dari shift. Kalau shift dihitung salah, kurir dibayar salah, dan mereka benar-benar marah.", "Courier pay is computed from shifts. If shifts are computed wrong, couriers are paid wrong, and they get really angry.") },
          { who: "rizky", text: T("Bulan lalu harga melonjak 400% tanpa alasan setelah ratusan kurir keluar dari jalur gunung. Pelanggan kabur.", "Last month prices spiked 400% for no reason after hundreds of couriers came off a mountain road. Customers left.") },
          { who: "nadia", text: T("Harapan saya: tulis rencana singkat sebelum kode, ukur sebelum dan sesudah, dan jangan pernah membuang data diam-diam.", "My expectations: write a short plan before code, measure before and after, and never drop data silently.") },
          { who: "nadia", text: T("Minggu ini: siapkan laptop, baca ulang catatan ini, dan ambil tiket pertama dari Pak Agus.", "This week: set up your laptop, re-read these notes, and take your first ticket from Agus.") }
        ],
        targets: [
          T("Tidak ada lagi kurir 'di tengah laut'", "No more couriers 'in the middle of the sea'"),
          T("Shift dan gaji kurir dihitung benar", "Courier shifts and pay computed correctly"),
          T("Tidak ada lonjakan harga palsu", "No fake price spikes"),
          T("Harga real-time cepat, dan infrastruktur yang aman", "Fast real-time prices, and safe infrastructure")
        ]
      },
      levels: [
        { from: "agus", after: T("Peta armada bersih. Tidak ada lagi kurir yang berenang di Selat Makassar.", "The fleet map is clean. No more couriers swimming in the Makassar Strait."),
          oneOnOne: T("Anda menangani data kotor tanpa membuang yang bagus. Masa percobaan selesai.", "You handled dirty data without throwing away the good. Probation's over.") },
        { from: "yuli", after: T("Keluhan gaji kurir turun drastis bulan ini.", "Courier pay complaints dropped sharply this month."),
          oneOnOne: T("Anda mengubah aturan bisnis yang rumit menjadi model yang bisa dibaca semua orang. Anda Data Engineer penuh sekarang.", "You turned a messy business rule into a model everyone can read. You're a full Data Engineer now.") },
        { from: "rizky", after: T("Jalur gunung macet lagi kemarin, dan harganya tetap normal. Itu yang kami mau.", "The mountain road went dark again yesterday, and prices stayed normal. That's what we wanted."),
          oneOnOne: T("Event time, watermark, data terlambat: Anda menjelaskannya ke tim dispatch sampai mereka paham. Saya mengajukan Anda sebagai Senior.", "Event time, watermarks, late data: you explained it to dispatch until they got it. I've put you forward for Senior.") },
        { from: "made", after: T("Latensi turun di bawah 50 ms dan audit infrastruktur bersih.", "Latency is under 50 ms and the infrastructure audit is clean."),
          oneOnOne: T("Anda sekarang memikirkan sistem, bukan hanya pipeline. Selamat: Lead Data Engineer.", "You think in systems now, not just pipelines. Congratulations: Lead Data Engineer.") }
      ]
    },

    cloudpulse: {
      logo: { text: "CP", bg: "#0e7490", fg: "#ecfeff" },
      name: "CloudPulse Health",
      industry: T("SaaS kesehatan · 400 rumah sakit & klinik", "Health SaaS · 400 hospitals & clinics"),
      city: "Bandung",
      people: {
        indah: { name: "Indah Permata", role: T("Data Engineering Manager (atasan Anda)", "Data Engineering Manager (your manager)"), color: "#0e7490" },
        dimas: { name: "Dimas Saputra", role: T("Lead Integrations Engineer", "Lead Integrations Engineer"), color: "#1d4ed8" },
        ratna: { name: "dr. Ratna Sari", role: T("VP Data Klinis", "VP of Clinical Data"), color: "#7c3aed" },
        kevin: { name: "Kevin Halim", role: T("Staff Lakehouse Architect", "Staff Lakehouse Architect"), color: "#b45309" },
        arif: { name: "dr. Arif Budiman", role: T("Chief Medical Information Officer", "Chief Medical Information Officer"), color: "#be123c" }
      },
      manager: "indah",
      posting: {
        role: "Junior Data Engineer, Clinical Data Platform",
        type: T("Penuh waktu · Hybrid", "Full-time · Hybrid"),
        salary: T("Rp 10–14 juta / bulan", "IDR 10–14 million / month"),
        posted: T("Diposting 1 minggu lalu · 52 pelamar", "Posted 1 week ago · 52 applicants"),
        about: T("CloudPulse menjalankan sistem rekam medis untuk 400 rumah sakit dan klinik. Kami sedang memindahkan ERP berusia 12 tahun ke lakehouse, dan membangun asisten AI untuk dokter.",
                 "CloudPulse runs the medical records system for 400 hospitals and clinics. We're moving a 12-year-old ERP to a lakehouse, and building an AI assistant for doctors."),
        doList: [
          T("Menarik data kunjungan dari API 400 klinik", "Pull visit data from 400 clinic APIs"),
          T("Menyatukan data pasien dari tiga sistem", "Unify patient data from three systems"),
          T("Merawat tabel lakehouse (Iceberg/Delta)", "Look after lakehouse tables (Iceberg/Delta)"),
          T("Menyiapkan data untuk asisten AI dengan aman", "Prepare data for the AI assistant safely")
        ],
        reqs: [
          { text: T("Python dan API (pagination, retry)", "Python and APIs (pagination, retries)"), mod: "mod-1-6" },
          { text: T("SQL dan pemodelan data", "SQL and data modelling"), mod: "mod-1-4" },
          { text: T("Format tabel terbuka: Iceberg atau Delta", "Open table formats: Iceberg or Delta"), mod: "mod-2-2" },
          { text: T("Peduli pada privasi data", "Care about data privacy"), mod: "mod-2-5" },
          { text: T("Tertarik pada data untuk AI", "Interest in data for AI"), mod: "mod-3-5" }
        ],
        perks: [T("Asuransi kesehatan premium", "Premium health insurance"), T("Pekerjaan yang membantu dokter dan pasien", "Work that helps doctors and patients"), T("Hari belajar setiap bulan", "A learning day every month")]
      },
      interview: {
        who: "indah",
        intro: T("Halo, saya Indah. Data kami adalah data pasien, jadi benar dan aman lebih penting daripada cepat. Tiga pertanyaan, santai saja.",
                 "Hi, I'm Indah. Our data is patient data, so right and safe matter more than fast. Three questions, take your time."),
        questions: [
          { q: T("Anda mengambil data lewat API dengan LIMIT 100 OFFSET N, sementara klinik terus menambah data. Apa risikonya?", "You page through an API with LIMIT 100 OFFSET N while clinics keep adding records. What's the risk?"),
            options: [
              { text: T("Tidak ada, OFFSET selalu konsisten", "None, OFFSET is always consistent"), good: false, reply: T("Baris baru menggeser halaman, jadi ada yang terlewat dan ada yang terambil dua kali.", "New rows shift the pages, so some are skipped and some fetched twice.") },
              { text: T("Baris bisa terlewat atau terduplikasi; lebih aman pakai cursor", "Rows can be skipped or duplicated; a cursor is safer"), good: true, reply: T("Tepat. Itu bug yang sedang kami alami sekarang.", "Exactly. It's the bug we have right now.") },
              { text: T("API-nya akan lambat", "The API gets slow"), good: false, reply: T("Bisa, tetapi masalah yang lebih berbahaya adalah data hilang tanpa error.", "It can, but the more dangerous problem is data going missing without an error.") }
            ] },
          { q: T("Pasien yang sama muncul sebagai 'Budi Santoso', 'Santoso, Budi', dan 'B. Santoso'. Bagaimana menyatukannya?", "One patient appears as 'Budi Santoso', 'Santoso, Budi' and 'B. Santoso'. How do you unify them?"),
            options: [
              { text: T("Cocokkan berdasarkan nama yang mirip", "Match on similar names"), good: false, reply: T("Ada ribuan Budi Santoso. Nama saja bisa menggabungkan dua orang berbeda, dan itu berbahaya di data medis.", "There are thousands of Budi Santosos. Names alone can merge two different people, which is dangerous with medical data.") },
              { text: T("Cocokkan pada pengenal yang stabil (NIK), lalu tetapkan sistem mana yang menang per kolom", "Match on a stable identifier (NIK), then decide which system wins per column"), good: true, reply: T("Ya. Itu yang disebut golden record.", "Yes. That's what we call a golden record.") },
              { text: T("Simpan ketiganya, biar dokter memilih", "Keep all three and let the doctor choose"), good: false, reply: T("Dokter tidak punya waktu, dan tiga versi berarti tiga riwayat alergi yang berbeda.", "Doctors don't have time, and three versions means three different allergy histories.") }
            ] },
          { q: T("Dokter di Rumah Sakit A bertanya ke asisten AI. Dokumen mana yang boleh dipakai untuk menjawab?", "A doctor at Hospital A asks the AI assistant. Which documents may it use to answer?"),
            options: [
              { text: T("Semua dokumen yang paling mirip, dari rumah sakit mana pun", "The most similar documents, from any hospital"), good: false, reply: T("Itu membocorkan catatan pasien rumah sakit lain. Pelanggaran serius.", "That leaks another hospital's patient notes. A serious breach.") },
              { text: T("Hanya dokumen milik Rumah Sakit A, disaring sebelum pencarian kemiripan", "Only Hospital A's documents, filtered before the similarity search"), good: true, reply: T("Benar, dan filternya di database, bukan di kode tampilan.", "Right, and the filter lives in the database, not in display code.") },
              { text: T("Dokumen publik saja", "Public documents only"), good: false, reply: T("Aman, tetapi tidak berguna: dokter butuh data pasiennya sendiri.", "Safe but useless: doctors need their own patients' data.") }
            ] }
        ]
      },
      offer: { salary: T("Rp 12.000.000 / bulan", "IDR 12,000,000 / month"), start: T("Senin depan, pukul 09.00", "Next Monday, 09:00") },
      day1: {
        room: T("Ruang rapat 'Stetoskop', lantai 5", "Meeting room 'Stethoscope', 5th floor"),
        lines: [
          { who: "indah", text: T("Selamat datang. Di sini setiap baris data adalah seseorang. Mari dengarkan dulu masalahnya dari tim.", "Welcome. Here every row of data is a person. Let's hear the problems from the team first.") },
          { who: "dimas", text: T("Script yang menarik data dari API klinik kadang melewatkan kunjungan, kadang menggandakannya, dan setelah crash tengah malam ia mulai lagi dari awal.", "The script pulling from the clinic APIs sometimes skips visits, sometimes doubles them, and after a midnight crash it starts again from the beginning.") },
          { who: "ratna", text: T("Satu pasien bisa punya tiga catatan berbeda di tiga sistem. Dokter tidak tahu mana yang benar, termasuk soal alergi.", "One patient can have three different records in three systems. Doctors don't know which is right, allergies included.") },
          { who: "kevin", text: T("Lakehouse kami berisi lebih dari satu juta file kecil. Query butuh tiga menit hanya untuk mulai.", "Our lakehouse holds over a million tiny files. Queries take three minutes just to start.") },
          { who: "indah", text: T("Harapan saya: privasi dulu, lalu kebenaran, lalu kecepatan. Kalau ragu, tanya. Tidak ada pertanyaan bodoh soal data pasien.", "My expectations: privacy first, then correctness, then speed. When in doubt, ask. There are no stupid questions about patient data.") },
          { who: "indah", text: T("Minggu ini: siapkan laptop, dengarkan, lalu ambil tiket pertama dari Dimas.", "This week: set up your laptop, listen, then take your first ticket from Dimas.") }
        ],
        targets: [
          T("Sinkronisasi API tanpa kunjungan hilang atau ganda", "API sync with no visits missing or doubled"),
          T("Satu catatan pasien yang benar di semua sistem", "One correct patient record across all systems"),
          T("Lakehouse yang cepat dan patuh penghapusan data", "A fast lakehouse that honours data erasure"),
          T("Asisten AI yang murah dan tidak pernah membocorkan data", "An AI assistant that is cheap and never leaks data")
        ]
      },
      levels: [
        { from: "dimas", after: T("Crash tengah malam kemarin, dan sinkronisasi melanjutkan dari titik terakhir tanpa satu pun kunjungan ganda.", "It crashed at midnight yesterday, and the sync resumed from the last point without one duplicate visit."),
          oneOnOne: T("Anda membuat checkpoint yang benar, dan itu fondasi semua pekerjaan lain. Masa percobaan selesai.", "You got the checkpoint right, and everything else rests on that. Probation's over.") },
        { from: "ratna", after: T("Dokter sekarang melihat satu catatan per pasien. Terima kasih dari seluruh tim klinis.", "Doctors now see one record per patient. Thank you from the whole clinical team."),
          oneOnOne: T("Anda menangani migrasi tanpa satu laporan pun rusak. Anda Data Engineer penuh sekarang.", "You handled the migration without breaking a single report. You're a full Data Engineer now.") },
        { from: "kevin", after: T("Query mulai dalam hitungan detik, dan data pasien yang mencabut persetujuan benar-benar hilang.", "Queries start in seconds, and the data of patients who withdrew consent is truly gone."),
          oneOnOne: T("Anda memahami lakehouse sampai ke file-nya. Saya mengajukan Anda sebagai Senior.", "You understand the lakehouse down to its files. I've put you forward for Senior.") },
        { from: "arif", after: T("Biaya embedding turun drastis, dan uji keamanan tidak menemukan kebocoran antar rumah sakit.", "Embedding costs fell sharply, and the security test found no leakage between hospitals."),
          oneOnOne: T("Dokter mempercayai asisten AI karena datanya Anda jaga. Selamat: Lead Data Engineer.", "Doctors trust the AI assistant because you looked after its data. Congratulations: Lead Data Engineer.") }
      ]
    }
  };

  root.JOB_CAREER_DATA = { COMMON, COMPANIES };
})(typeof window !== "undefined" ? window : globalThis);
