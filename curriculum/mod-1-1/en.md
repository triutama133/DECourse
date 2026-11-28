---
title: Linux, Shell Scripting and Docker for Data Engineers
duration: 2-3 weeks
summary: Process gigabytes of text with a few shell tools, write scripts that fail loudly instead of silently, schedule them, and package a job in a container so it runs the same everywhere.
why: Tutorials run everything on a laptop with 16 GB of RAM and a friendly terminal. Production jobs run in minimal containers with 512 MB, on a schedule, with nobody watching, and a failure that exits with code 0 is worse than a crash.
---

## @outcomes
- Combine grep, cut, sort, uniq, awk and jq to summarise large text and JSON files without loading them into memory
- Write a Bash script that stops on errors, cleans up after itself and reports problems with a proper exit code
- Explain why a pipeline can succeed while an early stage fails, and prevent it
- Schedule a job with cron and avoid the usual surprises (environment, overlap, time zones)
- Write a Dockerfile that builds fast, runs as a non-root user and is reproducible, and diagnose a container killed for using too much memory

## @prereq
Modules 0.0 and 0.1: Python basics, terminal basics, Git, and the idea of a Python virtual environment. Install `jq` (e.g. `brew install jq` on macOS or `sudo apt install jq` on Debian/Ubuntu) for Lessons 3–4 and the lab, and `pytest` (`pip install pytest`) if you want to run `scripts/prove.py`. Docker is needed only for the optional runtime part of the lab; the checks do not require it.

## @part Shell tools and scripts

## @lesson How a Unix program thinks: processes, streams and exit codes
Every time you run a command, the computer starts a **process**: a running copy of a program. Picture a worker at a desk. It has its own notepad (its **memory**) and a badge number (its **PID**, the process id). It also has three standard channels to the outside world: **stdin**, where its input arrives; **stdout**, where its normal output goes; and **stderr**, where it reports errors, kept apart from the normal output. Every command reads text in and writes text out, so you can connect any command to any other with the **pipe** `|`: the output of one becomes the input of the next. Small tools, one job each, joined together: that is what makes the shell powerful.

Every process ends with an **exit code**, a number from 0 to 255. By convention **0 means success** and anything else means failure. The shell stores the last one in `$?` (if `data/orders.csv` is not generated yet, create the KopiKu sample files first with `python3 labs/shared/shopgen.py --out data`):

```bash
grep -q "paid" data/orders.csv ; echo $?     # 0 if found, 1 if not found, 2 on error
```

Exit codes are how schedulers (such as **cron**, covered in Lesson 5), **CI** (Continuous Integration, which runs automated checks on your code) systems and containers decide whether your job worked. A script that prints "ERROR" and still exits 0 is a lie to every system around it. Two operators use exit codes directly: `a && b` runs `b` only if `a` succeeded, and `a || b` runs `b` only if `a` failed.

:::ask What does this print if `data/orders.csv` does NOT contain the word `zzzz`?
```bash
grep -q zzzz data/orders.csv && echo FOUND || echo MISSING
```
@options
FOUND
* MISSING
both lines
@why
`grep -q` succeeds (exit code 0) only when it finds a match. It found none, so it exits 1: `&&` skips `echo FOUND`, and `||` runs `echo MISSING`. This is how scripts branch on success and failure.
:::

The codes you will meet first:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General failure (what most programs use) |
| 2 | Misuse of the command (bad arguments) |
| 127 | Command not found |

:::advanced Later: more codes and commands to watch and stop programs
You do not need these today. Lesson 7 uses code 137 again, with its story.

| Code | Meaning |
|---|---|
| 126 | Command found but not executable |
| 137 | Killed with SIGKILL (128 + 9: a **signal** is a message the system sends to a program). In containers this usually means **out of memory** |
| 143 | Terminated with SIGTERM (128 + 15): a polite request to stop, e.g. from `docker stop` |

Useful process commands: `ps aux` (list processes), `top` or `htop` (live view of CPU and memory), `kill <pid>` (send SIGTERM), `kill -9 <pid>` (SIGKILL, cannot be caught, use as a last resort), and `Ctrl+C` (send SIGINT to the foreground process).
:::

> 🛠 **Try it (8 min, terminal).** From the course folder (run `python3 labs/shared/shopgen.py --out data` first if `data/orders.csv` is not there yet), run each command and then `echo $?`: `grep -q delivered data/orders.csv`, `grep -q zzzz data/orders.csv`, `grep -q x /no/such/file`, `false`, `bash -c 'exit 7'`. Then save a script `job.sh` with the lines `#!/bin/bash` (tells the system to run it with Bash), `set -e` (stop on the first failing command, both covered in full in Lesson 4), `echo start`, `false`, `echo never printed`; run `bash job.sh` and check `echo $?`. When you are done, clean up with `rm job.sh`.
>
> **You should see:** `0`, `1`, `2`, `1`, `7`; and for the script `start` and then exit code `1`. Remove `set -e` and run it again: the last line now prints too, and the exit code becomes `0`, a lie to every scheduler.

:::drill python Which commands run?
In the shell, `a && b && c` runs the next command only if the one before it **succeeded** (exit code 0). Write `commands_run(codes)`: `codes` is the list of exit codes the commands *would* return, in order. Return how many of them actually run.
@starter
# write your function below this line

