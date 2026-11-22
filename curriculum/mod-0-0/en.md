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

> [!IMPORTANT]
> **How to Work on Labs (Beginner Guide):**
> - **Start simple, then the lab:** Lessons 1 to 4 each end with a **Practice Pause** done the simple way: a few plain lines of Python, typed at the `>>>` prompt or in a practice file, with no functions yet. Lesson 5 teaches functions (`def`); from there the pauses send you to the lab, where you turn the code you already wrote into its functions. Do not read the whole chapter first; go back and forth between a lesson and its pause.
> - **The lab, from Lesson 5:** in the **Browser preview** on the Lab tab, or in your own terminal if you did Start here (the lab page shows the four setup commands, once). The lab's code lives in the file `labs/mod-0-0/basics.py`. It is a text file that you open in an editor (VS Code, or `code labs/mod-0-0/basics.py`), not a command: typing its name in the terminal gives `Permission denied` or `command not found`. The `pytest ...` command under each pause runs the tests there, and that run is the one that counts.
> - **Trying the examples in the lessons:** type them at the Python prompt `>>>` in your terminal (type `python3` and press Enter to get there; leave with `exit()`), or in the browser preview. Commands such as `cd`, `ls` and `pytest` go at the terminal's `$` prompt instead, never at `>>>`. Not sure which is which? **Start here, step 4** ("Three places you type") shows all three with what each one looks like.

## @part The basics: values, collections, decisions and loops

## @lesson How a program runs: values, variables and types
A program is a list of instructions that the computer follows **from the top to the bottom, one line at a time**. Nothing is skipped and nothing happens "in the background" unless you ask for it. This is the single most useful mental model in programming: when you are lost, put your finger on the first line and walk down.

### Values and variables

To do any work the computer must remember things. It remembers a **value** (a piece of data such as `150000` or `"paid"`) and gives it a **name** so you can use it again. That named value is a **variable**:

```python
total = 150000
status = "paid"
print(total)        # shows 150000
```

> **Where do I type this?** For a quick try: open your terminal, type `python3`, press Enter, and type the three lines at the `>>>` prompt, pressing Enter after each. `print(total)` shows `150000`. At `>>>` you can also type just `total` and Python shows its value; in a saved `.py` file nothing is shown unless you `print` it. Leave with `exit()`. (Start here, step 4, explains the terminal, `>>>` and files side by side.)

Read `total = 150000` as "**let the name `total` point at the value 150000**". The `=` sign is not the equals of mathematics; it is an *assignment*: do the right side first, then attach the name on the left to the result. That is why `total = total + 1000` makes sense in Python (take the old value, add 1000, attach the name to the new value) but is nonsense in maths.

### Types

Every value has a **type**, which tells Python what you are allowed to do with it. The five you will use daily:

| Type | Example | Meaning |
|---|---|---|
| `int` | `150000` | a whole number |
| `float` | `3.5` | a number with decimals |
| `str` | `"paid"` | text, always inside quotes |
| `bool` | `True`, `False` | yes or no |
| `None` | `None` | "there is no value" |

### Why types matter: the first bug of every data job

Everything that comes into your program from outside, a CSV file, a web API, a form, comes in as **text**. Here are two KopiKu orders exactly as Python reads them from a CSV file:

```python
row1 = {"order_id": "1001", "status": "paid", "total_idr": "150000"}
row2 = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
```

Look at the quotes: `"150000"` is text (`str`), not a number. Now your manager asks three simple questions, and the text gives three wrong answers **without any error**:

| The question | What you write | What Python answers | Why |
|---|---|---|---|
| Total of the two orders? | `row1["total_idr"] + row2["total_idr"]` | `'15000090000'` | `+` on text glues the characters together |
| Is 90,000 more than 150,000? | `"90000" > "150000"` | `True` | text is compared character by character, like words in a dictionary, and `"9"` comes after `"1"` |
| Totals from small to large? | `sorted(["150000", "90000", "25000"])` | `['150000', '25000', '90000']` | the same character-by-character order |

Nothing crashed. The program ran, the report went out, and every number in it was wrong. That is why a data engineer's first job with any new data is to **give each value its right type, on purpose**: `int("150000")` is the number `150000`. With numbers the same three questions give `240000`, `False` and `[25000, 90000, 150000]`. Check what you have with `type(x)`: `type(row1["total_idr"])` shows `<class 'str'>`.

