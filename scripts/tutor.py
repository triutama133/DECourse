#!/usr/bin/env python3
"""DataForge Tutor: ask the course a question, offline, with a small local AI model.

How it works (no cloud, no extra Python packages):
  1. Your question is searched in the course itself (every lesson and the glossary, in your language).
  2. The best few passages are handed to a small model running on YOUR computer through Ollama.
  3. The model explains them in plain words. The lessons it used are printed under the answer,
     so you can go and read the real lesson. The course, not the model, is the authority.

One-time setup (needs internet once, to download the model, about 2 GB):
    ollama serve                      # leave it running in another terminal
    ollama pull qwen2.5:3b            # small and fast on a normal laptop CPU

Use it:
    python3 scripts/tutor.py                       # chat; type exit to leave
    python3 scripts/tutor.py "what is a backfill?"  # one question
    python3 scripts/tutor.py --search "window function"   # NO model needed: just show the lessons that match
    python3 scripts/tutor.py --lang id "apa itu primary key?"
    python3 scripts/tutor.py --check               # new machine? this tells you exactly what is missing
    python3 scripts/tutor.py --self-test

Different model:  DF_TUTOR_MODEL=qwen2.5:7b python3 scripts/tutor.py   (smarter, slower)
"""
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
if not HOST.startswith("http"):
    HOST = "http://" + HOST
MODEL = os.environ.get("DF_TUTOR_MODEL", "qwen2.5:3b")

STOP = set(
    "the a an of to in is it and or for on that this with as be by are you your not no if then when which what at from so can do does into its how why "
    "i me my we our they them there here was were will would should could about also just more most some any each than too very "
    "yang dan atau untuk pada itu ini dengan adalah ke dari tidak ada apa bagaimana mengapa kenapa saya aku kita kami anda di akan bisa dapat "
    "sebuah suatu oleh juga lebih sangat seperti agar karena jika maka lalu sudah belum".split()
)
ID_WORDS = set("yang apa bagaimana dengan untuk adalah saya kenapa mengapa tidak itu ini dan di dari bisa kita anda buat cara".split())


def tokens(text):
    out = []
    for w in re.findall(r"[a-z0-9_]+", text.lower()):
        if len(w) < 2 or w in STOP:
            continue
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]  # crude plural: orders -> order
        out.append(w[:7])  # tolerate endings and spellings: idempotent / idempoten / idempotensi
    return out


def guess_lang(question):
    words = re.findall(r"[a-z]+", question.lower())
    return "id" if sum(1 for w in words if w in ID_WORDS) >= 1 and sum(1 for w in words if w in ID_WORDS) * 4 >= len(words) else "en"


# ---------------------------------------------------------------- reading the course
def clean_lesson_text(block):
    """Drop the machine parts of a lesson (starters, checks, solutions, animations); keep the teaching."""
    out, skip, in_drill = [], False, False
    for line in block.split("\n"):
        s = line.strip()
        if s.startswith(":::drill"):
            in_drill, skip = True, False
            out.append("Practice: " + s[len(":::drill"):].strip().split(" ", 1)[-1] if len(s) > 8 else "Practice:")
            continue
        if s.startswith((":::trace", ":::sqlsteps", ":::advanced")):
            skip = True
            continue
        if s.startswith(":::ask"):
            in_drill, skip = False, False
            out.append("Question: " + s[len(":::ask"):].strip())
            continue
        if s == ":::":
            in_drill, skip = False, False
            continue
        if skip:
            continue
        if in_drill:
            if s.startswith(("@starter", "@check", "@hint", "@solution")):
                skip = True
            else:
                out.append(line)
            continue
        if s.startswith(("@options", "@why")):
            if s == "@why":
                out.append("Answer explained:")
            continue
        out.append(line.lstrip("* ") if s.startswith("* ") and False else line)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_big(text, limit=1300):
    paras, cur, parts = text.split("\n\n"), "", []
    for p in paras:
        if cur and len(cur) + len(p) > limit:
            parts.append(cur.strip())
            cur = ""
        cur += p + "\n\n"
    if cur.strip():
        parts.append(cur.strip())
    return parts