@check
defines("commands_run") ## Define commands_run(codes).
commands_run([0, 0, 0]) == 3 ## All succeed: all three run.
commands_run([0, 1, 0]) == 2 ## The second runs and fails; the third is skipped.
commands_run([1, 0, 0]) == 1 ## The first fails: nothing after it runs.
commands_run([]) == 0 ## No commands, none run.
@hint
Count commands one by one. After a command whose code is not 0, stop.
@solution
def commands_run(codes):
    ran = 0
    for code in codes:
        ran += 1
        if code != 0:
            break
    return ran
:::

:::ask A script prints 'ERROR: file missing' and then ends normally, with exit code 0. What will cron or a CI system conclude?
@options
* succeeded: only the exit code counts
the job failed, because the word ERROR was printed
nothing, because it ignores both text and codes
@why
Schedulers, CI and containers read the exit code, not the text. A script that prints an error and exits 0 reports success to every system around it. Use a non-zero exit code when something went wrong.
:::

## @lesson The text-processing toolbox
Most data on a server arrives as text. These tools let you inspect and summarise it in seconds, and they **stream**: they process one line at a time, so memory use stays flat even on a 50 GB file. Use them for exploration and for simple, robust jobs.

| Tool | Job | Example |
|---|---|---|
| `head`, `tail` | First or last lines | `tail -n +2 f.csv` (skip the header) |
| `wc -l` | Count lines | `wc -l events.ndjson` |
| `grep` | Keep lines that match (`-v` inverts, `-c` counts) | `grep -c "cancelled" orders.csv` |
| `cut` | Pick columns by delimiter | `cut -d, -f4 orders.csv` |
| `sort` | Order lines (`-n` numeric, `-r` reverse, `-u` unique, `-k` by column) | `sort -t, -k6 -n orders.csv` |
| `uniq -c` | Count **adjacent** equal lines | `... \| sort \| uniq -c` |
| `tr` | Translate or delete characters | `tr 'A-Z' 'a-z'` |
| `sed` | Search and replace in a stream | `sed 's/Rp //'` |
| `awk` | Process columns, compute, aggregate | see below |

Two traps. First, `uniq` only collapses *neighbouring* duplicates, so you almost always `sort` first. Second, `sort` follows your locale's rules; for fast, predictable, byte-order sorting use `LC_ALL=C sort`.

**awk** is a tiny programming language for columns. It reads a line, splits it into fields (`$1`, `$2`, ...), and runs your code. `NR` is the line number and `END { ... }` runs once at the end. Counting orders per status, case-insensitively, including duplicate rows:

```bash
awk -F, 'NR > 1 { n[tolower($4)]++ } END { for (s in n) print s, n[s] }' data/orders.csv | sort
```

On the KopiKu data this prints `cancelled 362`, `delivered 2148`, `paid 374`, `refunded 174`, `shipped 576`. Notice it counts the duplicate rows too, so it differs from the de-duplicated counts in Module 0.1; you must decide whether duplicates matter before trusting any count.

> **Warning:** `awk -F,` and `cut -d,` split on every comma, so they break on CSV values like `"Santoso, Budi"`. They are fine for simple, known files. For real CSV with quoted fields use Python's `csv` module, `csvkit` or Miller (`mlr`).

**Finding and batching.** `find data -name '*.gz' -print0 | xargs -0 -n1 gzip -t` tests every compressed file, one per command; `-print0` and `-0` make it safe for file names containing spaces.

> 💡 **Practice Pause 1 (Data Stream Exploration in Terminal):**
> Prove these Unix text processing concepts right now on your machine! Open your terminal in the course directory:
> 1. Generate event data if not done already: `python3 labs/shared/shopgen.py --out data`
> 2. Inspect the first 3 NDJSON event lines: `head -3 data/events.ndjson`
> 3. Count total event log lines: `wc -l data/events.ndjson`
> 4. Count purchase events: `grep -c "purchase" data/events.ndjson`
> **You should see:** three long JSON lines (the third is cut off in the middle: a damaged line the data planted on purpose), then `90900 data/events.ndjson`, then `15079`. Your data is ready! Proceed to Lesson 3 to slice JSON data with `jq`.

:::drill python The uniq trap
The shell command `uniq -c` collapses only **neighbouring** duplicates. Write `uniq_c(lines)`: return a list of `(count, line)` pairs, where each pair is a run of identical lines that sit next to each other.
@starter
# write your function below this line

@check
defines("uniq_c") ## Define uniq_c(lines).
uniq_c(["a", "a", "b"]) == [(2, "a"), (1, "b")] ## The two neighbouring a lines become one pair.
uniq_c(["a", "b", "a"]) == [(1, "a"), (1, "b"), (1, "a")] ## Not neighbours: a is NOT merged. This is why you `sort` first.
uniq_c(sorted(["a", "b", "a"])) == [(2, "a"), (1, "b")] ## After sorting, the duplicates are neighbours.
uniq_c([]) == [] ## Nothing in, nothing out.
@hint
Walk the lines. If a line equals the one before it, add 1 to the last count; otherwise start a new pair.
@solution
def uniq_c(lines):
    out = []
    for line in lines:
        if out and out[-1][1] == line:
            out[-1] = (out[-1][0] + 1, line)
        else:
            out.append((1, line))
    return out
:::

:::ask You run `cut -d, -f4 orders.csv | uniq -c` on an unsorted file and the same status is listed three times. Why?
@options
the file has hidden characters in each of its rows
* uniq merges only neighbours, so sort the column first
uniq counts only the first 100 lines it sees
@why
`uniq` compares each line with the one just before it. Equal values that are far apart stay separate, so the usual pipeline is `sort | uniq -c`.
:::

