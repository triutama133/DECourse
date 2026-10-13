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
Modules 0.2 and 0.3: terminal basics, Git, and the idea of a Python virtual environment. Docker is needed only for the optional runtime part of the lab; the checks do not require it.

## @lesson How a Unix program thinks: processes, streams and exit codes
Everything you run is a **process**: a program with its own memory, a numeric id (PID), and three standard streams: **stdin** (input), **stdout** (output) and **stderr** (errors and diagnostics). Because commands only read and write streams of bytes, you can connect any command to any other with `|`. This is the design that makes the shell powerful: small programs, one job each, joined together.

Every process ends with an **exit code**, a number from 0 to 255. By convention **0 means success** and anything else means failure. The shell stores the last one in `$?`:

```bash
grep -q "paid" data/orders.csv ; echo $?     # 0 if found, 1 if not found, 2 on error
```

Exit codes are how schedulers, CI systems and containers decide whether your job worked. A script that prints "ERROR" and still exits 0 is a lie to every system around it. Two operators use exit codes directly: `a && b` runs `b` only if `a` succeeded, and `a || b` runs `b` only if `a` failed.

Some codes you will meet in the wild:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General failure (what most programs use) |
| 2 | Misuse of the command (bad arguments) |
| 126 / 127 | Command found but not executable / command not found |
| 137 | Killed with SIGKILL (128 + 9). In containers this usually means **out of memory** |
| 143 | Terminated with SIGTERM (128 + 15): a polite request to stop, e.g. from `docker stop` |

Useful process commands: `ps aux` (list processes), `top` or `htop` (live view of CPU and memory), `kill <pid>` (send SIGTERM), `kill -9 <pid>` (SIGKILL, cannot be caught, use as a last resort), and `Ctrl+C` (send SIGINT to the foreground process).

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

On the KopiKu data this prints `cancelled 362`, `delivered 2148`, `paid 374`, `refunded 174`, `shipped 576`. Notice it counts the duplicate rows too, so it differs from the de-duplicated counts in Module 0.2; you must decide whether duplicates matter before trusting any count.

> **Warning:** `awk -F,` and `cut -d,` split on every comma, so they break on CSV values like `"Santoso, Budi"`. They are fine for simple, known files. For real CSV with quoted fields use Python's `csv` module, `csvkit` or Miller (`mlr`).

**Finding and batching.** `find data -name '*.gz' -print0 | xargs -0 -n1 gzip -t` tests every compressed file, one per command; `-print0` and `-0` make it safe for file names containing spaces.

> 💡 **Practice Pause 1 (Data Stream Exploration in Terminal):**
> Prove these Unix text processing concepts right now on your machine! Open your terminal in the course directory:
> 1. Generate event data if not done already: `python3 labs/shared/shopgen.py --out data`
> 2. Inspect the first 3 NDJSON event lines: `head -3 data/events.ndjson`
> 3. Count total event log lines: `wc -l data/events.ndjson`
> 4. Count purchase events: `grep -c "purchase" data/events.ndjson`
> Your data is ready! Proceed to Lesson 3 to slice JSON data with `jq`.

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

`fromjson` parses a line as JSON; the `?` suppresses the error when a line is broken, so the bad lines are skipped instead of aborting the whole run. On the KopiKu events this keeps 89,987 of 90,900 lines (the other 913 are truncated) in about half a second on a laptop.

> **Warning:** `jq -s` ("slurp") loads the *entire* input into memory as one array. It is convenient and dangerous: on a large file it is exactly how a container gets killed. Prefer streaming forms (one object per line) and aggregate with `sort | uniq -c`, or move to DuckDB (Module 2.1) when you need real analytics.

When should you stop using shell tools? When the logic needs branching, state, retries or tests. A shell pipeline of five stages is a joy; a 300-line Bash script is a liability. Switch to Python (Module 1.2) when you reach for arrays of arrays or when you want to unit-test the logic.

> 💡 **Practice Pause 2 (JSON Parsing with jq):**
> Try `jq` directly in your terminal to extract fields:
> 1. Extract compact event_id and event_type: `head -5 data/events.ndjson | jq -c '{event_id, event_type}'`
> 2. Test error-resilient parsing: `jq -R -c 'fromjson? | select(type == "object")' data/events.ndjson | head -3`
> Notice how damaged lines are skipped without crashing! Proceed to Lesson 4 to write safe shell scripts.

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

Caveat: `-e` is not triggered inside `if` conditions, in `&&`/`||` chains, or in a command whose failure you test yourself. It is a safety net, not a substitute for thinking.

Habits that keep scripts reliable:

- **Quote variables**: `"$file"`, not `$file`. Unquoted, a name with a space becomes two arguments.
- **Validate arguments**: `file="${1:?usage: report.sh <events.ndjson>}"` stops with a message if the argument is missing.
- **Clean up with `trap`**: `tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT` removes the temporary file whether the script succeeds, fails or is interrupted.
- **Write outputs atomically**: write to `out.csv.tmp`, then `mv out.csv.tmp out.csv`. A rename on the same file system is atomic, so readers see either the old complete file or the new complete file, never a half-written one.
- **Log to stderr, results to stdout**: `echo "starting" >&2`. This keeps the data stream clean for pipes.
- **Make it idempotent**: run twice, same result. Use deterministic output paths and overwrite, or write by date partition.
- **Lint it**: `shellcheck script.sh` finds most quoting and logic mistakes automatically. Run it in CI.