def load_chunks(lang):
    chunks = []
    for path in sorted((ROOT / "curriculum").glob(f"mod-*/{lang}.md")):
        mod = path.parent.name
        raw = path.read_text(encoding="utf-8")
        title = (re.search(r"^title:\s*(.+)$", raw, re.M) or [None, mod])[1].strip()
        body = raw.split("\n---", 1)[1] if raw.startswith("---") else raw
        lesson_no, lesson_title, section = 0, "", ""
        buf = []
        in_lesson = False  # lab, chaos and quiz sections after a lesson are not part of it

        def flush():
            text = clean_lesson_text("\n".join(buf))
            if len(text) < 80 or lesson_no == 0:
                return
            for part in split_big(text):
                head = f"{lesson_title}: {section}" if section else lesson_title
                chunks.append({"mod": mod, "mod_title": title, "lesson": lesson_no, "lesson_title": lesson_title,
                               "heading": head, "text": part, "kind": "lesson"})

        for line in body.split("\n"):
            if line.startswith("## @") and not line.startswith("## @lesson"):
                flush(); buf = []
                in_lesson = False
            elif not in_lesson and not line.startswith("## @lesson"):
                continue
            elif line.startswith("## @lesson"):
                flush(); buf = []
                in_lesson = True
                lesson_no += 1
                lesson_title = re.sub(r"\{optional\}", "", line[len("## @lesson"):]).strip()
                section = ""
            elif line.startswith("### ") and lesson_no:
                flush(); buf = []
                section = line[4:].strip()
            else:
                buf.append(line)
        flush()
    # glossary: short exact definitions
    gl = (ROOT / "app" / "js" / "glossary-data.js")
    if gl.exists():
        q = r'"((?:[^"\\]|\\.)*)"'
        pat = re.compile(r'g\(\s*"[^"]+",\s*' + q + r',\s*' + q + r',\s*\[.*?\],\s*"(mod-\d-\d)",\s*(\d+),\s*' + q + r',\s*' + q + r'\s*\)', re.S)
        titles = {c["mod"]: c["mod_title"] for c in chunks}
        for m in pat.finditer(gl.read_text(encoding="utf-8")):
            term_en, term_id, mod, lesson = json.loads('"%s"' % m.group(1)), json.loads('"%s"' % m.group(2)), m.group(3), int(m.group(4))
            term = term_en if lang == "en" else term_id
            d = json.loads('"%s"' % (m.group(5) if lang == "en" else m.group(6)))
            chunks.append({"mod": mod, "mod_title": titles.get(mod, mod), "lesson": lesson, "lesson_title": "",
                           "heading": f"Glossary: {term}", "text": f"{term}: {d}", "kind": "glossary"})
    return chunks


class Index:
    """BM25 over lesson sections and glossary entries (pure Python: fast, offline, no model needed)."""

    def __init__(self, chunks, k1=1.4, b=0.75):
        self.chunks, self.k1, self.b = chunks, k1, b
        self.tf, self.df, self.len = [], Counter(), []
        for c in chunks:
            toks = tokens(c["heading"]) * 3 + tokens(c["text"])  # the heading counts triple
            if c["kind"] == "glossary":
                toks = tokens(c["heading"]) * 4 + toks
            cnt = Counter(toks)
            self.tf.append(cnt)
            self.len.append(len(toks))
            for t in cnt:
                self.df[t] += 1
        self.avg = sum(self.len) / max(1, len(self.len))

    def search(self, query, k=3):
        q = tokens(query)
        n = len(self.chunks)
        scored = []
        for i, cnt in enumerate(self.tf):
            s = 0.0
            for t in set(q):
                f = cnt.get(t, 0)
                if not f:
                    continue
                idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                s += idf * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
            if s > 0:
                scored.append((s, i))
        scored.sort(reverse=True)
        picked, seen = [], set()
        for s, i in scored:
            c = self.chunks[i]
            key = (c["mod"], c["lesson"], c["kind"])
            if key in seen:  # one passage per lesson keeps the answer varied
                continue
            seen.add(key)
            picked.append((s, c))
            if len(picked) == k:
                break
        return picked