## @lesson jq: the same idea for JSON
Click events and logs are usually **NDJSON**: one JSON object per line. `jq` is `awk` for JSON. The essentials:

```bash
head -2 data/events.ndjson | jq -c '{event_id, event_type}'
# {"event_id":"e00085531","event_type":"page_view"}
# {"event_id":"e00017290","event_type":"page_view"}
```

- `.field` selects a field; `.a.b` goes deeper; `.[]` iterates arrays.
- `select(condition)` keeps matching items: `jq 'select(.event_type == "purchase")'`.
- `-r` prints raw strings (no quotes), `-c` prints compact one-line JSON, `@tsv` and `@csv` format arrays as table rows: `jq -r '[.event_id, .event_type] | @tsv'`.
- `-R` reads each input line as raw text instead of JSON, which is the key to **robust** parsing:

```bash
jq -R -c 'fromjson? | select(type == "object")' data/events.ndjson | wc -l
```

`fromjson` parses a line as JSON; the `?` suppresses the error when a line is broken, so the bad lines are skipped instead of aborting the whole run. On the KopiKu events this keeps 89,987 of 90,900 lines (the other 913 are truncated) in under a second on a laptop.

> **Warning:** `jq -s` ("slurp") loads the *entire* input into memory as one array. It is convenient and dangerous: on a large file it is exactly how a container gets killed. Prefer streaming forms (one object per line) and aggregate with `sort | uniq -c`, or move to DuckDB (Module 2.1) when you need real analytics.

When should you stop using shell tools? When the logic needs branching, state, retries or tests. A shell pipeline of five stages is a joy; a 300-line Bash script is a liability. Switch to Python (Module 1.2) when you reach for arrays of arrays or when you want to unit-test the logic.

> 💡 **Practice Pause 2 (JSON Parsing with jq):**
> Try `jq` directly in your terminal, and meet the damaged line the data planted on purpose:
> 1. Two clean lines: `head -2 data/events.ndjson | jq -c '{event_id, event_type}'`
> 2. Five lines, the way you would first try it: `head -5 data/events.ndjson | jq -c '{event_id, event_type}'`
> 3. Error-resilient parsing: `jq -R -c 'fromjson? | select(type == "object")' data/events.ndjson | head -3`
> **You should see:** step 1 prints `{"event_id":"e00085531","event_type":"page_view"}` and a second short line. Step 2 prints the same two lines and then stops with `jq: parse error`: the third line of the file is cut off in the middle (you saw it in Pause 1), and plain `jq` gives up on the first broken line. Step 3 skips that line and prints three complete JSON objects, starting with `e00085531`, `e00017290` and `e00061551`. Damaged lines are skipped without crashing! Proceed to Lesson 4 to write safe shell scripts.

In Python's `json` module, `json.loads(line)` parses one JSON string and raises `json.JSONDecodeError` if the line is broken. Because valid JSON can also be a number, string, or list, check `isinstance(obj, dict)` when you only want JSON objects.

:::drill python Skip the broken lines
An events file has one JSON object per line, and some lines are cut off. `jq 'fromjson?'` skips the broken ones. Write `good_events(lines)`: return a list with the parsed object (dictionary) of every line that is valid JSON **and** is an object. Skip everything else without raising an error.
@starter
import json
# write your function below this line

@check
defines("good_events") ## Define good_events(lines).
good_events(['{"a": 1}', '{"a":', '{"b": 2}']) == [{"a": 1}, {"b": 2}] ## The cut-off line is skipped.
good_events(["5", '"text"', "[1]"]) == [] ## Valid JSON, but not objects: skipped too.
good_events([]) == [] ## No lines, no events.
good_events(["", '{"x": null}']) == [{"x": None}] ## An empty line is skipped; null inside an object is fine.
@hint
Loop over the lines and parse each one inside a `try` / `except` block that skips malformed JSON; keep the parsed result only when it is a dictionary.
@solution
import json
def good_events(lines):
    out = []
    for line in lines:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            out.append(obj)
    return out
:::

:::ask When should you stop writing a shell pipeline and switch to Python?
@options
as soon as it has more than two stages in it
never, since shell tools are always the faster ones
* when you need branching, state, retries or unit tests
@why
A five-stage pipeline is a joy, but logic with branches, memory between lines, retries or tests belongs in code you can test. A 300-line Bash script is a liability.
:::

## @lesson Writing scripts that fail loudly
A script is just commands in a file. The first line, the **shebang**, names the interpreter: `#!/usr/bin/env bash`. Run it with `bash script.sh`, or `chmod +x script.sh && ./script.sh`.