Types protect you in two more ways:
- **Dirty text fails loudly, and that is good.** `int("Rp 1.250.000")` raises `ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`. An error that stops you is better than a wrong number that nobody notices. Lesson 6 shows how to catch it and set the bad row aside.
- **`None` is not `0`.** A missing total (`None`) means "we do not know"; `0` means "the order was free". `None == 0` is `False`. Mix them up and averages and totals become quietly wrong.

**Where you will meet this again.** Everywhere: a database gives every column a type (Module 0.3); a pipeline converts and checks types before it loads anything (Module 1.2); file formats such as Parquet store the type next to the data so nobody has to guess (Module 2.1). The first warm-up task in the job simulator is exactly this: prices typed as text, turned into numbers.

> 🛠 **Try it (5 min, Python at the `>>>` prompt).** In the terminal type `python3`, then type (or paste) the `row1` line and press Enter, then the `row2` line and press Enter: one line at a time. If you paste both at once, the prompt shows `...`: Python is waiting for the end of the block, so press Enter once more on the empty `...` line (not Ctrl+C, which cancels them). Before each of the three questions in the table, **predict** the answer, then type the code and compare. Then answer the same three questions again with `int(...)` around each total.
>
> **You should see:** `'15000090000'`, `True` and `['150000', '25000', '90000']` with text; `240000`, `False` and `[25000, 90000, 150000]` with numbers. If one of your predictions was wrong, that is the lesson: write down in one sentence why.

### Formatting text and numbers (`abs`, f-strings, `.replace`)

A few small built-in helpers save you time right away:

- **Decimals trap:** store money as an `int` in the smallest unit (rupiah or cents), because decimals are stored in binary and `0.1 + 0.2` produces `0.30000000000000004`.
- **`abs(n)`** gives the distance from zero (always non-negative): `abs(-45000)` is `45000`. That helps in Lesson 3 when formatting negative money (`"-Rp 45.000"` instead of `"Rp -45.000"`).
- **Assignment order:** trace `a = 2`, `b = a * 3`, `a = 10`, `print(b)` on paper before running it. It prints `6`, not `30`, because `b` received `6` when assigned and changing `a` later does not recalculate `b`.
- **f-strings & format specifiers:** putting `f"..."` before quotes lets Python insert values inside `{...}` (e.g. `f"Order {1001}: Rp {total}"`), and adding `:,` inside `{amount:,}` inserts thousand commas: `f"{1250000:,}"` gives `"1,250,000"`.
- **String `.replace(old, new)`:** strings have attached helper actions called *methods*. Calling `"1,250,000".replace(",", ".")` swaps every comma for a dot, giving `"1.250.000"`. Together they format numbers the Indonesian way.

> 🛠 **Try it (10 min, Python in a practice file): Practice Pause 1, the simple way.** No functions yet: just variables, an f-string and `.replace`. Once, in the terminal, make a folder for your practice files: `mkdir -p ~/practice`. In VS Code choose File, New File, type these three lines, and save it (File, Save As) as `pause1.py` inside that `practice` folder in your home folder. Then run it from the terminal with `python3 ~/practice/pause1.py`:
>
> `amount = 1250000`
> `text = f"Rp {amount:,}"`
> `print(text)`
>
> It prints `Rp 1,250,000`, with commas. Change the second line so the commas become dots, run again, then try `amount` as `0`, `999` and `1000`. Negative amounts need `if`, which comes in Lesson 3.
>
> **You should see:** `Rp 1.250.000`, `Rp 0`, `Rp 999` and `Rp 1.000`. Keep the file: in Lesson 5 these exact lines become the lab's first function.

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

Reading a missing key with `order["note"]` raises `KeyError`; `.get("note", "")` gives a default instead. A dict is also the tool for **counting**: `counts[status] = counts.get(status, 0) + 1`. Remember this line; you will write it many times. To inspect keys and values together, use `order.items()`: it gives a sequence of `(key, value)` pairs, which is how you loop over both or sort them for ranking.

**Tuple** (`(...)`): a small fixed group that should not change, such as `("paid", 3)`. Functions often return a tuple to give back two things at once.