# ---------------------------------------------------------------- talking to the model
def system_prompt(lang):
    who = ("You are the DataForge Tutor, a patient teacher for a complete beginner who wants to become a professional data engineer. "
           "Explain in short, plain words, like talking to a friend. Use a tiny everyday example when it helps. ")
    rules = ("Answer ONLY from the COURSE EXCERPTS given below. Do not invent facts, commands or numbers. "
             "If the excerpts do not contain the answer, say so in one sentence and suggest which topic to look for; do not guess. "
             "Keep the answer under 150 words. Do not list sources: the program prints them.")
    where = "Reply in Indonesian." if lang == "id" else "Reply in English."
    return f"{who}{rules} {where}"


def build_messages(question, passages, lang, history):
    ctx = "\n\n".join(f"[{c['mod_title']}, lesson {c['lesson']}: {c['heading']}]\n{c['text'][:800]}" for _, c in passages)
    msgs = [{"role": "system", "content": system_prompt(lang)}]
    msgs += history[-2:]
    msgs.append({"role": "user", "content": f"COURSE EXCERPTS:\n{ctx}\n\nQUESTION: {question}"})
    return msgs


def chat(messages, on_token, model=MODEL, host=HOST):
    body = json.dumps({"model": model, "messages": messages, "stream": True, "keep_alive": "30m",
                       "options": {"temperature": 0.2, "num_ctx": 4096, "num_predict": 400}}).encode()
    req = urllib.request.Request(host + "/api/chat", data=body, headers={"Content-Type": "application/json"})
    full = []
    with urllib.request.urlopen(req, timeout=600) as r:
        for raw in r:
            if not raw.strip():
                continue
            d = json.loads(raw)
            if "error" in d:
                raise RuntimeError(d["error"])
            t = d.get("message", {}).get("content", "")
            if t:
                full.append(t)
                on_token(t)
            if d.get("done"):
                break
    return "".join(full)


def model_ready(model=MODEL, host=HOST):
    """Returns (ok, message)."""
    try:
        with urllib.request.urlopen(host + "/api/tags", timeout=3) as r:
            have = [m["name"] for m in json.load(r).get("models", [])]
    except (urllib.error.URLError, OSError):
        return False, ("The model server is not running. In another terminal run:  ollama serve\n"
                       "(First time only, then:  ollama pull %s  ). You can still use  --search  without any model." % model)
    if not any(h == model or h.split(":")[0] == model.split(":")[0] and ":" not in model for h in have):
        return False, f"The model '{model}' is not downloaded yet. Run once (needs internet, about 2 GB):  ollama pull {model}"
    return True, ""


def show_sources(passages, lang):
    label = "Read more" if lang == "en" else "Baca lebih lanjut"
    lines = []
    for _, c in passages:
        if c["kind"] == "glossary":
            continue
        name = c["lesson_title"] or c["heading"]
        lines.append(f"  - Module {c['mod'][4:].replace('-', '.')}, lesson {c['lesson']}: {name}")
    seen, out = set(), []
    for l in lines:
        if l not in seen:
            seen.add(l); out.append(l)
    return f"\n{label}:\n" + "\n".join(out) if out else ""


