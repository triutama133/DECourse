---
title: Your Workshop: Terminal, Python Environments and Git
duration: 1-2 weeks
summary: Learn to work comfortably in a terminal, keep each project's Python packages isolated, and use Git so that nothing you build is ever lost, and no secret ever leaks.
why: Tutorials assume your computer is already set up. Then you meet "command not found", a package that works on one laptop and not another, or an API key pushed to GitHub, and the course stops there.
---

## @outcomes
- Move around the file system and inspect files using the terminal, including combining commands with pipes
- Create an isolated Python environment for a project and record its dependencies
- Read a Python error message from the bottom up and find the line that matters
- Use Git to snapshot your work, view history, undo mistakes and keep files you must not share out of the repository
- Keep passwords and API keys out of your code and out of Git

## @prereq
Module 0.1 helps but is not required. You need a computer where you can install software: Linux, macOS, or Windows 10/11 with WSL2 (recommended on Windows because almost every data tool assumes a Linux-style shell).

## @lesson Why engineers live in the terminal
A graphical interface is great for exploring. It is poor at **repeating** things, **recording** what you did, and **running on machines with no screen**. Servers in the cloud have no desktop, and the job that runs your pipeline at 2 a.m. has no mouse. Everything on those machines is done with text commands, and everything you automate is a text command someone can read, review and re-run.

The program that reads your commands is the **shell** (usually `bash` or `zsh`; PowerShell on Windows). The window that hosts it is the **terminal**. You type a command, press Enter, and see the output. A few habits make this far less scary:

- **Press Tab** to complete file names. It is faster and prevents typos.
- **Press the Up arrow** to recall previous commands, and `Ctrl+R` to search them.
- **Read the error.** Nine times out of ten the answer is in the last line.
- **Ask the command for help:** `ls --help`, or `man ls` (press `q` to quit).

The commands you will use every day:

| Command | What it does | Example |
|---|---|---|
| `pwd` | Print the folder you are in | `pwd` |
| `ls -la` | List files, including hidden ones, with details | `ls -la data` |
| `cd` | Change folder | `cd ~/kopiku` |
| `mkdir -p` | Create a folder (and parents) | `mkdir -p kopiku/data` |
| `cp`, `mv` | Copy, move or rename | `mv old.csv new.csv` |
| `rm` | **Delete permanently** (no recycle bin) | `rm notes.txt` |
| `cat`, `head`, `tail` | Show a whole file, its first lines, its last lines | `head -5 orders.csv` |
| `less` | Scroll through a long file (`q` quits) | `less events.ndjson` |
| `grep` | Find lines containing text | `grep "cancelled" orders.csv` |
| `wc -l` | Count lines | `wc -l orders.csv` |

> **Warning:** `rm` does not ask and cannot be undone, and `rm -rf` deletes a whole folder tree without a single question. Before running it, run `ls` on exactly the same path to see what you are about to destroy. Never run a command you copied from the internet without understanding it.

**Windows users.** Install WSL2 (`wsl --install` in an administrator PowerShell), then open "Ubuntu" from the Start menu. Inside it, everything in this course works exactly as written. If you stay in plain PowerShell, many commands have equivalents (`dir` for `ls`, `type` for `cat`, `Select-String` for `grep`) but tutorials, Docker and data tools will keep assuming a Linux shell, so WSL2 saves you a lot of friction.

## @lesson Paths, files and the environment
Every file has a **path**, its address in the file system. An **absolute path** starts at the root (`/home/budi/kopiku/data/orders.csv`). A **relative path** starts from where you are now (`data/orders.csv`). Some shortcuts you will use constantly: `~` is your home folder, `.` is the current folder, `..` is the parent folder. If a script says "file not found", the cause is nearly always that you are standing in a different folder than you think; run `pwd` and `ls` first.

Files whose names start with a dot (`.gitignore`, `.env`) are **hidden**; `ls -a` shows them. File extensions (`.csv`, `.py`) are only a hint to humans and programs, not a guarantee of content.

Two pieces of the environment matter early:

