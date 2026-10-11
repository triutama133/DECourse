---
title: Python from Zero: What Every Line Means and Why It Exists
duration: 2-3 weeks
summary: Learn Python the way a data engineer uses it: values and types, lists and dictionaries, if, for, def, errors and files. For every idea you see what it does, why it exists, and exactly what the computer does step by step, then you prove it with eleven small functions on real-looking order data.
why: Many courses show you def and for for ten minutes and rush on. You copy the code, it works, and you still cannot explain it. Data engineering is writing these small ideas thousands of times, so unclear basics turn into bugs that cost money.
---

## @outcomes
- Explain what a variable, a type, a list, a dictionary and a set are, and choose the right one for a piece of data
- Trace a small program line by line and predict its output without running it
- Write if/elif/else decisions and for/while loops, and say why a loop or a decision is needed
- Write functions with def, parameters, return and default values, and explain the difference between print and return
- Read an error message from the bottom, and use try/except without hiding real problems
- Read a CSV file with `with open` and the csv module, and explain what `import` and `if __name__ == "__main__"` do

## @prereq
None. You do not need to have written code before, and it does not matter if earlier courses left you confused. You only need a way to run Python: the browser preview in the lab works first; Module 0.2 then teaches the proper setup on your own computer.

## @lesson How a program runs: values, variables and types
A program is a list of instructions that the computer follows **from the top to the bottom, one line at a time**. Nothing is skipped and nothing happens "in the background" unless you ask for it. This is the single most useful mental model in programming: when you are lost, put your finger on the first line and walk down.

To do any work the computer must remember things. It remembers a **value** (a piece of data such as `150000` or `"paid"`) and gives it a **name** so you can use it again. That named value is a **variable**:

```python
total = 150000
status = "paid"
print(total)        # shows 150000
```

Read `total = 150000` as "**let the name `total` point at the value 150000**". The `=` sign is not the equals of mathematics; it is an *assignment*: do the right side first, then attach the name on the left to the result. That is why `total = total + 1000` makes sense in Python (take the old value, add 1000, attach the name to the new value) but is nonsense in maths.

Every value has a **type**, which tells Python what you are allowed to do with it. The five you will use daily:

| Type | Example | Meaning |
|---|---|---|
| `int` | `150000` | a whole number |
| `float` | `3.5` | a number with decimals |
| `str` | `"paid"` | text, always inside quotes |
| `bool` | `True`, `False` | yes or no |
| `None` | `None` | "there is no value" |

**Why types matter, with a real data engineering problem.** A CSV file contains only text. The total `150000` arrives as the *text* `"150000"`, and `"150000" + 1` fails because Python will not guess whether you mean text joining or arithmetic. You convert on purpose: `int("150000") + 1` gives `150001`. Text such as `"Rp 1.250.000"` cannot be converted at all (Python raises an error), which is exactly how dirty data shows up in real pipelines. Check a type with `type(total)`.

Two traps to learn now. First, money must be an `int` in the smallest unit, because decimals are stored in binary and cannot always be exact: `0.1 + 0.2` is `0.30000000000000004`. Second, build text with an **f-string**: `f"Order {1001}: Rp {total}"` puts the values inside the text, and it is easier to read than gluing pieces with `+`.

Trace this by hand before you run it: `a = 2`, `b = a * 3`, `a = 10`, `print(b)`. It prints `6`, not `30`. `b` got the value 6 at the moment of the assignment; changing `a` later does not change `b`. If you predicted 30, you just learned something important.

## @lesson Collections: one value is never enough
One order has several facts, and a file has thousands of orders. Python gives you four containers. Knowing **why each exists** tells you which to choose.

**List** (`[...]`): an ordered row of things, where position matters and duplicates are allowed. `orders = [row1, row2, row3]`. You read by position starting at **0**: `orders[0]` is the first, `orders[-1]` is the last, `orders[1:3]` is a *slice* (positions 1 and 2). `len(orders)` counts, `orders.append(x)` adds at the end. Use a list for "all the rows of the file".

