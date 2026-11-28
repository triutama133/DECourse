/* Cloud sync is OFF by default. To turn it on, see DEPLOY.md:
 *   - on Vercel the build writes this file from the SUPABASE_URL and SUPABASE_ANON_KEY settings, or
 *   - on your own computer run  node scripts/write-cloud-config.js --local  (writes the git-ignored cloud-config.local.js).
 * Only the PUBLIC "anon" (or "publishable") key belongs here, never a service_role / secret key. */
window.DF_CLOUD = null;