By default Bash **keeps going after errors**. That is the opposite of what a data job needs. Start every script with strict mode:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e`: exit immediately when a command fails.
- `-u`: treat use of an unset variable as an error (catches typos like `$DATAA_DIR`).
- `-o pipefail`: a pipeline fails if *any* stage fails, not only the last. Without it, `zcat broken.gz | wc -l` exits 0 even when `zcat` failed halfway.

:::ask A pipeline is `zcat broken.gz | wc -l`. `zcat` fails halfway because the file is corrupt, `wc` still counts what it got. Without `-o pipefail`, what exit code does the pipeline report?
@options
* 0: only the last stage (`wc`) is reported
non-zero: `zcat` failed, so the pipeline did
127: the command was not found
@why
By default a pipeline reports the exit code of its **last** stage. `wc -l` succeeded, so the pipeline looks fine while the data is incomplete. `set -o pipefail` makes the pipeline fail if **any** stage fails.
:::

Caveat: `-e` is not triggered inside `if` conditions, in `&&`/`||` chains, or in a command whose failure you test yourself. It is a safety net, not a substitute for thinking.

Habits that keep scripts reliable:

- **Quote variables**: `"$file"`, not `$file`. Unquoted, a name with a space becomes two arguments.
- **Validate arguments**: `file="${1:?usage: report.sh <events.ndjson>}"` stops with a message if the argument is missing.
- **Clean up with `trap`**: `tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT` removes the temporary file whether the script succeeds, fails or is interrupted.
- **Write outputs atomically**: write to `out.csv.tmp`, then `mv out.csv.tmp out.csv`. A rename on the same file system is atomic, so readers see either the old complete file or the new complete file, never a half-written one.
- **Log to stderr, results to stdout**: `echo "starting" >&2`. This keeps the data stream clean for pipes.
- **Make it idempotent**: run twice, same result. Use deterministic output paths and overwrite, or write by date partition.
- **Lint it**: `shellcheck script.sh` finds most quoting and logic mistakes automatically. Run it in CI.

:::ask `file="my report.csv"` and the script runs `wc -l $file` (no quotes). What does `wc` receive?
@options
one argument: the name `my report.csv`
* two arguments: `my` and `report.csv`
nothing: the shell stops before running it
@why
Unquoted, the shell splits the value at the space. Always write `"$file"`. `shellcheck` flags exactly this mistake.
:::

:::talk Where does the message go?
@teacher Your script prints its result with `echo "total=42"` and its progress with `echo "starting..." >&2`. You run it like this: `bash report.sh > result.txt`. The `>` sends the normal output of the script into the file.
@ask When the run is over, what is inside `result.txt`?
@choice Both lines, because both were printed by the same script | They come out of the same script, but through two different channels, like two pipes. `>` takes only the normal one. Try again.
@choice * Only `total=42`: the progress message went to the error channel and appeared on your screen | Yes. `>&2` sends a message to stderr, which `>` does not capture, so your data file stays clean while you still see the progress on screen.
@choice Only `starting...`, because it was printed first | The order does not matter here: what counts is which channel each line was sent to. Try again.
@teacher That is why scripts log to stderr and print results to stdout: a pipe or a file receives clean data, and humans still see the messages.
:::

> 💡 **Practice Pause 3 (Build report.sh - Part A):**
> Time to build Part A of this lab!
> 1. Open `labs/mod-1-1/report.sh` in your text editor and read its header comment, it specifies the 6 `key=value` output lines (`lines_total`, `malformed_lines`, `valid_events`, `unique_event_ids`, `distinct_users`, and `type.<event_type>`) plus using `mktemp` with `trap` for cleanup. When running it by hand, always pass an input file, e.g. `bash labs/mod-1-1/report.sh data/events.ndjson`.
> 2. Apply strict mode `set -euo pipefail`, validate input argument `$1`, clean up any temporary file with `mktemp` and `trap`, and build the metric summary pipeline using `jq`, `sort -u`, and `wc -l`.
> 3. Test your script in the terminal:
> `python3 labs/mod-1-1/test_lab.py TestReportScript -v`
> Every test prints a line ending in `ok` or `FAIL`, and the last line says `OK` when all five pass. At first some already say `ok` (a script that does nothing still fails loudly without an argument), so you are done only when the whole run ends with `OK`. Then your professional Unix stream script is done! Proceed to Lesson 5 on Cron.

## @part Running jobs: cron, containers and limits

## @lesson Scheduling jobs with cron
**cron** runs commands on a schedule. Edit your table with `crontab -e`. Each line has five time fields then the command:

```text
# m  h  dom mon dow  command
  0  2   *   *   *   /opt/kopiku/run_report.sh >> /var/log/kopiku/report.log 2>&1
 */15 *  *   *   *   /opt/kopiku/check_inbox.sh
