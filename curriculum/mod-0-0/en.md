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
None. You do not need to have written code before, and it does not matter if earlier courses left you confused. You only need a way to run Python: the browser preview in the lab works first; Module 0.1 then teaches the proper setup on your own computer.

> [!IMPORTANT]
> **Short version:** the lab has two parts. **Part A** is plain Python (after Lessons 1 to 4), **Part B** is functions (after Lesson 5). Do not read the whole chapter first: go back and forth between a lesson and its Practice Pause. The full "how to work on the lab" guide appears at the end of Lesson 1, exactly where you first need it.

## @part The basics: values, collections, decisions and loops

## @lesson How a program runs: values, variables and types
A program is a list of instructions that the computer follows **from the top to the bottom, one line at a time**. Nothing is skipped and nothing happens "in the background" unless you ask for it. This is the single most useful mental model in programming: when you are lost, put your finger on the first line and walk down.

Here you learn by doing. Each small idea is followed by a short **drill**: you write a few lines, press **Run & check**, and the checker tells you exactly what is still wrong. Stuck? Press **Hint**, and if you are still stuck, **Show the solution** and then type it again yourself. The drills run Python in your browser, so there is nothing to install. Your own terminal is where the real work happens: the **Try it** and the lab at the end of the lesson use it.

### Show a value: print()

**Why:** a program that cannot show you anything is useless to you. `print()` is how you see what a program is doing.

`print()` puts something on the screen. Text goes inside quotes; a number does not:

```python
print("Hello")
print(150000)
```

> **Where do I type this?** For a quick try: open your terminal, type `python3`, press Enter, and type `print("Hello")` at the `>>>` prompt. Python answers `Hello`. Leave with `exit()`. (Start here, step 4, explains the terminal, `>>>` and files side by side.)

:::drill python Print a word
Use `print()` to show the word `paid`. It is text, so it goes inside quotes.
@starter
# write your line below this one

@check
calls("print") ## Use the print() function.
out == "paid" ## The program should print exactly: paid
@hint
`print("paid")`: the quotes tell Python that `paid` is text, not a name.
@solution
print("paid")
:::

### Values and variables

To do any work the computer must remember things. It remembers a **value** (a piece of data such as `150000` or `"paid"`) and gives it a **name** so you can use it again. That named value is a **variable**:

```python
total = 150000
status = "paid"
print(total)        # shows 150000
```

> **Where do I type this?** The same way: at the `>>>` prompt type the three lines, pressing Enter after each. `print(total)` shows `150000`. At `>>>` you can also type just `total` and Python shows its value; in a saved `.py` file nothing is shown unless you `print` it.

Read `total = 150000` as "**let the name `total` point at the value 150000**". The `=` sign is not the equals of mathematics; it is an *assignment*: do the right side first, then attach the name on the left to the result.

:::drill python Make two variables
Make a variable `price` that holds the number `25000`, and a variable `drink` that holds the text `"Kopi Susu"`.
@starter
# write your two lines below this one

@check
price == 25000 ## `price` should hold the number 25000 (a number has no quotes).
type(price) is int ## `price` should be a number, not text.
drink == "Kopi Susu" ## `drink` should hold the text "Kopi Susu" (text has quotes).
@hint
`price = 25000` and `drink = "Kopi Susu"`: one name, one `=`, one value per line.
@solution
price = 25000
drink = "Kopi Susu"
:::

### A name keeps its value until you change it

Because the right side is worked out first, `total = total + 1000` makes sense in Python (take the old value, add 1000, attach the name to the new value) but is nonsense in maths.

Trace this by hand before you run it: `a = 2`, `b = a * 3`, `a = 10`, `print(b)`. It prints `6`, not `30`. `b` got the value 6 at the moment of the assignment; changing `a` later does not change `b`. If you predicted 30, you just learned something important.

Watch it happen, with other numbers than the drill below:

:::trace A name keeps its value
@code
a = 2
b = a * 3
a = 10
print(b)
@notes
2 | `b` is worked out **now**, from the current value of `a` (2). It gets 6.
3 | `a` changes, but `b` already holds 6. Nothing recalculates it.
4 | So this prints 6, not 30.
:::

:::drill python Follow the value
Read the three lines from the top. What number does `y` hold at the end? Replace `None` with that number. (Run it if you want to check yourself: `print(y)`.)
@starter
x = 5
y = x + 1
x = 20
answer = None
@check
answer == 6 ## `y` got its value (6) when `x` was 5. Changing `x` later does not change `y`.
type(answer) is int ## `answer` should be a number.
@hint
Go line by line. After line 2, `y` is 6. Line 3 changes `x`, but nothing makes `y` be worked out again.
@solution
x = 5
y = x + 1
x = 20
answer = 6
:::

:::ask What will this print?
```python
count = 10
count = count + 5
print(count)
```
@options
count
* 15
count + 5
@why
Python works out the **right side first**: the old value of `count` (10) plus 5 is 15, and only then does the name `count` point at 15. `print` shows the value, not the name.
:::

### Types

Every value has a **type**, which tells Python what you are allowed to do with it. The five you will use daily:

| Type | Example | Meaning |
|---|---|---|
| `int` | `150000` | a whole number |
| `float` | `3.5` | a number with decimals |
| `str` | `"paid"` | text, always inside quotes |
| `bool` | `True`, `False` | yes or no |
| `None` | `None` | "there is no value" |

`type(x)` tells you the type of a value:

```python
print(type(150000))
print(type("150000"))
```

The two lines look alike, but the first is a number and the second is text. **Money is a whole number.** Store money as an `int` in the smallest unit (rupiah), never as a `float`: decimals are stored in binary, so `0.1 + 0.2` is `0.30000000000000004`, and after a million rows such tiny errors become real money.

:::drill python Number or text?
Make `price` the number `25000` and `price_text` the text `"25000"` (the same digits, inside quotes). Then print the type of each, one per line: first `price`, then `price_text`.
@starter
# write your lines below this one

@check
price == 25000 and type(price) is int ## `price` should be the number 25000 (no quotes).
price_text == "25000" ## `price_text` should be the text "25000" (with quotes).
out == "<class 'int'>\n<class 'str'>" ## Print type(price) on the first line and type(price_text) on the second. You should see int, then str.
@hint
`print(type(price))` shows the type of the value that `price` points at.
@solution
price = 25000
price_text = "25000"
print(type(price))
print(type(price_text))
:::

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

Nothing crashed. The program ran, the report went out, and every number in it was wrong. That is why a data engineer's first job with any new data is to **give each value its right type, on purpose**: `int("150000")` is the number `150000`, and `str(150000)` is the text `"150000"`. With numbers the same three questions give `240000`, `False` and `[25000, 90000, 150000]`.

Watch the silent bug happen, one line at a time, with small numbers:

:::trace Text glues, numbers add
@code
a = "150"
b = "90"
glued = a + b
total = int(a) + int(b)
print(glued, total)
@notes
3 | `+` on **text** glues the characters together: `150` and `90` become `15090`. No error, just a wrong answer.
4 | Convert each text to a number first, and `+` adds: 240.
:::

Before the drill, one prediction. Do not run it; think first:

:::ask What will this print?
```python
print("2" + "3")
```
@options
5
an error
* 23
@why
The quotes make `"2"` and `"3"` **text**, and `+` on text glues the characters together: `23`. Python does not guess that you meant numbers. This is exactly how a total of text prices goes wrong without any error.
:::

:::drill python Add prices as numbers
Two prices came out of a file, so they are text. Make `price_sum` their total **as a number** (43000), not the two texts glued together.
@starter
price_a = "25000"
price_b = "18000"
price_sum = None
@check
price_sum == 43000 ## `price_sum` should be 43000. If you got 2500018000, the two texts were glued together: convert each one with int(...) first.
type(price_sum) is int ## `price_sum` should be a number (int).
calls("int") ## Convert with int(...) before adding.
@hint
`int("25000")` is the number 25000. Convert both prices, then add them with `+`.
@solution
price_a = "25000"
price_b = "18000"
price_sum = int(price_a) + int(price_b)
:::

Types protect you in two more ways:
- **Dirty text fails loudly, and that is good.** `int("Rp 1.250.000")` raises `ValueError: invalid literal for int() with base 10: 'Rp 1.250.000'`. An error that stops you is better than a wrong number that nobody notices. Lesson 6 shows how to catch it and set the bad row aside.
- **`None` is not `0`.** A missing total (`None`) means "we do not know"; `0` means "the order was free". Mix them up and averages and totals become quietly wrong.

:::drill python None is not zero
`missing_total` is `None`: we do not know the total. Print the answer to the question "is `missing_total` equal to `0`?" (use `==`).
@starter
missing_total = None
# print your comparison below this line

@check
calls("print") ## Use print(...) to show the answer.
out == "False" ## You should see False: None ("we do not know") is not 0 ("it was free").
@hint
`print(missing_total == 0)` prints `True` or `False`.
@solution
missing_total = None
print(missing_total == 0)
:::

**Where you will meet this again.** Everywhere: a database gives every column a type (Module 0.3); a pipeline converts and checks types before it loads anything (Module 1.2); file formats such as Parquet store the type next to the data so nobody has to guess (Module 2.1). The first warm-up task in the job simulator is exactly this: prices typed as text, turned into numbers.

> 🛠 **Try it (5 min, Python at the `>>>` prompt).** In the terminal type `python3`, then type (or paste) the `row1` line and press Enter, then the `row2` line and press Enter: one line at a time. If you paste both at once, the prompt shows `...`: Python is waiting for the end of the block, so press Enter once more on the empty `...` line (not Ctrl+C, which cancels them). Before each of the three questions in the table, **predict** the answer, then type the code and compare. Then answer the same three questions again with `int(...)` around each total.
>
> **You should see:** `'15000090000'`, `True` and `['150000', '25000', '90000']` with text; `240000`, `False` and `[25000, 90000, 150000]` with numbers. If one of your predictions was wrong, that is the lesson: write down in one sentence why.

### Writing a number as text: f-strings

Reports show `Rp 1.250.000`, not `1250000`. Three small tools do it, one at a time. First, an **f-string** puts values inside text: write `f` before the opening quote and put the value in braces:

```python
total = 150000
print(f"Order {1001}: Rp {total}")     # Order 1001: Rp 150000
```

:::drill python Put a number inside text
`amount` is `45000`. Make `label` the text `Rp 45000` with an f-string, so that it follows `amount` if the number changes.
@starter
amount = 45000
label = None
@check
label == "Rp 45000" ## `label` should be the text Rp 45000.
"{" in code and "}" in code ## Use an f-string: f"Rp {amount}".
uses("amount") ## Take the value from the variable `amount`, do not type 45000 again.
@hint
Write `f` before the opening quote, then put `{amount}` where the number goes.
@solution
amount = 45000
label = f"Rp {amount}"
:::

### Thousands separators

A format code after a colon changes how the number is written. `f"{1250000:,}"` gives the text `"1,250,000"`, with commas between the thousands:

```python
print(f"{1250000:,}")
```

:::drill python Commas between thousands
Make `with_commas` the text of `amount` with commas between the thousands: `7,500,000`.
@starter
amount = 7500000
with_commas = None
@check
with_commas == "7,500,000" ## `with_commas` should be the text 7,500,000.
":," in code ## Put the format code `:,` after the name inside the braces: {amount:,}
@hint
`f"{amount:,}"`: the colon starts the format code, the comma asks for thousands separators.
@solution
amount = 7500000
with_commas = f"{amount:,}"
:::

### Swapping characters: .replace()

Indonesians write the thousands separator as a dot. A text's **`.replace(old, new)`** swaps characters. Text values have helper actions like this, called **methods**: `"1,250,000".replace(",", ".")` gives `"1.250.000"`.

