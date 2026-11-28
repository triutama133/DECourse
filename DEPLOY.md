# Put DataForge online (Vercel) and save progress in an account (Supabase)

Both are **optional**. The course runs fine on your own computer (`npm start`) and saves progress in your browser.
Do this when you want a web address you can open anywhere, and progress that follows you from one device to another.

Bahasa Indonesia ada di bagian bawah.

## How it fits together

```
your browser  ──►  Vercel         static files only: the lessons, the browser labs, the SQL and Python engines
      │
      └──────────►  Supabase      sign-in + one small row of progress per learner (only if you set it up)
```

- The site is **static**: nothing to install, no server code, no database of its own.
- The offline AI tutor needs Ollama on **your** computer. On the online site it shows the exact command to run
  (`OLLAMA_ORIGINS=https://your-site ollama serve`). Use Chrome, Edge or Firefox for this: Safari does not let an https page talk to a program on your own computer.
  Everything else works online without it.
- The sign-in uses only the **public** Supabase key. A learner can read and write **only their own row**
  (Row Level Security, tested in `scripts/test_supabase_schema.py`).

## Part 1. Deploy on Vercel

1. Put the repository on GitHub (it already is: your fork or `triutama133/DECourse`).
2. On vercel.com: **Add New → Project → Import** the repository.
3. Leave every build setting as it is. `vercel.json` already says: no framework, build with
   `node scripts/build-vercel.js`, publish the folder `dist`. (Do **not** type your own build command or output folder.)
4. **Deploy.** The first deploy takes about a minute. Open the address Vercel shows.

From the command line instead: `npx vercel` (preview) and `npx vercel --prod` (final), run in this folder.

What the build does: copies `app/` into `dist/` **without** the local helper server (`app/server.js`), and writes the
account settings. It needs no `npm install` and runs no tests. Check it yourself any time: `npm run build:vercel`.

### If the deploy fails

Open the failed deployment → **Building** → copy the red lines and send them to whoever helps you. Meanwhile, the usual causes:

| What the log says | What to do |
|---|---|
| `No Next.js version detected` (stops after a few seconds) | The Vercel project's **Framework Preset** is set to Next.js, but this is a plain static site. `vercel.json` sets `"framework": null`, which fixes it for every deploy from this repository. For tidiness also set Project → Settings → Build & Development → **Framework Preset = Other**. A failed deployment of an older commit stays in the list marked "Stale"; only the newest one counts. |
| A password-reset or sign-in email link opens `http://localhost:3000` | Supabase still has its default **Site URL**. Set Authentication → URL Configuration → Site URL to your Vercel address, and add that address (and `http://localhost:3000`) under Redirect URLs. Then request a new email: links already sent keep the old address. |
| `No Output Directory named "..." found` | Project → Settings → Build & Development → turn **off** the "Override" switches for Build Command and Output Directory, so `vercel.json` is used. |
| `Error: missing from the web app: ...` | A file the site needs is not in the repository. Run `git status` and commit it. |
| `ERROR: the Supabase URL looks wrong` | `SUPABASE_URL` must look like `https://abcdxyz.supabase.co` (no path, no spaces). |
| `ERROR: this is a service_role / secret key` | You pasted the **secret** key. Use the **anon / publishable** key (see Part 2, step 5). The build refuses the secret one on purpose. |
| The page opens but is blank | Open the browser console (F12). A 404 for a file under `js/` means the file is not in the repository. |

## Part 2. Save progress online with Supabase

1. Create a free project at supabase.com. Remember the database password somewhere safe (you will not need it again here).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` → **Run**. This creates the table and the security rules.
   (Safe to run again.)
3. **Authentication → Sign In / Providers → Email**: keep it enabled. Choose whether **Confirm email** is on.
   On = a learner must click a link in an email before the first sign-in. Off = signing up signs in at once.
4. **Authentication → URL Configuration**: set **Site URL** to your Vercel address (for example `https://dataforge-xxx.vercel.app`)
   and add the same address, and `http://localhost:3000`, under **Redirect URLs**. Sign-in links and password-reset links
   come back to these addresses. (The free Supabase email sender is slow and limited; fine for yourself, set up your own
   SMTP under Authentication → Emails before many learners use it.)
5. **Project Settings → API** (or the **Connect** button): copy the **Project URL** and the **anon / publishable** key.
   Never use the `service_role` or `secret` key anywhere in this project.