**Dictionary** (`{...}`): look things up by a *name* instead of a position. One order is a dict: 

```python
order = {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"}
print(order["status"])         # paid
print(order.get("note"))       # None: .get gives None instead of an error when the key is missing
order["status"] = "shipped"    # change a value
```

Reading a missing key with `order["note"]` raises `KeyError`; `.get("note", "")` gives a default instead. A dict is also the tool for **counting**: `counts[status] = counts.get(status, 0) + 1`. Remember this line; you will write it many times.

**Tuple** (`(...)`): a small fixed group that should not change, such as `("paid", 3)`. Functions often return a tuple to give back two things at once.

**Set** (`{...}` with no keys): a bag of **unique** values with no order. `set([7, 3, 7, 5])` is `{3, 5, 7}`. Use it to remove duplicates, and to ask "have I seen this before?" very quickly with `x in seen`.

A real data file is therefore usually **a list of dictionaries**: the list is the file, each dict is a row, the keys are the column names. The lab's `orders` looks exactly like this.

One idea to meet early: **mutable versus immutable**. Lists, dicts and sets can be changed in place; strings, numbers and tuples cannot. When two names point at the same list, a change through one name is visible through the other. That is the root of the most famous Python bug, which the chaos scenario of this module shows.

## @lesson Decisions: if, elif, else
A decision is how a program chooses between paths. In data engineering almost all **validation** is decisions: is this total a number? is the status one we know?

```python
status = "refunded"
if status == "paid":
    print("count the revenue")
elif status == "cancelled" or status == "refunded":
    print("no revenue")
else:
    print("unknown status: send it to quarantine")
```

How it runs: Python checks the conditions from the top, runs the block of the **first** one that is true, then skips all the others. The block is whatever is **indented** under the colon; in Python the indentation is the structure (usually four spaces), so a wrong indent is a wrong program.

The condition is an expression that gives `True` or `False`. Comparisons: `==` equal (two signs; one `=` is assignment!), `!=`, `<`, `>`, `<=`, `>=`, and `in` for membership (`status in {"cancelled", "refunded"}`). Combine with `and`, `or`, `not`.

**Truthiness** saves typing: `0`, `""`, `None`, `[]`, `{}` count as false in an `if`, everything else as true. So `if not rows:` means "if there are no rows". Be careful, though: `if total:` is also false for a total of `0`, which may be a perfectly valid value. When zero is legal, write `if total is not None:`.

**Why decisions are everywhere in pipelines.** The rule of Module 0.1 is "never guess and never drop silently". In code that rule is an `if` with two branches: a valid row continues, an invalid row is put aside *with a reason*. An `else` that does nothing is how data disappears without a trace.

Division by zero is a decision problem too: the average of an empty list is not 0, it does not exist. `if not values: return None` handles it before the error can happen. Prefer to check the dangerous case first and leave early.

## @lesson Repetition: for, while and comprehensions
A file has 100,000 rows. You cannot write 100,000 lines, so you write the instruction **once** and let the computer repeat it. That is a loop, and it is the engine of every data pipeline.

```python
total = 0
for order in orders:            # take the rows one by one: each time, `order` points at the next row
    total = total + int(order["total_idr"])
print(total)
```

Trace it with three rows (150000, 80000, 120000). Before the loop `total` is 0. Round 1: `order` is row 1, so `total` becomes 150000. Round 2: 230000. Round 3: 350000. The loop ends because the rows ran out, and the print shows 350000. This **accumulator pattern** (start with a neutral value, update it every round) is behind sums, counts, maximums and almost every aggregation you will write.

Useful tools, each solving a specific annoyance:

- `range(5)` gives 0, 1, 2, 3, 4 (not 5!). `range(0, 100, 10)` steps by ten. Use it when you need positions or a number of repeats.
- `enumerate(rows)` gives the position *and* the item: `for i, row in enumerate(rows):`. Better than keeping your own counter.
- `zip(a, b)` walks two lists together.
- `continue` skips to the next round (a cancelled order: nothing to add). `break` leaves the loop entirely.