- **Environment variables** are named values every program can read, such as `HOME` or `PATH`. `echo $HOME` shows one. Later you will use them to pass settings and secrets to programs without writing them in code.
- **`PATH`** is the list of folders the shell searches when you type a command name. "command not found" means the program is not installed, or not in a folder on your `PATH`. Activating a Python virtual environment (next lessons) works by putting its folder at the front of `PATH`.

**Text encoding and line endings** cause quiet bugs. Text files are bytes interpreted through an encoding; use **UTF-8** everywhere and say so when opening files in code. Windows and Linux end lines differently (`\r\n` vs `\n`); a CSV created on Windows may leave an invisible `\r` at the end of the last column, which breaks comparisons that "look" identical.

**Permissions.** Files have read, write and execute permissions for owner, group and others. `ls -l` shows them (`-rwxr-xr-x`). `chmod +x script.sh` lets you run a script directly. You will mainly meet permissions as "Permission denied", which means the user running the command is not allowed that action on that file. Do not "fix" it with `sudo` blindly: that runs the command with full power and creates files only the administrator can later change.

## @lesson Redirects and pipes: small tools, joined together
The most powerful idea in the terminal is that commands do one small job, and you connect them. Two symbols do the connecting.

- `|` (pipe) sends the output of one command into the next.
- `>` writes output to a file (replacing it), and `>>` appends to a file.

Try this on the KopiKu data after Lab 0.1. How many orders per status?

```bash
cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn
```

Read it left to right: `cut` takes the 4th comma-separated column (the status), `tail -n +2` skips the header line, `sort` groups equal values together, `uniq -c` counts runs of equal values, and the last `sort -rn` puts the biggest count first. Five tiny tools replaced a program, and nothing was loaded into memory at once, so it works on a file far bigger than your RAM. Module 1.1 develops this skill in depth.

Notice the output also reveals the data problem from Module 0.1: you will see `paid`, `PAID` and `Paid` as separate groups. The terminal is a good place to *look at data before you write code for it*.

> **Warning:** `>` replaces the target file immediately and silently. `sort data.csv > data.csv` destroys the file (the shell empties it before `sort` reads it). Write to a new file, then rename.

Every program has three standard streams: input (`stdin`), output (`stdout`) and errors (`stderr`). Pipes carry `stdout`; error messages still appear on your screen. To save errors too, use `2>` (for example `python job.py > out.txt 2> errors.txt`). Separating them is why a pipeline can fail loudly even when its output is being piped away.

## @lesson Python: install it once, then isolate every project
Check what you have: `python3 --version`. For this course use Python 3.10 or newer. On Linux and macOS, use the system's package manager or the official installer; on Windows, work inside WSL2.

The central problem: Python packages are installed into one place, and different projects need different versions. Project A needs `pandas 1.5`, project B needs `pandas 2.2`. Install everything globally and one project eventually breaks the other, or breaks your operating system's own Python tools. The fix is a **virtual environment**: a private folder with its own Python and its own packages, per project.

```bash
cd ~/kopiku
python3 -m venv venv              # create the environment in ./venv
source venv/bin/activate          # activate it (Windows PowerShell: venv\Scripts\Activate.ps1)
python --version                  # now "python" means the venv's Python
python -m pip install requests    # installs into ./venv only
python -m pip freeze > requirements.txt   # record exactly what is installed
deactivate                        # leave the environment
```

Three rules save most beginners' afternoons:

1. **Always run `python -m pip`, not bare `pip`.** It guarantees the package goes to the same Python you are using.
2. **Never use `sudo pip install`.** It modifies the system Python and can break the operating system's tools.
3. **Commit `requirements.txt`, never the `venv/` folder.** The folder is large, specific to your machine, and recreated in one command: `python -m pip install -r requirements.txt`.

Newer tools (`uv`, `poetry`) do the same job faster and add lock files; the concept is identical, so learn it with `venv` first.

**Running scripts.** `python summarize.py data/orders.csv` runs a file; the words after the file name arrive in `sys.argv` and are parsed nicely by the standard-library `argparse` module. The idiom `if __name__ == "__main__":` at the bottom means "run this part only when the file is executed directly, not when it is imported", which you will use in every script that might later become a library.

**Reading a traceback.** When Python fails it prints a *stack trace*. Read it **from the bottom**: the last line names the error type and message (`FileNotFoundError: [Errno 2] No such file or directory: 'data/orders.csv'`); the lines above show which line of which file called which. The last frame in your own code is usually where to look. Copy the last line when you search for help or ask someone.