```

The five fields are **minute** (`m`, 0–59), **hour** (`h`, 0–23), **day of month** (`dom`, 1–31), **month** (`mon`, 1–12), and **day of week** (`dow`, 0–7, where 0 and 7 are Sunday and `1-5` means Monday through Friday). A `*` means "every", `*/15` means "every 15th" (step syntax), and `a-b` means an inclusive range. So the first line runs at 02:00 every day, and the second runs every 15 minutes. Know these surprises before they cost you a night:

- **Minimal environment.** cron does not load your shell profile. `PATH` is short, your virtual environment is not active, your environment variables are missing. Use absolute paths, set variables inside the script, and call `/opt/kopiku/venv/bin/python` directly.
- **Silent output.** Output goes to email or nowhere. Redirect both streams to a log file (`>> log 2>&1`) so you can see what happened.
- **Overlapping runs.** If a run takes longer than the interval, a second copy starts and they collide. Guard with a lock: `flock -n /tmp/report.lock /opt/kopiku/run_report.sh`.
- **Time zones.** cron uses the server's time zone, and daylight saving shifts can skip or repeat an hour. Servers should run in UTC, and schedules be written with that in mind.
- **No dependencies, no retries, no history.** cron does not know that job B must wait for job A, will not retry, and keeps no record of runs.

:::ask Your script works in your terminal but fails under cron with `python: command not found`. What is the most likely cause?
@options
cron does not support Python scripts
the schedule expression is wrong
* cron has a bare environment: short `PATH`, no venv
@why
cron does not load your shell profile. Use absolute paths (`/opt/kopiku/venv/bin/python`), set variables inside the script, and redirect output to a log (`>> log 2>&1`) so you can see what happened.
:::

:::talk When the job takes longer than the schedule
@teacher A cron line runs a report every 15 minutes. One day the database is slow, and one run takes 20 minutes.
@ask What does cron do at minute 15, while the first run is still going?
@choice It waits until the first run finishes, then starts the next one | cron does not know or care what your job is doing. It only looks at the clock. Try again.
@choice It stops the first run and starts a fresh one | cron never kills your job. Try again.
@choice * It starts a second copy anyway, so two runs work at the same time | Yes. cron only watches the clock, so the two copies can write the same files and collide. A lock such as `flock -n` makes the second copy refuse to start.
@teacher cron is a very simple clock: no waiting, no retrying, no memory of past runs. That is why bigger pipelines move to an orchestrator later in the course.
:::

That last point is why real pipelines move to an **orchestrator** such as Airflow or Dagster (Module 2.4), which add dependencies, retries, backfills and a UI. cron is still the right tool for a simple, independent job on a single machine.

> 🛠 **Try it (10 min, terminal).** You cannot wait for midnight, so practise the three things that bite people.
> 1. Write the five-field cron line for: every day at 02:30; every 15 minutes; 06:00 on weekdays only; midnight on the first day of each month.
> 2. See what cron's bare environment looks like: `env -i PATH=/usr/bin:/bin sh -c 'echo "HOME=[$HOME] VIRTUAL_ENV=[$VIRTUAL_ENV]"'`, then `echo "HOME=[$HOME] VIRTUAL_ENV=[$VIRTUAL_ENV]"` in your own shell (note: `VIRTUAL_ENV` is populated only when a Python virtual environment is active).
> 3. Overlapping runs (Linux only; macOS does not ship `flock` by default): in one terminal run `flock -n /tmp/demo.lock sleep 20`; in a second terminal run `flock -n /tmp/demo.lock echo second; echo $?`.
>
> **You should see:** `30 2 * * *`, `*/15 * * * *`, `0 6 * * 1-5`, `0 0 1 * *`; `HOME=[] VIRTUAL_ENV=[]` in the bare environment (your shell has `HOME`, and `VIRTUAL_ENV` when a venv is active); and `1` from the second `flock` without any `second` printed: the lock is held, so the overlapping copy refuses to run.

:::ask What does the cron line `*/15 * * * * /opt/kopiku/check_inbox.sh` do?
@options
* runs the script every 15 minutes, all day long
runs the script once, at 15 minutes past midnight
runs the script 15 times a day at random hours
@why
The five fields are minute, hour, day of month, month, day of week. `*/15` in the minute field means every 15th minute, and the stars mean every hour and every day.
:::

## @lesson Containers: the same environment everywhere
"It works on my machine" is the oldest problem in software. Your job depends on a specific Python version, libraries, system packages and file layout; the server has different ones. A **container** packages the application together with everything it needs to run, isolated from the host, so it behaves the same on your laptop, in CI and in production.

Two terms to keep apart:

- An **image** is a read-only template: the packaged filesystem and the default command. It is built once from a **Dockerfile**.
- A **container** is a running (or stopped) instance of an image. You can start many containers from one image.

Containers are not virtual machines: they share the host's kernel, so they start in a second and use little memory, but they are isolated by process, file system and network settings.

A minimal Dockerfile for a Python job:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .
RUN useradd --create-home appuser
USER appuser
ENTRYPOINT ["python", "etl.py"]
CMD ["/data/orders.csv"]
```

Build and run it, mounting a data folder from your computer into the container read-only:

```bash
docker build -t kopiku-etl .
docker run --rm -v "$PWD/data:/data:ro" kopiku-etl
```

:::talk Why does every build take minutes?
@teacher A learner writes `COPY . .` first and `RUN pip install -r requirements.txt` after it. They change one line of their own code and rebuild the image.
@ask What does Docker do with the `pip install` step?
@choice It skips it, because the requirements did not change | It would, if only `requirements.txt` had been copied before. But `COPY . .` copied the whole project, and the edited file is part of it, so that layer changed. Try again.
@choice * It runs it again and downloads every package, because an earlier step changed | Yes. Docker reuses a layer only if everything before it is unchanged. One edited line in the copied folder breaks the cache, and everything after it is rebuilt.
@choice It asks you whether to reuse the old layer | Docker never asks: it decides from what changed. Try again.
@teacher So copy `requirements.txt` first, install, and copy your code last. Put what changes least at the top, and your everyday rebuilds take seconds.
:::

Why each line looks the way it does:

- **`FROM python:3.12-slim`**: always pin a version tag. `latest` changes under you and breaks reproducibility. `slim` images are much smaller than the full ones; Alpine is smaller still but uses a different C library, which often means Python packages must be compiled from source, so slim is the safer default.
- **Layer caching.** Each instruction creates a **layer**, and Docker reuses a layer if its inputs did not change. Copying only `requirements.txt` first, installing, and *then* copying the code means everyday code edits do not trigger a reinstall of all dependencies. Put the things that change least at the top.
- **`--no-cache-dir`** stops pip from storing downloaded packages inside the image, keeping it small.
- **Non-root user.** Processes in a container run as root by default. If the application is compromised, root inside the container is a much larger problem. Run as an ordinary user. (When mounting folders, file ownership then matters: make sure that user can read the mounted data.)
- **Exec form (`["python", "etl.py"]`)** runs your program directly as the main process, so it receives stop signals and exits cleanly. The shell form (`CMD python etl.py`) wraps it in a shell that may swallow signals.
- **`ENTRYPOINT` plus `CMD`**: the entrypoint is the program, the `CMD` provides default arguments that `docker run` can override.
- **`.dockerignore`** lists files that must never be sent to the build: virtual environments, data, `.git`, `.env`. It speeds builds and prevents secrets from being baked into an image.

