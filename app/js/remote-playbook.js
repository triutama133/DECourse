// The Global Remote Data Engineer Playbook
// High-Impact Technical English, Communication Frameworks, and International Remote Career Strategy

window.REMOTE_PLAYBOOK = {
  overview: {
    id: {
      title: "Panduan Komunikasi Teknis & Karir Remote Global",
      subtitle: "Kunci tembus kerja remote luar negeri (US, Eropa, Singapura) bukan TOEFL/IELTS, melainkan 'Technical English Fluency' dan komunikasi asinkron yang jelas.",
      whyImportant: "Recruiter luar negeri tidak peduli apakah grammar Anda seperti novelis. Mereka peduli 3 hal: 1) Bisakah Anda menjelaskan keputusan arsitektur secara diplomatis? 2) Bisakah Anda menulis dokumentasi RFC yang jelas? 3) Bisakah Anda menangani insiden di Slack dengan tenang?"
    },
    en: {
      title: "Global Remote Data Engineer Playbook",
      subtitle: "The secret to landing international remote roles (US, Europe, Singapore) isn't TOEFL or IELTS—it is Technical English Fluency and structured async communication.",
      whyImportant: "Global hiring managers don't care about poetic grammar. They look for 3 things: 1) Can you articulate architectural trade-offs diplomatically? 2) Can you write crystal-clear RFCs and PRs? 3) Can you stay calm and articulate during production incidents on Slack?"
    }
  },

  sections: [
    {
      id: "system-design-phrasing",
      title: {
        id: "1. Formula Berbicara saat Wawancara System Design (English Phrasing)",
        en: "1. System Design Interview Communication Patterns"
      },
      description: {
        id: "Kalimat-kalimat kunci yang langsung memberikan sinyal 'Senior Engineer' di hadapan interviewer luar negeri.",
        en: "Key phrases that immediately signal senior-level engineering judgment in global interviews."
      },
      templates: [
        {
          stage: {
            id: "Tahap Klarifikasi (Clarifying Requirements)",
            en: "Clarifying Requirements"
          },
          pattern: "Before jumping into the storage layer, let me clarify the non-functional requirements. What is the expected write throughput and the acceptable latency SLA between event generation and query availability?",
          whyItWorks: {
            id: "Menunjukkan Anda tidak buru-buru memilih tool sebelum paham skala bisnis riil.",
            en: "Demonstrates that you prioritize business scale and SLA constraints over premature tool selection."
          }
        },
        {
          stage: {
            id: "Menjelaskan Pertukaran Solusi (Evaluating Trade-offs)",
            en: "Evaluating Trade-offs"
          },
          pattern: "There is an inherent trade-off here between write latency and storage cost. If we write small files continuously, we achieve sub-second freshness, but we risk the small-file problem in object storage. Therefore, I propose a micro-batching window of 60 seconds coupled with an hourly asynchronous compaction daemon.",
          whyItWorks: {
            id: "Hiring manager internasional sangat menyukai kata 'inherent trade-off' dan 'therefore, I propose...'.",
            en: "International hiring managers strongly value explicit trade-off analysis and structured architectural proposals."
          }
        },
        {
          stage: {
            id: "Menjawab Skenario Gagal (Handling Edge Cases)",
            en: "Handling Edge Cases & Failure Modes"
          },
          pattern: "In the event of network partitions or upstream worker failures, our pipeline guarantees at-least-once delivery. To prevent downstream revenue duplication, our consumers implement idempotent upserts keyed on a deterministic transaction hash.",
          whyItWorks: {
            id: "Langsung menjawab kekhawatiran interviewer tentang konsistensi data.",
            en: "Directly addresses interviewer concerns regarding idempotency and distributed failure handling."
          }
        }
      ]
    },
    {
      id: "async-documentation",
      title: {
        id: "2. Menulis RFC & Dokumentasi Asinkron (Async Work Standard)",
        en: "2. Writing High-Impact RFCs & Async PR Descriptions"
      },
      description: {
        id: "Di tim remote global (lintas zona waktu 8-12 jam), kemampuan menulis Anda adalah reputasi teknis Anda.",
        en: "In distributed remote teams across multiple time zones, your writing is your technical reputation."
      },
      sampleRfc: `## RFC-042: Migrating Operational CDC from Batch Polling to Debezium & Redpanda

### 1. Problem Statement & Motivation
Currently, our nightly batch queries against production PostgreSQL (\`SELECT * WHERE updated_at > ...\`) cause heavy lock contention, increasing p99 OLTP latency by 35% between 02:00-04:00 UTC. Furthermore, deletions in the source database are silently dropped in the lakehouse.

### 2. Proposed Architecture
We propose capturing database mutations at the storage engine level by reading PostgreSQL Write-Ahead Logs (WAL) via Debezium and streaming changes to Redpanda.

### 3. Trade-offs & Considered Alternatives
- **Alternative A (Airbyte Batch Sync)**: Rejected due to recurring table locks and lack of hard-delete capture.
- **Alternative B (Kafka + ZooKeeper)**: Rejected due to excessive operational JVM overhead; chosen Redpanda for single-binary C++ efficiency.

### 4. Rollback & Disaster Recovery Plan
If consumer lag exceeds 500k records during initial backfill, replication slots will be paused, falling back to the existing replica snapshot with zero impact on customer-facing APIs.`
    },
    {
      id: "incident-communication",
      title: {
        id: "3. Komunikasi Insiden di Slack Global (#war-room)",
        en: "3. Live Incident Triage Communication on Slack"
      },
      description: {
        id: "Template cara mengabarkan insiden pipa data rusak di Slack perusahaan global tanpa panik dan tanpa menyalahkan orang lain.",
        en: "Battle-tested Slack updates to communicate production data pipeline failures calmly and transparently."
      },
      slackTemplates: [
        {
          phase: {
            id: "Pemberitahuan Awal (Menit 0-10)",
            en: "Initial Alert (0-10 mins)"
          },
          text: `🚨 **INCIDENT UPDATE [P1 - Data Freshness Delay]**
- **Impact**: Daily Executive Revenue Mart is delayed; values currently show data up to 23:00 UTC yesterday.
- **Root Cause (Preliminary)**: Ingestion pipeline halted due to upstream schema modification on checkout events.
- **Action Being Taken**: @alex is triaging schema mismatch in staging; @sarah is preparing a defensive dbt patch.
- **Next Update**: 15 minutes (or immediately upon mitigation).`
        },
        {
          phase: {
            id: "Masalah Teratasi & Backfill Dimulai (Menit 45)",
            en: "Resolved & Backfill Triggered (45 mins)"
          },
          text: `✅ **INCIDENT MITIGATED [P1 - Revenue Mart]**
- **Resolution**: Deployed patch PR #204 to handle nullable currency fields safely.
- **Status**: Pipeline backfill completed for missing partitions. Row counts reconciled and verified 100% against payment gateways.
- **Follow-up**: Blameless Post-Mortem scheduled for tomorrow 14:00 UTC with Action Items for Data Contracts.`
        }
      ]
    },
    {
      id: "behavioral-star",
      title: {
        id: "4. Menjawab Pertanyaan Behavioral (STAR Framework in English)",
        en: "4. Mastering Behavioral Rounds using the STAR Framework"
      },
      description: {
        id: "Wawancara remote luar negeri selalu menyertakan sesi Culture & Behavioral. Jawaban wajib terstruktur dengan Situasi, Tugas, Aksi, dan Hasil.",
        en: "Global remote companies evaluate communication and diplomacy through structured STAR behavioral questions."
      },
      starExamples: [
        {
          question: {
            id: "Ceritakan pengalaman ketika Anda berselisih pendapat teknis dengan Product Manager atau Software Engineer.",
            en: "Tell me about a time you had a disagreement with a Product Manager or Software Engineer."
          },
          answer: `**Situation**: The checkout backend team wanted to push a non-backward-compatible database migration on a Friday to hit an end-of-sprint deadline, which would have broken our downstream analytical lakehouse.
**Task**: I needed to protect our data pipelines and Monday morning executive reporting without becoming a blocker to their deployment roadmap.
**Action**: Instead of simply saying 'no', I hopped on a 15-minute call with their lead engineer. I proposed adding a temporary alias column in the database migration and pair-programmed a defensive staging view in dbt using \`COALESCE(new_column, old_column)\`.
**Result**: They shipped on time on Friday, our downstream models ran with zero errors over the weekend, and we subsequently formalized a pre-merge Data Contract CI check to avoid future friction.`
        }
      ]
    },
    {
      id: "contractor-salary",
      title: {
        id: "5. Strategi Gaji Remote & Kontrak Internasional (USD/EUR)",
        en: "5. Compensation Benchmarks & Contractor Setup for Global Remote"
      },
      description: {
        id: "Cara bernegosiasi gaji dollar dan setup legal dari Indonesia.",
        en: "How to negotiate global compensation and structure international contractor agreements."
      },
      tips: [
        {
          topic: {
            id: "Benchmark Gaji Remote (Data Engineer)",
            en: "Remote DE Compensation Benchmarks"
          },
          detail: {
            id: "Junior-Mid: $2,500 - $4,500/bulan (~Rp 40jt - 70jt). Senior: $5,000 - $10,000+/bulan (~Rp 80jt - 160jt+). Jangan pernah sebutkan gaji lokal rupiah Anda saat ditanya salary expectation; selalu sebutkan market rate USD.",
            en: "Junior-Mid: $2,500 - $4,500/month (~IDR 40M - 70M). Senior: $5,000 - $10,000+/month (~IDR 80M - 160M+). Never anchor on your local salary history when asked for expectations; anchor firmly on global USD market rates."
          }
        },
        {
          topic: {
            id: "Bentuk Kontrak & Pembayaran",
            en: "Contract Structure & Payment Methods"
          },
          detail: {
            id: "Perusahaan luar negeri biasanya mempekerjakan engineer Indonesia via dua jalur: 1) **Independent Contractor (B2B)** via invoice bulanan (Wise Business / Payoneer), atau 2) **Employer of Record (EOR)** via platform seperti **Deel** atau **Remote.com** (di mana Anda mendapatkan kontrak berbadan hukum Indonesia lengkap dengan BPJS dan pemotongan PPh 21).",
            en: "Global companies typically hire Indonesian engineers via two models: 1) **Independent Contractor (B2B)** using monthly invoicing (Wise Business / Payoneer), or 2) **Employer of Record (EOR)** via platforms like **Deel** or **Remote.com** (providing local compliance, Indonesian statutory benefits, and tax withholding)."
          }
        }
      ]
    }
  ]
};

