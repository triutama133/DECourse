#!/usr/bin/env node
// Verify a proof code the same way the app does:  node scripts/proof_check.js mod-0-1 DF1:...   (prints JSON; used by scripts/test_proof.py)
const fs = require('fs');
const path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'proof-data.js'), 'utf8'));
const { verify } = require('../app/js/proof.js');
const [mod, code] = process.argv.slice(2);
console.log(JSON.stringify(verify(window.PROOF[mod], mod, code)));