A **comprehension** is a loop written as one expression: `ids = [int(o["customer_id"]) for o in orders]` builds a list; `{int(o["customer_id"]) for o in orders}` builds a set; `{k: v for ...}` a dict. It is the same loop in short form. Use it when it fits on one clear line; when you need `if/else` branches or several steps, write the normal loop. Readable beats clever.

A `while` loop repeats **as long as a condition is true**: `while attempts < 3:`. Use it when you do not know how many rounds you need (retrying, reading until the end). The danger: if nothing in the loop ever makes the condition false, it runs forever. Always ask: "what changes inside the loop so that it ends?"

## @lesson Functions: def, parameters and return
Look at the loop that sums totals. If you need the same sum in five places, you do not copy five loops. You give the loop a **name** and reuse it. That is a function, and it exists for three reasons: **reuse** (write once), **clarity** (a good name explains the purpose, so `total_revenue(orders)` is read like a sentence), and **testing** (a small function with one input and one output can be checked automatically, which is how the lab works).

```python
def total_revenue(orders):             # def = "define": here we only describe it; nothing runs yet
    total = 0
    for order in orders:
        total = total + int(order["total_idr"])
    return total                       # return = hand the answer back and leave the function

result = total_revenue(my_orders)      # calling the function: now the body runs
```

The parts: `def`, the **name**, the **parameters** in brackets (the inputs; `orders` is a placeholder name), a colon, then the indented **body**. When you *call* it, the value you pass (the **argument**) is attached to the parameter name for the duration of the call.

**return versus print**, the confusion that hurts most beginners. `print` only *shows* something on the screen; the program cannot use it afterwards. `return` *hands a value back* to the code that called the function so that it can store it, compare it or pass it on. A function that prints but does not return gives `None` to the caller. Pipelines run without a screen, so functions must **return** their results.

**Default values**: `def safe_int(text, default=None):` means the caller may leave `default` out. **Scope**: names created inside a function exist only while it runs; the outside world cannot see them, and that is a feature (a function cannot accidentally break your other variables).

**A trap to meet now.** Never use a *mutable* value (a list or dict) as a default: `def add(order, batch=[]):`. Python creates that list **once**, when the `def` line is read, and every call that omits `batch` shares it. The second call sees what the first one added. Use `batch=None` and create a new list inside. The chaos scenario shows what this does to a real pipeline, and the lab has a test for it.

Prefer functions that depend only on their inputs and return a result without changing anything else (**pure functions**). They are easy to test and safe to run twice, which is the property pipelines need (Module 0.1: idempotence).

## @lesson When things go wrong: errors and try/except
Errors are not failures of the learner; they are the program telling you precisely what it could not do. Learn to read them. A **traceback** lists the path of calls; **read it from the bottom**. The last line names the error type and a message (`ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`); the lines above it show where it happened, and the last line that points into *your* code is usually the place to look.

The errors you will meet constantly: `ValueError` (right type, impossible value: `int("abc")`), `TypeError` (wrong type: `"a" + 1`), `KeyError` (dict key missing), `IndexError` (list position too big), `ZeroDivisionError`, `FileNotFoundError`, `NameError` (a typo in a name), `IndentationError`.

You can **catch** an error you expect and decide what to do:

```python
def safe_int(text, default=None):
    try:
        return int(text)
    except ValueError:       # only this kind of error
        return default
```

How it runs: Python tries the block under `try`. If everything works, the `except` is skipped. If a `ValueError` happens, the rest of the `try` is abandoned and the `except` block runs instead.

Three rules that separate good pipelines from dangerous ones:

1. **Catch the specific error you expect.** `except ValueError` is a plan. `except Exception: pass` (or a bare `except:`) is a decision to hide every future bug: a typo, a missing file, a real data problem all vanish silently, and wrong numbers appear with no sign of trouble. Module 1.2 shows how expensive that is.
2. **Keep the `try` block small**: only the line that can fail.
3. **Raise on purpose** when your function cannot do its job: `raise ValueError("total must not be negative")`. Failing loudly early is better than passing bad data on.