Other things you will use: **volumes and bind mounts** keep data outside the container (containers are disposable: anything written inside disappears with them); **environment variables** (`-e KEY=value`) pass configuration; **`docker compose`** describes several services (a database, a broker, your job) in one YAML file and puts them on a shared network where they find each other by service name; and **multi-stage builds** compile in one stage and copy only the result into a small final image.

> 💡 **Practice Pause 4 (Optimize Dockerfile & .dockerignore - Part B):**
> Time to package your job into a production-ready container:
> 1. Open `labs/mod-1-1/Dockerfile` and `labs/mod-1-1/.dockerignore` in your text editor.
> 2. Fix the Dockerfile: pin `FROM python:3.12-slim`, set `WORKDIR /app`, copy `app/requirements.txt` and run `pip install --no-cache-dir -r requirements.txt` (or set `PIP_NO_CACHE_DIR`) before copying `app/`, create and switch to a non-root user (`RUN useradd --create-home appuser` then `USER appuser`), and replace the starter's shell-form `CMD` with exec-form `ENTRYPOINT ["python", "etl.py"]` and `CMD ["/data/orders.csv"]`.
> 3. Verify `.dockerignore` excludes `venv/`, `data/`, `.git/`, and `.env`.
> 4. Test in the terminal:
> `python3 labs/mod-1-1/test_lab.py TestDockerfile -v`
> When all eight Dockerfile tests end in `ok` and the last line says `OK`, your container is production ready! Proceed to Lesson 7 to learn about memory limits & exit code 137.

:::ask You start three containers from the same image. How many images exist?
@options
three: every container gets an image of its own
* one: the containers are running copies
none, because an image disappears when it is run
@why
An image is a read-only template built once from a Dockerfile. A container is a running (or stopped) instance of it, and you can start as many as you like from the same image.
:::

:::ask Why do teams package a job in a container instead of just copying the script to the server?
@options
containers make the code itself run much faster
containers mean that no server is needed anymore
* the job carries its own Python and libraries
@why
A container packages the application with everything it needs, isolated from the host. That ends 'it works on my machine': laptop, test and production run the same environment.
:::

## @lesson Resource limits and the job that dies with code 137
Containers can be given limits: `docker run --memory 512m --cpus 1 ...`, or in an orchestrator's configuration. If a process in a container uses more memory than its limit, the Linux kernel's **OOM killer** terminates it with SIGKILL. You see exit code **137** and, in `docker inspect`, `"OOMKilled": true`. There is no Python traceback, because the process never got a chance to print one: from the inside it simply vanishes, which is why this failure confuses beginners.

:::ask A container job ends with exit code **137** and `OOMKilled: true`. What happened?
@options
the script hit a normal error and returned 137
* the kernel killed it: it exceeded its memory limit
`docker stop` asked it to stop politely
@why
137 = 128 + 9: the process received SIGKILL. In a container with a memory limit this is the OOM killer. A polite stop (`docker stop`) gives 143 (128 + 15, SIGTERM). The cure is to process in a stream or bounded chunks, not to load everything at once.
:::

:::talk No error message at all
@teacher A containerised job runs for twenty minutes and then the container is simply gone. The logs end in the middle of work, with no Python traceback and no error text.
@ask What should you look at first?
@choice The Python code, line by line, for a syntax error | A syntax error would have been reported at the start, with a traceback. This job ran for twenty minutes. Try again.
@choice * The exit code and `docker inspect`: code 137 with `OOMKilled: true` means the kernel killed it for using too much memory | Yes. The process had no chance to print anything, which is why there is no traceback. The fix is to process in a stream or in bounded chunks, not to hunt for a bug in a line.
@choice The schedule expression of the job | The job did start and run. The schedule is not the problem. Try again.
@teacher When a job vanishes without a message, think "killed from outside", and ask the system, not the code.
:::

The usual causes in data work:

- **Loading everything at once**: `pandas.read_csv` on a file much larger than memory (pandas often needs several times the file size in RAM), `jq -s`, or `list(rows)` on a huge iterator.
- **Unbounded growth**: collecting results in a list or dictionary that grows with the input.
- **Fan-out**: a join or explode that multiplies rows.

The fixes follow the same principle: **process in a stream or in bounded chunks, and keep memory proportional to one batch, not to the whole input.** The shell tools in this module do that naturally; Module 1.2 shows the Python version (generators), and Module 2.1 shows engines (DuckDB, Polars) that spill to disk instead of dying.

Related limits to watch: **disk** (a full disk makes writes fail in odd ways, so clean temp files and monitor usage), **CPU** throttling (your job just becomes slow), and **open files**. When a container misbehaves, the first commands are `docker logs <name>`, `docker stats` (live memory and CPU), `docker inspect <name>` (exit code, OOMKilled) and `docker exec -it <name> sh` (look around inside).