**Set** (`{...}` with no keys): a bag of **unique** values with no order. `set([7, 3, 7, 5])` is `{3, 5, 7}`. Use it to remove duplicates, and to ask "have I seen this before?" very quickly with `x in seen`. Because a set is unordered, use the built-in function `sorted(my_set)` whenever you need the unique values back as an ordered list (for example, customer IDs in ascending order: `sorted({7, 3, 5})` produces `[3, 5, 7]`).

A real data file is therefore usually **a list of dictionaries**: the list is the file, each dict is a row, the keys are the column names. The lab's `orders` looks exactly like this.

One idea to meet early: **mutable versus immutable**. Lists, dicts and sets can be changed in place; strings, numbers and tuples cannot. When two names point at the same list, a change through one name is visible through the other. That is the root of the most famous Python bug, which the chaos scenario of this module shows.

> 🛠 **Try it (10 min, Python in a practice file): Practice Pause 2, the simple way.** Make `~/practice/pause2.py` that starts with this list of four orders (a list of dicts, exactly like a CSV file gives you):
>
> ```python
> orders = [
>     {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"},
>     {"order_id": "1002", "customer_id": "3", "status": "cancelled", "total_idr": "90000"},
>     {"order_id": "1003", "customer_id": "7", "status": "paid", "total_idr": "25000"},
>     {"order_id": "1004", "customer_id": "5", "status": "delivered", "total_idr": "60000"},
> ]
> ```
>
> Then, still without loops, print: how many orders there are (`len`); the status of the first order; the total of the last one. Count two statuses by hand with the counting line: `counts = {}`, then `counts["paid"] = counts.get("paid", 0) + 1`, print `counts`, do it again for `"paid"` and once for `"cancelled"`, print again. Finally put the four `customer_id` values in a set and print how many distinct customers there are, and compare `sorted([7, 3, 7, 5])` with `sorted(set([7, 3, 7, 5]))`.
>
> **You should see:** `4`, `paid`, `60000`; `{'paid': 1}` and then `{'paid': 2, 'cancelled': 1}`; `3` distinct customers; `[3, 5, 7, 7]` against `[3, 5, 7]`. Doing the counting by hand is slow on purpose: Lesson 4's loop does exactly this for every order.

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

Division by zero is a decision problem too: the average of an empty list is not 0, it does not exist. Use built-in `sum(values)` (adds up all numbers in a list) and `len(values)` (counts the items), guarded by an `if`: `if not values: avg = None` handles the empty list before the error can happen, and `else: avg = sum(values) / len(values)` runs safely when there is data. Prefer checking the dangerous case first.

> 🛠 **Try it (10 min, Python in a practice file): Practice Pause 3, the simple way.** In `~/practice/pause3.py`: (1) set `amount = -45000` and use `if` with `abs()` so that a negative amount is written `-Rp 45.000` while a positive one still gives `Rp 45.000`; (2) set `totals = []` and print the average with `sum(totals) / len(totals)` (`sum` adds up a list of numbers, `len` counts its items), but only when the list is not empty, and print `None` otherwise; run it, then change `totals` to `[150000, 25000]` and run again.
>
> **You should see:** `-Rp 45.000`, then `None` for the empty list and `87500.0` for the two totals. Without the `if`, the empty list stops your program with `ZeroDivisionError`.

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

**Sorting and ranking with `sorted()`**: In data pipelines, you frequently rank items (e.g. highest spending customers). The built-in `sorted(data, key=...)` accepts a `key` function telling Python what property to rank by. A short one-line function called a **lambda** (`lambda x: ...`) is often used as the key. For example, to sort `(customer_id, total)` pairs by total descending, write `sorted(pairs, key=lambda pair: -pair[1])` (the minus sign turns highest into smallest so Python puts it first). When two customers spent the exact same total and you want to break ties by smaller customer ID, return a tuple from the key: `key=lambda pair: (-pair[1], pair[0])`. Python compares the first tuple element first, and only inspects the second when there is a tie.

A `while` loop repeats **as long as a condition is true**: `while attempts < 3:`. Use it when you do not know how many rounds you need (retrying, reading until the end). The danger: if nothing in the loop ever makes the condition false, it runs forever. Always ask: "what changes inside the loop so that it ends?"