## @lesson Git: a safety net for everything you write
Git records snapshots of your project so you can see what changed, go back to any earlier state, work on experiments without risk, and collaborate. Three areas explain nearly everything:

1. **Working tree**: the files as they are on disk right now.
2. **Staging area**: the changes you have *chosen* to include in the next snapshot.
3. **Repository history**: the permanent chain of snapshots, called **commits**.

The basic loop:

```bash
git init                         # start tracking this folder (once)
git status                       # what changed? what is staged?
git add summarize.py             # stage a file for the next snapshot
git commit -m "Add script that counts orders by status"   # take the snapshot
git log --oneline                # list history
git diff                         # see unstaged changes line by line
```

**Good commits** are small and have a message that says *what and why* ("Reject orders with non-positive totals"), not "update" or "fix". Commit when one thing works. Small commits make mistakes easy to find and undo.

**Undoing things safely** (learn these before you need them):

- Discard uncommitted edits to a file: `git restore file.py`
- Unstage a file: `git restore --staged file.py`
- Undo a commit by adding a new commit that reverses it: `git revert <commit>`
- Fix the last commit message (not yet shared): `git commit --amend`

**Branches** let you experiment without touching the main line: `git switch -c try-new-parser`, work and commit, then merge it (`git switch main && git merge try-new-parser`) or throw it away. **Remotes** such as GitHub hold a copy elsewhere: `git remote add origin <url>` and `git push -u origin main`. A pushed repository is a backup and a portfolio, but also something other people can read, which is why the next two points matter.

**`.gitignore`** lists files Git must not track: `venv/`, `.env`, `__pycache__/`, large data files such as `data/`. Note: ignoring a file only affects files not yet committed. If you committed `data/` earlier, add it to `.gitignore` *and* run `git rm -r --cached data` to stop tracking it.

> **Warning:** Git history is permanent by design. A file committed once lives in every clone and every old commit, even if you delete it in the next commit. This is why secrets must never be committed, even "temporarily".

## @lesson Secrets and configuration
A **secret** is anything that grants access: passwords, API keys, tokens, private keys, database connection strings with passwords. A **configuration** is a setting that differs between environments (the database host in development vs production). Both belong *outside* your code.

The beginner's version of the fix is environment variables:

```python
import os
db_password = os.environ["DB_PASSWORD"]      # fails loudly if missing: good
region = os.environ.get("REGION", "ap-southeast-1")   # with a harmless default
```

For local work, put variables in a file named `.env` that is listed in `.gitignore`, and load it with your shell (`set -a; source .env; set +a`) or a library such as `python-dotenv`. In production the platform injects them from a secrets manager. Commit a `.env.example` with fake values so teammates know which variables exist.

If a secret does get committed or pushed: **assume it is stolen**, because bots scan public repositories within minutes. The fix order matters: (1) **revoke and replace the secret** at its provider, (2) then clean the repository history if you must, (3) then add the file to `.gitignore` and enable secret scanning. Deleting the file in a later commit is *not* a fix.

## @lesson Working habits that make you faster
A few small disciplines separate people who ship from people who struggle with their tools.

- **One project, one folder, one repository, one environment.** For this course: `~/kopiku/` containing `venv/`, `data/`, your scripts, `requirements.txt`, `.gitignore` and a short `README.md` that says how to run things.
- **Keep data out of Git, and make it reproducible.** Data is big and changes; the *recipe* that produces it (the generator command) belongs in the README. This is the habit of reproducibility, and employers notice it.
- **Make errors easy to help with.** When you ask for help, give the exact command you ran, the full error text (as text, not a screenshot), what you expected, what Python version and OS you use, and what you already tried. People answer well-formed questions in minutes and ignore vague ones.
- **Read before you paste.** Understand every command you copy. Prefer official documentation for installation steps; tutorials age quickly.
- **Use an editor that helps.** Visual Studio Code with the Python extension gives syntax highlighting, an integrated terminal and a debugger. The terminal skills in this module work the same inside it.

