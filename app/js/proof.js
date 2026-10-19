// Checks the proof codes printed by scripts/prove.py. Works in the browser (window.ProofCheck) and in Node (require).
// Code format:  DF1:<module>:<passed>:<venv v|c|n>:<python>:<os>:<tests8>:<work8>:<chk6>
(function (root) {
  function sha256(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = Array.from(new TextEncoder().encode(str));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map((x) => x | 0);
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function verify(P, modId, raw) {
    if (!P) return { ok: false, reason: "none" };
    const f = String(raw || "").trim().replace(/\s+/g, "").split(":");
    if (f.length !== 9 || f[0] !== "DF1") return { ok: false, reason: "format" };
    const [, mod, passed, venv, py, os, tests, work, chk] = f;
    if (sha256(f.slice(0, 8).join("|")).slice(0, 6) !== chk.toLowerCase()) return { ok: false, reason: "checksum" };
    if (mod !== modId) return { ok: false, reason: "module", mod };
    if (tests !== P.tests) return { ok: false, reason: "stale" };
    if (work === P.reference) return { ok: false, reason: "copied" };
    if (work === P.starter) return { ok: false, reason: "starter" };
    if (!(parseInt(passed, 10) > 0)) return { ok: false, reason: "passed" };
    if (P.requireVenv && venv === "n") return { ok: false, reason: "venv" };
    return { ok: true, info: { passed: parseInt(passed, 10), venv, py, os } };
  }

  function verifyTryIt(expectedIdent, raw) {
    const f = String(raw || "").trim().replace(/\s+/g, "").split(":");
    if (f.length !== 6 || f[0] !== "TRY1") return { ok: false, reason: "format" };
    const [, ident, passed, py, os, chk] = f;
    if (sha256(f.slice(0, 5).join("|")).slice(0, 6) !== chk.toLowerCase()) return { ok: false, reason: "checksum" };
    if (expectedIdent && ident !== expectedIdent) return { ok: false, reason: "ident", ident };
    if (!(parseInt(passed, 10) > 0)) return { ok: false, reason: "passed" };
    return { ok: true, info: { ident, passed: parseInt(passed, 10), py, os } };
  }

  const api = { sha256, verify, verifyTryIt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ProofCheck = api;
})(typeof window !== "undefined" ? window : globalThis);