> 🛠 **Try it (15 min, Python in a practice file): Practice Pause 4, the simple way.** Copy the `orders` list from Pause 2 into `~/practice/pause4.py`. With one `for order in orders:` loop, build three things at once: `counts` (orders per status, with the counting line from Lesson 2), `revenue` (the sum of `int(order["total_idr"])` for orders whose status is not `"cancelled"` or `"refunded"`), and `ids` (a set: `ids = set()` before the loop, `ids.add(int(order["customer_id"]))` inside, which puts one value into the set). Print them after the loop, with `sorted(ids)`. Then cut `items = [1, 2, 3, 4, 5]` into pieces of 2 with `for start in range(0, len(items), 2):` and the slice `items[start:start + 2]`, collecting the pieces in a list.
>
> **You should see:** `{'paid': 2, 'cancelled': 1, 'delivered': 1}`, `235000`, `[3, 5, 7]` and `[[1, 2], [3, 4], [5]]`. You have now written, the simple way, the inside of five of the lab's eleven functions.

## @part Functions, errors and files

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

**Typing a function at the `>>>` prompt.** After a line that ends with `:`, such as `def double(n):`, Python shows `...` and indents the next line for you. When the function is complete, press **Enter once more on the empty line** to finish it; without that empty line, the next thing you type becomes part of the function. For anything longer than two lines, a file is easier.

> 🛠 **Try it (8 min, in a file `fn.py`).** Predict each output in your head first, then run it.
> 1. Write `def show_square(n): print(n * n)` and `def give_square(n): return n * n` (each on its own lines as usual). Run `a = show_square(4)` and `b = give_square(4)`, then `print(a, b)`.
> 2. Write `def add(item, box=[]): box.append(item); return box` (on proper lines) and run `print(add(1))`, `print(add(2))`, `print(add(3))`. Then fix it so that every call without a second argument starts with a fresh empty list.
> 3. Write `total(orders)` that adds up `int(order["total_idr"])` over a list of order dicts, with no `print` inside. Check it with `total([{"total_idr": "100"}, {"total_idr": "250"}]) == 350` and `total([]) == 0`.
>
> **You should see:** `16` printed by step 1, then `None 16` (`print` shows, `return` hands back); the buggy `add` prints `[1]`, `[1, 2]`, `[1, 2, 3]` and your fixed one `[1]`, `[2]`, `[3]`; both checks of step 3 are `True`.

> 💡 **Practice Pause 5 (Open the lab):**
> Now open the lab: the **Browser preview** on the Lab tab, or `labs/mod-0-0/basics.py` in your editor on the terminal route (the lab page shows the one-time setup). Each function there starts like `def format_rupiah(amount):`, then its description between `"""`, then `raise NotImplementedError(...)`: a placeholder that means "not written yet". Delete that line and put your own code from Pauses 1 to 4 in its place, with two changes: the value comes in as the parameter (`amount`, `orders`) instead of a variable you typed, and the answer leaves with `return` instead of `print`.
> Before, in Pause 1:
>
> ```python
> amount = 1250000
> text = ...                 # your line from Pause 1
> print(text)
> ```
>
> After, in the lab:
>
> ```python
> def format_rupiah(amount):
>     text = ...             # the same line, indented
>     return text
> ```
>
> `amount` no longer gets its value from you: the test gives it, by calling for example `format_rupiah(1250000)`. Then add the `if` from Pause 3 for negative amounts.
> Do it for `format_rupiah` (Pauses 1 and 3), `count_by_status` and `unique_customer_ids` (Pause 4), `average_total` (Pause 3, but over the orders' totals), `total_revenue` and `batches` (Pause 4), and `top_customers` (Lesson 4's `sorted` with a `key`). On the Browser preview click **Run tests**; on the terminal route, `pytest` runs all the automated checks (adding `-k TestFormatRupiah` runs just that one group while `-v` prints each test name):
> `pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v`
> Then go on to Lesson 6.

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

> 💡 **Practice Pause 6 (Try It Now):**
> Apply pure functions, error handling, and avoiding the mutable default bug:
> 1. Implement `safe_int(text, default=None)` with a `try / except ValueError` block.
> 2. Implement `add_to_batch(order, batch=None)` using `if batch is None: batch = []`.
> 3. Implement `split_valid(orders)` using your `safe_int` function.
> Click **Run tests**; all three groups should show ✓ (terminal route):
> `pytest labs/mod-0-0/test_lab.py -k "TestSafeInt or TestAddToBatch or TestSplitValid" -v`

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