Finally, **practise the loop** until it is automatic: make a small change, run it, look at the result, commit. Everything later in the course (tests, containers, orchestrators) is that same loop with better tools.

## @lab Lab: build your KopiKu workspace
Create the project folder that you will use for the rest of the course, and prove it is set up correctly with an automatic checker. Your workspace needs an isolated environment, a Git history with sensible commits, a `.gitignore` that protects you, and a small script that counts orders by status.

### @steps
1. Create the folder and move into it:

```bash
mkdir -p ~/kopiku && cd ~/kopiku
```

2. Create and activate a virtual environment, and make your first commit with a `.gitignore` that excludes `venv/`, `.env`, `data/` and `__pycache__/`:

```bash
python3 -m venv venv
source venv/bin/activate            # Windows PowerShell: venv\Scripts\Activate.ps1
git init
printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore
git add .gitignore
git commit -m "Start project with a .gitignore"
```

3. Copy the data generator from the course repository into your project and generate the data. Replace `<course-repo>` with the path where you cloned this course:

```bash
cp <course-repo>/labs/shared/shopgen.py .
python3 shopgen.py --out data
```

4. Copy `starter/summarize.py` (shown below) from the course repository into your project and implement it. It must count each `order_id` once and group by lower-case status. Try it, and compare with the terminal one-liner from the lessons (remember the one-liner double-counts duplicates, so the numbers will differ slightly: that is the point):

```bash
python3 summarize.py data/orders.csv
```

5. Commit the script and the generator, record the dependencies (even though you have none yet, the file is part of the habit) and commit again:

```bash
git add shopgen.py summarize.py
git commit -m "Add script that counts orders by status"
python -m pip freeze > requirements.txt
git add requirements.txt
git commit -m "Record dependencies in requirements.txt"
```

6. Run the checker and fix anything it reports:

```bash
python3 <course-repo>/labs/mod-0-2/check.py ~/kopiku
```

7. **Now do Lab 0.1 for real.** If you only tried it in the browser preview, go back to Module 0.1 and do it on your own computer, using what you just built: activate a venv, install pytest, then run the tests from your own terminal.

```bash
python3 -m venv venv && source venv/bin/activate
pip install pytest
pytest labs/mod-0-1/test_lab.py -v
```

### @files
- labs/mod-0-2/starter/summarize.py :: Starter for your script: fill in the counting logic :: starter
- labs/mod-0-2/check.py :: Checker that inspects your workspace :: test
- labs/mod-0-2/reference/summarize.py :: One possible solution (try first!) :: reference
- labs/mod-0-2/reference/make_workspace.sh :: Builds the finished workspace automatically :: reference

### @deliverables
- `python3 labs/mod-0-2/check.py ~/kopiku` prints PASS for every line
- Your Git history has at least three commits with meaningful messages
- `venv/`, `data/` and `.env` are not tracked by Git
- Lab 0.1's 8 tests pass in your own terminal, inside your own venv (your own setup, not the browser preview)

### @verify
The checker is the verification:

```bash
python3 labs/mod-0-2/check.py ~/kopiku
```

It checks the environment, the repository, `.gitignore`, the commit history, that no secret appears anywhere in history, and that your script gives the correct counts. Each failing line prints a hint.

## @chaos The API key that went public
### @scenario
A junior engineer builds a small job that downloads exchange rates from a paid API. To get it working quickly, they paste the API key into `config.py`, commit, and push the repository to a public GitHub account to show it in their portfolio. Three days later the team lead gets an email from the API provider: usage on that key is 400 times higher than normal, and the monthly bill is on its way to being very large. The job itself still works fine.

### @cause
The key was committed in plain text and the repository was public. Automated bots scan every public push for patterns that look like keys and start using any they find, usually within minutes. The junior engineer then deleted the key from `config.py` in a new commit, which changed nothing: the key still exists in the earlier commit, visible to anyone who opens the history.

### @fix
1. **Revoke the key immediately** at the provider and issue a new one. This is the only step that actually stops the damage.
2. Check the provider's usage log to see what the old key was used for.
3. Move the new key into an environment variable (`os.environ["RATES_API_KEY"]`), put `.env` in `.gitignore`, and commit a `.env.example` with a fake value.
4. If the repository must stay public, remove the secret from history with a tool such as `git filter-repo` and force-push, but treat this as cleanup, not security: the old key is already compromised.
5. Turn on the platform's secret scanning and add a pre-commit check so it cannot happen again.