def ask(question, idx, lang, history, k=2, out=sys.stdout):
    passages = idx.search(question if len(tokens(question)) >= 3 or not history else history[-2]["content"].split("QUESTION:")[-1] + " " + question, k)
    passages = [p for p in passages if p[0] >= 0.72 * passages[0][0]] if passages else passages  # drop weak matches
    if not passages:
        out.write(("I could not find that in the course. Try other words, or open the Glossary.\n" if lang == "en"
                   else "Saya tidak menemukannya di kursus ini. Coba kata lain, atau buka Glosarium.\n"))
        return None
    answer = chat(build_messages(question, passages, lang, history), lambda t: (out.write(t), out.flush()))
    out.write("\n" + show_sources(passages, lang) + "\n")
    history += [{"role": "user", "content": f"QUESTION: {question}"}, {"role": "assistant", "content": answer}]
    return answer


# ---------------------------------------------------------------- self-test (no real model needed)
def check():
    """A plain checklist for a new machine: is Ollama installed, running, and is the model downloaded?"""
    import shutil
    import platform
    sysname = platform.system()
    install = {"Linux": "curl -fsSL https://ollama.com/install.sh | sh", "Darwin": "brew install ollama   (or the installer from https://ollama.com/download)"}.get(sysname, "download the installer from https://ollama.com/download")
    ok = True
    found = shutil.which("ollama")
    print(("OK   " if found else "MISS ") + "Ollama is installed" + (f" ({found})" if found else f".  Fix: {install}"))
    ok &= bool(found)
    try:
        urllib.request.urlopen(HOST + "/api/version", timeout=3).read()
        up = True
    except (urllib.error.URLError, OSError):
        up = False
    print(("OK   " if up else "MISS ") + "The Ollama server is running" + ("." if up else ".  Fix: start the course with `npm start` and click Tutor in the page, or run `ollama serve` in another terminal."))
    have = False
    if up:
        have = model_ready()[0]
        print(("OK   " if have else "MISS ") + f"The model {MODEL} is downloaded" + ("." if have else f".  Fix (needs internet once, about 2 GB):  ollama pull {MODEL}"))
    else:
        print(f"SKIP The model {MODEL} cannot be checked until the server runs.")
    print("\nReady: you can ask questions." if ok and up and have else "\nNot ready yet: follow the Fix lines above, top to bottom.")
    return 0 if ok and up and have else 1