> 💡 **Practice Pause 7 (Complete the Entire Lab):**
> In `basics.py`, implement the final function `read_orders(path)` using `with open(...)` and `csv.DictReader`.
> Click **Run tests** once more (or run all tests in the terminal): all 31 should pass. On the preview route, after Module 0.2 you write the lab again on your own computer and run all 31 there:
> `pytest labs/mod-0-0/test_lab.py -v`
> The preview shows your logic works; the run on your own computer is the one that counts. On the terminal route that run is already yours: `python3 scripts/prove.py mod-0-0` prints your proof code.

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

> 🛠 **Try it (15 min).** Run `python3 labs/mod-0-0/debug_me.py`. It holds three small functions, each with one bug, and prints PASS or FAIL for each. Fix them one at a time with the routine from this lesson: read the error from the bottom, reproduce it with the smallest input, inspect the value just before the failing line. Do not rewrite a function; find the bug.
>
> **You should see:** three FAIL lines at first (one `TypeError`, two wrong answers) and `all three fixed` at the end. Then write one sentence per bug: what was the clue that led you to it? That sentence is the skill.

**Where these ideas show up in a data engineer's day.** It is fair to ask what eleven small functions have to do with the job. Almost every task you will be given is these same ideas, only bigger:
- **Types:** data arrives as text; you give each value its right type before anything else, or totals come out wrong without an error.
- **Lists and dicts:** a file or a table is a list of rows; each row is a dict of column to value.
- **Counting with a dict:** "how many per city, per status, per day" is the most common question in data; SQL's `GROUP BY` (Module 0.3) is the same idea.
- **Sets:** removing duplicates, and asking "have we already loaded this?".
- **if and try/except:** deciding which rows are valid, and setting the bad ones aside instead of crashing or silently dropping them.
- **Functions with tests:** every step of a pipeline is a function, and its tests are how you know it still works after tomorrow's change.

The labs grow from here: in Module 1.2 the same ideas become a real pipeline that reads files, converts types, quarantines bad rows and can be re-run safely. If something in this module still feels unclear, that is normal after one reading: re-read the lesson whose Practice Pause was hardest, and do its Try it again.

## @lab Lab: eleven small functions on KopiKu orders
Write eleven short functions, each practising one idea from the lessons, on KopiKu order data.

**What a lab is.** The file `basics.py` holds eleven functions whose inside is empty: each one only says `raise NotImplementedError`. You write the inside. A second file, `test_lab.py`, holds 31 **tests**: small programs that call your function with an example and check the answer, for example "`format_rupiah(1250000)` must give `"Rp 1.250.000"`". A test is ✓ when your function gives the expected answer, and ✗ when it gives something else or crashes. You are done when all 31 are ✓.

**Where to do it: choose one of two routes.**

- **Route A, the browser preview** (nothing to install): the editor box further down this page holds the file, **Run tests** runs all 31, and the list under the button shows each group of tests (one group per function) as ✓ or ✗. A preview pass does not count: after Module 0.2 you write the lab again on your own computer.
- **Route B, your own terminal** (recommended if you did Start here): this is how you will work for the rest of the course, and the run counts. Set it up once, in the terminal:

```bash
cd ~/projects/DECourse                     # your course folder
python3 -m venv venv                       # once: a private Python for the course
source venv/bin/activate                   # every new terminal
python -m pip install -r labs/mod-0-0/requirements.txt    # once: pytest
```

  Use your own course folder in the first line. If its name has a space, put a backslash before the space: `cd ~/Documents/Learn\ DE/DECourse`. After `source`, the prompt starts with `(venv)`; Module 0.2 explains what a venv is. Then open the course folder in VS Code (File, Open Folder) and click `labs/mod-0-0/basics.py` to edit it. Run one function's tests with, for example:

```bash
pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v
```

  You see one line per test ending in `PASSED` or `FAILED`; under a failure, the line that starts with `E` says what went wrong. On the untouched file it is `E       NotImplementedError: TODO: implement format_rupiah`, which only means you have not written it yet. `-k TestFormatRupiah` picks one group (the other 27 tests are "deselected"); without `-k` you see all 31, and the last line says, for example, `29 failed, 2 passed`.