A bad row from a customer is *expected* data, so you handle it (put it aside with a reason). A missing file or a programming mistake is *not* expected, so let it fail loudly.

## @lesson Files, imports and running a script
Programs read files. The standard pattern:

```python
import csv

with open("orders.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
```

Why each part. `open` gives you a connection to the file. **`with`** guarantees the file is closed when the block ends, even if an error happens inside, so you never leak open files (a real problem in long-running jobs). `encoding="utf-8"` says how bytes become text; leaving it out means your program behaves differently on different computers. `newline=""` is what the csv module wants so that line breaks inside quoted values survive. `csv.DictReader(f)` turns each row into a dict using the header line as keys, so you get exactly the list of dictionaries of lesson 2. All values are strings; converting them is your job.

An **import** brings in code written by someone else. The **standard library** ships with Python and needs no installation: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Other libraries (pandas, pydantic) are installed with `pip` into your virtual environment (Module 0.2). Your own file `basics.py` is a **module** too: `import basics` runs it once and gives you its functions as `basics.total_revenue(...)`. That is how the lab tests use your code.

You run a script with `python3 myfile.py`. A common line at the bottom of scripts is:

```python
if __name__ == "__main__":
    main()
```

Python sets the special name `__name__` to `"__main__"` only when the file is *run directly*. When another file imports it, `__name__` is the module's name instead, so `main()` does not run. The effect: the file works both as a program and as a library you can test.

Paths: use `pathlib.Path("data") / "orders.csv"` instead of gluing strings, and remember that a relative path is relative to the folder you started Python in, which is the usual reason for `FileNotFoundError`.

## @lesson Putting it together, and how to debug
You now have every piece of a tiny pipeline: read the file (lesson 7), loop over the rows (4), decide what is valid (3), set the bad ones aside (6), count with a dict (2), wrap each step in a function (5). Here it is as a plan you can read like a story:

```python
def main(path):
    rows = read_orders(path)                 # file -> list of dicts
    valid, invalid = split_valid(rows)       # decisions + try/except, nothing dropped silently
    print(count_by_status(valid))            # dict counting
    print(format_rupiah(total_revenue(valid)))
```

Notice what happened: `main` contains no details. Each function has one job and a name that says it. This is how professional pipelines stay readable.

**How to read code you did not write.** Start at the bottom (usually the entry point), then read each function's name and parameters before its body. Pick a tiny input and **trace** it by hand, writing the value of each variable on paper after each line. If your prediction and the output differ, you found the line you misunderstood. The free tool pythontutor.com shows this execution step by step.

**How to debug.** (1) Read the error from the bottom. (2) Reproduce it with the smallest input. (3) Print or inspect the value *just before* the failing line (`print(type(x), x)` answers half of all bugs). (4) Change one thing at a time. (5) Write a **test** that fails because of the bug, fix the code, and keep the test so the bug never returns.

**Tests**, a first look. A test is just code that calls your function and compares with the expected answer:

```python
def test_format_rupiah():
    assert format_rupiah(1250000) == "Rp 1.250.000"
```

`assert` raises an error if the condition is false. A test tool (pytest) finds the functions named `test_...`, runs them all and reports which failed and why. The lab has 31 such tests: read a failing test as a **specification** (it tells you exactly what is expected), not as an obstacle.

You will not remember everything after one reading, and you are not supposed to. Type the examples, break them on purpose, and look at the error messages. Each lab function below practises one lesson; do them in order and run the tests after each.

## @lab Lab: eleven small functions on KopiKu orders
Write eleven short functions, each practising one idea from the lessons: formatting numbers, converting text safely, looping and summing, counting with dictionaries, removing duplicates with a set, splitting valid from invalid, averaging without dividing by zero, ranking, cutting a list into batches, avoiding the mutable default trap, and reading a CSV file. The tests (31) tell you what each function must do.