:::drill python Commas to dots
`with_commas` is the text `7,500,000`. Make `with_dots` the same text with dots instead of commas.
@starter
with_commas = "7,500,000"
with_dots = None
@check
with_dots == "7.500.000" ## `with_dots` should be the text 7.500.000.
calls("replace") ## Use the .replace(old, new) method on the text.
@hint
`with_commas.replace(",", ".")` gives back a new text; the old one stays the same.
@solution
with_commas = "7,500,000"
with_dots = with_commas.replace(",", ".")
:::

Together, `f"Rp {amount:,}".replace(",", ".")` writes `1250000` as `Rp 1.250.000`. You now know every piece of Step 1 of the lab: the lab asks you to put them together on its own numbers.

> [!IMPORTANT]
> **How to Work on Labs (Beginner Guide):**
> - **The lab has two parts.** **Part A** is plain Python, no functions: after each of Lessons 1 to 4 you fill in a few variables in the file `labs/mod-0-0/practice.py` (replace each `None` with your own code). **Part B** starts after Lesson 5, which teaches functions (`def`): the file `labs/mod-0-0/basics.py` holds eleven functions to write. Do not read the whole chapter first; go back and forth between a lesson and its Practice Pause.
> - **Where:** in the **Browser preview** on the Lab tab (nothing to install; use the Part A / Part B switch), or in your own terminal if you did Start here (the lab page shows the four setup commands, once). The files are text files that you open in an editor (VS Code, or `code labs/mod-0-0/practice.py`), not commands: typing a file's name in the terminal gives `Permission denied` or `command not found`. The `pytest ...` command under each pause checks your work, and that run is the one that counts.
> - **Trying the examples in the lessons:** type them at the Python prompt `>>>` in your terminal (type `python3` and press Enter to get there; leave with `exit()`), or in the browser preview. Commands such as `cd`, `ls` and `pytest` go at the terminal's `$` prompt instead, never at `>>>`. Not sure which is which? **Start here, step 4** ("Three places you type") shows all three with what each one looks like.

