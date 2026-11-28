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
Module 0.0 (basic Python loops, dictionaries, sets and reading CSV files) is expected for the final counting script. You need a computer where you can install software: Linux, macOS, or Windows 10/11 with WSL2 (recommended on Windows because almost every data tool assumes a Linux-style shell).

## @part The terminal

## @lesson Why engineers live in the terminal
Picture a Monday: your lead asks, "rename these 40 files in `data/` and tell me how many orders were cancelled". With a mouse that is twenty minutes of clicking, and nothing you can repeat tomorrow. With a few typed commands it takes ten seconds, and the commands themselves are a record that anyone can read and re-run. That is why this module starts with the terminal, and why **you type every command on your own computer**: reading about a terminal teaches almost nothing, typing in one teaches fast.

A graphical interface is great for exploring. It is poor at **repeating** things, **recording** what you did, and **running on machines with no screen**. Servers in the cloud have no desktop, and the job that runs your pipeline at 2 a.m. has no mouse. Everything on those machines is done with text commands, and everything you automate is a text command someone can read, review and re-run.

The program that reads your commands is the **shell** (usually `bash` or `zsh`; PowerShell on Windows). The window that hosts it is the **terminal**. You type a command, press Enter, and see the output. A few habits make this far less scary:

- **Press Tab** to complete file names. It is faster and prevents typos.
- **Press the Up arrow** to recall previous commands, and `Ctrl+R` to search them.
- **Read the error.** Nine times out of ten the answer is in the last line.
- **Ask the command for help:** `man ls` opens the manual on Linux and macOS (press `q` to quit); on Linux, `ls --help` also prints a short summary (`--help` is Linux-only and fails on macOS).

**Windows users.** Install WSL2 (`wsl --install` in an administrator PowerShell), then open "Ubuntu" from the Start menu. Inside it, everything in this course works exactly as written. If you stay in plain PowerShell, many commands have equivalents (`dir` for `ls`, `type` for `cat`, `Select-String` for `grep`) but tutorials, Docker (a tool that packages programs to run anywhere; Module 1.1) and data tools will keep assuming a Linux shell, so WSL2 saves you a lot of friction.

The commands come in small groups. For each group: read what it is for, answer the question, then try it on your computer.

### Where am I, and what is here?

Before anything else you need to know **which folder you are standing in** and **what it holds**. A shell always has a *current folder*; commands that name files without a full address (`data/orders.csv`) look for them starting from it.

| Command | What it does | Example |
|---|---|---|
| `pwd` | Print the folder you are in | `pwd` |
| `ls -la` | List files, including hidden ones, with details | `ls -la data` |
| `cd` | Change folder | `cd ~/kopiku` |

Two path shortcuts you will see right away: `~` means your **home folder** (e.g. `/home/budi`), and `..` means the **parent folder** one level up.

:::ask You are in `~/kopiku/scripts`. The data folder is `~/kopiku/data`. You run `head -5 data/orders.csv`. What happens?
@options
the first five lines of the orders file are shown
the first five lines of the orders file are deleted
* error: `data/` is not inside `scripts/`
@why
`data/orders.csv` is a **relative path**: the shell looks for it starting from the folder you are in, `scripts/`, and there is no `data/` inside it. The file is one level up. Run `pwd` and `ls` first, or write the path from where you are: `../data/orders.csv`.
:::

> **On your computer, now:** open your terminal and run `pwd`, then `ls -la`, then `cd ..` and `pwd` again. Watch the answer of `pwd` change.

### Make, copy, move

| Command | What it does | Example |
|---|---|---|
| `mkdir -p` | Create a folder (and parents) | `mkdir -p kopiku/data` |
| `cp` | Copy a file | `cp orders.csv backup.csv` |
| `mv` | Move or rename | `mv old.csv new.csv` |

`mv` has two jobs that look the same to the shell: moving a file to another folder, and renaming it in place.

:::ask What does this do, if `old.csv` exists?
```bash
mv old.csv new.csv
```
@options
copies `old.csv` to `new.csv`; both files exist afterwards
* renames the file: only `new.csv` exists afterwards
deletes both files
@why
`mv` moves. When the destination is a new name in the same folder, "moving" a file is the same as **renaming** it. Use `cp` when you want to keep the original.
:::

> **On your computer, now:** `mkdir -p ~/kopiku/data`, `cd ~/kopiku`, `echo "hello" > a.txt` (`echo` prints text, and `>` sends it into a file instead of the screen; Lesson 3 explains), `cp a.txt b.txt`, `mv b.txt c.txt`, then `ls`. You should see `a.txt`, `c.txt`, and `data`. Clean up the two practice files with `rm a.txt c.txt` so they do not clutter `~/kopiku` later.

### Look inside a file

| Command | What it does | Example |
|---|---|---|
| `cat` | Show a whole file | `cat notes.txt` |
| `head`, `tail` | Show its first lines, its last lines | `head -5 orders.csv` |
| `less` | Scroll through a long file (`q` quits) | `less events.ndjson` |

Never open a million-line file in an editor to "see what is in it": `head` shows the shape in a blink.