> 🛠 **Try it (10 min).**
> 1. Exit code 137 is 128 + 9, the signal SIGKILL that kills a container over its memory limit. Prove it: `sleep 100 & kill -9 $!; wait $!; echo $?`.
> 2. Compare memory. In Python, write two functions that add up the valid totals of `data/orders.csv` (remember to strip any `"Rp "` prefix or commas and ignore negative or non-numeric totals): one first reads the whole file into a list (`list(csv.reader(...))`), the other adds row by row. Wrap each call in `tracemalloc` (`tracemalloc.start()` before, `tracemalloc.get_traced_memory()[1]` after, then `tracemalloc.stop()`) and print the peak in KiB.
>
> **You should see:** `137`, and a peak of about 1,500 KiB for the `csv.reader` list version (about 2,000 KiB if you used `DictReader`) against about 40 KiB for the streaming one, however you write it (roughly 40 times less on this small file). On a file a thousand times bigger, that ratio decides whether the container survives.

:::ask A container running a pandas job stops with exit code 137 and no Python error message. What most likely happened?
@options
* it exceeded its memory limit and was killed
the Python code has a syntax error on its last line
the schedule expression was written in the wrong way
@why
137 is 128 + 9: the process received SIGKILL. When a container exceeds its memory limit the OOM killer does that, so there is no traceback. Process in chunks or streams to keep memory flat.
:::

## @lab Lab: a shell report and a container for a KopiKu job
Part A: write a robust shell script that summarises the website events file, which contains broken lines and duplicates. Part B: package a small Python job into a good Docker image. Both are checked automatically.

> **Already completed Practice Pauses 3 and 4?** You have already built and tested both parts, jump straight to **@verify** below (and optionally Step 7 if Docker is installed).

### @steps
1. Generate the data if you have not already, and look at the events file before you write anything:

```bash
python3 labs/shared/shopgen.py --out data
head -3 data/events.ndjson
wc -l data/events.ndjson
```