### @steps
1. Open `labs/mod-0-0/basics.py` and read it from top to bottom first. Every function has a docstring with examples; the lesson numbers tell you where the idea is explained.
2. Work in this order, and run the tests after EACH function: `format_rupiah`, `safe_int`, `total_revenue`, `count_by_status`, `unique_customer_ids`, `split_valid`, `average_total`, `top_customers`, `batches`, `add_to_batch`, `read_orders`.

```bash
pytest labs/mod-0-0/test_lab.py -v                    # all of them
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt     # only one group while you work
```

3. When a test fails, read it like a specification: the test name says what you broke, the last lines show the expected and the actual value. Print the values inside your function (`print(type(x), x)`) if you are unsure what you are working with.
4. Before you run, **predict**: write down which tests you expect to pass. When the result surprises you, find out why. That surprise is where the learning is.
5. **Do it for real.** The in-browser box above is only a preview. After Module 0.2, repeat this lab on your own computer in your own venv, writing the code again **without copying**, and run `python3 scripts/prove.py mod-0-0` to get the proof code for the **Proof** box on this lab page.

### @files
- labs/mod-0-0/basics.py :: Your working file: implement the eleven TODO functions :: starter
- labs/mod-0-0/test_lab.py :: The 31 tests that check your work :: test
- labs/mod-0-0/requirements.txt :: pytest :: config
- labs/mod-0-0/reference/basics.py :: One possible solution (try first!) :: reference

### @deliverables
- All 31 tests in test_lab.py pass **on your own computer, run from your own terminal** (a pass in the browser preview does not count)
- You can explain in your own words the difference between `print` and `return`, and between a list, a dict and a set
- You can explain why `batch=[]` as a default argument is a bug and what to write instead

### @verify
Run the tests from the repository root:

```bash
pytest labs/mod-0-0/test_lab.py -v
python3 scripts/prove.py mod-0-0
```

Known-good run: prefix the first command with `LAB_DIR=reference`.

## @chaos The batch that remembered yesterday
### @scenario
A small team writes an hourly job that groups incoming orders into batches before loading them. The helper function is one line: `def add_to_batch(order, batch=[]): batch.append(order); return batch`. In tests it works: call it with an order and you get a list containing that order.

In production the job runs inside a long-lived worker process. After the second hour, the dashboard shows orders from the first hour again; after a day, the same orders appear 24 times and revenue is 24 times too high. Restarting the worker fixes it for an hour. Nobody can reproduce the problem with a single test, which makes people suspect the database, then the network.

### @cause
In Python the default value of a parameter is created **once**, when the `def` line is executed, not every time the function is called. `batch=[]` is therefore one single list that lives as long as the process. Every call that does not pass its own list appends to that same list, so it remembers everything from earlier calls. A fresh process (as in a unit test, or right after a restart) hides the bug because the list is empty again.

The deeper cause is hidden state: the function's result depended on something that was not an input, namely what earlier calls had done. A function that returns different answers for the same input cannot be tested simply and is not safe to run twice.

### @fix
1. Use `None` as the default and create the list inside the function: `if batch is None: batch = []`. Better still, return a **new** list (`return batch + [order]`) instead of changing the one that was passed in.
2. Add a test that calls the function twice and asserts that the second call does not contain the first call's order. The lab has exactly this test (`test_never_remembers_previous_calls`).
3. Search the code base for other mutable defaults (`=[]`, `={}`, `=set()`): linters such as ruff flag them automatically (rule B006). Make that check part of the build.
4. Prefer functions whose output depends only on their inputs. Where state is really needed, keep it explicit (a parameter or an object), never in a default value.

### @pattern
A default value is created once. A function must give the same result for the same input; hidden state turns a pipeline into one that works in tests and fails in production.

## @quiz
### What does the line `total = total + 1000` do in Python?
- [ ] It shows an error, because a value cannot be equal to itself plus another number
- [ ] It adds 1000 to every variable in the whole program that currently has the name total
- [x] It takes total's current value, adds 1000 and attaches the name total to the result
- [ ] It tests whether total equals total plus 1000 and then stores True or False in total