> 💡 **Practice Pause 1 (Part A, Step 1):**
> Open Part A of the lab: the file `labs/mod-0-0/practice.py` in your editor, or the **Part A** tab of the Browser preview on the Lab tab. Read the top of the file once, then find **Step 1**. It gives you `amount`, `row1` and `row2`, and two variables to fill in: replace each `None` with your own code.
> 1. `formatted`: the amount written as text with dots, `Rp 1.250.000` (the f-string and `.replace` above).
> 2. `two_totals`: the two totals in `row1` and `row2` added as **numbers**. Look back at the three wrong answers in the table: these totals are text, so convert them first.
> Run the file to see your values: `python3 labs/mod-0-0/practice.py`. Then check Step 1: press **Run tests** in the preview, or in the terminal (once the one-time setup on the lab page is done):
> `pytest labs/mod-0-0/test_practice.py -k Step1 -v`
> You should see `Rp 1.250.000` and `240000`, and three passed checks. A check that fails says which variable is wrong, what it should be and what it is: `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is None `` just means you have not replaced the `None` yet. Then go on to Lesson 2.

## @lesson Collections: one value is never enough
One order has several facts, and a file has thousands of orders. Python gives you four containers: the **list**, the **dictionary**, the **tuple** and the **set**. Knowing **why each exists** tells you which to choose. As in Lesson 1, every idea is followed by a drill.

### List: an ordered row of things

**Why:** a shop has thousands of orders, and one variable per order is hopeless. A list keeps many values under one name.

A **list** (`[...]`) is an ordered row of things, where position matters and duplicates are allowed. `len()` tells you **how many items** a list has:

```python
products = ["Kopi Susu", "Americano", "Teh Tarik"]
print(len(products))     # 3: three items in the list
```

:::drill python How many items?
`prices` is a list. Make `how_many` the number of items in it, using `len()`.
@starter
prices = [25000, 22000, 18000, 30000]
how_many = None
@check
how_many == 4 ## `how_many` should be 4: the list has four items.
calls("len") ## Use len(prices) to count the items.
@hint
`len(prices)` gives how many items `prices` has.
@solution
prices = [25000, 22000, 18000, 30000]
how_many = len(prices)
:::

### Positions start at 0

You read one item by its **position** (also called an index), written in square brackets. Positions start at **0**, so `products[0]` is the first item and `products[1]` the second. A negative position counts from the end: `products[-1]` is the last item. A **slice** `products[0:2]` takes positions 0 and 1 (it stops *before* the second number):

```python
products = ["Kopi Susu", "Americano", "Teh Tarik"]
print(products[0])       # Kopi Susu
print(products[-1])      # Teh Tarik
print(products[0:2])     # ['Kopi Susu', 'Americano']
```

Predict before you drill:

:::ask What will this print?
```python
letters = ["a", "b", "c", "d"]
print(letters[1], letters[-1])
```
@options
* b d
a d
b c
@why
Positions start at 0, so `letters[1]` is the **second** item, `"b"`. Position `-1` is the **last** item, `"d"`. `print` with two values puts a space between them: `b d`.
:::

:::drill python First and last
Make `first` the first item of `cities` and `last` the last item. Use positions, do not type the names again.
@starter
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first = None
last = None
@check
first == "Jakarta" ## `first` should be "Jakarta": the first item is at position 0.
last == "Medan" ## `last` should be "Medan": position -1 is the last item.
uses("cities") ## Take them from the list `cities` with [position].
@hint
`cities[0]` is the first item; `cities[-1]` is the last one.
@solution
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first = cities[0]
last = cities[-1]
:::

:::drill python A slice
Make `first_two` the first two cities, as a list, with a slice.
@starter
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first_two = None
@check
first_two == ["Jakarta", "Bandung"] ## `first_two` should be ['Jakarta', 'Bandung'].
":" in code.split("first_two =")[-1] ## Use a slice: cities[0:2] (it stops before position 2).
@hint
`cities[0:2]` starts at position 0 and stops before position 2.
@solution
cities = ["Jakarta", "Bandung", "Surabaya", "Medan"]
first_two = cities[0:2]
:::

### Changing a list

A list can change. `.append(x)` adds `x` at the end:

```python
products = ["Kopi Susu", "Americano"]
products.append("Teh Tarik")
print(products)          # ['Kopi Susu', 'Americano', 'Teh Tarik']
```

:::drill python Add one at the end
Add `"Medan"` to the end of the list `cities`.
@starter
cities = ["Jakarta", "Bandung"]
# write your line below this one

@check
cities == ["Jakarta", "Bandung", "Medan"] ## `cities` should end with "Medan" and keep the two cities before it.
calls("append") ## Use cities.append(...).
@hint
`cities.append("Medan")` changes the list in place; you do not need `cities = ...`.
@solution
cities = ["Jakarta", "Bandung"]
cities.append("Medan")
:::

### Counting: how many in total, and how many of one kind

Two different questions, two different tools. `len(list)` answers **how many items in total**. `list.count(x)` answers **how many items are equal to `x`**:

```python
statuses = ["paid", "paid", "cancelled", "paid"]
print(len(statuses))             # 4: four orders in total
print(statuses.count("paid"))    # 3: three of them are paid
```

Predict first:

:::ask What will this print?
```python
statuses = ["paid", "cancelled", "paid"]
print(len(statuses), statuses.count("paid"))
```
@options
3 3
2 3
* 3 2
@why
`len(statuses)` counts **every** item: 3. `statuses.count("paid")` counts only the items equal to `"paid"`: 2. The first number is "how many in total", the second is "how many of one kind".
:::

:::drill python In total, and of one kind
`statuses` holds the status of four orders. Make `all_orders` the number of orders, and `paid_orders` the number of orders whose status is `"paid"`.
@starter
statuses = ["paid", "cancelled", "paid", "shipped", "paid"]
all_orders = None
paid_orders = None
@check
all_orders == 5 ## `all_orders` should be 5: use len(statuses), it counts everything.
paid_orders == 3 ## `paid_orders` should be 3: use statuses.count("paid"), it counts only the equal ones.
calls("len") and calls("count") ## Use both: len(...) for the total, .count(...) for one kind.
@hint
`len(statuses)` counts all the items. `statuses.count("paid")` counts only the items equal to `"paid"`.
@solution
statuses = ["paid", "cancelled", "paid", "shipped", "paid"]
all_orders = len(statuses)
paid_orders = statuses.count("paid")
:::

### Dictionary: look things up by name

**Why:** "position 3" says nothing about an order, but `"status"` does. A dictionary lets you ask for a fact by its name.

A **dictionary** (`{...}`) looks things up by a *name* (a **key**) instead of a position. One order is a dictionary:

```python
order = {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"}
print(order["status"])         # paid
print(order.get("note"))       # None: .get gives None instead of an error when the key is missing
```

Reading a missing key with `order["note"]` raises `KeyError`; `.get("note", "")` gives a default instead.

:::drill python Look up by key
Make `status` the status of the `order`, and `note` its note. The order has no note, so use `.get` with the default `"no note"`.
@starter
order = {"order_id": "1002", "status": "cancelled", "total_idr": "90000"}
status = None
note = None
@check
status == "cancelled" ## `status` should be "cancelled": read it with order["status"].
note == "no note" ## `note` should be "no note": use order.get("note", "no note") for a key that may be missing.
calls("get") ## Use .get(...) for the note.
@hint
`order["status"]` reads a key that exists. `order.get("note", "no note")` gives the default when the key is missing.
@solution
order = {"order_id": "1002", "status": "cancelled", "total_idr": "90000"}
status = order["status"]
note = order.get("note", "no note")
:::

### Changing a dictionary

Assigning to a key changes it, or adds it when it does not exist yet:

```python
order["status"] = "shipped"    # change a value
order["courier"] = "JNE"       # add a new key
```

:::drill python Change and add
Change the status of `order` to `"shipped"` and add a key `"courier"` with the value `"JNE"`.
@starter
order = {"order_id": "1003", "status": "paid"}
# write your lines below this one

@check
order["status"] == "shipped" ## `order["status"]` should be "shipped".
order.get("courier") == "JNE" ## `order` should have the key "courier" with the value "JNE".
len(order) == 3 ## `order` should have three keys: order_id, status and courier.
@hint
`order["status"] = "shipped"` and `order["courier"] = "JNE"`.
@solution
order = {"order_id": "1003", "status": "paid"}
order["status"] = "shipped"
order["courier"] = "JNE"
:::

### A dictionary can hold counts

A dictionary is also the tool for keeping a **count per name**, "how many of each kind". It is a different question from `len`: `counts = {"paid": 3, "cancelled": 1}` says there are 3 paid orders and 1 cancelled one. `counts["paid"]` reads one count, and `len(counts)` is the number of *different kinds*, not the number of orders. How to build such a dictionary from many rows is the job of a loop, which Lesson 4 teaches. Here you only read one.

:::drill python Read a count
Make `paid_count` the number of paid orders, and `kinds` the number of different statuses, both read from the dictionary `counts`.
@starter
counts = {"paid": 3, "cancelled": 1, "shipped": 2}
paid_count = None
kinds = None
@check
paid_count == 3 ## `paid_count` should be 3: read it with counts["paid"].
kinds == 3 ## `kinds` should be 3: there are three different statuses. len(counts) counts the keys.
@hint
`counts["paid"]` is the count of paid orders. `len(counts)` is how many keys the dictionary has.
@solution
counts = {"paid": 3, "cancelled": 1, "shipped": 2}
paid_count = counts["paid"]
kinds = len(counts)
:::

### Tuple: a small fixed group

A **tuple** (`(...)`) is a small fixed group that should not change, such as `("paid", 3)`. Functions often return a tuple to give back two things at once.

### Set: each value once

A **set** is a bag of **unique** values with no order. `set([7, 3, 7, 5])` is `{3, 5, 7}`. Use it to remove duplicates, and to ask "have I seen this before?" very quickly with `x in seen`. Because a set has no order, use the built-in function `sorted(my_set)` whenever you need the unique values back as an ordered list:

```python
ids = [7, 3, 7, 5]
print(sorted(set(ids)))    # [3, 5, 7]
```

:::drill python Each id once
`ids` has repeats. Make `unique_ids` a list of the different ids, each once, smallest first.
@starter
ids = [4, 9, 4, 1, 9, 9]
unique_ids = None
@check
unique_ids == [1, 4, 9] ## `unique_ids` should be [1, 4, 9]: each id once, smallest first.
calls("set") and calls("sorted") ## Use set(...) to drop the repeats and sorted(...) for the order.
@hint
`set(ids)` keeps each value once; `sorted(...)` turns it into an ordered list.
@solution
ids = [4, 9, 4, 1, 9, 9]
unique_ids = sorted(set(ids))
:::

### A real file: a list of dictionaries

A real data file is therefore usually **a list of dictionaries**: the list is the file, each dictionary is a row, the keys are the column names. Here are three products (every value is text, as it comes out of a CSV file) and four questions with their answers:

```python
products = [
    {"sku": "K1", "name": "Kopi Susu", "price_idr": "25000"},
    {"sku": "K2", "name": "Americano", "price_idr": "22000"},
    {"sku": "K3", "name": "Teh Tarik", "price_idr": "18000"},
]
product_count = len(products)                  # 3: len() counts the rows
first_name = products[0]["name"]               # "Kopi Susu": [0] is the FIRST row, then ["name"] picks one fact from that dictionary
last_price = int(products[-1]["price_idr"])    # 18000: [-1] is the LAST row; int() because the price is text
print(product_count, first_name, last_price)   # 3 Kopi Susu 18000
```

Read each line from the inside out: `products[0]` is one dictionary, and `["name"]` reads one value from it.

:::drill python Ask a list of rows
`shops` is a list of dictionaries. Make `shop_count` the number of rows, `first_city` the city of the first row, and `last_staff` the staff of the last row **as a number**.
@starter
shops = [
    {"city": "Jakarta", "staff": "12"},
    {"city": "Bandung", "staff": "8"},
    {"city": "Surabaya", "staff": "15"},
]
shop_count = None
first_city = None
last_staff = None
@check
shop_count == 3 ## `shop_count` should be 3: len(shops) counts the rows.
first_city == "Jakarta" ## `first_city` should be "Jakarta": shops[0]["city"].
last_staff == 15 and type(last_staff) is int ## `last_staff` should be the number 15: shops[-1]["staff"] is text, so wrap it in int(...).
@hint
Position first, key second: `shops[0]["city"]`. The last row is `shops[-1]`. The value is text, so `int(...)`.
@solution
shops = [
    {"city": "Jakarta", "staff": "12"},
    {"city": "Bandung", "staff": "8"},
    {"city": "Surabaya", "staff": "15"},
]
shop_count = len(shops)
first_city = shops[0]["city"]
last_staff = int(shops[-1]["staff"])
:::

### Two names, one list

One idea to meet early: **mutable versus immutable**. Lists, dictionaries and sets can be changed in place; strings, numbers and tuples cannot. When two names point at the same list, a change through one name is visible through the other. That is the root of the most famous Python bug, which the chaos scenario of this module shows.

Watch a second name being attached to the **same** list (look at the label next to the value):

:::trace A second name, the same list
@code
orders = ["x"]
copy = orders
copy.append("y")
print(orders)
@notes
2 | `copy = orders` does **not** copy the list: it attaches a second name to the same list. Both names show the same label.
3 | Changing the list through `copy`...
4 | ...changes what `orders` sees too: it prints `['x', 'y']`.
:::

:::drill python Two names, one list
`b = a` does not copy the list: both names point at the same list. After the three lines, what list does `a` hold? Replace `None` with that list.
@starter
a = [1, 2]
b = a
b.append(3)
a_now = None
@check
a_now == [1, 2, 3] ## `a` holds [1, 2, 3]: `b` is the same list as `a`, so the append through `b` shows up in `a`.
@hint
`b = a` makes `b` point at the same list as `a`. `b.append(3)` changes that one list.
@solution
a = [1, 2]
b = a
b.append(3)
a_now = [1, 2, 3]
:::

> 💡 **Practice Pause 2 (Part A, Step 2):**
> In `practice.py` (or the **Part A** tab), do **Step 2** with the list `orders` (a list of dicts, exactly what a CSV file gives you) and the list `ids_seen`:
> 1. `order_count`: how many orders are in the list (`len`).
> 2. `first_status`: the status of the first order (position `0`, then the key `"status"`).
> 3. `last_total`: the total of the last order (position `-1`), as a **number**.
> 4. `unique_ids`: the different ids in `ids_seen`, each once, smallest first (a set, then `sorted`).
> Run the file to see your values, then check the step:
> `pytest labs/mod-0-0/test_practice.py -k Step2 -v`
> You should see `4`, `paid`, `60000` and `[3, 5, 7]`, and four passed checks.

## @lesson Decisions: if, elif, else
A decision is how a program chooses between paths. In data engineering almost all **validation** is decisions: is this total a number? is the status one we know? Every decision starts with a question that Python answers with `True` or `False`.

### Questions that Python answers with True or False

A comparison asks a question about two values. The answer is a `bool` (`True` or `False`):

| Question | Write | Example |
|---|---|---|
| equal? | `==` | `stock == 12` |
| not equal? | `!=` | `status != "paid"` |
| smaller / bigger? | `<` `>` | `stock < 20` |
| smaller or equal / bigger or equal? | `<=` `>=` | `stock >= 20` |
| is it in this group? | `in` | `"paid" in ["paid", "shipped"]` |

```python
stock = 12
print(stock < 20)          # True
print(stock == 12)         # True: two equal signs ASK the question
print("a" in ["a", "b"])   # True
```

Be careful: one `=` **assigns** (`stock = 12` puts 12 in the name), two `==` **compare** (`stock == 12` asks "is it 12?"). Mixing them up is the classic beginner slip.

:::ask What will this print?
```python
print(5 == 5.0, "5" == 5)
```
@options
* True False
True True
False False
@why
`5` and `5.0` are the same number, so the first comparison is `True`. But `"5"` is **text** and `5` is a number, and Python never treats text and numbers as equal: `False`.
:::

:::drill python Ask a question
`stock` is `12`. Make `is_low` hold the answer to the question "is the stock below 20?". It should be `True` now, and follow `stock` if the number changes.
@starter
stock = 12

# write your solution below this line
@check
is_low is True ## `is_low` should be True: 12 is below 20.
uses("stock") ## Ask the question about the variable `stock`, do not just type True.
rerun_with("stock", 50)["is_low"] is False ## When `stock` is 50, `is_low` should be False. Use stock < 20.
@hint
`stock < 20` is a question whose answer is `True` or `False`. Store the answer: `is_low = stock < 20`.
@solution
stock = 12
is_low = stock < 20
:::

### if: run a block only when the answer is True

An `if` runs the lines under it **only when its question is `True`**. The lines that belong to the `if` are **indented** (four spaces) under a line that ends with a colon. In Python the indentation *is* the structure, so a wrong indent is a wrong program.

```python
stock = 12
if stock < 20:
    print("reorder")
```

Add an `else` for "otherwise". Watch which lines run, and which are skipped:

:::trace Which lines run?
@code
stock = 12
if stock < 20:
    message = "reorder"
else:
    message = "enough"
print(message)
@notes
1 | `stock` gets the value 12.
2 | The question: is 12 < 20? Yes, `True`.
3 | Because the answer was `True`, Python goes into the indented block under the `if`.
6 | The `else` block was skipped entirely. Now the program goes on with the first line that is not indented under it.
:::

:::drill python if and else
Write an `if` / `else` so that `message` is `"reorder"` when `stock` is below 20, and `"enough"` otherwise.
@starter
stock = 12
# write your if / else below this line

@check
has_node("If") ## Use an if (and an else).
message == "reorder" ## With stock 12, `message` should be "reorder".
rerun_with("stock", 50)["message"] == "enough" ## With stock 50, `message` should be "enough".
rerun_with("stock", 20)["message"] == "enough" ## With stock exactly 20, `message` should be "enough": 20 is not below 20.
@hint
```python
if stock < 20:
    message = "reorder"
else:
    message = "enough"
```
@solution
stock = 12
if stock < 20:
    message = "reorder"
else:
    message = "enough"
:::

### elif: more than two paths

`elif` ("else if") adds more questions. Python asks them **from the top**, runs the block of the **first** one that is `True`, and skips all the others:

```python
status = "refunded"
if status == "paid":
    print("count the revenue")
elif status == "cancelled" or status == "refunded":
    print("no revenue")
else:
    print("unknown status: send it to quarantine")
```

:::drill python Three paths
Set `action` by the `status`: `"paid"` gives `"count it"`; `"cancelled"` or `"refunded"` give `"skip it"`; anything else gives `"check it"`.
@starter
status = "refunded"
# write your if / elif / else below this line

@check
has_node("If") ## Use if / elif / else.
action == "skip it" ## With status "refunded", `action` should be "skip it".
rerun_with("status", "paid")["action"] == "count it" ## With status "paid", `action` should be "count it".
rerun_with("status", "cancelled")["action"] == "skip it" ## With status "cancelled", `action` should be "skip it".
rerun_with("status", "shipped")["action"] == "check it" ## With any other status (for example "shipped"), `action` should be "check it".
@hint
Start with `if status == "paid":`, then `elif status == "cancelled" or status == "refunded":`, then `else:`.
@solution
status = "refunded"
if status == "paid":
    action = "count it"
elif status == "cancelled" or status == "refunded":
    action = "skip it"
else:
    action = "check it"
:::

### and, or, not

Combine questions with `and` (both must be true), `or` (at least one) and `not` (turns the answer around). `status in {"cancelled", "refunded"}` is a short way to write several `or`.

:::drill python Both must be true
An order can be shipped when it is paid **and** there is stock. Make `can_ship` `True` only when `paid` is `True` and `stock` is above 0.
@starter
paid = True
stock = 5

# write your solution below this line
@check
can_ship is True ## With paid True and stock 5, `can_ship` should be True.
rerun_with("stock", 0)["can_ship"] is False ## With stock 0, `can_ship` should be False.
rerun_with("paid", False)["can_ship"] is False ## When `paid` is False, `can_ship` should be False.
uses("paid") and uses("stock") ## Use both variables in one question joined with `and`.
@hint
`paid and stock > 0`: the two questions joined with `and`.
@solution
paid = True
stock = 5
can_ship = paid and stock > 0
:::

### What counts as false: truthiness

In an `if`, some values count as **false** without being `False`: `0`, `""` (empty text), `None`, `[]` (empty list), `{}`. Everything else counts as true. So `if not rows:` means "if there are no rows". Be careful, though: `if total:` is also false for a total of `0`, which may be a perfectly valid value (a free order). When zero is legal, ask the exact question: `total is not None`.

:::ask What will this print?
```python
total = 0
if total:
    print("has a total")
else:
    print("no total")
```
@options
has a total
* no total
an error
@why
`0` counts as false in an `if`, so Python runs the `else`. This is exactly the trap: a free order (total `0`) would be treated as "no total". When `0` is a legal value, write `if total is not None:` instead.
:::

:::drill python Zero is a real value
`total` is `0`: the order was free, which is a real value. Make `has_total` `True` whenever `total` is not `None` (so `True` for `0`), and `False` when it is `None`.
@starter
total = 0

# write your solution below this line
@check
has_total is True ## With total 0, `has_total` should be True: a free order is still a total.
rerun_with("total", None)["has_total"] is False ## With total None, `has_total` should be False.
rerun_with("total", 250)["has_total"] is True ## With total 250, `has_total` should be True.
"is not None" in code ## Ask the exact question: total is not None.
@hint
`total is not None` is `True` for `0` and `False` only for `None`.
@solution
total = 0
has_total = total is not None
:::

### Negative numbers: abs()

`abs(n)` gives the distance from zero, always positive: `abs(-45000)` is `45000`. To show a negative number with the minus sign first, write `abs(n)` and put the sign in front yourself, with an `if` that checks whether `n` is below zero. Remember `str(n)` turns a number into text.

:::drill python The minus sign first
`n` is a whole number. Make `signed` its text: with a `-` in front when `n` is negative (`-450` gives `"-450"`), and just the digits otherwise (`450` gives `"450"`). Use `abs()`.
@starter
n = -450
# write your if / else below this line

@check
signed == "-450" ## With n -450, `signed` should be the text "-450".
rerun_with("n", 450)["signed"] == "450" ## With n 450, `signed` should be the text "450" (no minus).
rerun_with("n", 0)["signed"] == "0" ## With n 0, `signed` should be "0".
calls("abs") ## Use abs(n) to get the digits without the sign.
@hint
When `n < 0`: `"-" + str(abs(n))`. Otherwise: `str(n)`.
@solution
n = -450
if n < 0:
    signed = "-" + str(abs(n))
else:
    signed = str(n)
:::

### Division by zero is a decision problem

The average of a list is its sum divided by how many numbers it has. Python has two built-in helpers for that: `sum(values)` adds up all the numbers in a list, and `len(values)` counts the items. For an **empty** list the division would be by zero and Python stops with `ZeroDivisionError`. The average of nothing is not `0`, it does not exist: use `None`. Guard the dangerous case first with an `if`.

:::drill python The average of nothing
`scores` is a list of numbers. Make `mean` their average. When the list is empty there is no average: `mean` should be `None`.
@starter
scores = [80, 90, 70]
# write your if / else below this line

@check
mean == 80 ## With scores [80, 90, 70], `mean` should be 80.0.
rerun_with("scores", [])["mean"] is None ## With an empty list, `mean` should be None (and the program must not stop with ZeroDivisionError).
rerun_with("scores", [10])["mean"] == 10 ## With scores [10], `mean` should be 10.0.
calls("sum") and calls("len") ## Use sum(scores) / len(scores).
@hint
`if len(scores) == 0:` give `None`; `else:` the sum divided by the length.
@solution
scores = [80, 90, 70]
if len(scores) == 0:
    mean = None
else:
    mean = sum(scores) / len(scores)
:::

**Why decisions are everywhere in pipelines.** The rule of Module 0.2 is "never guess and never drop silently". In code that rule is an `if` with two branches: a valid row continues, an invalid row is put aside *with a reason*. An `else` that does nothing is how data disappears without a trace.

> 💡 **Practice Pause 3 (Part A, Step 3):**
> In `practice.py` (or the **Part A** tab), do **Step 3**:
> 1. `signed_text`: `signed_amount` written like Step 1, but a negative amount has the minus sign first, `-Rp 45.000`, and a positive one has none, `Rp 500`. Use `if`, and `abs()` from above.
> 2. `average`: the average of the numbers in `totals`, or `None` when `totals` is empty (`sum`, `len` and an `if`).
> Run the file, then check the step:
> `pytest labs/mod-0-0/test_practice.py -k Step3 -v`
> You should see `-Rp 45.000` and `87500.0`, and four passed checks. The checker also tries an empty `totals`: without your `if`, the file would stop with `ZeroDivisionError`, and the message tells you at which line.

## @lesson Repetition: for, while and comprehensions
A file has 100,000 rows. You cannot write 100,000 lines, so you write the instruction **once** and let the computer repeat it. That is a loop, and it is the engine of every data pipeline.

### for: do something for each item

A `for` loop takes the items of a list **one by one** and runs the indented lines once for each. Watch it happen:

:::trace Each round, a new item
@code
cities = ["Jakarta", "Bandung", "Medan"]
for city in cities:
    print(city)
print("done")
@notes
2 | A round starts: the name `city` is attached to the next item of the list.
3 | The indented line runs once for this item.
4 | The items ran out, so the loop is over and Python goes on with the next line that is not indented.
:::

:::drill python Show each item
Use a `for` loop to print every name in `names`, one per line.
@starter
names = ["Kopi", "Teh", "Susu"]
# write your loop below this line

@check
has_node("For") ## Use a for loop.
out == "Kopi\nTeh\nSusu" ## It should print Kopi, Teh and Susu, each on its own line.
rerun_with("names", ["a", "b"])["__out__"] == "a\nb" ## Your loop should work for any list: with ["a", "b"] it should print a and b.
@hint
`for name in names:` then, indented on the next line, `print(name)`.
@solution
names = ["Kopi", "Teh", "Susu"]
for name in names:
    print(name)
:::

### The accumulator: update a total every round

To add things up, start with a neutral value (`0`) **before** the loop, then update it in every round. This **accumulator pattern** is behind sums, counts, maximums and almost every aggregation you will write.

:::trace A total that grows
@code
prices = [25000, 18000, 30000]
total = 0
for price in prices:
    total = total + price
print(total)
@notes
2 | Before the loop: start with a neutral value. Nothing has been added yet.
4 | The new `total` is the old `total` plus this round's `price`. Watch the yellow row: `total` grows each round.
5 | The loop is over. `total` holds the sum of all the prices.
:::

:::ask What will this print?
```python
total = 0
for n in [1, 2, 3]:
    total = n
print(total)
```
@options
* 3
6
0
@why
`total = n` **replaces** `total` in every round, so after the last round it holds only the last number, 3. To add up you need `total = total + n`: the new value is built from the old one.
:::

:::drill python Add them all up
Use a `for` loop to make `total` the sum of the numbers in `prices`. Do not use the built-in `sum()`: the point here is the loop.
@starter
prices = [25000, 18000, 30000]
total = 0
# write your loop below this line

@check
has_node("For") ## Use a for loop.
total == 73000 ## `total` should be 73000.
rerun_with("prices", [5, 5])["total"] == 10 ## Your loop should work for any list: with [5, 5], `total` should be 10.
not calls("sum") ## Do not use sum(): write the loop yourself.
@hint
`for price in prices:` then, indented: `total = total + price`.
@solution
prices = [25000, 18000, 30000]
total = 0
for price in prices:
    total = total + price
:::

Data from a file arrives as text (Lesson 1), so inside the loop you usually convert each value with `int(...)` before you add it.

:::drill python Text prices
`texts` holds prices as text. Make `total` their sum **as numbers**.
@starter
texts = ["150000", "90000", "25000"]
total = 0
# write your loop below this line

@check
total == 265000 ## `total` should be the number 265000, not glued text.
type(total) is int ## `total` should be a number (int).
rerun_with("texts", ["1", "2"])["total"] == 3 ## With ["1", "2"], `total` should be 3.
@hint
Convert inside the loop: `total = total + int(text)`.
@solution
texts = ["150000", "90000", "25000"]
total = 0
for text in texts:
    total = total + int(text)
:::

### if inside a loop: only some of the items

Put an `if` inside the loop to treat some items differently. Each order below is a dictionary; its total is text.

:::drill python Skip the cancelled ones
Make `revenue` the sum of the totals (as numbers) of the orders whose status is **not** `"cancelled"`.
@starter
orders = [
    {"status": "paid", "total": "150000"},
    {"status": "cancelled", "total": "90000"},
    {"status": "paid", "total": "25000"},
]
revenue = 0
# write your loop below this line

@check
revenue == 175000 ## `revenue` should be 175000: the cancelled order (90000) must not count.
rerun_with("orders", [{"status": "cancelled", "total": "5"}])["revenue"] == 0 ## With only a cancelled order, `revenue` should stay 0.
rerun_with("orders", [{"status": "paid", "total": "7"}, {"status": "shipped", "total": "3"}])["revenue"] == 10 ## With a paid 7 and a shipped 3, `revenue` should be 10.
has_node("If") ## Use an if inside the loop.
@hint
```python
for order in orders:
    if order["status"] != "cancelled":
        revenue = revenue + int(order["total"])
```
@solution
orders = [
    {"status": "paid", "total": "150000"},
    {"status": "cancelled", "total": "90000"},
    {"status": "paid", "total": "25000"},
]
revenue = 0
for order in orders:
    if order["status"] != "cancelled":
        revenue = revenue + int(order["total"])
:::

### Counting with a dictionary

"How many per status, per city, per day" is the most common question in data. A dictionary keeps one count per name, and one line does the update:

```python
counts[status] = counts.get(status, 0) + 1
```

Read it from the right: `counts.get(status, 0)` is the count so far (`0` when this status has not been seen yet), `+ 1` adds this one, and the result is stored back under the same key. Remember this line; you will write it many times.

:::trace Counting per name
@code
statuses = ["paid", "cancelled", "paid"]
counts = {}
for status in statuses:
    counts[status] = counts.get(status, 0) + 1
print(counts)
@notes
2 | An empty dictionary: nothing counted yet.
4 | `counts.get(status, 0)` gives the count so far (0 for a new name), +1 adds this one, and the result is stored back. Watch the dictionary grow.
5 | When the loop is over, `counts` has one count per different status.
:::

:::drill python Count per city
`visits` lists the city of each visit. Make `counts` a dictionary with the number of visits per city, like `{"Jakarta": 3, ...}`.
@starter
visits = ["Jakarta", "Medan", "Jakarta", "Jakarta", "Medan", "Bandung"]
counts = {}
# write your loop below this line

@check
counts == {"Jakarta": 3, "Medan": 2, "Bandung": 1} ## `counts` should be {'Jakarta': 3, 'Medan': 2, 'Bandung': 1}.
rerun_with("visits", ["a", "b", "a"])["counts"] == {"a": 2, "b": 1} ## With ["a", "b", "a"], `counts` should be {'a': 2, 'b': 1}.
has_node("For") ## Use a for loop.
@hint
`for city in visits:` then `counts[city] = counts.get(city, 0) + 1`.
@solution
visits = ["Jakarta", "Medan", "Jakarta", "Jakarta", "Medan", "Bandung"]
counts = {}
for city in visits:
    counts[city] = counts.get(city, 0) + 1
:::

The same line can add **amounts** instead of ones: `totals[city] = totals.get(city, 0) + amount`. When each item is a pair, the loop can take the two parts apart in one go: `for city, amount in sales:`.

:::drill python Add up per name
`sales` holds `(city, amount)` pairs. Make `totals` a dictionary with the total amount per city, like `{"Jakarta": 125, ...}`.
@starter
sales = [("Jakarta", 100), ("Medan", 50), ("Jakarta", 25)]
totals = {}
# write your loop below this line

@check
totals == {"Jakarta": 125, "Medan": 50} ## `totals` should be {'Jakarta': 125, 'Medan': 50}.
rerun_with("sales", [("a", 1), ("b", 2), ("a", 3)])["totals"] == {"a": 4, "b": 2} ## With [("a", 1), ("b", 2), ("a", 3)], `totals` should be {'a': 4, 'b': 2}.
has_node("For") ## Use a for loop.
@hint
`for city, amount in sales:` then `totals[city] = totals.get(city, 0) + amount`.
@solution
sales = [("Jakarta", 100), ("Medan", 50), ("Jakarta", 25)]
totals = {}
for city, amount in sales:
    totals[city] = totals.get(city, 0) + amount
:::

### Walking through a dictionary: .items()

`counts.items()` gives the key **and** the value together, so a loop can take both: `for key, value in counts.items():`.

:::drill python Print each count
Print one line per entry of `counts`, in the form `paid: 3` (the key, a colon and a space, the value).
@starter
counts = {"paid": 3, "cancelled": 1}
# write your loop below this line

@check
out == "paid: 3\ncancelled: 1" ## It should print `paid: 3` on one line and `cancelled: 1` on the next.
uses("items") ## Use counts.items() to get the key and the value together.
rerun_with("counts", {"x": 2})["__out__"] == "x: 2" ## With {"x": 2}, it should print `x: 2`.
@hint
`for status, number in counts.items():` then `print(f"{status}: {number}")`.
@solution
counts = {"paid": 3, "cancelled": 1}
for status, number in counts.items():
    print(f"{status}: {number}")
:::

### Each value once: a set filled in a loop

A set keeps each value once. Start with an empty set (`seen = set()`) and put values in with `.add(x)`; adding a value that is already there changes nothing. Afterwards `sorted(...)` gives them in order.

:::drill python Each id once, as numbers
`texts` holds customer ids as text, with repeats. Make `unique_ids` a list of the different ids **as numbers**, smallest first. Fill a set in a loop with `.add()`.
@starter
texts = ["7", "3", "7", "5", "3"]
seen = set()
# write your loop below this line, then make unique_ids

@check
unique_ids == [3, 5, 7] ## `unique_ids` should be [3, 5, 7]: numbers (not text), each once, smallest first.
calls("add") ## Fill the set with seen.add(...) inside the loop.
has_node("For") ## Use a for loop.
rerun_with("texts", ["2", "2", "1"])["unique_ids"] == [1, 2] ## With ["2", "2", "1"], `unique_ids` should be [1, 2].
@hint
Inside the loop: `seen.add(int(text))`. After the loop: `unique_ids = sorted(seen)`.
@solution
texts = ["7", "3", "7", "5", "3"]
seen = set()
for text in texts:
    seen.add(int(text))
unique_ids = sorted(seen)
:::

### range(): numbers, and steps

`range(5)` gives 0, 1, 2, 3, 4 (**not** 5: it stops before the end). `range(2, 8)` gives 2 to 7. `range(0, 10, 3)` steps by three: 0, 3, 6, 9. Wrap it in `list(...)` to see the numbers. With a slice (Lesson 2) it cuts a long list into pieces: `items[3:6]` is positions 3, 4 and 5.

```python
print(list(range(0, 10, 3)))    # [0, 3, 6, 9]
```

:::drill python Where each piece starts
`items` has 10 items. A piece is 3 items long. Make `starts` the list of positions where each piece starts: `[0, 3, 6, 9]`. Use `range` with `len(items)`.
@starter
items = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]

# write your solution below this line
@check
starts == [0, 3, 6, 9] ## `starts` should be [0, 3, 6, 9].
calls("range") and calls("len") ## Use range(0, len(items), 3), wrapped in list(...).
rerun_with("items", [1, 2, 3, 4])["starts"] == [0, 3] ## With 4 items, `starts` should be [0, 3].
@hint
`list(range(0, len(items), 3))`: from 0, up to the length of `items`, in steps of 3.
@solution
items = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
starts = list(range(0, len(items), 3))
:::

### Skip one, or stop early

`continue` skips the rest of this round and goes to the next one. `break` leaves the loop completely.

:::ask What will this print?
```python
kept = []
for n in [1, 2, 3, 4]:
    if n == 3:
        continue
    kept.append(n)
print(kept)
```
@options
[1, 2, 3, 4]
* [1, 2, 4]
[1, 2]
@why
When `n` is 3, `continue` skips the `append`, so 3 is never added, but the loop **goes on** with 4. With `break` instead of `continue` the loop would stop at 3 and the list would be `[1, 2]`.
:::

### A loop in one line: the comprehension

A **comprehension** is a loop that builds a list in one expression: `[int(t) for t in texts]` means "for each `t` in `texts`, take `int(t)`". It is the same loop in short form. Use it when it fits on one clear line; when you need branches or several steps, write the normal loop. Readable beats clever.

:::drill python One line
Use a list comprehension to make `ints` from `texts`: every text converted to a number.
@starter
texts = ["7", "3", "12"]

# write your solution below this line
@check
ints == [7, 3, 12] ## `ints` should be [7, 3, 12], as numbers.
has_node("ListComp") ## Use a list comprehension: [ ... for ... in ...].
rerun_with("texts", ["5"])["ints"] == [5] ## With ["5"], `ints` should be [5].
@hint
`[int(text) for text in texts]`
@solution
texts = ["7", "3", "12"]
ints = [int(text) for text in texts]
:::

### Ranking with sorted() and a key

In data pipelines you often rank things (the customers who spent the most). `sorted(data, key=...)` takes a `key`: a small function that tells Python what to rank by. A one-line function written with `lambda` is often used: `lambda pair: pair[1]` means "given a pair, use its second item". To rank from biggest to smallest, add `reverse=True`. To break ties, let the key return a **tuple**: Python compares the first item first and looks at the second only when the first is equal. A minus sign in front of a number turns "biggest first" into "smallest first": `key=lambda pair: (-pair[1], pair[0])` ranks by total, biggest first, and for the same total by the smaller id first.

:::drill python Rank by total
`pairs` holds `(customer_id, total)` tuples. Make `ranked` the pairs sorted by total, **biggest first**; when two totals are equal, the smaller customer id comes first.
@starter
pairs = [(7, 100), (3, 100), (5, 250)]

# write your solution below this line
@check
ranked == [(5, 250), (3, 100), (7, 100)] ## `ranked` should be [(5, 250), (3, 100), (7, 100)].
has_node("Lambda") ## Use a key function written with lambda.
rerun_with("pairs", [(1, 5), (2, 9)])["ranked"] == [(2, 9), (1, 5)] ## With [(1, 5), (2, 9)], `ranked` should be [(2, 9), (1, 5)].
@hint
`sorted(pairs, key=lambda pair: (-pair[1], pair[0]))`: the minus sign makes the biggest total sort first, and the id breaks ties.
@solution
pairs = [(7, 100), (3, 100), (5, 250)]
ranked = sorted(pairs, key=lambda pair: (-pair[1], pair[0]))
:::

### while: repeat as long as a condition is true

A `while` loop repeats **as long as a question stays `True`**. Use it when you do not know how many rounds you need (retrying, reading until the end). The danger: if nothing inside the loop ever makes the question false, it runs forever. Always ask: "what changes inside the loop so that it ends?"

:::ask What does n hold at the end?
```python
n = 3
while n > 0:
    n = n - 1
print(n)
```
@options
3
1
* 0
@why
Each round takes 1 away: 3, 2, 1, 0. When `n` is 0 the question `n > 0` is `False`, the loop stops, and `n` is 0. Without the line `n = n - 1` the question would stay `True` forever.
:::

:::drill python How many times?
How many times can you take `3` away from `n` while `n` is still at least 3? Count the rounds in `steps`, using a `while` loop (for `n = 10`: 10, 7, 4 are all at least 3, so `steps` is 3).
@starter
n = 10
steps = 0
# write your while loop below this line

@check
has_node("While") ## Use a while loop.
steps == 3 ## With n 10, `steps` should be 3.
rerun_with("n", 30)["steps"] == 10 ## With n 30, `steps` should be 10.
rerun_with("n", 2)["steps"] == 0 ## With n 2, `steps` should be 0: the loop must not run at all.
@hint
`while n >= 3:` then, indented: `n = n - 3` and `steps = steps + 1`.
@solution
n = 10
steps = 0
while n >= 3:
    n = n - 3
    steps = steps + 1
:::

> 💡 **Practice Pause 4 (Part A, Step 4):**
> In `practice.py` (or the **Part A** tab), do **Step 4**. One `for order in orders:` loop can build several results at once. Before the loop, start `status_counts` as `{}`, `revenue` as `0`, and a set for the ids (`ids = set()`):
> 1. `status_counts`: orders per status, `{"paid": 2, "cancelled": 1, "delivered": 1}` (the counting line from this lesson).
> 2. `revenue`: the sum of the totals, as numbers, of the orders whose status is not `"cancelled"` and not `"refunded"`.
> 3. `customer_ids`: the different `customer_id` values as whole numbers, smallest first (fill the set inside the loop with `.add(...)`, which puts one value into a set, then use `sorted`).
> 4. `batches`: `items` cut into pieces of at most `batch_size`, in order, `[[1, 2], [3, 4], [5]]` (`range` with a step, and a slice).
> Run the file, then check the step:
> `pytest labs/mod-0-0/test_practice.py -k Step4 -v`
> You should see `{'paid': 2, 'cancelled': 1, 'delivered': 1}`, `235000`, `[3, 5, 7]` and `[[1, 2], [3, 4], [5]]`. When all 15 Part A checks pass (`pytest labs/mod-0-0/test_practice.py -v`), you have written, with plain code, the inside of what Part B turns into functions.

## @part Functions, errors and files

## @lesson Functions: def, parameters and return
Look at the loop that sums totals. If you need the same sum in five places, you do not copy five loops. You give the lines a **name** and reuse them. That is a function, and it exists for three reasons: **reuse** (write once), **clarity** (a good name explains the purpose, so `total_revenue(orders)` is read like a sentence), and **testing** (a small function with one input and one output can be checked automatically, which is how the lab works).

### def: give some lines a name

`def` means "define". The indented lines under it are the **body**. Defining a function does **not** run it, it only describes it. To run the body you **call** the function by writing its name followed by brackets:

```python
def say_hello():
    print("Hello")

say_hello()
say_hello()
```

:::trace Define once, call twice
@code
def say_hello():
    print("Hello")

say_hello()
say_hello()
@notes
1 | `def` only describes the function and gives it a name. Nothing is printed yet.
4 | A call: Python jumps into the function body. Look at the new box on the right: every call gets its own space for its variables.
2 | The body runs.
5 | Called again: the same body runs a second time.
:::

:::drill python Define and call
Define a function `show_paid` that prints the word `paid`. Then call it once.
@starter
# write your function and your call below this line

@check
defines("show_paid") ## Define a function named show_paid: def show_paid():
out == "paid" ## Calling it once should print: paid
calls("show_paid") ## Call the function: show_paid()
@hint
```python
def show_paid():
    print("paid")

show_paid()
```
@solution
def show_paid():
    print("paid")

show_paid()
:::

### Parameters: give the function an input

Between the brackets you list **parameters**: names for the inputs. When you call the function, the value you pass (the **argument**) is attached to the parameter name for the duration of the call.

```python
def show_total(total):
    print("Rp", total)

show_total(5000)       # total is 5000 during this call
show_total(7500)       # total is 7500 during this call
```

:::drill python A function with an input
Define `show_label(label)` that prints `Label: ` followed by the label (for `"Kopi"` it prints `Label: Kopi`). Then call it with `"Kopi"`.
@starter
# write your function and your call below this line

@check
defines("show_label") ## Define a function named show_label with one parameter.
out == "Label: Kopi" ## Calling show_label("Kopi") should print: Label: Kopi
printed_by(show_label, "Teh") == "Label: Teh" ## show_label("Teh") should print: Label: Teh (use the parameter, do not type Kopi inside the function).
@hint
```python
def show_label(label):
    print("Label:", label)
```
`print` puts a space between its values, so `print("Label:", label)` gives `Label: Kopi`.
@solution
def show_label(label):
    print("Label:", label)

show_label("Kopi")
:::

### return: hand the answer back

`print` only **shows** something on the screen; the program cannot use it afterwards. `return` **hands a value back** to the code that called the function, so that it can store it, compare it or pass it on. A function that prints but does not return gives `None` to the caller. Pipelines run without a screen, so functions must **return** their results.

:::trace return hands a value back
@code
def double(n):
    result = n * 2
    return result

x = double(4)
print(x)
@notes
5 | The call `double(4)`: `n` will be 4 inside the function.
2 | The function works out `n * 2` and keeps it in `result`. This `result` exists only inside the function.
3 | `return` hands the value back and leaves the function.
6 | Back outside: `x` now holds what the function returned (8).
:::

:::ask What will this print?
```python
def double(n):
    print(n * 2)

x = double(4)
print(x)
```
@options
8
* 8 and then None
8 and then 8
@why
This version **prints** 8 inside the function (that is the first line), but it does not `return` anything. A function without `return` gives back `None`, so `x` is `None` and the last line prints `None`. Printing is for people; `return` is for the program.
:::

:::drill python Return, not print
Write `double(n)` so that it **returns** twice `n` (do not print inside it).
@starter
# write your function below this line

@check
defines("double") ## Define a function named double with one parameter.
double(4) == 8 ## double(4) should give back 8 (use return).
double(0) == 0 ## double(0) should give back 0.
double(2.5) == 5.0 ## double(2.5) should give back 5.0.
has_node("Return") ## Use return to hand the answer back.
@hint
```python
def double(n):
    return n * 2
```
@solution
def double(n):
    return n * 2
:::

:::drill python Two inputs
Write `total_price(price, quantity)` that returns the price times the quantity.
@starter
# write your function below this line

@check
defines("total_price") ## Define a function named total_price with two parameters.
total_price(25000, 3) == 75000 ## total_price(25000, 3) should give back 75000.
total_price(10, 0) == 0 ## total_price(10, 0) should give back 0.
has_node("Return") ## Use return to hand the answer back.
@hint
Two parameters are separated by a comma: `def total_price(price, quantity):`.
@solution
def total_price(price, quantity):
    return price * quantity
:::

### Default values

`def format_money(amount, symbol="Rp"):` means the caller may leave `symbol` out; then it is `"Rp"`.

:::drill python A default value
Write `format_money(amount, symbol="Rp")` that returns the symbol, a space and the amount: `format_money(500)` gives `"Rp 500"`, and `format_money(5, "USD")` gives `"USD 5"`.
@starter
# write your function below this line

@check
defines("format_money") ## Define a function named format_money.
format_money(500) == "Rp 500" ## format_money(500) should give back "Rp 500".
format_money(5, "USD") == "USD 5" ## format_money(5, "USD") should give back "USD 5".
format_money(7, symbol="SGD") == "SGD 7" ## You can also name the argument: format_money(7, symbol="SGD").
@hint
```python
def format_money(amount, symbol="Rp"):
    return f"{symbol} {amount}"
```
@solution
def format_money(amount, symbol="Rp"):
    return f"{symbol} {amount}"
:::

### A function that answers yes or no

A function that returns `True` or `False` gives a name to a question. Then your loops read like sentences.

:::drill python A yes or no function
Write `is_paid(order)` that returns `True` when the order's `"status"` is `"paid"`, and `False` otherwise.
@starter
# write your function below this line

@check
defines("is_paid") ## Define a function named is_paid with one parameter.
is_paid({"status": "paid"}) is True ## is_paid({"status": "paid"}) should give back True.
is_paid({"status": "shipped"}) is False ## is_paid({"status": "shipped"}) should give back False.
@hint
Return the answer of the question itself: `return order["status"] == "paid"`.
@solution
def is_paid(order):
    return order["status"] == "paid"
:::

:::drill python Use your own function
`is_paid` is written for you. Use it in a loop to make `paid_count` the number of paid orders in `orders`.
@starter
def is_paid(order):
    return order["status"] == "paid"

orders = [{"status": "paid"}, {"status": "cancelled"}, {"status": "paid"}]
paid_count = 0
# write your loop below this line

@check
paid_count == 2 ## `paid_count` should be 2.
calls("is_paid") ## Call is_paid(order) inside the loop.
rerun_with("orders", [{"status": "shipped"}])["paid_count"] == 0 ## With no paid order, `paid_count` should stay 0.
@hint
```python
for order in orders:
    if is_paid(order):
        paid_count = paid_count + 1
```
@solution
def is_paid(order):
    return order["status"] == "paid"

orders = [{"status": "paid"}, {"status": "cancelled"}, {"status": "paid"}]
paid_count = 0
for order in orders:
    if is_paid(order):
        paid_count = paid_count + 1
:::

### Names inside a function stay inside

**Scope**: names created inside a function exist only while it runs; the outside world cannot see them. That is a feature: a function cannot accidentally break your other variables. Prefer functions that depend only on their inputs and return a result without changing anything else (**pure functions**). They are easy to test and safe to run twice, which is the property pipelines need (Module 0.2: idempotence).

:::ask What will this print?
```python
def make_label():
    label = "Rp 500"

make_label()
print(label)
```
@options
`Rp 500`, the function made it
`None`, the function returned nothing
* an error: `label` exists only inside the function
@why
`label` was created **inside** `make_label`, and it disappears when the function ends. The last line looks for `label` outside and Python stops with `NameError: name 'label' is not defined`. To get the value out, the function must `return` it.
:::

### A trap to meet now: a list as a default value

Never use a *mutable* value (a list or dictionary) as a default: `def add(item, box=[]):`. Python creates that list **once**, when the `def` line is read, and every call that omits `box` shares it. Predict first:

:::ask What does the second call print?
```python
def add(item, box=[]):
    box.append(item)
    return box

print(add(1))
print(add(2))
```
@options
* [1, 2]
[2]
[1]
@why
The default list is created once and **kept**. The first call puts 1 in it; the second call starts with that same list, which already holds 1, and adds 2. Watch it in the next animation: the list keeps the same label, `list#1`.
:::

:::trace One list, shared by every call
@code
def add(item, box=[]):
    box.append(item)
    return box

print(add(1))
print(add(2))
@notes
1 | The default `[]` is created **now**, once, when the `def` line is read.
6 | The second call: `box` is not given, so it is the **same** list as before (same label), which already holds 1.
:::

The fix: use `None` as the default and create a new list inside: `if box is None: box = []`. The chaos scenario of this module shows what the bug does to a real pipeline, and the lab has a test for it.

:::drill python Fix the shared list
`add` has the trap. Fix it so every call without a second argument starts with a **fresh** empty list: `add(1)` gives `[1]` and then `add(2)` gives `[2]`.
@starter
def add(item, box=[]):
    box.append(item)
    return box

# write your solution below this line
@check
add(1) == [1] ## add(1) should give back [1].
add(2) == [2] ## add(2) should give back [2], not [1, 2]: every call without a list must start fresh.
add(3, [1, 2]) == [1, 2, 3] ## add(3, [1, 2]) should still give back [1, 2, 3].
"box=None" in code.replace(" ", "") ## Use None as the default: box=None, and create the list inside the function.
@hint
```python
def add(item, box=None):
    if box is None:
        box = []
    box.append(item)
    return box
```
@solution
def add(item, box=None):
    if box is None:
        box = []
    box.append(item)
    return box
:::

**Typing a function at the `>>>` prompt.** After a line that ends with `:`, such as `def double(n):`, Python shows `...` and indents the next line for you. When the function is complete, press **Enter once more on the empty line** to finish it; without that empty line, the next thing you type becomes part of the function. For anything longer than two lines, a file is easier.

> 🛠 **Try it (8 min, in a file `fn.py`).** Predict each output in your head first, then run it.
> 1. Write `def show_square(n): print(n * n)` and `def give_square(n): return n * n` (each on its own lines as usual). Run `a = show_square(4)` and `b = give_square(4)`, then `print(a, b)`.
> 2. Write `def add(item, box=[]): box.append(item); return box` (on proper lines) and run `print(add(1))`, `print(add(2))`, `print(add(3))`. Then fix it so that every call without a second argument starts with a fresh empty list.
> 3. Write `total(orders)` that adds up `int(order["total_idr"])` over a list of order dicts, with no `print` inside. Check it with `total([{"total_idr": "100"}, {"total_idr": "250"}]) == 350` and `total([]) == 0`.
>
> **You should see:** `16` printed by step 1, then `None 16` (`print` shows, `return` hands back); the buggy `add` prints `[1]`, `[1, 2]`, `[1, 2, 3]` and your fixed one `[1]`, `[2]`, `[3]`; both checks of step 3 are `True`.

> 💡 **Practice Pause 5 (Part B: open the functions):**
> Part B is the second half of the lab: the **Part B** tab of the Browser preview, or `labs/mod-0-0/basics.py` in your editor. Each function there starts like `def format_rupiah(amount):`, then its description between `"""`, then `raise NotImplementedError(...)`: a placeholder that means "not written yet". Delete that line and put the code you wrote in Part A in its place, with two changes: the value comes in as the parameter (`amount`, `orders`) instead of a variable at the top of the file, and the answer leaves with `return` instead of being stored in a variable.
> Before, in Part A (Step 1):
>
> ```python
> amount = 1250000                 # given to you
> formatted = ...                  # your line from Step 1
> ```
>
> After, in Part B:
>
> ```python
> def format_rupiah(amount):       # the test gives `amount`
>     text = ...                   # the same line, indented
>     return text
> ```
>
> A test calls `format_rupiah(1250000)` and compares what you `return` with `"Rp 1.250.000"`. Then add the `if` from Step 3 for negative amounts.
> Do it for `format_rupiah` (Steps 1 and 3), `count_by_status` (Step 4), `unique_customer_ids` (Steps 2 and 4), `average_total` (the average of Step 3, over the orders' totals), `total_revenue` and `batches` (Step 4), and `top_customers` (Lesson 4's `sorted` with a `key`). On the Browser preview click **Run tests**; on the terminal route, `pytest` runs the automated checks (`-k TestFormatRupiah` runs just that one group, `-v` prints each test name):
> `pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v`
> Then go on to Lesson 6.

## @lesson When things go wrong: errors and try/except
Errors are not failures of the learner; they are the program telling you precisely what it could not do. Learn to read them, and they become the most useful thing on your screen.

### Reading an error

When Python stops it prints a **traceback**: the path of calls that led to the problem. **Read it from the bottom.** The last line names the error type and a message; the lines above it show where it happened, and the last line that points into *your* code is usually the place to look.

```python
order = {"order_id": "1001", "status": "paid"}
print(order["total_idr"])
```

Run that one with the button below the code: the last line says `KeyError: 'total_idr'`, because the dictionary has no such key. The errors you will meet constantly:

| Error | Meaning | Example |
|---|---|---|
| `ValueError` | right type, impossible value | `int("abc")` |
| `TypeError` | the wrong type for this action | `"a" + 1` |
| `KeyError` | a dictionary key is missing | `order["note"]` |
| `IndexError` | a list position is too big | `[1, 2, 3][5]` |
| `ZeroDivisionError` | dividing by zero | `10 / 0` |
| `FileNotFoundError` | the file is not there | `open("nope.csv")` |
| `NameError` | a name Python does not know (often a typo) | `totl` |

:::ask Which error is this?
```python
number = int("Rp 1.250.000")
```
@options
TypeError
KeyError
* ValueError
@why
`int` is the right tool for text, but this text is not a whole number: the **type** is fine and the **value** is impossible. That is a `ValueError`. A `TypeError` would be, for example, adding text and a number.
:::

:::ask Which error is this?
```python
statuses = ["paid", "cancelled", "paid"]
print(statuses[3])
```
@options
* IndexError
KeyError
ValueError
@why
The list has three items, at positions 0, 1 and 2. Position 3 does not exist: `IndexError: list index out of range`. A `KeyError` is the same idea for a dictionary key.
:::

### try / except: catch an error you expect

You can **catch** an error you expect and decide what to do instead of stopping:

:::trace try and except
@code
text = "abc"
try:
    n = int(text)
    print("converted")
except ValueError:
    n = 0
print(n)
@notes
3 | `int("abc")` fails with a `ValueError`. The rest of the `try` block is abandoned.
5 | Python jumps to the matching `except`. The line `print("converted")` was never run.
7 | The program goes on normally, with `n` set to 0.
:::

How it runs: Python tries the block under `try`. If everything works, the `except` is skipped. If a `ValueError` happens, the rest of the `try` is abandoned and the `except` block runs instead.

:::drill python Catch the bad value
Write `to_number(text)` that returns `int(text)`, or `0` when the text is not a whole number.
@starter
# write your function below this line

@check
defines("to_number") ## Define a function named to_number with one parameter.
to_number("42") == 42 ## to_number("42") should give back 42.
to_number("abc") == 0 ## to_number("abc") should give back 0: the error is caught.
to_number("") == 0 ## to_number("") should give back 0.
has_node("Try") ## Use try / except.
@hint
```python
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
```
@solution
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
:::

### Catch only what you expect

Three rules separate good pipelines from dangerous ones:

1. **Catch the specific error you expect.** `except ValueError` is a plan. `except Exception: pass` (or a bare `except:`) is a decision to hide every future bug: a typo, a missing file, a real data problem all vanish silently, and wrong numbers appear with no sign of trouble. Module 1.2 shows how expensive that is.
2. **Keep the `try` block small**: only the line that can fail.
3. **Raise on purpose** when your function cannot do its job: `raise ValueError("total must not be negative")`. Failing loudly early is better than passing bad data on.

:::drill python Hide only what you expect
`to_number` catches **every** kind of error. A missing value (`None`) is a different problem and must not be hidden as `0`: `int(None)` raises a `TypeError`. Change the function so it catches only `ValueError`.
@starter
def to_number(text):
    try:
        return int(text)
    except Exception:
        return 0

# write your solution below this line
@check
to_number("abc") == 0 ## to_number("abc") should still give back 0.
raises_error(TypeError, to_number, None) ## to_number(None) should raise a TypeError (not hide it as 0). Catch only ValueError.
@hint
Change `except Exception:` to `except ValueError:`.
@solution
def to_number(text):
    try:
        return int(text)
    except ValueError:
        return 0
:::

:::drill python Raise on purpose
Write `check_total(total)` that returns `total` when it is not negative, and **raises** `ValueError("total must not be negative")` when it is below zero.
@starter
# write your function below this line

@check
defines("check_total") ## Define a function named check_total with one parameter.
check_total(500) == 500 ## check_total(500) should give back 500.
check_total(0) == 0 ## check_total(0) should give back 0: zero is allowed.
raises_error(ValueError, check_total, -1) ## check_total(-1) should raise a ValueError.
@hint
```python
def check_total(total):
    if total < 0:
        raise ValueError("total must not be negative")
    return total
```
@solution
def check_total(total):
    if total < 0:
        raise ValueError("total must not be negative")
    return total
:::

### A bad row is data, a bug is not

A bad row from a customer is *expected* data, so you handle it: put it aside **with a reason**, never drop it silently. A missing file or a programming mistake is *not* expected, so let it fail loudly.

:::drill python Set the bad ones aside
`rows` holds values as text; some are not numbers. Fill `good` with the numbers (as `int`) and `bad` with the texts that could not be converted, both in the original order. Use `try` / `except ValueError` inside a loop.
@starter
rows = ["10", "x", "25", "", "7"]
good = []
bad = []
# write your loop below this line

@check
good == [10, 25, 7] ## `good` should be [10, 25, 7].
bad == ["x", ""] ## `bad` should be ['x', '']: nothing is dropped silently.
rerun_with("rows", ["1", "b"])["good"] == [1] and rerun_with("rows", ["1", "b"])["bad"] == ["b"] ## With ["1", "b"], `good` should be [1] and `bad` should be ['b'].
has_node("Try") ## Use try / except inside the loop.
@hint
```python
for text in rows:
    try:
        good.append(int(text))
    except ValueError:
        bad.append(text)
```
@solution
rows = ["10", "x", "25", "", "7"]
good = []
bad = []
for text in rows:
    try:
        good.append(int(text))
    except ValueError:
        bad.append(text)
:::

> 💡 **Practice Pause 6 (Part B):**
> Apply pure functions, error handling, and avoiding the mutable default bug:
> 1. Implement `safe_int(text, default=None)` with a `try / except ValueError` block.
> 2. Implement `add_to_batch(order, batch=None)` using `if batch is None: batch = []`.
> 3. Implement `split_valid(orders)` using your `safe_int` function.
> Click **Run tests**; all three groups should show ✓ (terminal route):
> `pytest labs/mod-0-0/test_lab.py -k "TestSafeInt or TestAddToBatch or TestSplitValid" -v`

## @lesson Files, imports and running a script
Programs read files, and a data engineer reads a lot of them. The standard pattern uses `open`, `with` and a reader. This lesson builds it up one piece at a time. The drills give you small sample files, so you can try everything in your browser.

### Open a file and read its text

```python
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
```

Why each part. `open` gives you a connection to the file. **`with`** guarantees the file is closed when the block ends, even if an error happens inside, so you never leak open files (a real problem in long-running jobs). `encoding="utf-8"` says how bytes become text; leaving it out means your program behaves differently on different computers. `f.read()` gives the whole content as one text.

:::drill python Read a file
The file `note.txt` is next to your code. Read all of its text into `text`, with `with open(...)`.
@file note.txt
Kopi Susu: 25000
@starter
# write your lines below this line

@check
text.strip() == "Kopi Susu: 25000" ## `text` should be the content of note.txt: Kopi Susu: 25000
has_node("With") ## Use a with block, so the file is always closed.
calls("open") ## Use open("note.txt", ...).
@hint
```python
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
```
@solution
with open("note.txt", encoding="utf-8") as f:
    text = f.read()
:::

### A CSV file: rows as dictionaries

A CSV file is text with one row per line and commas between the values; the first line holds the column names. The `csv` module reads it. `csv.DictReader(f)` turns each row into a dictionary, using the header line as keys, so you get exactly the **list of dictionaries** of Lesson 2. `newline=""` is what the csv module wants so that line breaks inside quoted values survive. All values are text; converting them is your job.

:::trace From a CSV file to a list of dictionaries
@file drinks.csv
name,price_idr
Kopi,25000
Teh,18000
@code
import csv

with open("drinks.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

print(rows[0])
@notes
3 | The file is opened. `with` will close it for us at the end of the block.
4 | `csv.DictReader` reads the header line (`name,price_idr`) and turns each following line into a dictionary. `list(...)` collects them all.
6 | `rows[0]` is the first row: a dictionary with the header names as keys. Both values are text.
:::

:::drill python Read a CSV
`products.csv` is next to your code (columns `sku`, `name` and `price_idr`). Read it into `rows`, a list of dictionaries, and print how many rows there are.
@file products.csv
sku,name,price_idr
K1,Kopi Susu,25000
K2,Americano,22000
K3,Teh Tarik,18000
@starter
import csv
# write your lines below this line

@check
len(rows) == 3 ## `rows` should hold 3 dictionaries, one per line under the header.
rows[0]["name"] == "Kopi Susu" ## The first row's "name" should be Kopi Susu.
out == "3" ## Print the number of rows: print(len(rows)).
calls("DictReader") ## Use csv.DictReader(f).
@hint
```python
with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(len(rows))
```
@solution
import csv
with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(len(rows))
:::

:::drill python Add up a column
`rows` is already read for you. Make `total` the sum of the `price_idr` column **as numbers**.
@file products.csv
sku,name,price_idr
K1,Kopi Susu,25000
K2,Americano,22000
K3,Teh Tarik,18000
@starter
import csv

with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

total = 0
# write your loop below this line

@check
total == 65000 ## `total` should be 65000: the three prices as numbers.
has_node("For") ## Use a for loop.
calls("int") ## The values are text: convert them with int(...).
@hint
```python
for row in rows:
    total = total + int(row["price_idr"])
```
@solution
import csv

with open("products.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

total = 0
for row in rows:
    total = total + int(row["price_idr"])
:::

### Writing a file

Open with `"w"` to **write**. Careful: `"w"` empties the file first. `f.write(text)` puts the text in; add `\n` for a line break.

:::drill python Write a report
Write the text `Total: 65000` into a new file `report.txt`, with `with open("report.txt", "w", ...)`.
@starter
# write your lines below this line

@check
read_file("report.txt").strip() == "Total: 65000" ## report.txt should contain: Total: 65000
has_node("With") ## Use a with block.
@hint
```python
with open("report.txt", "w", encoding="utf-8") as f:
    f.write("Total: 65000")
```
@solution
with open("report.txt", "w", encoding="utf-8") as f:
    f.write("Total: 65000")
:::

### import: code written by someone else

An **import** brings in code written by someone else. The **standard library** ships with Python and needs no installation: `csv`, `json`, `pathlib`, `datetime`, `statistics`. Other libraries (pandas, pydantic) are installed with `pip` into your virtual environment (Module 0.1).

:::drill python Use the standard library
Import the `statistics` module and make `average` the mean of `prices` with `statistics.mean(...)`.
@starter
prices = [25000, 22000, 18000]
# write your lines below this line

@check
average == 21666.666666666668 ## `average` should be the mean of the three prices (about 21666.67).
calls("mean") ## Use statistics.mean(prices).
rerun_with("prices", [10, 20])["average"] == 15 ## With [10, 20], `average` should be 15.
@hint
`import statistics`, then `average = statistics.mean(prices)`.
@solution
import statistics

prices = [25000, 22000, 18000]
average = statistics.mean(prices)
:::

### Your own file is a module, and __main__

Your own file `basics.py` is a **module** too: `import basics` runs it once and gives you its functions as `basics.total_revenue(...)`. That is how the lab tests use your code. You run a script with `python3 myfile.py`. A common line at the bottom of scripts is:

```python
if __name__ == "__main__":
    main()
```

Python sets the special name `__name__` to `"__main__"` only when the file is *run directly*. When another file imports it, `__name__` is the module's name instead, so `main()` does not run. The effect: the file works both as a program and as a library you can test.

:::ask The file shop.py is run directly: `python3 shop.py`
```python
# shop.py
def main():
    print("running")

if __name__ == "__main__":
    main()
```
@options
nothing
* running
an error
@why
Run directly, `__name__` is `"__main__"`, so the `if` is true and `main()` runs: `running` is printed.
:::

:::ask Another file does `import shop`. What does the import print?
```python
# shop.py
def main():
    print("running")

if __name__ == "__main__":
    main()
```
@options
* nothing
running
an error
@why
On import, `__name__` is `"shop"`, not `"__main__"`, so `main()` is **not** called: the import only makes the functions available. That is why a test can import your file without starting the program.
:::

### Paths: where is the file?

Use `pathlib.Path("data") / "orders.csv"` instead of gluing strings. A **relative** path is relative to the folder you started Python in, which is the usual reason for the error below.

:::ask What happens when the file is not there?
```python
with open("missing.csv", encoding="utf-8") as f:
    data = f.read()
```
@options
ValueError
* FileNotFoundError
an empty `data`
@why
Python stops with `FileNotFoundError: No such file or directory`. When you see it, check the **folder you started Python in** and the spelling of the path, before anything else.
:::

> 💡 **Practice Pause 7 (Part B: complete the lab):**
> In `basics.py`, implement the final function `read_orders(path)` using `with open(...)` and `csv.DictReader`.
> Click **Run tests** on each part, or run everything in the terminal: all 46 checks should pass, 15 in Part A and 31 in Part B:
> `pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v`
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

Notice what happened: `main` contains no details. Each function has one job and a name that says it. This is how professional pipelines stay readable. Watch a small version run, and look at the boxes on the right: `main()` calls `total_revenue(...)`, and each call gets its own box with its own variables.

:::trace A small pipeline, function by function
@code
def read_orders():
    return [{"status": "paid", "total": "100"}, {"status": "cancelled", "total": "50"}]

def total_revenue(orders):
    total = 0
    for order in orders:
        if order["status"] != "cancelled":
            total = total + int(order["total"])
    return total

def main():
    orders = read_orders()
    print(total_revenue(orders))

main()
@notes
15 | The program starts here: everything above only defined functions. Now `main()` is called.
12 | `main` first asks `read_orders()` for the data.
13 | Then it passes the rows to `total_revenue`. A new box appears for that call, with its own `total`.
8 | Only the paid order is added: the cancelled one is skipped by the `if`.
9 | `return` hands the result back to `main`, and the `total_revenue` box disappears.
:::

### How to read code you did not write

Start at the bottom (usually the entry point), then read each function's name and parameters before its body. Pick a tiny input and **trace** it by hand, writing the value of each variable on paper after each line. If your prediction and the output differ, you found the line you misunderstood. The animations in this course do the same for you; the free tool pythontutor.com does it for any code.

### How to debug

1. **Read the error from the bottom.**
2. **Reproduce it with the smallest input.**
3. **Print or inspect the value just before the failing line** (`print(type(x), x)` answers half of all bugs).
4. **Change one thing at a time.**
5. **Write a test that fails because of the bug**, fix the code, and keep the test so the bug never returns.

Practise on three small bugs. Each one starts broken: run it, read what it tells you, and fix it with the routine above.

:::drill python Bug 1: an error
This stops with an error. Read the last line of the message, and fix the code so that `total` is the number `43000`.
@starter
prices = ["25000", "18000"]
total = 0
for price in prices:
    total = total + price

# write your solution below this line
@check
total == 43000 ## `total` should be 43000.
type(total) is int ## `total` should be a number (int).
@hint
The error is a `TypeError`: you cannot add text to a number. The prices are text (Lesson 1): convert each with `int(price)`.
@solution
prices = ["25000", "18000"]
total = 0
for price in prices:
    total = total + int(price)
:::

:::drill python Bug 2: no error, wrong output
This should print the numbers 1 to 5, but it prints 0 to 4. Fix it, without writing the numbers by hand.
@starter
for n in range(5):
    print(n)

# write your solution below this line
@check
out == "1\n2\n3\n4\n5" ## It should print 1, 2, 3, 4 and 5, each on its own line.
has_node("For") ## Keep the for loop.
@hint
`range(5)` starts at 0 and stops before 5. Give it a start and a stop: `range(1, 6)`.
@solution
for n in range(1, 6):
    print(n)
:::

:::drill python Bug 3: the answer disappears
`add_fee` should give back the price plus a fee of 500, but it gives `None`. Why? Fix it.
@starter
def add_fee(price):
    price + 500

# write your solution below this line
@check
add_fee(1000) == 1500 ## add_fee(1000) should give back 1500.
add_fee(0) == 500 ## add_fee(0) should give back 500.
@hint
The function works out `price + 500` and then throws the result away. Which keyword hands a value back?
@solution
def add_fee(price):
    return price + 500
:::

### Tests: a first look

A test is just code that calls your function and compares with the expected answer:

```python
def test_format_rupiah():
    assert format_rupiah(1250000) == "Rp 1.250.000"
```

`assert` raises an error if the condition is false, and does nothing when it is true. A test tool (pytest) finds the functions named `test_...`, runs them all and reports which failed and why. The lab has 46 such tests: read a failing test as a **specification** (it tells you exactly what is expected), not as an obstacle.

:::drill python Write your own assertions
`double` is written for you. Add at least **two** `assert` lines that check it, with different numbers. They must pass.
@starter
def double(n):
    return n * 2

# write your assert lines below this line

@check
count_nodes("Assert") >= 2 ## Write at least two assert lines, for example: assert double(2) == 4
@hint
`assert double(2) == 4` and `assert double(10) == 20`. When an assert is true, nothing happens; when it is false, Python stops with an AssertionError.
@solution
def double(n):
    return n * 2

assert double(2) == 4
assert double(10) == 20
:::

You will not remember everything after one reading, and you are not supposed to. Type the examples, break them on purpose, and look at the error messages. Each lab function practises one lesson; do them in order and run the tests after each.

> 🛠 **Try it (15 min).** Run `python3 labs/mod-0-0/debug_me.py`. It holds three small functions, each with one bug, and prints PASS or FAIL for each. Fix them one at a time with the routine from this lesson: read the error from the bottom, reproduce it with the smallest input, inspect the value just before the failing line. Do not rewrite a function; find the bug.
>
> **You should see:** three FAIL lines at first (one `TypeError`, two wrong answers) and `all three fixed` at the end. Then write one sentence per bug: what was the clue that led you to it? That sentence is the skill.

**Where these ideas show up in a data engineer's day.** It is fair to ask what these small exercises have to do with the job. Almost every task you will be given is these same ideas, only bigger:
- **Types:** data arrives as text; you give each value its right type before anything else, or totals come out wrong without an error.
- **Lists and dicts:** a file or a table is a list of rows; each row is a dict of column to value.
- **Counting with a dict:** "how many per city, per status, per day" is the most common question in data; SQL's `GROUP BY` (Module 0.3) is the same idea.
- **Sets:** removing duplicates, and asking "have we already loaded this?".
- **if and try/except:** deciding which rows are valid, and setting the bad ones aside instead of crashing or silently dropping them.
- **Functions with tests:** every step of a pipeline is a function, and its tests are how you know it still works after tomorrow's change.

The labs grow from here: in Module 1.2 the same ideas become a real pipeline that reads files, converts types, quarantines bad rows and can be re-run safely. If something in this module still feels unclear, that is normal after one reading: re-read the lesson whose Practice Pause was hardest, and do its Try it again.

## @lab Lab: from plain code to eleven small functions on KopiKu orders
Two parts, on KopiKu order data. **Part A** (after Lessons 1 to 4) is plain Python with no functions: you fill in twelve variables. **Part B** (after Lessons 5 to 7) turns the same ideas into eleven small functions.

**What a lab is.** Each part is a file you edit and a file of **tests** that checks it. In Part A, `practice.py` gives you data and twelve variables set to `None`; you replace each `None` with your own code, and `test_practice.py` runs your file, with several different data sets in place of the given one, and checks each variable. In Part B, `basics.py` holds eleven functions whose inside is empty (each one only says `raise NotImplementedError`), and `test_lab.py` calls each function with examples, for example "`format_rupiah(1250000)` must give `"Rp 1.250.000"`". A check is ✓ when your code gives the expected answer, and ✗ when it gives something else or crashes. You are done when all 46 pass: 15 in Part A and 31 in Part B.

**Where to do it: choose one of two routes.**

- **Route A, the browser preview** (nothing to install): the editor box further down this page has a **Part A / Part B** switch. **Run tests** runs the part you are on, and the list under the button shows each group of checks (one group per step or function) as ✓ or ✗. A preview pass does not count: you do the lab again in your own terminal.
- **Route B, your own terminal** (recommended if you did Start here): this is how you will work for the rest of the course, and the run counts. Set it up once, in the terminal:

```bash
cd ~/projects/DECourse                     # your course folder
python3 -m venv venv                       # once: a private Python for the course
source venv/bin/activate                   # every new terminal
python -m pip install -r labs/mod-0-0/requirements.txt    # once: pytest
```

  Use your own course folder in the first line. If its name has a space, put a backslash before the space: `cd ~/Documents/Learn\ DE/DECourse`. After `source`, the prompt starts with `(venv)`; Module 0.1 explains what a venv is. Then open the course folder in VS Code (File, Open Folder) and click `labs/mod-0-0/practice.py` (Part A) or `labs/mod-0-0/basics.py` (Part B) to edit it. Check one step or one function with, for example:

```bash
pytest labs/mod-0-0/test_practice.py -k Step1 -v       # Part A, step 1
pytest labs/mod-0-0/test_lab.py -k TestFormatRupiah -v # Part B, one function
```

  You see one line per check ending in `PASSED` or `FAILED`; under a failure, the message says what went wrong. In Part A it names the variable: `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is None `` (you have not replaced the `None` yet). In Part B on the untouched file it is `E       NotImplementedError: TODO: implement format_rupiah`, which only means you have not written the function yet. `-k` picks one group (the other checks are "deselected"); without `-k` you see them all, and the last line says, for example, `29 failed, 2 passed`.

Lessons 1 to 4 end with Part A steps, without functions. From Lesson 5 on, each **Practice Pause** tells you which Part B functions to write, mostly by turning the code you already wrote in Part A into a function.

**The loop, for every step and function.**
1. Read the description in the file: in Part A the comment above each variable, in Part B the text between the `"""` lines. It says what goes in and what must come out, with examples.
2. Write your attempt: replace the `None` (Part A) or the `raise NotImplementedError` line (Part B).
3. Run the check and find that step's or function's group. At first the other groups are ✗ too; that is expected, ignore them.
4. If your group is ✗, read the message. `` `formatted` should be 'Rp 1.250.000' when amount is 1250000, but it is 'Rp 1,250,000' `` (Part A) or `AssertionError: assert 'Rp 1,250,000' == 'Rp 1.250.000'` (Part B) both mean: your answer is `'Rp 1,250,000'`, the expected one is `'Rp 1.250.000'`. The difference, commas instead of dots, tells you exactly what to change.
5. Change one thing, run again. Going round this loop five times for one step is normal: it is how programmers work, not a sign that you are bad at it.

**Part A, twelve variables, and why a data engineer needs them:**

| Step | You make | Where you will need it at work |
|---|---|---|
| 1 | `formatted`, `two_totals` | reports show money people can read; totals from a file are text until you make them numbers |
| 2 | `order_count`, `first_status`, `last_total`, `unique_ids` | looking things up in rows; each customer counted once, because files are re-sent and rows repeat |
| 3 | `signed_text`, `average` | negative amounts (refunds); a day with no orders must not crash the whole job |
| 4 | `status_counts`, `revenue`, `customer_ids`, `batches` | how many per category (SQL calls it `GROUP BY`, Module 0.3); the revenue Finance checks you against; sending data in pieces |

**Part B, the eleven functions, in the order of the lessons, and why a data engineer needs each one:**

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
1. Choose your route (see "Where to do it" above): the **Browser preview** below, or the files in VS Code with the checks in your terminal. Open `practice.py` and read it from top to bottom once, without writing anything: the data at the top and four steps.
2. Follow the Practice Pauses. After Lessons 1 to 4: Steps 1 to 4 of Part A, in `practice.py`. After Lesson 5: `format_rupiah`, `count_by_status`, `unique_customer_ids`, `average_total`, `total_revenue`, `batches` and `top_customers` in Part B (`basics.py`). After Lesson 6: `safe_int`, `add_to_batch` and `split_valid`. After Lesson 7: `read_orders`. Run the checks after each step or function and look only at its group.
3. Unsure what a value is in your code? Add `print(type(x), x)` above the line you doubt and run again; the printout appears when you run the file, or in the output of the preview. Remove it when you are done. (Part A also prints all its variables each time you run `practice.py`.)
4. Before each run, **predict** which groups will be ✓. When the result surprises you, find out why: that surprise is where the learning is.
5. **Do it for real.** On the terminal route you already are: when all 46 pass, run the proof command below. On the preview route, write both parts again in your own terminal, in your own venv, **without copying** from the preview. From the course folder, with the venv active:

```bash
pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v   # all 46 checks
pytest labs/mod-0-0/test_lab.py -v -k TestSafeInt                  # one group while you work
python3 scripts/prove.py mod-0-0                                   # when all pass: your proof code
```

   Open the two files in your editor (VS Code: File, Open Folder, then click the file); they are files you edit, not commands you type. Paste the proof code into the **Proof** box on this page.

### @files
- labs/mod-0-0/practice.py :: Part A, your working file: plain Python, fill in the twelve variables :: starter
- labs/mod-0-0/basics.py :: Part B, your working file: implement the eleven TODO functions :: starter
- labs/mod-0-0/debug_me.py :: A debugging drill: three functions with one bug each (lesson 8) :: config
- labs/mod-0-0/test_practice.py :: The 15 tests that check Part A :: test
- labs/mod-0-0/test_lab.py :: The 31 tests that check Part B :: test
- labs/mod-0-0/requirements.txt :: pytest :: config
- labs/mod-0-0/reference/practice.py :: One possible solution for Part A (try first!) :: reference
- labs/mod-0-0/reference/basics.py :: One possible solution for Part B (try first!) :: reference

### @deliverables
- All 46 checks pass (15 in test_practice.py, 31 in test_lab.py) **on your own computer, run from your own terminal** (a pass in the browser preview does not count)
- You can explain in your own words the difference between `print` and `return`, and between a list, a dict and a set
- You can explain why `batch=[]` as a default argument is a bug and what to write instead

### @verify
Run the tests from the repository root:

```bash
pytest labs/mod-0-0/test_practice.py labs/mod-0-0/test_lab.py -v
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