Lessons 1 to 4 end with practice done the simple way, without functions. From Lesson 5 on, each **Practice Pause** tells you which lab functions to write, mostly by turning the code you already wrote into a function.

**The loop, for every function.**
1. Read the function's description in the file: the text between the `"""` lines says what goes in and what must come out, with examples.
2. Write your attempt, replacing the `raise NotImplementedError` line.
3. Click **Run tests** and find that function's group. At first the other groups are ✗ too; that is expected, ignore them.
4. If your group is ✗, click it and read the message. A line such as `AssertionError: assert 'Rp 1,250,000' == 'Rp 1.250.000'` means: your function returned `'Rp 1,250,000'` (left), the test expected `'Rp 1.250.000'` (right). The difference, commas instead of dots, tells you exactly what to change.
5. Change one thing, run again. Going round this loop five times for one function is normal: it is how programmers work, not a sign that you are bad at it.

**The eleven functions, in the order of the lessons, and why a data engineer needs each one:**

| Idea from lesson | Function | What it does | Where you will need it at work |
|---|---|---|---|
| 1 | `format_rupiah` | `1250000` becomes `"Rp 1.250.000"` | reports, dashboards and e-mails show money people can read |
| 2 | `count_by_status` | how many orders per status | the most common question about any data: how many per category (SQL calls it `GROUP BY`, Module 0.3) |
| 2 | `unique_customer_ids` | each customer once, sorted | files are re-sent and rows repeat; counting a customer twice inflates every number |
| 3 | `average_total` | the average, or `None` for no orders | a metric must survive an empty day without crashing the whole job |
| 4 | `total_revenue` | sum of the totals that are not cancelled | revenue is the number Finance checks you against: text to number, and the right filter |
| 4 | `batches` | cut a list into chunks of `size` | send data to an API or a database in pieces, not one huge request (Module 1.6) |
| 4 | `top_customers` | the `n` customers who spent most | every "top 10" report |
| 6 | `safe_int` | text to number, or a default when impossible | convert dirty values without crashing the run |
| 5 | `add_to_batch` | add to a list without the "mutable default" trap | this exact bug makes yesterday's data leak into today's run (see the Chaos tab) |
| 6 | `split_valid` | separate good rows from bad ones | bad rows are set aside and reported, never silently dropped (Module 1.2) |
| 7 | `read_orders` | read a CSV file into a list of dicts | every pipeline starts by reading a file |

### @steps
1. Choose your route (see "Where to do it" above): the **Browser preview** below, or `labs/mod-0-0/basics.py` in VS Code with the tests in your terminal. Read the whole file from top to bottom once, without writing anything: eleven functions, each with its description.
2. Follow the Practice Pauses. Lessons 1 to 4: practise the simple way, no lab yet. After Lesson 5: `format_rupiah`, `count_by_status`, `unique_customer_ids`, `average_total`, `total_revenue`, `batches` and `top_customers`. After Lesson 6: `safe_int`, `add_to_batch` and `split_valid`. After Lesson 7: `read_orders`. Run the tests after each function and look only at its group.
3. Unsure what a value is inside your function? Add `print(type(x), x)` above the line you doubt and run again; the printout appears in the output. Remove it when you are done.
4. Before each run, **predict** which groups will be ✓. When the result surprises you, find out why: that surprise is where the learning is.
5. **Do it for real.** On the terminal route you already are: when all 31 pass, run the proof command below. On the preview route, after Module 0.2 write the lab again on your own computer, in your own venv, **without copying** from the preview. From the course folder, with the venv active:

```bash
pytest labs/mod-0-0/test_lab.py -v                    # all of them
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt     # one group while you work
python3 scripts/prove.py mod-0-0                      # when all 31 pass: your proof code
```

   Open `labs/mod-0-0/basics.py` in your editor (VS Code: File, Open Folder, then click the file); it is a file you edit, not a command you type. Paste the proof code into the **Proof** box on this page.

### @files
- labs/mod-0-0/basics.py :: Your working file: implement the eleven TODO functions :: starter
- labs/mod-0-0/debug_me.py :: A debugging drill: three functions with one bug each (lesson 8) :: config
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