6. In Vercel: **Project → Settings → Environment Variables** → add `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (tick Production **and** Preview) → **Deployments → … → Redeploy**. The settings are written into the site at build time,
   so a redeploy is needed after any change. Other names work too if they end in `SUPABASE_URL` and `ANON_KEY` / `PUBLISHABLE_KEY`
   (for example `NEXT_PUBLIC_SUPABASE_URL`, or `talenthub_PUBLIC_SUPABASE_URL`); a name ending in `SERVICE_ROLE_KEY` is never used.
   To see whether it worked, open `https://your-site/js/cloud-config.js`: it should show your project, not `null`.
7. Open the site: a **Masuk / Sign in** button appears in the top bar. Create an account, learn something, open the site
   on another device, sign in: the progress is there.

### Try it on your own computer first

```bash
node scripts/write-cloud-config.js --local --url https://abcdxyz.supabase.co --key <anon-key>   # writes a git-ignored file
npm start                                                                                         # http://localhost:3000
```

Already have the two values in a `.env` file (for example `talenthub_PUBLIC_SUPABASE_URL` and `talenthub_PUBLIC_SUPABASE_ANON_KEY`)?
Read just those two, and nothing else from the file:

```bash
node scripts/write-cloud-config.js --local --env-file .env --prefix talenthub_
```

No Supabase account yet? Try the whole flow against a fake one:

```bash
node scripts/mock_supabase.js            # prints the two values to use
node scripts/write-cloud-config.js --local --url http://127.0.0.1:54321 --key test-anon-key
npm start
```

To switch it off again, delete `app/js/cloud-config.local.js`.

### What is saved, and what is not

- **Saved online:** lesson progress, drills and their code, quiz scores, notes, drafts, streak, job-simulator and interview progress.
- **Never uploaded:** theme, language, sound and text-size settings, the AI tutor's settings, and the text you paste from your terminal in Try-it boxes.
- **Two devices:** progress from both is merged (lists are joined, objects merge key by key, a single value takes the newer change), so nothing you learned on one device is lost when you sign in on another.
- **Offline:** everything keeps working and is saved on the device; it goes online when the connection is back.
- **Delete it:** the account dialog has "Delete the online copy". Deleting the whole account is done in the Supabase dashboard
  (Authentication → Users); the progress row goes with it.

### Check that it works

```bash
node scripts/test_cloud_sync.js                                              # sync, merge, token refresh, offline, the Vercel build (fake Supabase)
DATABASE_URL=postgresql://... python3 scripts/test_supabase_schema.py        # the security rules, on a throw-away PostgreSQL
```

---

# Bahasa Indonesia

Dua-duanya **opsional**. Kursus tetap jalan di komputer Anda (`npm start`) dan menyimpan progres di browser.
Lakukan ini kalau Anda ingin alamat web yang bisa dibuka di mana saja, dan progres yang ikut ke perangkat lain.

**Vercel (taruh di internet):** impor repositori di vercel.com, jangan ubah pengaturan build (sudah diatur `vercel.json`:
tanpa framework, build `node scripts/build-vercel.js`, folder keluaran `dist`), lalu **Deploy**. Kalau gagal, salin baris merah
dari log dan lihat tabel "If the deploy fails" di atas.

**Supabase (simpan progres di akun):**
1. Buat proyek gratis di supabase.com.
2. **SQL Editor**: tempel seluruh `supabase/schema.sql`, **Run**.
3. **Authentication → Providers → Email**: aktif. Pilih apakah **Confirm email** menyala.
4. **Authentication → URL Configuration**: isi **Site URL** dengan alamat Vercel Anda; tambahkan alamat itu dan `http://localhost:3000` di **Redirect URLs**.
5. **Project Settings → API**: salin **Project URL** dan kunci **anon / publishable**. Jangan pernah memakai kunci `service_role` / `secret`.
6. Di Vercel: **Settings → Environment Variables**: tambahkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY`, lalu **Redeploy**.
7. Tombol **Masuk** muncul di bilah atas. Buat akun, belajar, buka di perangkat lain, masuk: progres Anda ada di sana.

Yang disimpan online: progres materi, latihan, kuis, catatan, draf, streak. Yang tidak pernah diunggah: tema, bahasa, suara,
pengaturan tutor AI, dan teks yang Anda tempel dari terminal. Progres dari dua perangkat digabung, tidak saling menimpa.
Tanpa akun Supabase Anda bisa mencoba alurnya dengan `node scripts/mock_supabase.js` (lihat bagian bahasa Inggris).
