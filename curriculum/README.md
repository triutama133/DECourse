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

English is the source of truth and both English and Indonesian (`id.md`) are complete for all 23 modules. `node scripts/build-curriculum.js` checks that both maintain identical structure (same number of lessons, steps, files, deliverables, quiz questions and options, correct answers and code fences). If you change an English file, update `id.md` too.

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

## @lesson Title of a lesson          (5 to 7 of these; the lesson text is normal Markdown)
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

## Standards for a module

- **Lessons**: 1,500 to 2,800 words in total, at least five lessons. Explain the *why* before the *how*, include at least one measured number or worked example from the lab, and be honest about trade-offs. Say "check current prices" instead of quoting prices that change.
- **Lab**: a learner-edited file at the lab root, a `reference/` solution, and tests that use `labs/shared/labtools.py` so that `LAB_DIR=reference` runs them against the solution. The starter must fail, the reference must pass; `scripts/verify_labs.py` checks both. Prefer real tools over mocks and deterministic data (see `labs/shared/`).
- **Chaos scenario**: a realistic production failure with a cause that the lab demonstrates, and a fix with several concrete steps.
- **Quiz**: eight questions, four options each, with an explanation. The correct option must not be systematically the longest or the shortest: distractors should be plausible and similar in length. Run `quizlen.py`. The app shuffles the options.
- **Facts**: any claim about a tool's behaviour must be something you ran. If you could not run it, do not state it as fact.

## Lab proof codes

Every module has an entry in `labs/proof.json` (what to run, which files are the learner's work, which are the reference). `node scripts/build-curriculum.js` validates it against the lab's `starter` files and generates `app/js/proof-data.js`. When you add a lab or change its tests, starters or shared helpers, rebuild: the hashes change, and old codes become "stale" for learners.