2. Part A. Open `labs/mod-1-1/report.sh`. Implement it so it prints the lines described in its header comment. Build the pipeline stage by stage in your terminal first; when each part prints the right number, move it into the script. Use `jq -R 'fromjson? ...'` for robust parsing and `sort -u` to remove duplicate event ids.
3. Make the script professional: strict mode, a required argument with a usage message, `mktemp` for any temporary file, and `trap` to remove it. Run `shellcheck` on it if you have it.
4. Run the tests for part A as you go (`test_lab.py` uses Python's built-in `unittest` module, so class names like `TestReportScript` work directly without `pytest`):

```bash
python3 labs/mod-1-1/test_lab.py TestReportScript -v
```

5. Part B. Open `labs/mod-1-1/Dockerfile` and `.dockerignore`. The starter builds, but it breaks several good practices checked by `TestDockerfile`: an unpinned base image, missing `WORKDIR`, no layer caching, pip cache kept (`--no-cache-dir` / `PIP_NO_CACHE_DIR`), root user, shell-form command, no ignore list (`venv`, `data`, `.git`, `.env`), and keeping secrets out of the Dockerfile. Fix each one using the lesson as your guide.
6. Run the Dockerfile checks:

```bash
python3 labs/mod-1-1/test_lab.py TestDockerfile -v
```

7. Optional, if Docker is installed: build and run it for real, then try a memory limit.

```bash
docker build -t kopiku-etl labs/mod-1-1
docker run --rm -v "$PWD/data:/data:ro" kopiku-etl
docker run --rm --memory 64m -v "$PWD/data:/data:ro" kopiku-etl
```

### @files
- labs/mod-1-1/report.sh :: Your working file for part A :: starter
- labs/mod-1-1/Dockerfile :: Your working file for part B (fix its problems) :: starter
- labs/mod-1-1/.dockerignore :: Your working file: what to keep out of the image :: starter
- labs/mod-1-1/app/etl.py :: The Python job being containerised (provided) :: data
- labs/mod-1-1/app/requirements.txt :: Its dependencies (provided) :: data
- labs/mod-1-1/test_lab.py :: The tests that check both parts :: test
- labs/mod-1-1/reference/report.sh :: Reference solution for part A (try first!) :: reference
- labs/mod-1-1/reference/Dockerfile :: Reference solution for part B :: reference
- labs/mod-1-1/reference/.dockerignore :: Reference ignore list for part B :: reference

### @deliverables
- `python3 labs/mod-1-1/test_lab.py` passes all tests
- report.sh gives the right numbers on `data/events.ndjson` and fails with a non-zero exit code when given no file or a missing file
- You can explain what each of the eight checks in `TestDockerfile` (Dockerfile and `.dockerignore`) prevents

### @verify
Run both parts together from the repository root:

```bash
python3 labs/mod-1-1/test_lab.py -v
python3 scripts/prove.py mod-1-1    # requires pytest (pip install pytest)
```

To compare with a known-good run: `LAB_DIR=reference python3 labs/mod-1-1/test_lab.py`.

## @chaos The partial file that loaded "successfully"
### @scenario
Every night at 01:00 a cron job reads yesterday's orders export, a gzip-compressed file that a partner uploads to a shared folder, and loads the totals into the warehouse. On the 12th the finance dashboard shows revenue at 6% of normal. The job's log says `done` and its exit code was 0. The file on disk looks fine, and re-running the job manually at 10:00 gives the correct numbers.

The script is: `zcat /incoming/orders.csv.gz | awk -F, '{...}' > /warehouse/daily.csv`.

### @cause
The partner's upload was still in progress when the job started at 01:00. The file existed but was incomplete, and gzip reported "unexpected end of file". But in a pipeline, the exit code is that of the **last** command: `zcat` failed, `awk` happily processed the lines it received and exited 0, so the script succeeded. The incomplete output replaced the previous day's complete file because the job wrote directly to the final path.

Nothing checked that the input was complete, that the output was plausible, or that the pipeline's early stages succeeded.

### @fix
1. Add `set -euo pipefail` so a failure in any stage fails the script (in a test, a truncated gzip piped through `wc -l` printed a partial count and still exited 0 until `pipefail` was set).
2. Verify the input before using it: `gzip -t file.gz`, and wait for a completion marker (a `_SUCCESS` file or a checksum the partner publishes) instead of guessing a time.
3. Write the output to a temporary file and `mv` it into place only after everything succeeded, so a failed run never replaces good data.
4. Add a sanity check on the result (row count or revenue within a range of recent days) that fails the job when something is off.
5. Alert when the job fails or does not run at all.

### @pattern
A pipeline succeeds only if every stage succeeds. Verify inputs, fail on any stage, and never overwrite good output with unverified output.

## @quiz
### What does `set -o pipefail` change in a Bash script?
- [ ] It makes every command in the script run in parallel so that pipelines finish sooner
- [x] A pipeline fails when any command inside it fails, not only the last command
- [ ] It prevents the script from creating temporary files or writing to the disk
- [ ] It makes the script stop whenever an unset variable is used in any command

> Without pipefail the exit code of a pipeline is that of its last command, so an early failure (like a truncated zcat) can be hidden. Unset variables are the job of `set -u`.

### A container exits with code 137 and the logs end abruptly with no error message. What is the most likely cause?
- [ ] The Python code raised an unhandled exception, which is always printed before the exit
- [ ] The Dockerfile used the shell form of CMD instead of the exec form
- [x] The process was killed by the system for exceeding the memory limit it was given
- [ ] The image was built from a base image that was too small to run Python

> 137 is 128 + 9: the process received SIGKILL. In containers that is typically the kernel's OOM killer; the process had no chance to print anything.

### Why does `sort | uniq -c` need the `sort` first?
- [ ] `uniq` can only read files from disk and cannot receive input through a pipe, so a temporary file is needed
- [ ] `sort` translates the text into a binary format that `uniq` is then able to understand and count
- [x] `uniq` merges only adjacent identical lines, so equal values have to be sorted next to each other
- [ ] `sort` removes the blank lines and the header row that would otherwise make `uniq` count incorrectly

> uniq compares each line only with the previous one. Sorting brings equal lines together so each distinct value is counted once.

### In a Dockerfile, why copy `requirements.txt` and run `pip install` before copying the rest of the code?
- [ ] pip refuses to install packages once the application code is already present inside the image
- [x] Docker reuses the cached dependency layer when only your code changes, so rebuilds are fast
- [ ] The file system in a container becomes read-only after the first COPY instruction has run
- [ ] The order has no real effect, but it is the convention that makes Dockerfiles easier for people to read

> Each instruction creates a cached layer. Dependencies change rarely and code changes often, so putting the install before the code copy avoids reinstalling every time.

### Why should a container usually run as a non-root user?
- [ ] Root users cannot read files that were copied into the image with the COPY instruction
- [ ] Non-root processes use less memory because they skip several kernel checks
- [x] If the application is compromised, the attacker has far fewer privileges
- [ ] Docker will not start containers whose main process runs as root

> Least privilege limits the damage from a vulnerability. It is a security practice and not a requirement of Docker.

### A cron job works when you run it by hand but fails when cron runs it, with `command not found`. What is the most likely explanation?
- [ ] cron only runs scripts that are written in the shell language itself, and cannot start Python or Perl programs
- [ ] The script file lost its execute permission at the exact moment when cron started it for the first time
- [x] cron runs with a minimal environment: a short PATH, no login profile and no activated virtual environment
- [ ] cron cannot run commands that read from or write to files on the disk, only commands that print to the screen

> cron does not load your login shell's profile. Use absolute paths, set needed variables inside the script, and call the virtual environment's Python directly.

### What does `jq -R 'fromjson?'` do for a file where some lines are broken?
- [ ] It repairs broken JSON lines by guessing the missing brackets, quotes and commas, then keeps them
- [ ] It stops at the first broken line and reports the line number of that line as a fatal error
- [x] It parses every line separately and silently skips any invalid JSON line, instead of failing
- [ ] It loads the whole file into memory first so that every broken line can be located before parsing

> `-R` reads raw lines, `fromjson` parses one, and `?` suppresses the error for failures, so one bad line does not abort the run. Count what you skipped so the loss is visible.

### Which approach makes a script's output safe from being half-written when the script fails midway?
- [ ] Write directly to the final file and delete it in the trap if the script fails
- [x] Write to a temporary file in the same folder, then rename it into place at the end
- [ ] Run the script twice and compare the two outputs before using either of them
- [ ] Redirect the script's output to `/dev/null` and generate the real file from the log

> A rename on the same file system is atomic, so a reader sees either the old complete file or the new complete file. The trap-and-delete approach still exposes a partial file while the script runs.

## @resources
- [GNU Bash manual](https://www.gnu.org/software/bash/manual/bash.html)
- [jq manual](https://jqlang.github.io/jq/manual/)
- [ShellCheck](https://www.shellcheck.net/)
- [Docker docs: Dockerfile best practices](https://docs.docker.com/build/building/best-practices/)