> 💡 **Practice Pause 3 (Build report.sh - Part A):**
> Time to build Part A of this lab!
> 1. Open `labs/mod-1-1/report.sh` in your text editor (remember: do not execute directly in bash without an input argument!).
> 2. Apply strict mode `set -euo pipefail`, validate input argument `$1`, and build the metric summary pipeline using `jq`, `sort -u`, and `wc -l`.
> 3. Test your script in the terminal:
> `python3 labs/mod-1-1/test_lab.py TestReportScript -v`
> When all Part A tests are GREEN (PASSED), your professional Unix stream script is done! Proceed to Lesson 5 on Cron.

## @lesson Scheduling jobs with cron
**cron** runs commands on a schedule. Edit your table with `crontab -e`. Each line has five time fields then the command:

```text
# m  h  dom mon dow  command
  0  2   *   *   *   /opt/kopiku/run_report.sh >> /var/log/kopiku/report.log 2>&1
 */15 *  *   *   *   /opt/kopiku/check_inbox.sh
```

The first line runs at 02:00 every day. Know these surprises before they cost you a night:

- **Minimal environment.** cron does not load your shell profile. `PATH` is short, your virtual environment is not active, your environment variables are missing. Use absolute paths, set variables inside the script, and call `/opt/kopiku/venv/bin/python` directly.
- **Silent output.** Output goes to email or nowhere. Redirect both streams to a log file (`>> log 2>&1`) so you can see what happened.
- **Overlapping runs.** If a run takes longer than the interval, a second copy starts and they collide. Guard with a lock: `flock -n /tmp/report.lock /opt/kopiku/run_report.sh`.
- **Time zones.** cron uses the server's time zone, and daylight saving shifts can skip or repeat an hour. Servers should run in UTC, and schedules be written with that in mind.
- **No dependencies, no retries, no history.** cron does not know that job B must wait for job A, will not retry, and keeps no record of runs.

That last point is why real pipelines move to an **orchestrator** such as Airflow or Dagster (Module 2.4), which add dependencies, retries, backfills and a UI. cron is still the right tool for a simple, independent job on a single machine.

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
> 2. Fix the Dockerfile: pin image `python:3.12-slim`, install dependencies before copying code, add non-root `USER appuser`, and use exec-form `ENTRYPOINT ["python", "etl.py"]`.
> 3. Verify `.dockerignore` excludes `venv/`, `data/`, `.git/`, and `.env`.
> 4. Test in the terminal:
> `python3 labs/mod-1-1/test_lab.py TestDockerfile -v`
> When all Dockerfile tests show PASSED, your container is production ready! Proceed to Lesson 7 to learn about memory limits & exit code 137.

## @lesson Resource limits and the job that dies with code 137
Containers can be given limits: `docker run --memory 512m --cpus 1 ...`, or in an orchestrator's configuration. If a process in a container uses more memory than its limit, the Linux kernel's **OOM killer** terminates it with SIGKILL. You see exit code **137** and, in `docker inspect`, `"OOMKilled": true`. There is no Python traceback, because the process never got a chance to print one: from the inside it simply vanishes, which is why this failure confuses beginners.

The usual causes in data work:

- **Loading everything at once**: `pandas.read_csv` on a file much larger than memory (pandas often needs several times the file size in RAM), `jq -s`, or `list(rows)` on a huge iterator.
- **Unbounded growth**: collecting results in a list or dictionary that grows with the input.
- **Fan-out**: a join or explode that multiplies rows.

The fixes follow the same principle: **process in a stream or in bounded chunks, and keep memory proportional to one batch, not to the whole input.** The shell tools in this module do that naturally; Module 1.2 shows the Python version (generators), and Module 2.1 shows engines (DuckDB, Polars) that spill to disk instead of dying.

Related limits to watch: **disk** (a full disk makes writes fail in odd ways, so clean temp files and monitor usage), **CPU** throttling (your job just becomes slow), and **open files**. When a container misbehaves, the first commands are `docker logs <name>`, `docker stats` (live memory and CPU), `docker inspect <name>` (exit code, OOMKilled) and `docker exec -it <name> sh` (look around inside).

## @lab Lab: a shell report and a container for a KopiKu job
Part A: write a robust shell script that summarises the website events file, which contains broken lines and duplicates. Part B: package a small Python job into a good Docker image. Both are checked automatically.

### @steps
1. Generate the data if you have not already, and look at the events file before you write anything:

```bash
python3 labs/shared/shopgen.py --out data
head -3 data/events.ndjson
wc -l data/events.ndjson
```

2. Part A. Open `labs/mod-1-1/report.sh`. Implement it so it prints the lines described in its header comment. Build the pipeline stage by stage in your terminal first; when each part prints the right number, move it into the script. Use `jq -R 'fromjson? ...'` for robust parsing and `sort -u` to remove duplicate event ids.
3. Make the script professional: strict mode, a required argument with a usage message, `mktemp` for any temporary file, and `trap` to remove it. Run `shellcheck` on it if you have it.
4. Run the tests for part A as you go:

```bash
python3 labs/mod-1-1/test_lab.py TestReportScript -v
```

5. Part B. Open `labs/mod-1-1/Dockerfile` and `.dockerignore`. The starter builds, but it breaks several good practices: an unpinned base image, no layer caching, root user, shell-form command, no ignore list. Fix each one using the lesson as your guide.
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

### @deliverables
- `python3 labs/mod-1-1/test_lab.py` passes all tests
- report.sh gives the right numbers on `data/events.ndjson` and fails with a non-zero exit code when given no file or a missing file
- You can explain what each of the six fixes in your Dockerfile prevents

### @verify
Run both parts together from the repository root:

```bash
python3 labs/mod-1-1/test_lab.py -v
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