### @pattern
Secrets live in the environment, never in the repository. If one ever leaks, revoke first and clean up second.

## @quiz
### What is the main purpose of a Python virtual environment?
- [ ] It makes Python code run faster by compiling it ahead of time for the current machine
- [x] It gives each project its own packages, so different projects can use different versions
- [ ] It protects your code from being read by other users who share the same computer
- [ ] It installs a second copy of the operating system's Python so that updates cannot change it

> A virtual environment is a private folder with its own Python and its own installed packages, created per project. It has no effect on speed or on file privacy.

### You committed `data/orders.csv` last week and now add `data/` to `.gitignore`. What happens to the file?
- [ ] Git deletes it from the repository history as soon as the line is added
- [x] It stays tracked; ignore only covers untracked files. Run `git rm -r --cached data`
- [ ] It is removed from your disk during the next `git pull`
- [ ] It is hidden in the log but still tracked, and future edits are ignored automatically

> `.gitignore` applies only to files Git is not already tracking. Already-committed files continue to be tracked until you remove them from the index (and they remain in old commits).

### What does `grep "paid" orders.csv | wc -l` do?
- [ ] Counts how many files in the current folder contain the word "paid"
- [ ] Deletes every line that contains "paid" and prints the number of lines remaining
- [x] Counts how many lines of orders.csv contain the text "paid" anywhere
- [ ] Writes the word "paid" into orders.csv once for each line it already has

> `grep` prints matching lines, and the pipe sends them to `wc -l`, which counts lines. Nothing is modified.

### You run `sort orders.csv > orders.csv`. What is the result?
- [ ] The file is sorted in place, which is the usual way to sort a file safely
- [ ] The command fails with an error because the input and output are the same file
- [x] The file ends up empty, because the shell truncates it before `sort` reads it
- [ ] The file is sorted and a backup copy named orders.csv~ is created automatically

> The shell opens the output file for writing (emptying it) before starting the command. Write to a new file and rename it, or use `sort -o`.

### A Python script crashes with a long stack trace. Where should you look first?
- [ ] The first line of the trace, because that is where the program began running
- [x] The last line, which names the error, then your own last line of code in the trace
- [ ] The middle of the trace, because that is where the library code is
- [ ] Nowhere: stack traces are for the Python developers and not meant for users to read

> Python prints the call chain from the outermost call to the innermost. The final line has the error type and message; the nearest frame in your code is usually the cause.

### Which is the best commit message for a change that makes the cleaning step reject negative totals?
- [ ] "update"
- [x] "Reject orders with a non-positive total"
- [ ] "Changed some stuff in pipeline.py and also fixed things"
- [ ] "WIP"

> A good message says what changed and, where it helps, why. Vague messages make history useless when you need to find a bug later.

### You accidentally pushed a commit containing a database password to a public repository, then removed the file in the next commit. What should you do?
- [ ] Nothing more, because the password is no longer present in the latest version of the code
- [ ] Make the repository private, which prevents anyone from having already copied it
- [x] Change the password at the database first, then clean the history and add safeguards
- [ ] Ask GitHub support to delete the repository and keep using the same password

> The secret remains in the old commit and may already have been copied. Rotating the credential is the only fix that actually removes the risk. History cleanup is secondary.

### Why is `requirements.txt` committed to Git but the `venv/` folder is not?
- [ ] Git cannot store folders that contain more than a hundred files
- [ ] `requirements.txt` is encrypted, which makes it safe to share, while `venv/` is not
- [x] The folder is big and machine-specific, while the file can recreate it anywhere
- [ ] Python refuses to start if the `venv/` folder is stored in a repository

> `python -m pip install -r requirements.txt` rebuilds the environment on any machine, so only the recipe needs version control.

## @resources
- [Python docs: venv, creating virtual environments](https://docs.python.org/3/library/venv.html)
- [Python docs: argparse tutorial](https://docs.python.org/3/howto/argparse.html)
- [Pro Git book (free)](https://git-scm.com/book/en/v2)
- [GitHub docs: removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