:::ask Which command is the right first look at a huge file?
@options
`cat huge.csv`
`rm huge.csv`
* `head -5 huge.csv`
@why
`cat` would print every line and flood your screen. `head -5` shows just the first five lines (the header and a few rows), which is usually all you need to understand the shape of the data.
:::

### Find and count

| Command | What it does | Example |
|---|---|---|
| `grep` | Find lines containing text | `grep "cancelled" orders.csv` |
| `wc -l` | Count lines | `wc -l orders.csv` |

Together they answer "how many orders were cancelled?" without opening the file: `grep "cancelled" orders.csv | wc -l` (the `|` pipe, explained in Lesson 3, sends `grep`'s matching lines into `wc -l`; `grep -c "cancelled" orders.csv` is a built-in shortcut for the same count).

### The dangerous one: rm

| Command | What it does | Example |
|---|---|---|
| `rm` | **Delete permanently** (no recycle bin) | `rm notes.txt` |

> **Warning:** `rm` does not ask and cannot be undone, and `rm -rf` deletes a whole folder tree without a single question. Before running it, run `ls` on exactly the same path to see what you are about to destroy. Never run a command you copied from the internet without understanding it.

:::ask You want to delete the folder `old_data/`. What is the safest habit?
@options
* check with `ls old_data`, then delete
run `rm -rf old_data` and hope it is right
run `rm old_data` so it moves to the recycle bin
@why
There is no recycle bin in the shell. Looking at **exactly the same path** with `ls` first costs two seconds and has saved many people a bad day.
:::

> 💡 **Practice Pause 1 (Terminal Command Exploration):**
> Do not just read the table above! Open your terminal right now and move to your course folder first:
> Type `cd ~/projects/DECourse` (or wherever you cloned the course). If `data/orders.csv` is not there yet, run `python3 labs/shared/shopgen.py --out data` first.
> Type `pwd` to check your current working directory.
> Type `ls -la data` to list KopiKu's transaction files.
> Type `head -5 data/orders.csv` to inspect the first 5 order rows.
> Type `wc -l data/orders.csv` to count the total lines.
> **You should see:** the full path of your course folder for `pwd`; the seven data files (`orders.csv`, `customers.csv` and five more) for `ls -la data`; a header line (`order_id,customer_id,order_ts,status,payment_method,total_idr`) and four orders for `head -5`; and `3635 data/orders.csv` for `wc -l` (the header plus 3,634 orders).
> Once you see the output stream in your terminal, proceed to Lesson 2 below.

## @lesson Paths, files and the environment
Why do scripts say "file not found" when the file is right there? Almost always because the script is standing in a different folder than you think. Understanding **paths** removes this whole class of confusion.

### Paths: the address of a file

Every file has a **path**, its address in the file system. An **absolute path** starts at the root (`/home/budi/kopiku/data/orders.csv`). A **relative path** starts from where you are now (`data/orders.csv`). Some shortcuts you will use constantly: `~` is your home folder, `.` is the current folder, `..` is the parent folder. If a script says "file not found", run `pwd` and `ls` first.

Watch how a relative path becomes an absolute one: the shell glues it to the folder you are in. (The trace below uses Python's built-in `posixpath` module, which handles Linux/macOS `/`-separated paths.)

:::trace A relative path, resolved
@code
import posixpath

cwd = "/home/budi/kopiku/scripts"
relative = "data/orders.csv"
absolute = posixpath.join(cwd, relative)
print(absolute)

fixed = posixpath.normpath(posixpath.join(cwd, "..", relative))
print(fixed)
@notes
3 | You are standing in `scripts/`. This is the "current folder", what `pwd` prints.
5 | The shell joins the current folder and the relative path. That is the place it really looks.
6 | `/home/budi/kopiku/scripts/data/orders.csv`: there is no `data/` inside `scripts/`, so: "No such file or directory".
8 | `..` means "the parent folder". Going up one level before `data/orders.csv` lands on the real file.
:::

Files whose names start with a dot (`.gitignore`, `.env`) are **hidden**; `ls -a` shows them. File extensions (`.csv`, `.py`) are only a hint to humans and programs, not a guarantee of content.

> **On your computer, now:** `cd ~`, then `ls`, then `ls -a`: what extra names appear? Then `cd /tmp` and `pwd`. Which of `~`, `/tmp` and `..` is an absolute path, and which are shortcuts?

### Environment variables and PATH

:::talk Which Python runs?
@teacher The shell finds programs by searching a list of folders called `PATH`, from left to right. Imagine `PATH` is `/home/budi/venv/bin:/usr/local/bin:/usr/bin`, and a program named `python3` exists both in `/home/budi/venv/bin` and in `/usr/bin`.
@ask You type `python3`. Which one runs?
@choice Both run, one after the other | The shell runs one program per command. It stops at the first match. Try again.
@choice The one in `/usr/bin`, because it is the system's own Python | That folder is searched last here. The shell does not prefer "official" programs; it only follows the order of the list. Try again.
@choice * The one in `/home/budi/venv/bin`, because its folder comes first | Yes: the first match wins, and the search stops there. This is exactly how activating a virtual environment works: it puts its folder at the front of `PATH`.
@teacher Remember: **the first folder in `PATH` that has the name wins.** `echo $PATH` and `which python3` show you who won on your computer.
:::

- **Environment variables** are named values every program can read, such as `HOME` or `PATH`. `echo $HOME` shows one (putting `$` in front of a variable name tells the shell to read its value). Later you will use them to pass settings and secrets to programs without writing them in code.
- **`PATH`** is the list of folders the shell searches when you type a command name, **in order, and the first match wins**. "command not found" means the program is not installed, or not in a folder on your `PATH`.

:::ask You type `pytest` and the shell answers `command not found`. What does that tell you?
@options
the `pytest` program is broken on this machine
you typed the wrong password to run `pytest`
* `pytest` is not in any `PATH` folder
@why
The shell looks for the name in every folder of `PATH`, in order. "command not found" means none of them has it: not installed, or installed somewhere that is not on `PATH`. Activating a Python virtual environment (the lesson after next) works by putting its folder at the **front** of `PATH`.
:::

> **On your computer, now:** `echo $PATH` (the folders are separated by `:`), then `which python3` to see which folder won.

### Quiet bugs: encoding, line endings, permissions

**Text encoding and line endings** cause quiet bugs. Text files are bytes (a **byte** is the smallest piece a computer stores; one plain letter is one byte) interpreted through an encoding, the rule that says which byte means which character; use **UTF-8** everywhere and say so when opening files in code. Windows and Linux end lines differently (`\r\n` vs `\n`); a CSV created on Windows may leave an invisible `\r` at the end of the last column, which breaks comparisons that "look" identical.

**Permissions.** Files have read, write and execute permissions for owner, group and others. `ls -l` shows them as letters (`-rwxr-xr-x`: `r` is read, `w` is write, `x` is run; three groups of three, for the owner, the group and everyone else). `chmod +x script.sh` lets you run a script directly. You will mainly meet permissions as "Permission denied", which means the user running the command is not allowed that action on that file. You may also see people prefix commands with `sudo`, it runs a command as `root` (the system administrator, with unrestricted power to change or delete anything).

:::ask You get `Permission denied` running a script you just downloaded. What is the right first move?
@options
* inspect with `ls -l`, then `chmod +x` if safe
put `sudo` in front so it runs as root right away
delete the file and download a fresh copy
@why
`sudo` runs the command with full power and creates files only the administrator can later change: do not "fix" permission errors with it blindly. Read the permission flags first, then change only what is needed, on a file you trust.
:::

> 💡 **Practice Pause 2 (Paths & Environment Exploration):**
> Inspect your shell environment directly in your terminal:
> Type `cd ~/projects/DECourse` (or your course folder; if `data/orders.csv` is not there yet, run `python3 labs/shared/shopgen.py --out data` first).
> Type `echo $HOME` to see your home directory path.
> Type `echo $PATH` to see where your shell looks for executables.
> Type `which python3` to find the absolute path of your system's Python interpreter.
> Type `ls -l data/orders.csv` to view the file's permission flags.
> **You should see:** a path such as `/home/yourname` (on macOS `/Users/yourname`) for `$HOME`; a long list of folders separated by `:` for `$PATH`; a path such as `/usr/bin/python3` for `which python3`; and a line that starts with `-rw` (you may read and write the file) for `ls -l`.
> You now understand how the shell resolves paths and tools. Proceed to Lesson 3.

## @lesson Redirects and pipes: small tools, joined together
Why chain commands at all? Because a command that does **one** small job is easy to trust, and ten small jobs joined together can answer a question no single program was built for. This is the idea behind almost every data pipeline you will ever build.

### Two symbols do the connecting

The most powerful idea in the terminal is that commands do one small job, and you connect them.

- `|` (pipe) sends the output of one command into the next.
- `>` writes output to a file (replacing it), and `>>` appends to a file.

### Read a pipe from left to right

How many orders per status? Try this on the KopiKu order file you generated in Start here (`python3 labs/shared/shopgen.py --out data`):

```bash
cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn
```

The building blocks: `cut -d, -f4` splits each line on commas (`-d,`) and picks the 4th field (`-f4`), `tail -n +2` prints from line 2 onward (skipping the header), `sort` orders lines alphabetically (`-rn` sorts numerically in reverse), and `uniq -c` counts repeated lines.

Do not run it yet. First predict what each stage hands to the next, on a tiny file:

```
id,customer,total,status
1,7,150000,paid
2,3,90000,cancelled
3,7,25000,paid
```

:::ask What does `cut -d, -f4 orders.csv` print for that file?
@options
the whole file, including header and all columns
* the 4th column, including the header
only the numeric values, without the header
@why
`-d,` says the separator is a comma, and `-f4` picks the 4th field. The header's 4th field (`status`) comes out too, which is why the next stage skips the first line.
:::

:::ask Why must `sort` come BEFORE `uniq -c` in the pipe?
@options
`uniq` only works on sorted numbers, not text
* `uniq -c` only counts adjacent duplicates
it makes the output look prettier, nothing more
@why
`uniq -c` only compares a line with the one just before it. For `paid, cancelled, paid` it would count three groups of 1. After `sort` it sees `cancelled, paid, paid` and counts `1 cancelled` and `2 paid`.
:::

Every stage is a small step you already know from Python. Watch the same pipeline written as Python, one stage per line:

:::trace The pipe, stage by stage
@code
column = ["status", "paid", "cancelled", "paid"]
no_header = column[1:]
ordered = sorted(no_header)
counts = {}
for status in ordered:
    counts[status] = counts.get(status, 0) + 1
print(counts)
@notes
1 | `cut -d, -f4`: the 4th column, header included.
2 | `tail -n +2`: skip the first line (the header).
3 | `sort`: equal values end up next to each other.
6 | `uniq -c`: count each run of equal values. Watch the dictionary grow.
:::

Read it left to right: `cut` takes the 4th comma-separated column (the status), `tail -n +2` skips the header line, `sort` groups equal values together, `uniq -c` counts runs of equal values, and the last `sort -rn` puts the biggest count first. Five tiny tools replaced a program, and nothing was loaded into memory at once, so it works on a file far bigger than your RAM. Module 1.1 develops this skill in depth.

Notice the output also reveals messy real-world data: you will see `paid`, `PAID` and `Paid` counted as separate groups. The terminal is a good place to *look at data before you write code for it* — Module 0.2 shows where in a pipeline this cleaning belongs.

### Writing to a file

:::ask You run `sort orders.csv > orders.csv`. What happens to the data?
@options
the file is sorted in place, as you wanted
* the file is emptied before `sort` reads it
nothing happens: the shell refuses to run it
@why
`>` truncates the target file as the command starts. `sort` then reads an already-empty file. To sort a file into another file, write to a **different** name: `sort orders.csv > sorted.csv`. (Redirecting onto the file you read from destroys it.)
:::

Every program has three standard streams: input (`stdin`), output (`stdout`) and errors (`stderr`). Pipes carry `stdout`; error messages still appear on your screen. To save errors too, use `2>` (for example `python3 job.py > out.txt 2> errors.txt`). Separating them is why a pipeline can fail loudly even when its output is being piped away.

> 💡 **Practice Pause 3 (Piping KopiKu Data):**
> Prove the power of pipes directly in your terminal without writing a Python script:
> Run this pipeline from the course root:
> `cut -d, -f4 data/orders.csv | tail -n +2 | sort | uniq -c | sort -rn`
> **You should see:** `2080 delivered` first, then `555 shipped`, `367 paid`, `352 cancelled` and `168 refunded`, and further down the same words in other capital letters (`34 DELIVERED`, `34 Delivered`, and a few more). That mix of spellings is real messy data: the next modules teach you where to fix it.
> Notice how you aggregated thousands of KopiKu transaction rows into status counts in milliseconds! Proceed to Lesson 4 to isolate your Python environment.

## @part Python environments and Git

## @lesson Python: install it once, then isolate every project
Why does this matter on day one? Because the first time you install something globally and it breaks a tool your operating system needs, you lose an afternoon. A virtual environment is cheap insurance against that.

Check what you have: `python3 --version`. For this course use Python 3.10 or newer. On Linux and macOS, use the system's package manager or the official installer; on Windows, work inside WSL2 (the **Start here** page walks through installing it).

**Ubuntu, Debian and WSL2 users:** these systems ship Python without the venv tool. Install it once with `sudo apt install -y python3-venv python3-pip`; without it, the `python3 -m venv` line below stops with the message `ensurepip is not available` (measured on a fresh Ubuntu 24.04).

The central problem: Python packages are installed into one place, and different projects need different versions. Project A needs `pandas 1.5`, project B needs `pandas 2.2`. Install everything globally and one project eventually breaks the other, or breaks your operating system's own Python tools. The fix is a **virtual environment**: a private folder with its own Python and its own packages, per project.

Here is the whole idea in a few lines. The shell looks for a command in the folders of `PATH`, in order, and the **first match wins**. Activating a virtual environment puts its folder **in front**:

:::trace How activating a venv changes which program runs
@code
path = ["/usr/local/bin", "/usr/bin"]
folders = {
    "/usr/local/bin": [],
    "/usr/bin": ["python3", "git"],
    "/home/budi/kopiku/venv/bin": ["python3", "pytest"],
}

def which(command):
    for folder in path:
        if command in folders[folder]:
            return folder + "/" + command
    return None

print(which("python3"))
print(which("pytest"))
path.insert(0, "/home/budi/kopiku/venv/bin")
print(which("python3"))
print(which("pytest"))
@notes
14 | `python3` is found in `/usr/bin`: the first folder that has it wins.
15 | `pytest` is in no folder of `PATH`: the shell would say `command not found`.
16 | This is what `source venv/bin/activate` does: it puts the venv's folder first.
17 | The same name now finds the venv's own Python, the one with this project's packages.
18 | And `pytest`, installed only in the venv, is found too.
:::

:::ask Project A needs `pandas 1.5` and project B needs `pandas 2.2`. Both are installed into the one global Python. What happens?
@options
both versions work side by side without trouble
pip refuses to install and changes nothing
* installing one replaces the other: a project breaks
@why
A Python installation holds **one** version of each package. A virtual environment gives every project its own private folder of packages, so A and B stop fighting.
:::

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
3. **Commit `requirements.txt`, never the `venv/` folder.** (Git and committing are taught next in Lesson 5, for now, "commit" means saving a file into your project's version history.) The folder is large, specific to your machine, and recreated in one command: `python -m pip install -r requirements.txt`.

Newer tools (`uv`, `poetry`) do the same job faster and add lock files; the concept is identical, so learn it with `venv` first.

:::ask Which command installs `requests` into the Python you are using right now?
@options
`pip install requests`
* `python -m pip install requests`
`sudo pip install requests`
@why
`python -m pip` runs the pip that belongs to **this** Python, so the package lands where you will use it. A bare `pip` may belong to another Python, and `sudo pip` changes the system Python and can break your operating system's tools.
:::

:::ask Which of these should you commit to Git?
@options
the whole `venv/` folder
both of them
* `requirements.txt`
@why
`venv/` is large, specific to your machine, and recreated in one command from `requirements.txt` (`python -m pip install -r requirements.txt`). Commit the recipe, not the result.
:::

**Running scripts.** `python summarize.py data/orders.csv` runs a file; the words after the file name arrive in `sys.argv` and are parsed nicely by the standard-library `argparse` module. The idiom `if __name__ == "__main__":` at the bottom means "run this part only when the file is executed directly, not when it is imported", which you will use in every script that might later become a library.

**Reading a traceback.** When Python fails it prints a *stack trace*. Read it **from the bottom**: the last line names the error type and message (`FileNotFoundError: [Errno 2] No such file or directory: 'data/orders.csv'`); the lines above show which line of which file called which. The last frame in your own code is usually where to look. Copy the last line when you search for help or ask someone.

> 💡 **Practice Pause 4 (Build Workspace & Virtual Environment):**
> Time to build your own local workbench! Open your terminal and run:
> 1. Create your project folder: `mkdir -p ~/kopiku && cd ~/kopiku` (`&&` runs the second command only if the first succeeds)
> 2. Create an isolated virtual environment: `python3 -m venv venv`
> 3. Activate the environment: `source venv/bin/activate`
> 4. Verify: `which python` (ensure it points to `~/kopiku/venv/bin/python`).
> **You should see:** the prompt now starts with `(venv)`, and `which python` prints a path that ends in `kopiku/venv/bin/python`.
> Keep it activated! Proceed to Lesson 5 to set up Git.

## @lesson Git: a safety net for everything you write
Why Git before you have anything to lose? Because the day you overwrite a working script, you want a button that says "go back to yesterday".

Git records snapshots of your project so you can see what changed, go back to any earlier state, work on experiments without risk, and collaborate. Three areas explain nearly everything:

1. **Working tree**: the files as they are on disk right now.
2. **Staging area**: the changes you have *chosen* to include in the next snapshot.
3. **Repository history**: the permanent chain of snapshots, called **commits**.

**One-time setup (do this once per computer):** tell Git who you are so it knows who made each commit (otherwise `git commit` stops with `Author identity unknown`):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The basic loop (passing `-b main` to `git init` guarantees the first branch is always named `main`, even on older Git installs):

```bash
git init -b main                 # start tracking this folder on branch main (once)
git status                       # what changed? what is staged?
git add summarize.py             # stage a file for the next snapshot
git commit -m "Add script that counts orders by status"   # take the snapshot
git log --oneline                # list history
git diff                         # see unstaged changes line by line
```

Predict before you read the next part:

:::ask You edit `a.py` and `b.py`. You run `git add a.py` and then `git commit -m "fix"`. What is in the commit?
@options
* only `a.py`, because only it was staged
both `a.py` and `b.py`
nothing yet, until you also run `git push`
@why
A commit takes a snapshot of the **staging area**, and only `a.py` was staged. `b.py` stays a modified file in the working tree. This is why `git status` before every commit pays off.
:::

**Good commits** are small and have a message that says *what and why* ("Reject orders with non-positive totals"), not "update" or "fix". Commit when one thing works. Small commits make mistakes easy to find and undo.

**Undoing things safely** (learn these before you need them):

- Discard uncommitted edits to a file: `git restore file.py`
- Unstage a file: `git restore --staged file.py`
- Undo a commit by adding a new commit that reverses it: `git revert <commit>` (replace `<commit>` with the short commit hash shown by `git log --oneline`, e.g. `a1b2c3d`)
- Fix the last commit message (not yet shared): `git commit --amend`

:::ask You edited `summarize.py` and broke it. Nothing is committed yet. Which command throws the edits away and brings the last committed version back?
@options
`git revert`
`git commit --amend`
* `git restore summarize.py`
@why
`git restore file` discards uncommitted edits to a file. `git revert` undoes a **commit** by adding a new commit, and `git commit --amend` rewrites the last commit message. Careful: `git restore` cannot be undone, the edits are gone.
:::

**Branches** let you experiment without touching the main line: `git switch -c try-new-parser`, work and commit, then merge it (`git switch main && git merge try-new-parser`) or throw it away. **Remotes** such as GitHub hold a copy elsewhere: `git remote add origin <url>` and `git push -u origin main`. A pushed repository is a backup and a portfolio, but also something other people can read, which is why the next two points matter.

:::talk Is a commit a backup?
@teacher A learner finishes a lab, runs `git add` and `git commit`, and tells a friend: "my work is safe on GitHub now". Let us check that.
@ask After `git commit` (and nothing else), where does the snapshot live?
@choice On GitHub, because Git sends every commit automatically | Git never sends anything on its own. Sending is a separate command. Try again.
@choice * Only on your own computer, inside the repository's history | Right. A commit is a snapshot saved in the `.git` folder on your computer. GitHub only learns about it when you run `git push`.
@choice Nowhere yet: it is saved only when you press save in the editor | Saving in the editor writes the file. The commit is the snapshot Git took afterwards, and it already exists on your computer. Try again.
@teacher So: **commit** saves a snapshot on your computer, **push** copies it to a remote such as GitHub. If your laptop is lost before you push, the commit is lost with it.
:::

**`.gitignore`** lists files Git must not track: `venv/`, `.env`, `__pycache__/`, large data files such as `data/`. Note: ignoring a file only affects files not yet committed. If you committed `data/` earlier, add it to `.gitignore` *and* run `git rm -r --cached data` to stop tracking it (`--cached` removes it from Git only while keeping the local files on your disk).

> **Warning:** Git history is permanent by design. A file committed once lives in every clone and every old commit, even if you delete it in the next commit. This is why secrets must never be committed, even "temporarily".

:::ask You committed `.env` with a password, noticed, and deleted the file in your next commit. Is the password safe now?
@options
* no: it stays in the earlier commit
yes, the file is gone from the folder now
yes, because old commits cannot be read
@why
Deleting a file in a later commit only removes it from the latest snapshot. The old commit still contains it. Treat any committed secret as exposed: revoke and replace it first (next lesson).
:::


> 💡 **Practice Pause 5 (Initialize Git & Guard with .gitignore):**
> Still inside `~/kopiku` in your terminal (if you have never used Git on this computer, run the two `git config --global` lines above once first):
> 1. Initialize Git tracking on branch `main`: `git init -b main`
> 2. Create a `.gitignore` so venv and data are never tracked (`printf` prints text where `\n` means a new line):
> `printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore`
> 3. Make your first commit:
> `git add .gitignore && git commit -m "chore: initial commit with gitignore"`
> 4. Check your history: `git log --oneline` (you have your first commit!). Proceed to Lesson 6.

## @part Safe working habits

## @lesson Secrets and configuration
Why not just write the password in the code? Because code gets shared, copied and pushed, so a secret in code is a secret everywhere the code goes.

:::talk Who can read your code?
@teacher You are proud of your first project and push it to a public GitHub repository for your portfolio. In the code there is one line: `db_password = "kopiku123"`.
@ask Who can read that password?
@choice Only you, because it is your repository | A public repository can be read by anyone with the link, and by programs that scan GitHub all day. Try again.
@choice The people you invite, and nobody else | That is what a private repository does. This one is public. Try again.
@choice * Anyone, including bots that scan every public push within minutes | Yes. That is why a secret never belongs inside code: code gets shared, copied and pushed.
@teacher The habit: keep secrets outside the code, in environment variables or in a `.env` file that Git ignores, and keep your code free of anything you would not say out loud in a crowded room.
:::

A **secret** is anything that grants access: passwords, API keys, tokens, private keys, database connection strings with passwords. A **configuration** is a setting that differs between environments (the database host in development vs production). Both belong *outside* your code.

The beginner's version of the fix is environment variables:

```python
import os
db_password = os.environ["DB_PASSWORD"]      # fails loudly if missing: good
region = os.environ.get("REGION", "ap-southeast-1")   # with a harmless default
```

:::ask `os.environ["DB_PASSWORD"]` runs on a machine where `DB_PASSWORD` was never set. What happens?
@options
it returns an empty string and carries on quietly
* it stops with a `KeyError`: loud and early
it returns the password of another program
@why
Failing immediately and clearly beats running half-configured. `os.environ.get("REGION", "ap-southeast-1")` is the version for **harmless** settings that have a safe default; never give a secret a default.
:::

For local work, put variables in a file named `.env` that is listed in `.gitignore`, and load it with your shell (`set -a; source .env; set +a`: `set -a` auto-exports every variable defined while `source .env` reads the file, and `set +a` turns auto-export back off) or a library such as `python-dotenv`. In production the platform injects them from a secrets manager. Commit a `.env.example` with fake values so teammates know which variables exist.

### Why a variable "disappears"

An environment variable belongs to the **terminal window** where you set it, and to the programs you start from that window. `export DB_PASSWORD=secret` in one terminal does nothing in a second terminal, and closing the window forgets it. This is why teams keep variables in a `.env` file, and why the course asks you to repeat the setup lines (and any `export`) in every new terminal.

:::ask You run `export DB_PASSWORD=secret` in terminal 1, then open terminal 2 and run `python3 job.py`, which reads `os.environ["DB_PASSWORD"]`. What happens?
@options
it works, because the whole computer now knows the password
* it stops with a `KeyError`: the variable belongs to terminal 1 only
it asks you to type the password in terminal 2
@why
An exported variable lives in that one terminal window and in the programs started from it. A new window starts without it. Put the line in a `.env` file you load again, or repeat the `export`.
:::

### Settings files: YAML in two minutes

Many tools you will meet (Docker Compose, dbt, Airflow, GitHub Actions) read their settings from **YAML** files. YAML is plain text with a few rules:

```yaml
database:
  host: localhost
  port: 5432
tags:
  - kopiku
  - daily
```

- `name: value` is one setting. A dash `-` starts one item of a list.
- **Indentation shows what belongs inside what.** `host` and `port` are indented under `database`, so they are *inside* it. Use spaces, never tabs, and the same number of spaces for settings at the same level.
- Most YAML errors are one space too many or too few. If a tool says "mapping values are not allowed here", look at the indentation first.

:::ask In this file, is `port` inside `database`?
```yaml
database:
  host: localhost
port: 5432
```
@options
yes, because it comes right after `host`
yes, because both values are written the same way
* no: it is not indented, so it is a top-level key
@why
Only indentation decides. `host` is pushed in under `database`, but `port` starts at the left edge again, so it belongs to the top level. To put it inside, indent it by the same two spaces as `host`.
:::

Predict the order of the emergency steps:

:::ask An API key was pushed to a public repository. What is the FIRST thing to do?
@options
* revoke the key at its provider and create a new one
delete the file in a new commit
wait to see whether anyone uses it
@why
Bots scan public repositories within minutes, so assume the key is already copied. Revoke and replace it first. Cleaning the history and adding `.gitignore` come after, and deleting the file alone is not a fix.
:::

If a secret does get committed or pushed: **assume it is stolen**, because bots scan public repositories within minutes. The fix order matters: (1) **revoke and replace the secret** at its provider, (2) then clean the repository history if you must, (3) then add the file to `.gitignore` and enable secret scanning. Deleting the file in a later commit is *not* a fix.

> 💡 **Practice Pause 6 (Protect Secrets):**
> Guard your credentials before any leak can happen!
> Inside `~/kopiku`, add `.env` to your `.gitignore` (if not already added).
> Create a safe public template: `echo "DATABASE_URL=sqlite:///data/warehouse.db" > .env.example`
> Commit the changes:
> `git add .env.example && git commit -m "chore: add env template"`
> Your repository is now protected against leaked secrets. Proceed to Lesson 7.

## @lesson Working habits that make you faster
Why spend a lesson on habits? Because the difference between two beginners with the same skills is usually how fast each of them gets unstuck.

A few small disciplines separate people who ship from people who struggle with their tools.

- **One project, one folder, one repository, one environment.** For this course: `~/kopiku/` containing `venv/`, `data/`, your scripts, `requirements.txt`, `.gitignore` and a short `README.md` that says how to run things.
- **Keep data out of Git, and make it reproducible.** Data is big and changes; the *recipe* that produces it (the generator command) belongs in the README. This is the habit of reproducibility, and employers notice it.
- **Make errors easy to help with.** When you ask for help, give the exact command you ran, the full error text (as text, not a screenshot), what you expected, what Python version and OS you use, and what you already tried. People answer well-formed questions in minutes and ignore vague ones.
- **Read before you paste.** Understand every command you copy. Prefer official documentation for installation steps; tutorials age quickly.
- **Use an editor that helps.** Visual Studio Code with the Python extension gives syntax highlighting, an integrated terminal and a debugger. The terminal skills in this module work the same inside it.

Which help request gets answered fast?

:::ask Pick the best way to ask for help with a failing script.
@options
a screenshot and the words "it does not work"
* the exact command, the full error text, your OS, what you tried
"please help, it is urgent" with no details
@why
People answer well-formed questions in minutes: they can reproduce the problem and see the error. A screenshot cannot be searched or copied, and a vague question cannot be answered.
:::

Finally, **practise the loop** until it is automatic: make a small change, run it, look at the result, commit. Everything later in the course (tests, containers, orchestrators) is that same loop with better tools.

**Reading `summarize.py` before you edit it.** The starter imports two standard-library helpers already wired up for you:
- **`argparse`**: reads the filename you type after `python3 summarize.py` (for example `data/orders.csv`) and puts it in `args.path`.
- **`collections.Counter`**: a dictionary built specifically for counting — writing `counts[status] += 1` starts at `0` automatically without needing `counts.get(status, 0)`.

> 💡 **Practice Pause 7 (Complete summarize.py & Verify Workspace):**
> Prove that your entire workbench functions as intended:
> 1. Make sure you are in `~/kopiku` with its virtual environment active: `cd ~/kopiku && source venv/bin/activate`
> 2. Tell the shell where you cloned the course (change the path to YOUR folder): `export COURSE=~/projects/DECourse` (the folder from Start here, step 3; `export` lasts only in this terminal window)
> 3. Copy the generator and generate data: `cp $COURSE/labs/shared/shopgen.py . && python3 shopgen.py --out data`
> 4. Copy the starter script: `cp $COURSE/labs/mod-0-1/starter/summarize.py .`
> 5. Open `summarize.py` in your editor and implement it: count each `order_id` once (deduplicate repeated rows), normalize statuses to trimmed lower-case, and print one sorted line per status in the format `"<status> <count>"`.
> 6. Commit script and generator, then freeze requirements: `git add shopgen.py summarize.py && git commit -m "feat: count orders by status"` and `python -m pip freeze > requirements.txt && git add requirements.txt && git commit -m "chore: freeze requirements"`
> 7. Run the automated checker from the course repo: `python3 $COURSE/labs/mod-0-1/check.py ~/kopiku`
> When all 16 checks PASS, congratulations! You have a verified professional data engineering environment (in the Lab below, skip Steps 1–5 and jump straight to Steps 6–7).

## @lab Lab: build your KopiKu workspace
Create the project folder that you will use for the rest of the course, and prove it is set up correctly with an automatic checker. Your workspace needs an isolated environment, a Git history with sensible commits, a `.gitignore` that protects you, and a small script that counts orders by status.

### @steps
> **Already followed Practice Pauses 4–7 in `~/kopiku`?** **Skip Steps 1–5**: do **not** re-run `cp $COURSE/labs/mod-0-1/starter/summarize.py .` or it will overwrite your finished script! Jump straight to **Step 6** (`check.py`) and **Step 7** (course venv + `prove.py`).

1. Create the folder and move into it:

```bash
mkdir -p ~/kopiku && cd ~/kopiku
```

2. Create and activate a virtual environment, and make your first commit with a `.gitignore` that excludes `venv/`, `.env`, `data/` and `__pycache__/` (if this is your first time using Git on this computer, run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"` once first so `git commit` does not stop with `Author identity unknown`):

```bash
python3 -m venv venv
source venv/bin/activate            # Windows PowerShell: venv\Scripts\Activate.ps1
git init -b main
printf 'venv/\n.env\ndata/\n__pycache__/\n' > .gitignore   # printf writes text (\n = newline)
git add .gitignore
git commit -m "Start project with a .gitignore"
```

3. Tell the shell where the course is (the folder from Start here, step 3; change it if you cloned elsewhere, and repeat this line in every new terminal), copy the data generator into your project, and generate the data:

```bash
export COURSE=~/projects/DECourse
cp $COURSE/labs/shared/shopgen.py .
python3 shopgen.py --out data
```

4. Copy the starter script into your project with `cp $COURSE/labs/mod-0-1/starter/summarize.py .` (**do not run this `cp` if you already finished `summarize.py` in Practice Pause 7**, or it will overwrite your code), open it in your editor and implement it. It must count each `order_id` once and group by lower-case status. Try it, and compare with the terminal one-liner from the lessons (remember the one-liner double-counts duplicates, so the numbers will differ slightly: that is the point):

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
python3 $COURSE/labs/mod-0-1/check.py ~/kopiku
```

7. **Get ready for Module 0.2 and prove your workspace.** First leave `~/kopiku`'s venv with `deactivate`, then create the shared course virtual environment once inside your course folder (`$COURSE`), install `pytest` (Module 0.2 uses it right next; if you tried `Lab 0.0` only in the browser preview earlier, run `pytest labs/mod-0-0/test_lab.py -v` here too), and generate your Module 0.1 proof code:

```bash
deactivate                              # leave ~/kopiku's venv (skip if not active)
export COURSE=~/projects/DECourse       # change if you cloned elsewhere
cd "$COURSE"
python3 -m venv venv && source venv/bin/activate
python -m pip install pytest
python3 scripts/prove.py mod-0-1 ~/kopiku
```

The last command prints a proof code. Paste it into the **Proof** box on the Module 0.1 lab page.

This second venv belongs to the **course folder** (`$COURSE`, e.g. `~/projects/DECourse`, from Start here, step 3), not to `~/kopiku`: one venv per project is the normal habit. It is the one you use for every later module. Create it once; at the start of each study session run `cd ~/projects/DECourse` (your `$COURSE` folder) and `source venv/bin/activate`, and check that the prompt starts with `(venv)`.

### @files
- labs/mod-0-1/starter/summarize.py :: Starter for your script: fill in the counting logic :: starter
- labs/mod-0-1/check.py :: Checker that inspects your workspace :: test
- labs/mod-0-1/reference/summarize.py :: One possible solution (try first!) :: reference
- labs/mod-0-1/reference/make_workspace.sh :: Builds the finished workspace automatically :: reference

### @deliverables
- `python3 labs/mod-0-1/check.py ~/kopiku` prints PASS for all 16 checks
- Your Git history has at least three commits with unique, meaningful messages, and `venv/`, `data/` and `.env` are not tracked by Git
- `python3 scripts/prove.py mod-0-1 ~/kopiku` prints a valid proof code
- `pytest` is installed in the course folder's `venv`, ready for Module 0.2

### @verify
The checker is the verification. Run it from your course folder (`cd "$COURSE"`, e.g. `~/projects/DECourse`):

```bash
python3 labs/mod-0-1/check.py ~/kopiku
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

> `.gitignore` applies only to files Git is not already tracking. Already-committed files continue to be tracked until you remove them from the staging area (and they remain in old commits).

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
