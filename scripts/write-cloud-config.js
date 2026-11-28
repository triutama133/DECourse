#!/usr/bin/env node
// Write the small file that tells the web app which Supabase project to save progress to.
//   Vercel:  set SUPABASE_URL and SUPABASE_ANON_KEY in the project settings; scripts/build-vercel.js calls this for you.
//   Local:   node scripts/write-cloud-config.js --local --url https://xxxx.supabase.co --key <anon key>
//            (or put the two names in your environment). It writes app/js/cloud-config.local.js, which git ignores.
// Only the PUBLIC key is allowed. A service_role / secret key would let anyone who opens the page read every
// learner's data, so this script refuses it.
const fs = require("fs");
const path = require("path");

const URL_NAMES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"];
const KEY_NAMES = ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"];

function firstEnv(env, names) { for (const n of names) if (env[n] && String(env[n]).trim()) return String(env[n]).trim(); return ""; }

function keyRole(key) {
  if (/^sb_secret_/.test(key)) return "service_role";
  if (/^sb_publishable_/.test(key)) return "anon";
  const parts = key.split(".");
  if (parts.length === 3) {
    try { return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role || "unknown"; } catch (e) { return "unknown"; }
  }
  return "unknown";
}

// returns { ok, config, message }; config is null when sync should stay off
function buildConfig(env, args = {}) {
  const url = (args.url || firstEnv(env, URL_NAMES)).replace(/\/+$/, "");
  const key = args.key || firstEnv(env, KEY_NAMES);
  if (!url && !key) return { ok: true, config: null, message: "cloud sync is OFF (no SUPABASE_URL / SUPABASE_ANON_KEY set)" };
  if (!url || !key) return { ok: false, config: null, message: "set BOTH the Supabase URL and the anon key (one of them is missing)" };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    return { ok: false, config: null, message: `the Supabase URL looks wrong: ${url}  (expected https://<project>.supabase.co)` };
  }
  const role = keyRole(key);
  if (role === "service_role") return { ok: false, config: null, message: "this is a service_role / secret key. Never put it in a web page. Use the anon (publishable) key from Project Settings > API." };
  return { ok: true, config: { url, anonKey: key }, message: `cloud sync is ON for ${url}` };
}

function configSource(config) {
  return "/* written by scripts/write-cloud-config.js; the anon key is public by design, Row Level Security protects the data */\n"
    + `window.DF_CLOUD = ${config ? JSON.stringify(config) : "null"};\n`;
}

module.exports = { buildConfig, configSource, keyRole };

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const local = a.includes("--local");
  const out = arg("--out") || path.join(__dirname, "..", "app", "js", local ? "cloud-config.local.js" : "cloud-config.js");
  const r = buildConfig(process.env, { url: arg("--url"), key: arg("--key") });
  if (!r.ok) { console.error("ERROR: " + r.message); process.exit(1); }
  fs.writeFileSync(out, configSource(r.config));
  console.log(`${r.message}\nwrote ${path.relative(process.cwd(), out)}`);
}
