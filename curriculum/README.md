# Course source

Every module lives in `curriculum/<module>/` as one Markdown file per language: `en.md` (English) and `id.md` (Indonesian). `levels.json` lists the levels and the order of the modules. `node scripts/build-curriculum.js` validates everything, embeds the lab files from `labs/`, and writes `app/js/curriculum-data.js`, which the web app loads. Never edit that generated file by hand.

```bash
node scripts/build-curriculum.js --check     # validate only; prints a table of words and quiz size per module
node scripts/build-curriculum.js             # validate and write app/js/curriculum-data.js
python3 scripts/quizlen.py curriculum/mod-3-4/en.md   # where does the correct quiz option rank by length?
python3 scripts/quizfit.py need mod-1-2 en          # which questions let a learner guess by length? (see the script for how to fix them)
python3 scripts/verify_labs.py mod-3-4       # reference passes, starter fails
python3 scripts/test_proof.py                # lab proof codes end to end (needs Node and network once)
```

## Language status

English is the source of truth. All 27 modules are complete in both English and Indonesian (`id.md`). `node scripts/build-curriculum.js` checks that both maintain identical structure (same number of lessons, steps, files, deliverables, quiz questions and options, correct answers and code fences). If you change an English file, update `id.md` too.

## File format of a module

```markdown
---
title: Module title
duration: 3 weeks
summary: One or two sentences for the module card.
why: What the usual tutorials get wrong; why this module exists.
---

## @outcomes
- Observable things the learner can do afterwards

## @prereq
One short paragraph.

## @part Title of a group           (optional; groups the lessons that follow it, display only)
## @lesson Title of a lesson          (5 to 12 of these; the lesson text is normal Markdown)
## @lesson Title of a lesson {optional}   (a beginner may skip it on the first pass; shown as a badge)
...

## @lab Title of the lab
Introduction paragraph.
### @steps          numbered steps and code fences
### @files          - path/in/repo :: description :: kind     (kind: starter | reference | test | data | config)
### @deliverables   - bullet list
### @verify         the commands that prove the lab is done

## @chaos Title of the failure scenario
### @scenario  ### @cause  ### @fix  ### @pattern

## @quiz
### Question text?
- [ ] option
- [x] the correct option          (exactly four options, exactly one [x])
- [ ] option
- [ ] option

> Explanation shown after answering.

## @resources
- [Label](https://url)
```

## Interactive blocks inside lessons

A lesson is normal Markdown plus a few blocks that the app turns into small interactive pieces. They are the "watch it, predict it, do it" part; the learner's real practice stays on their own computer (the Try it, the Practice Pause and the lab). Every block ends with a line that contains only `:::`.

| Block | What it is |
|---|---|
| `:::ask Question` + `@options` (the right one starts with `* `) + `@why` | A "what will this print?" question. After two wrong answers the explanation is shown. |
| `:::drill python Title` + `@starter`, `@check`, `@hint`, `@solution` (+ `@file name` for sample files) | A small exercise run in the browser's Pyodide. A check line is `python expression ## message`. Helpers: `calls("len")`, `uses("x")`, `defines("f")`, `has_node("If")`, `count_nodes("Assert")`, `printed_by(fn, ...)`, `raises_error(Exc, fn, ...)`, `rerun_with("name", value)` (run the learner's code on other data), `read_file("name")`, `out`, `code`. |
| `:::drill sql Title` + `@data kopiku`, `@starter`, `@solution`, `@hint`, optional `@check` (`/regex/ ## message`, or `!/regex/` to forbid), `@ordered`, `@names`, `@verify` | A SQL exercise on a dataset of `app/js/playground.js`. The learner's **result** is compared with the solution's, on the dataset and again on a copy with extra rows and NULLs. `@verify` is a query run after the learner's statements (INSERT, CREATE, ALTER...). |
| `:::trace Title` + `@code` (+ `@notes` lines `N \| text`, `@file`) | "Watch it run": the code is executed line by line and the variables are shown (like Python Tutor). A note is attached to a source line number. |
| `:::sqlsteps Title` + `@data`, then `@stage Label`, the SQL, `@say` and a sentence | The same SQL question one clause at a time; rows that a stage drops are struck through. |

Rules for authors:

- **Different data than the lab.** A drill teaches the idea on its own numbers; the lab asks the learner to apply it. Never put a lab answer in a lesson.
- **The first law:** the learner does it on their own computer. Pair interactive blocks with a terminal step; every passed drill already shows "Now do it on your own computer", and from Level 1 on it says the drill is a warm-up, not the proof.
- **Both languages.** English and Indonesian must have the same blocks in the same order; code, checks, SQL and trace code are identical, only the words change (the build checks this).
- **Verify by running.** `node scripts/verify_drills.js` (every solution passes, every starter fails, every trace note is on a line that runs) and `node scripts/verify_sql_drills.js` (the same for SQL, plus a wrong query is rejected and every animation stage runs). Both run in CI.
- **Questions:** spread the right answer over the three positions and keep the options similar in length (`node scripts/asklen.js` reports both; today the right answer sits evenly in the three positions and is the unique longest option in about 30% of the predict questions, so keep writing distractors of the same length).

## Python challenges

`curriculum/python-challenges/en.md` and `id.md` hold the Python Lab challenges: one `## @challenge <id> | <level 1-5> | <topic>` line, then one `:::drill python` block (same format as in lessons). The two files must list the same ids in the same order. Run `node scripts/build-challenges.js` to regenerate `app/js/py-challenges-data.js` (CI checks it is in sync), and `node scripts/verify_drills.js` to prove that every solution passes and every starter fails, in the real Python engine.

## Standards for a module

- **Lessons**: at least five per module (modules run from about 4,000 to 15,000 words in total, so keep each lesson to one idea that fits a few small screens). Explain the *why* before the *how*, include at least one measured number or worked example from the lab, and be honest about trade-offs. Say "check current prices" instead of quoting prices that change.
- **Lab**: a learner-edited file at the lab root, a `reference/` solution, and tests that use `labs/shared/labtools.py` so that `LAB_DIR=reference` runs them against the solution. The starter must fail, the reference must pass; `scripts/verify_labs.py` checks both. Prefer real tools over mocks and deterministic data (see `labs/shared/`).
- **Chaos scenario**: a realistic production failure with a cause that the lab demonstrates, and a fix with several concrete steps.
- **Quiz**: at least eight questions (the modules have 8 to 13), four options each, with an explanation. The correct option must not be systematically the longest or the shortest: distractors should be plausible and similar in length. Run `quizlen.py`. The app shuffles the options.
- **Teach before use**: a term a learner has not met must not appear unexplained. Add the term to `app/js/glossary-data.js` (both languages, plain words, the lesson that teaches it). The app then shows a box at the top of any lesson that uses a word before its teaching lesson, and makes the word clickable. The first time a word is needed in Level 0, also give it a short plain gloss in the sentence itself. `node scripts/test_glossary.js` checks that every glossary term really appears in the lesson it points to.
- **Right answers are not machine-checked.** The build only proves a quiz is well formed (four options, one marked). Whether the marked answer is *correct* is a human check: read each marked answer against its lesson, in both languages, whenever you edit or add a question.
- **Facts**: any claim about a tool's behaviour must be something you ran. If you could not run it, do not state it as fact.

## Lab proof codes

Every module has an entry in `labs/proof.json` (what to run, which files are the learner's work, which are the reference). `node scripts/build-curriculum.js` validates it against the lab's `starter` files and generates `app/js/proof-data.js`. When you add a lab or change its tests, starters or shared helpers, rebuild: the hashes change, and old codes become "stale" for learners.