def self_test():
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    bad = []
    idx = {l: Index(load_chunks(l)) for l in ("en", "id")}
    n_en, n_id = len(idx["en"].chunks), len(idx["id"].chunks)
    if n_en < 1000 or abs(n_en - n_id) > n_en * 0.15:
        bad.append(f"chunk counts look wrong: en {n_en}, id {n_id}")
    cases = [
        ("en", "what is idempotent and why does a backfill need it", "mod-2-4"),
        ("en", "how do I use a window function like LAG", "mod-1-3"),
        ("en", "what is a primary key", "mod-0-3"),
        ("en", "what is a virtual environment in python", "mod-0-1"),
        ("en", "kafka partitions and consumer groups", "mod-3-2"),
        ("en", "how do I watch my pipeline with logs, metrics and alerts", "mod-2-4"),
        ("en", "star schema fact table and dimension table", "mod-1-4"),
        ("en", "what is a data contract", "mod-2-5"),
        ("id", "apa itu primary key", "mod-0-3"),
        ("id", "bagaimana cara kerja backfill dan idempotent", "mod-2-4"),
        ("id", "apa itu virtual environment", "mod-0-1"),
        ("id", "fungsi window LAG di SQL", "mod-1-3"),
    ]
    for lang, q, want in cases:
        got = [c["mod"] for _, c in idx[lang].search(q, 3)]
        if want not in got:
            bad.append(f"search [{lang}] {q!r}: wanted {want} in top 3, got {got}")
    if guess_lang("apa itu primary key") != "id" or guess_lang("what is a primary key") != "en":
        bad.append("language guess is wrong")
    if "@solution" in " ".join(c["text"] for c in idx["en"].chunks):
        bad.append("solutions leaked into the searchable text")

    # the chat path against a fake Ollama server that streams two tokens
    class Fake(BaseHTTPRequestHandler):
        seen = {}

        def log_message(self, *a): pass

        def do_GET(self):
            self.send_response(200); self.end_headers()
            self.wfile.write(json.dumps({"models": [{"name": "fake:1b"}]}).encode())

        def do_POST(self):
            Fake.seen = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.send_response(200); self.end_headers()
            for t, done in (("Hello ", False), ("world", False), ("", True)):
                self.wfile.write((json.dumps({"message": {"content": t}, "done": done}) + "\n").encode())

    srv = HTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    host = f"http://127.0.0.1:{srv.server_port}"
    ok, _ = model_ready("fake:1b", host)
    if not ok:
        bad.append("model_ready did not see the fake model")
    if model_ready("other:3b", host)[0]:
        bad.append("model_ready accepted a model that is not downloaded")
    if model_ready("x:1b", "http://127.0.0.1:9")[0]:
        bad.append("model_ready said ready with no server")
    toks = []
    text = chat([{"role": "user", "content": "hi"}], toks.append, "fake:1b", host)
    if text != "Hello world" or toks != ["Hello ", "world"]:
        bad.append(f"streaming reply wrong: {text!r}")
    msgs = build_messages("what is a primary key", idx["en"].search("primary key", 3), "en", [])
    if "ONLY from the COURSE EXCERPTS" not in msgs[0]["content"] or "primary key" not in msgs[-1]["content"].lower():
        bad.append("prompt is missing the rules or the excerpts")
    srv.shutdown()
    for b in bad:
        print("FAIL", b)
    if not bad:
        print(f"tutor self-test passed: {n_en} English + {n_id} Indonesian passages, {len(cases)} searches, chat path, prompt")
    return 1 if bad else 0


def main(argv):
    args, lang, search_only, question = argv[1:], None, False, []
    k = 2
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--self-test":
            return self_test()
        if a == "--check":
            return check()
        if a == "--lang" and i + 1 < len(args):
            lang = args[i + 1]; i += 1
        elif a == "--search":
            search_only = True
        elif a == "-k" and i + 1 < len(args):
            k = int(args[i + 1]); i += 1
        elif a in ("-h", "--help"):
            print(__doc__); return 0
        else:
            question.append(a)
        i += 1
    q = " ".join(question).strip()
    lang = lang or (guess_lang(q) if q else "en")
    indexes = {}

    def index_for(l):
        if l not in indexes:
            indexes[l] = Index(load_chunks(l))
        return indexes[l]

    if search_only:
        if not q:
            print("Usage: tutor.py --search \"your words\""); return 2
        hits = index_for(lang).search(q, max(k, 5))
        for s, c in hits:
            print(f"\n== {c['mod_title']}, lesson {c['lesson']}: {c['heading']}   (#/curriculum/{c['mod']}/concepts/{c['lesson']})\n{c['text'][:600]}")
        if not hits:
            print("Nothing in the course matches those words.")
        return 0

    ok, msg = model_ready()
    if not ok:
        print(msg); return 1
    history = []
    try:
        if q:
            ask(q, index_for(lang), lang, history, k)
            return 0
        print(f"DataForge Tutor ({MODEL}, offline). Ask about anything in the course. Type exit to leave, /lang en or /lang id to switch language.\n")
        while True:
            try:
                line = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print(); return 0
            if not line:
                continue
            if line.lower() in ("exit", "quit", "keluar"):
                return 0
            if line.startswith("/lang "):
                lang = line.split()[1] if line.split()[1] in ("en", "id") else lang
                continue
            l = guess_lang(line) if lang == "auto" else lang
            ask(line, index_for(l), l, history, k)
    except (urllib.error.URLError, OSError, RuntimeError) as e:
        print(f"\nThe model could not answer ({e}). Is `ollama serve` still running?"); return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