> `=` is assignment: the right side is calculated first, then the name on the left points at the result. It is not the equals sign of mathematics.

### A CSV file gives you the text `"150000"` as the total of an order. What do you need before you can add 1000 to it?
- [ ] Nothing, because Python converts text that looks like a number automatically for every operator
- [ ] Put the text in square brackets so that it becomes a list that Python can add to
- [ ] Remove the quotation marks from the file itself, since Python cannot read text values
- [x] Convert it with int(...), because the file holds only text and `"150000" + 1000` is an error

> Everything read from a CSV is a string. You convert explicitly, and a text such as "Rp 1.250.000" cannot be converted, which is how dirty data shows up.

### Which container is the best choice to remember which customer ids you have already seen, so you can quickly ask "have I seen this one?"
- [ ] A list, because a list keeps every id in the order it was found and allows repeated ids
- [ ] A tuple, since a tuple is fixed and therefore cannot ever contain the same id twice
- [x] A set, because it stores each value once and answers `x in seen` very quickly on large data
- [ ] A dictionary with the id as value, because a dict is the only container that can hold numbers

> A set holds unique values and is built for membership tests. A list would also work but is slower on large data and keeps duplicates.

### What is printed by this code?  `a = 2`  `b = a * 3`  `a = 10`  `print(b)`
- [ ] 30, because b always follows the current value of a, whatever happens later
- [x] 6, because b got the value 6 when it was assigned; changing a later does not touch it
- [ ] 10, because the last assignment in the program overrides every earlier one before printing
- [ ] An error, since a name cannot be assigned twice in the same program

> Names point at values. `b = a * 3` calculates 6 at that moment. Changing `a` later does not recalculate `b`.

### What is the difference between print and return in a function?
- [ ] There is none: both show the result on the screen, and return only stops the function earlier
- [x] print only shows something on screen, while return hands a value back to the code that called it
- [ ] return shows the value on the screen and saves it in a file, whereas print only keeps it in memory
- [ ] print can be used only inside loops, and return only in functions that have no parameters

> A pipeline runs without a screen. Only a returned value can be stored, compared or passed to the next step. A function that only prints gives None to its caller.

### Why is `except Exception: pass` dangerous in a data pipeline?
- [x] It hides every future error, so wrong or missing data goes on silently with no sign of trouble
- [ ] It makes the program slower, because Python has to build an exception object for every single row
- [ ] It is not allowed by Python, so the program stops with a syntax error as soon as it is started
- [ ] It deletes the rows that caused the error from the input file, which cannot be undone

> Catch the specific error you expect (`except ValueError`) and decide what to do with the row. Swallowing everything turns typos, missing files and bad data into silent wrong results.

### What happens with `def add(order, batch=[]): batch.append(order); return batch` when you call `add("a")` and then `add("b")`?
- [ ] The second call returns ["b"], since every call starts with a brand new empty list
- [ ] Python reports an error on the second call because the default list was already used once
- [ ] Each call changes a copy, so the results ["a"] and ["b"] never influence each other
- [x] The second call returns "a", "b", because the default list is created once and shared

> A default value is created when `def` runs, not at each call. Use `batch=None` and create the list inside the function.

### What does `if __name__ == "__main__":` at the bottom of a script achieve?
- [ ] It makes the script run faster by skipping every function that is not called directly
- [x] The code under it runs when you start the file directly, but not when it is imported
- [ ] It checks that the script was written by the main developer of the project
- [ ] It makes Python read the file twice so that all names are defined before they are used

> `__name__` is `"__main__"` only for the file you run. Importing the file (for example from a test) does not trigger `main()`, so the file works as a program and as a library.

## @resources
- [The Python Tutorial (official)](https://docs.python.org/3/tutorial/)
- [Python Tutor: see your code run step by step](https://pythontutor.com/)
- [Think Python, 3rd edition (free book)](https://allendowney.github.io/ThinkPython/)
- [Python docs: the csv module](https://docs.python.org/3/library/csv.html)
- [Python docs: errors and exceptions](https://docs.python.org/3/tutorial/errors.html)
