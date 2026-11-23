# Python challenges (English)

Each challenge is one `:::drill python` block (see curriculum/README.md, "Interactive blocks"). The line before it names the challenge:
`## @challenge <id> | <level 1-5> | <topic>`. `node scripts/build-challenges.js` turns this file and `id.md` into `app/js/py-challenges-data.js`.
The Indonesian file must have the same ids in the same order.

## @challenge b01 | 1 | Basics
:::drill python Keep a number in range
Write `clamp(x, lo, hi)`: return `lo` if `x` is below it, `hi` if `x` is above it, otherwise `x`.
@starter
# write your function below this line

@check
defines("clamp") ## Define clamp(x, lo, hi).
clamp(5, 0, 10) == 5 ## Inside the range: unchanged.
clamp(-3, 0, 10) == 0 ## Below the range: lo.
clamp(42, 0, 10) == 10 ## Above the range: hi.
clamp(10, 0, 10) == 10 ## The edge itself is fine.
@hint
`min(hi, max(lo, x))`, or two `if` statements.
@solution
def clamp(x, lo, hi):
    return min(hi, max(lo, x))
:::

## @challenge b02 | 1 | Basics
:::drill python Count the vowels
Write `count_vowels(text)`: how many of the letters a, e, i, o, u are in the text, ignoring upper or lower case.
@starter
# write your function below this line

@check
defines("count_vowels") ## Define count_vowels(text).
count_vowels("Kopi Susu") == 4 ## o, i, u, u.
count_vowels("RHYTHM") == 0 ## No vowels at all.
count_vowels("AEIOU aeiou") == 10 ## Capital letters count too.
count_vowels("") == 0 ## Empty text.
@hint
Lower-case the text, then count the characters that are `in "aeiou"`.
@solution
def count_vowels(text):
    return sum(1 for ch in text.lower() if ch in "aeiou")
:::

## @challenge b03 | 1 | Basics
:::drill python Read it backwards
Write `is_palindrome(text)`: `True` if the text reads the same forwards and backwards, **ignoring case, spaces and punctuation** (only letters and digits count).
@starter
# write your function below this line

@check
defines("is_palindrome") ## Define is_palindrome(text).
is_palindrome("Kasur ini rusak") == True ## Spaces and capitals do not matter.
is_palindrome("A man, a plan, a canal: Panama") == True ## Punctuation does not matter.
is_palindrome("kopi") == False ## Not a palindrome.
is_palindrome("") == True ## Nothing reads the same both ways.
@hint
Keep only `ch.isalnum()` characters, lower-case them, and compare with the reversed version `s[::-1]`.
@solution
def is_palindrome(text):
    s = "".join(ch.lower() for ch in text if ch.isalnum())
    return s == s[::-1]
:::

## @challenge b04 | 1 | Basics
:::drill python Money with dots
Write `rupiah(n)`: `n` is a whole number of rupiah. Return text with dots between thousands, like `"Rp 1.250.000"`. A negative number gets the minus first: `"-Rp 5.000"`.
@starter
# write your function below this line

@check
defines("rupiah") ## Define rupiah(n).
rupiah(1250000) == "Rp 1.250.000" ## Dots between thousands.
rupiah(999) == "Rp 999" ## No dot below 1,000.
rupiah(0) == "Rp 0" ## Zero.
rupiah(-5000) == "-Rp 5.000" ## The minus goes first.
@hint
`f"{abs(n):,}"` gives commas; `.replace(",", ".")` turns them into dots.
@solution
def rupiah(n):
    text = "Rp " + f"{abs(n):,}".replace(",", ".")
    return "-" + text if n < 0 else text
:::

## @challenge b05 | 1 | Basics
:::drill python Fizz and buzz
Write `fizzbuzz(n)`: a list for the numbers 1 to `n`. A multiple of 3 becomes `"Fizz"`, a multiple of 5 becomes `"Buzz"`, a multiple of both becomes `"FizzBuzz"`, any other number stays a number.
@starter
# write your function below this line

@check
defines("fizzbuzz") ## Define fizzbuzz(n).
fizzbuzz(5) == [1, 2, "Fizz", 4, "Buzz"] ## The first five.
fizzbuzz(15)[-1] == "FizzBuzz" ## 15 is a multiple of both.
fizzbuzz(0) == [] ## Nothing to do.
fizzbuzz(3)[1] == 2 ## Numbers that fit no rule stay numbers, not text.
@hint
Test the multiple of both (`i % 15 == 0`) first.
@solution
def fizzbuzz(n):
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(i)
    return out
:::

## @challenge b06 | 1 | Basics
:::drill python Add the digits
Write `digit_sum(n)`: the sum of the digits of the whole number `n` (zero or more). `digit_sum(1203)` is 6.
@starter
# write your function below this line

@check
defines("digit_sum") ## Define digit_sum(n).
digit_sum(1203) == 6 ## 1 + 2 + 0 + 3.
digit_sum(0) == 0 ## Zero.
digit_sum(999) == 27 ## 9 + 9 + 9.
digit_sum(7) == 7 ## One digit.
@hint
`str(n)` gives the digits as characters; `int(ch)` turns one back into a number.
@solution
def digit_sum(n):
    return sum(int(ch) for ch in str(n))
:::

## @challenge b07 | 1 | Basics
:::drill python Tidy a name
Write `tidy_name(text)`: remove extra spaces (at the ends and between words) and capitalise each word: `"  sari   wulan "` becomes `"Sari Wulan"`.
@starter
# write your function below this line

@check
defines("tidy_name") ## Define tidy_name(text).
tidy_name("  sari   wulan ") == "Sari Wulan" ## Extra spaces gone, capitals added.
tidy_name("BUDI") == "Budi" ## Only the first letter stays capital.
tidy_name("") == "" ## Nothing in, nothing out.
tidy_name("andi p. kusuma") == "Andi P. Kusuma" ## Works for any number of words.
@hint
`text.split()` splits on any amount of whitespace; `" ".join(...)` puts the words back with single spaces.
@solution
def tidy_name(text):
    return " ".join(word.capitalize() for word in text.split())
:::

## @challenge b08 | 1 | Basics
:::drill python Average, safely
Write `average(nums)`: the mean of a list of numbers, or `None` when the list is empty (not an error).
@starter
# write your function below this line

@check
defines("average") ## Define average(nums).
average([2, 4, 6]) == 4 ## The mean of 2, 4 and 6.
average([5]) == 5 ## One number.
average([]) is None ## Nothing to average.
average([1, 2]) == 1.5 ## The result can have decimals.
@hint
Check `if not nums:` first, then `sum(nums) / len(nums)`.
@solution
def average(nums):
    if not nums:
        return None
    return sum(nums) / len(nums)
:::

## @challenge c01 | 2 | Collections
:::drill python Remove duplicates, keep the order
Write `dedupe(items)`: a new list with each value once, in the order of its **first** appearance.
@starter
# write your function below this line

@check
defines("dedupe") ## Define dedupe(items).
dedupe([3, 1, 3, 2, 1]) == [3, 1, 2] ## First appearances, in order.
dedupe([]) == [] ## Empty list.
dedupe(["a", "a", "a"]) == ["a"] ## All the same.
(lambda xs: (dedupe(xs), xs)[1])([1, 1]) == [1, 1] ## The original list is not changed.
@hint
Keep a `seen` set and a result list; append only when the value is not in `seen`.
@solution
def dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
:::

## @challenge c02 | 2 | Collections
:::drill python The top few
Write `top_n(counts, n)`: `counts` maps a name to a number. Return the `n` names with the biggest numbers, biggest first. When two have the same number, the name that comes first alphabetically goes first.
@starter
# write your function below this line

@check
defines("top_n") ## Define top_n(counts, n).
top_n({"a": 5, "b": 9, "c": 1}, 2) == ["b", "a"] ## The two biggest.
top_n({"x": 3, "b": 3, "m": 3}, 2) == ["b", "m"] ## A tie: alphabetical.
top_n({"a": 1}, 5) == ["a"] ## Asking for more than exist.
top_n({}, 3) == [] ## Nothing to rank.
@hint
`sorted(counts, key=lambda name: (-counts[name], name))[:n]`
@solution
def top_n(counts, n):
    return sorted(counts, key=lambda name: (-counts[name], name))[:n]
:::

## @challenge c03 | 2 | Collections
:::drill python Swap keys and values
Write `invert(d)`: a new dictionary where each value of `d` becomes a key and each key becomes its value. (All values of `d` are different.)
@starter
# write your function below this line

@check
defines("invert") ## Define invert(d).
invert({"a": 1, "b": 2}) == {1: "a", 2: "b"} ## Keys and values swapped.
invert({}) == {} ## Empty.
invert({"paid": "P"}) == {"P": "paid"} ## Works for text values too.
@hint
`{value: key for key, value in d.items()}`
@solution
def invert(d):
    return {value: key for key, value in d.items()}
:::

## @challenge c04 | 2 | Collections
:::drill python Count the words
Write `count_words(text)`: a dictionary that counts each word of the text, ignoring upper or lower case. Words are separated by spaces.
@starter
# write your function below this line

@check
defines("count_words") ## Define count_words(text).
count_words("a b a") == {"a": 2, "b": 1} ## a twice, b once.
count_words("Kopi kopi KOPI") == {"kopi": 3} ## Capitals do not matter.
count_words("") == {} ## No words.
count_words("x") == {"x": 1} ## One word.
@hint
Loop over `text.lower().split()` and use `counts[w] = counts.get(w, 0) + 1`.
@solution
def count_words(text):
    counts = {}
    for w in text.lower().split():
        counts[w] = counts.get(w, 0) + 1
    return counts
:::

## @challenge c05 | 2 | Collections
:::drill python One flat list
Write `flatten(lists)`: `lists` is a list of lists. Return one list with all the items in order.
@starter
# write your function below this line

@check
defines("flatten") ## Define flatten(lists).
flatten([[1, 2], [3], [4, 5]]) == [1, 2, 3, 4, 5] ## Joined in order.
flatten([]) == [] ## No lists.
flatten([[], [1], []]) == [1] ## Empty lists are fine.
flatten([["a"]]) == ["a"] ## Works for text.
@hint
`[x for sub in lists for x in sub]`
@solution
def flatten(lists):
    return [x for sub in lists for x in sub]
:::

## @challenge c06 | 2 | Collections
:::drill python Cut into batches
Write `chunks(items, size)`: a list of lists, each with up to `size` items, in order. The last one may be shorter.
@starter
# write your function below this line

@check
defines("chunks") ## Define chunks(items, size).
chunks([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]] ## The last batch is shorter.
chunks([1, 2], 5) == [[1, 2]] ## One batch only.
chunks([], 3) == [] ## No items, no batches.
chunks([1, 2, 3, 4], 2) == [[1, 2], [3, 4]] ## An exact fit.
@hint
`range(0, len(items), size)` gives the start of each batch; slice `items[i:i + size]`.
@solution
def chunks(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]
:::

## @challenge c07 | 2 | Collections
:::drill python Two lists into one dictionary
Write `to_dict(keys, values)`: pair them up into a dictionary. If one list is longer, ignore the extra items.
@starter
# write your function below this line

@check
defines("to_dict") ## Define to_dict(keys, values).
to_dict(["a", "b"], [1, 2]) == {"a": 1, "b": 2} ## Paired up.
to_dict(["a", "b", "c"], [1, 2]) == {"a": 1, "b": 2} ## An extra key is ignored.
to_dict([], [1]) == {} ## Nothing to pair.
to_dict(["x"], ["y", "z"]) == {"x": "y"} ## An extra value is ignored.
@hint
`dict(zip(keys, values))`: `zip` stops at the shorter list.
@solution
def to_dict(keys, values):
    return dict(zip(keys, values))
:::

## @challenge c08 | 2 | Collections
:::drill python Merge two dictionaries
Write `merge(a, b)`: a **new** dictionary with all the keys of both. When a key is in both, the value from `b` wins. Do not change `a` or `b`.
@starter
# write your function below this line

@check
defines("merge") ## Define merge(a, b).
merge({"x": 1}, {"y": 2}) == {"x": 1, "y": 2} ## Both keys kept.
merge({"x": 1}, {"x": 9}) == {"x": 9} ## b wins.
(lambda a: (merge(a, {"z": 0}), a)[1])({"q": 1}) == {"q": 1} ## a is not changed.
merge({}, {}) == {} ## Empty.
@hint
`{**a, **b}` builds a new dictionary; later keys win.
@solution
def merge(a, b):
    return {**a, **b}
:::

## @challenge c09 | 2 | Collections
:::drill python Sort the orders
Write `sort_orders(orders)`: `orders` is a list of dictionaries with `id` and `total`. Return the list of **ids**, with the biggest total first. When totals are equal, the smaller id goes first.
@starter
# write your function below this line

@check
defines("sort_orders") ## Define sort_orders(orders).
sort_orders([{"id": 2, "total": 50}, {"id": 1, "total": 90}]) == [1, 2] ## Biggest total first.
sort_orders([{"id": 5, "total": 10}, {"id": 3, "total": 10}]) == [3, 5] ## A tie: smaller id first.
sort_orders([]) == [] ## No orders.
sort_orders([{"id": 1, "total": 7}]) == [1] ## One order.
@hint
Sort with `key=lambda o: (-o["total"], o["id"])`, then take the ids.
@solution
def sort_orders(orders):
    ordered = sorted(orders, key=lambda o: (-o["total"], o["id"]))
    return [o["id"] for o in ordered]
:::

## @challenge c10 | 2 | Collections
:::drill python What do they share?
Write `common(a, b)`: the values that are in **both** lists, each once, as a sorted list.
@starter
# write your function below this line

@check
defines("common") ## Define common(a, b).
common([1, 2, 3, 3], [3, 2, 9]) == [2, 3] ## Shared values, once, sorted.
common([1], [2]) == [] ## Nothing shared.
common([], [1]) == [] ## One list empty.
common(["b", "a"], ["a", "b"]) == ["a", "b"] ## Works for text.
@hint
Sets are made for this: `sorted(set(a) & set(b))`.
@solution
def common(a, b):
    return sorted(set(a) & set(b))
:::

## @challenge d01 | 3 | Functions and errors
:::drill python Number or fallback
Write `safe_int(text, default=0)`: turn the text into a whole number; if it cannot be done, return `default`. Do not let an error escape.
@starter
# write your function below this line

@check
defines("safe_int") ## Define safe_int(text, default=0).
safe_int("42") == 42 ## A good number.
safe_int(" 7 ") == 7 ## Spaces around a number are fine.
safe_int("abc") == 0 ## Not a number: the default.
safe_int("4.5", -1) == -1 ## A decimal is not a whole number: your own default.
safe_int("") == 0 ## Empty text.
@hint
`try:` `return int(text)` `except ValueError:` `return default`
@solution
def safe_int(text, default=0):
    try:
        return int(text)
    except ValueError:
        return default
:::

## @challenge d02 | 3 | Functions and errors
:::drill python Where is it?
Write `first_index(items, target)`: the position of the first `target` in the list, or `-1` if it is not there. (Do not use `.index`, which raises an error.)
@starter
# write your function below this line

@check
defines("first_index") ## Define first_index(items, target).
first_index(["a", "b", "c"], "b") == 1 ## Found at position 1.
first_index([4, 4, 4], 4) == 0 ## The first one.
first_index([1, 2], 9) == -1 ## Not found.
first_index([], 1) == -1 ## Empty list.
@hint
`for i, x in enumerate(items):` gives the position and the value together.
@solution
def first_index(items, target):
    for i, x in enumerate(items):
        if x == target:
            return i
    return -1
:::

## @challenge d03 | 3 | Functions and errors
:::drill python Any number of arguments
Write `total(*numbers)`: add up however many numbers are passed: `total(1, 2, 3)` is 6. With no numbers it is 0.
@starter
# write your function below this line

@check
defines("total") ## Define total(*numbers).
total(1, 2, 3) == 6 ## Three numbers.
total() == 0 ## No numbers.
total(5) == 5 ## One number.
total(0.5, 0.5) == 1.0 ## Decimals work.
@hint
A parameter written `*numbers` collects all the extra arguments in a tuple; `sum(numbers)` adds them.
@solution
def total(*numbers):
    return sum(numbers)
:::

## @challenge d04 | 3 | Functions and errors
:::drill python Try again
Write `retry(fn, times)`: call `fn()` up to `times` times. Return its result the first time it works. If every attempt raises an error, raise the **last** error.
@starter
# write your function below this line

@check
defines("retry") ## Define retry(fn, times).
retry(lambda: 5, 3) == 5 ## Works at once.
(lambda c: retry(lambda: (c.append(1), 1 / 0 if len(c) < 3 else "ok")[1], 5))([]) == "ok" ## Fails twice, works the third time.
raises_error(ZeroDivisionError, retry, lambda: 1 / 0, 2) == True ## Always fails: the error is raised in the end.
(lambda c: (raises_error(ValueError, retry, lambda: (c.append(1), int("x"))[1], 4), len(c))[1])([]) == 4 ## It really tried 4 times.
@hint
Loop `for attempt in range(times)`; `try: return fn()`; `except Exception as e: last = e`; after the loop `raise last`.
@solution
def retry(fn, times):
    last = None
    for attempt in range(times):
        try:
            return fn()
        except Exception as e:
            last = e
    raise last
:::

## @challenge d05 | 3 | Functions and errors
:::drill python Read a settings line
Write `parse_kv(text)`: the text looks like `"a=1;b=2"`. Return `{"a": "1", "b": "2"}`. Skip empty pieces. Only the **first** `=` splits a piece, so `"url=x=y"` gives `{"url": "x=y"}`.
@starter
# write your function below this line

@check
defines("parse_kv") ## Define parse_kv(text).
parse_kv("a=1;b=2") == {"a": "1", "b": "2"} ## Two settings.
parse_kv("") == {} ## Nothing.
parse_kv("a=1;;b=2;") == {"a": "1", "b": "2"} ## Empty pieces are skipped.
parse_kv("url=x=y") == {"url": "x=y"} ## Only the first = splits.
@hint
`piece.split("=", 1)` splits at most once.
@solution
def parse_kv(text):
    out = {}
    for piece in text.split(";"):
        if piece:
            key, value = piece.split("=", 1)
            out[key] = value
    return out
:::

## @challenge d06 | 3 | Functions and errors
:::drill python The shared-list trap
Write `add_item(item, bucket=None)`: return a **new** list with `item` added to the end of `bucket` (an empty list when no bucket is given). Calling it twice without a bucket must give two separate lists. (Never use `[]` as a default value.)
@starter
# write your function below this line

@check
defines("add_item") ## Define add_item(item, bucket=None).
add_item(1) == [1] ## Starts a new list.
(add_item(1), add_item(2))[1] == [2] ## The second call does not remember the first.
add_item(3, [1, 2]) == [1, 2, 3] ## Adds to the list you give.
(lambda b: (add_item(9, b), b)[1])([1]) == [1] ## The list you pass is not changed.
@hint
`if bucket is None: bucket = []`, then return `bucket + [item]`.
@solution
def add_item(item, bucket=None):
    if bucket is None:
        bucket = []
    return bucket + [item]
:::

## @challenge d07 | 3 | Functions and errors
:::drill python Glue two functions
Write `compose(f, g)`: return a new function that, given `x`, returns `f(g(x))`.
@starter
# write your function below this line

@check
defines("compose") ## Define compose(f, g).
compose(lambda x: x + 1, lambda x: x * 2)(5) == 11 ## g first (10), then f (11).
compose(str.upper, str.strip)("  hi ") == "HI" ## Works with any functions.
compose(len, str)(12345) == 5 ## str first, then len.
compose(abs, abs)(-3) == 3 ## Same function twice.
@hint
Define a small function inside `compose` and return it (do not call it).
@solution
def compose(f, g):
    def combined(x):
        return f(g(x))
    return combined
:::

## @challenge d08 | 3 | Functions and errors
:::drill python Refuse a bad value
Write `validate_age(age)`: return `age` if it is a whole number from 0 to 120. Otherwise **raise** a `ValueError`. (A bad value must stop the program, not slip through.)
@starter
# write your function below this line

@check
defines("validate_age") ## Define validate_age(age).
validate_age(30) == 30 ## A good age is returned.
validate_age(0) == 0 ## 0 is allowed.
raises_error(ValueError, validate_age, 200) == True ## Too big: ValueError.
raises_error(ValueError, validate_age, -1) == True ## Negative: ValueError.
raises_error(ValueError, validate_age, "30") == True ## Text is not a whole number: ValueError.
@hint
Check `isinstance(age, int)` and `0 <= age <= 120`; if it fails, `raise ValueError("...")`.
@solution
def validate_age(age):
    if not isinstance(age, int) or not 0 <= age <= 120:
        raise ValueError("age must be a whole number from 0 to 120")
    return age
:::

## @challenge e01 | 4 | Data patterns
:::drill python Running total
Write `running_total(nums)`: a list where each item is the sum of all numbers up to and including that position: `[1, 2, 3]` gives `[1, 3, 6]`.
@starter
# write your function below this line

@check
defines("running_total") ## Define running_total(nums).
running_total([1, 2, 3]) == [1, 3, 6] ## Cumulative sums.
running_total([]) == [] ## Empty.
running_total([5, -5, 5]) == [5, 0, 5] ## Negative numbers too.
running_total([10]) == [10] ## One number.
@hint
Keep a `total` variable, add each number to it, and append the total to the result.
@solution
def running_total(nums):
    total = 0
    out = []
    for x in nums:
        total += x
        out.append(total)
    return out
:::

## @challenge e02 | 4 | Data patterns
:::drill python Latest row per key
Write `latest_per_key(rows)`: `rows` is a list of `(key, timestamp, value)`. Return a dictionary that maps each key to the value of its row with the **biggest timestamp**. (The rows may be in any order.)
@starter
# write your function below this line

@check
defines("latest_per_key") ## Define latest_per_key(rows).
latest_per_key([("a", 1, "x"), ("a", 3, "z"), ("a", 2, "y")]) == {"a": "z"} ## The biggest timestamp wins.
latest_per_key([("a", 1, 10), ("b", 5, 20)]) == {"a": 10, "b": 20} ## Each key on its own.
latest_per_key([]) == {} ## No rows.
latest_per_key([("k", 2, "late"), ("k", 1, "early")]) == {"k": "late"} ## Order in the list does not matter.
@hint
Keep a dictionary of `key -> (timestamp, value)` and replace it only when the new timestamp is bigger.
@solution
def latest_per_key(rows):
    best = {}
    for key, ts, value in rows:
        if key not in best or ts > best[key][0]:
            best[key] = (ts, value)
    return {key: pair[1] for key, pair in best.items()}
:::

## @challenge e03 | 4 | Data patterns
:::drill python Split into sessions
Write `sessionize(times, gap)`: `times` is a list of whole-number seconds. Sort them, then start a **new session** whenever the time since the previous event is **more than** `gap`. Return the sessions as a list of lists.
@starter
# write your function below this line

@check
defines("sessionize") ## Define sessionize(times, gap).
sessionize([1, 2, 10, 11], 5) == [[1, 2], [10, 11]] ## A gap of 8 starts a new session.
sessionize([10, 1, 2], 5) == [[1, 2], [10]] ## Unsorted input works.
sessionize([1, 6], 5) == [[1, 6]] ## A gap of exactly 5 is not more than 5.
sessionize([], 5) == [] ## No events.
@hint
Loop over `sorted(times)`. Start a new inner list when `t - previous > gap`, otherwise append to the last one.
@solution
def sessionize(times, gap):
    sessions = []
    for t in sorted(times):
        if sessions and t - sessions[-1][-1] <= gap:
            sessions[-1].append(t)
        else:
            sessions.append([t])
    return sessions
:::

## @challenge e04 | 4 | Data patterns
:::drill python Column names in snake_case
Write `to_snake(text)`: lower-case the text, turn every run of characters that are not letters or digits into a single `_`, and remove `_` at the ends. `"Total (IDR)"` becomes `"total_idr"`.
@starter
import re
# write your function below this line

@check
defines("to_snake") ## Define to_snake(text).
to_snake("Order ID") == "order_id" ## A space becomes an underscore.
to_snake("Total (IDR)") == "total_idr" ## Brackets and the space become one underscore, none at the end.
to_snake("  already_snake ") == "already_snake" ## Spaces at the ends are removed.
to_snake("A--B") == "a_b" ## A run of symbols becomes one underscore.
@hint
`re.sub(r"[^a-z0-9]+", "_", text.lower())` and then `.strip("_")`.
@solution
import re
def to_snake(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
:::

## @challenge e05 | 4 | Data patterns
:::drill python Flatten nested JSON
Write `flatten_json(d)`: turn a nested dictionary into one level, joining the keys with dots: `{"a": {"b": 1}}` becomes `{"a.b": 1}`.
@starter
# write your function below this line

@check
defines("flatten_json") ## Define flatten_json(d).
flatten_json({"a": {"b": 1}}) == {"a.b": 1} ## Two levels.
flatten_json({"x": 1, "y": {"z": 2, "w": {"v": 3}}}) == {"x": 1, "y.z": 2, "y.w.v": 3} ## Three levels.
flatten_json({}) == {} ## Empty.
flatten_json({"a": []}) == {"a": []} ## A list is a value, not flattened.
@hint
Loop over the items. If the value is a dictionary, call `flatten_json` on it and add the prefix `key + "."` to each of its keys.
@solution
def flatten_json(d):
    out = {}
    for key, value in d.items():
        if isinstance(value, dict):
            for inner_key, inner_value in flatten_json(value).items():
                out[key + "." + inner_key] = inner_value
        else:
            out[key] = value
    return out
:::

## @challenge e06 | 4 | Data patterns
:::drill python Which bucket?
Write `bucket_of(value, edges)`: `edges` is a sorted list such as `[10, 100]`. Return the number of edges that are **less than or equal to** `value`: that is the bucket number (0 is below the first edge).
@starter
import bisect
# write your function below this line

@check
defines("bucket_of") ## Define bucket_of(value, edges).
bucket_of(5, [10, 100]) == 0 ## Below the first edge.
bucket_of(10, [10, 100]) == 1 ## An edge itself belongs to the upper bucket.
bucket_of(99, [10, 100]) == 1 ## Between the edges.
bucket_of(100, [10, 100]) == 2 ## At the last edge.
bucket_of(7, []) == 0 ## No edges: everything is in bucket 0.
@hint
`bisect.bisect_right(edges, value)` counts exactly that.
@solution
import bisect
def bucket_of(value, edges):
    return bisect.bisect_right(edges, value)
:::

## @challenge e07 | 4 | Data patterns
:::drill python Insert or replace
Write `upsert(table, rows, key)`: `table` and `rows` are lists of dictionaries; `key` names the field that identifies a row. Return a **new** list: a row with a key that is already in the table **replaces** it (same position); a new key is added at the end. Do not change `table`.
@starter
# write your function below this line

@check
defines("upsert") ## Define upsert(table, rows, key).
upsert([{"id": 1, "v": "a"}], [{"id": 1, "v": "b"}], "id") == [{"id": 1, "v": "b"}] ## Replaced.
upsert([{"id": 1, "v": "a"}], [{"id": 2, "v": "b"}], "id") == [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}] ## Added at the end.
upsert([], [{"id": 1}, {"id": 1}], "id") == [{"id": 1}] ## The same key twice in rows gives one row.
(lambda t: (upsert(t, [{"id": 1, "v": "z"}], "id"), t)[1])([{"id": 1, "v": "a"}]) == [{"id": 1, "v": "a"}] ## The table is not changed.
@hint
Copy the table, remember each key's position in a dictionary, then replace or append for every new row.
@solution
def upsert(table, rows, key):
    out = list(table)
    position = {row[key]: i for i, row in enumerate(out)}
    for row in rows:
        if row[key] in position:
            out[position[row[key]]] = row
        else:
            position[row[key]] = len(out)
            out.append(row)
    return out
:::

## @challenge e08 | 4 | Data patterns
:::drill python Moving average
Write `moving_avg(nums, k)`: the average of every **full** window of `k` numbers in a row. For 5 numbers and `k = 3` there are 3 windows. If there are fewer than `k` numbers, return an empty list.
@starter
# write your function below this line

@check
defines("moving_avg") ## Define moving_avg(nums, k).
moving_avg([1, 2, 3, 4, 5], 3) == [2, 3, 4] ## Three windows.
moving_avg([10, 20], 2) == [15] ## One window.
moving_avg([1, 2], 3) == [] ## Fewer numbers than the window.
moving_avg([4], 1) == [4] ## A window of one.
@hint
`for i in range(len(nums) - k + 1)` gives the start of each window; average `nums[i:i + k]`.
@solution
def moving_avg(nums, k):
    return [sum(nums[i:i + k]) / k for i in range(len(nums) - k + 1)]
:::

## @challenge e09 | 4 | Data patterns
:::drill python A CSV line with quotes
Write `split_csv_line(line)`: split one CSV line into its fields. A field in double quotes may contain commas: `'a,"b,c",d'` has three fields. Use the standard `csv` module, not `split(",")`.
@starter
import csv
# write your function below this line

@check
defines("split_csv_line") ## Define split_csv_line(line).
split_csv_line("a,b,c") == ["a", "b", "c"] ## A simple line.
split_csv_line('a,"b,c",d') == ["a", "b,c", "d"] ## A comma inside quotes does not split.
split_csv_line('x,"say ""hi""",y') == ["x", 'say "hi"', "y"] ## Doubled quotes mean one quote.
calls("reader") == True ## You used csv.reader.
@hint
`next(csv.reader([line]))` reads one line and returns its fields as a list.
@solution
import csv
def split_csv_line(line):
    return next(csv.reader([line]))
:::

## @challenge e10 | 4 | Data patterns
:::drill python A small pivot
Write `pivot(rows)`: `rows` is a list of `(city, status, count)`. Return a dictionary of dictionaries: `{city: {status: total}}`, adding up the counts when the same city and status appear more than once.
@starter
# write your function below this line

@check
defines("pivot") ## Define pivot(rows).
pivot([("JKT", "paid", 2), ("JKT", "cancelled", 1)]) == {"JKT": {"paid": 2, "cancelled": 1}} ## One city, two statuses.
pivot([("JKT", "paid", 2), ("JKT", "paid", 3)]) == {"JKT": {"paid": 5}} ## Repeated pairs are added.
pivot([("A", "x", 1), ("B", "x", 4)]) == {"A": {"x": 1}, "B": {"x": 4}} ## Two cities.
pivot([]) == {} ## Nothing.
@hint
`out.setdefault(city, {})` gives the inner dictionary; then `inner[status] = inner.get(status, 0) + count`.
@solution
def pivot(rows):
    out = {}
    for city, status, count in rows:
        inner = out.setdefault(city, {})
        inner[status] = inner.get(status, 0) + count
    return out
:::

## @challenge f01 | 5 | Objects and recursion
:::drill python Build a stack
Write a class `Stack` with `push(x)`, `pop()` (returns the last pushed item), `peek()` (shows it without removing) and `len(stack)` (the number of items). `pop()` or `peek()` on an empty stack raises `IndexError`.
@starter
# write your class below this line

@check
defines("Stack") ## Define class Stack.
(lambda s: (s.push(1), s.push(2), s.pop())[-1])(Stack()) == 2 ## Last in, first out.
(lambda s: (s.push(1), s.push(2), s.peek(), len(s))[-1])(Stack()) == 2 ## peek does not remove.
(lambda s: (s.push("a"), s.pop(), len(s))[-1])(Stack()) == 0 ## Empty again after pop.
raises_error(IndexError, Stack().pop) == True ## Pop on empty: IndexError.
raises_error(IndexError, Stack().peek) == True ## Peek on empty: IndexError.
@hint
Keep a list in `self.items` (made in `__init__`). Define `__len__` so `len(stack)` works.
@solution
class Stack:
    def __init__(self):
        self.items = []

    def push(self, x):
        self.items.append(x)

    def pop(self):
        return self.items.pop()

    def peek(self):
        return self.items[-1]

    def __len__(self):
        return len(self.items)
:::

## @challenge f02 | 5 | Objects and recursion
:::drill python A tally
Write a class `Tally` with `add(x)` (count one more of `x`), `count(x)` (how many so far, 0 if never added) and `most_common()` (the item with the highest count; on a tie the alphabetically first; `None` if empty).
@starter
# write your class below this line

@check
defines("Tally") ## Define class Tally.
(lambda t: (t.add("a"), t.add("a"), t.add("b"), t.count("a"))[-1])(Tally()) == 2 ## a was added twice.
Tally().count("zzz") == 0 ## Never added: 0.
(lambda t: (t.add("b"), t.add("a"), t.most_common())[-1])(Tally()) == "a" ## A tie: alphabetical.
(lambda t: (t.add("x"), t.add("y"), t.add("y"), t.most_common())[-1])(Tally()) == "y" ## The highest count.
Tally().most_common() is None ## Empty: None.
@hint
Keep a dictionary in `self.counts`. For `most_common`, `min(self.counts, key=lambda k: (-self.counts[k], k))`.
@solution
class Tally:
    def __init__(self):
        self.counts = {}

    def add(self, x):
        self.counts[x] = self.counts.get(x, 0) + 1

    def count(self, x):
        return self.counts.get(x, 0)

    def most_common(self):
        if not self.counts:
            return None
        return min(self.counts, key=lambda k: (-self.counts[k], k))
:::

## @challenge f03 | 5 | Objects and recursion
:::drill python Add up a nested list
Write `sum_nested(x)`: `x` is a number, or a list that may contain numbers and more lists, as deep as you like. Return the sum of all the numbers. Use recursion.
@starter
# write your function below this line

@check
defines("sum_nested") ## Define sum_nested(x).
sum_nested(5) == 5 ## A single number.
sum_nested([1, [2, 3], [[4]]]) == 10 ## Lists inside lists.
sum_nested([]) == 0 ## An empty list.
sum_nested([[], [[]], 7]) == 7 ## Empty lists inside.
@hint
If `x` is a list, return `sum(sum_nested(item) for item in x)`; otherwise return `x`.
@solution
def sum_nested(x):
    if isinstance(x, list):
        return sum(sum_nested(item) for item in x)
    return x
:::

## @challenge f04 | 5 | Objects and recursion
:::drill python How deep is it?
Write `depth(d)`: how many levels of dictionary there are. `{}` and `{"a": 1}` have depth 1; `{"a": {"b": 2}}` has depth 2.
@starter
# write your function below this line

@check
defines("depth") ## Define depth(d).
depth({}) == 1 ## An empty dictionary is one level.
depth({"a": 1}) == 1 ## One level.
depth({"a": {"b": 2}}) == 2 ## Two levels.
depth({"a": 1, "b": {"c": {"d": 3}}}) == 3 ## The deepest branch counts.
@hint
`1 + max((depth(v) for v in d.values() if isinstance(v, dict)), default=0)`
@solution
def depth(d):
    return 1 + max((depth(v) for v in d.values() if isinstance(v, dict)), default=0)
:::

## @challenge f05 | 5 | Objects and recursion
:::drill python A generator of batches
Write `batches(items, size)` as a **generator** (with `yield`): it hands out lists of up to `size` items one at a time, so it never builds all the batches at once.
@starter
# write your function below this line

@check
defines("batches") ## Define batches(items, size).
list(batches([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]] ## The batches, one by one.
list(batches([], 3)) == [] ## No items, no batches.
hasattr(batches([1], 1), "__next__") == True ## It is a generator, not a list.
next(batches(range(10), 4)) == [0, 1, 2, 3] ## It also works for any iterable, such as range.
@hint
Collect items in a `batch` list; `yield batch` when it has `size` items and start a new one; after the loop yield what is left.
@solution
def batches(items, size):
    batch = []
    for x in items:
        batch.append(x)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
:::

## @challenge f06 | 5 | Objects and recursion
:::drill python Count the calls
Write `count_calls(fn)`: a **decorator** that returns a new function which calls `fn` with the same arguments and gives back its result, and keeps the number of calls so far in `wrapper.calls`.
@starter
# write your decorator below this line

@check
defines("count_calls") ## Define count_calls(fn).
(lambda f: (f(), f(), f.calls)[-1])(count_calls(lambda: 1)) == 2 ## Two calls counted.
count_calls(lambda a, b: a + b)(2, 3) == 5 ## The result and the arguments pass through.
count_calls(lambda: 1).calls == 0 ## Starts at zero.
(lambda f: (f(x=4), f.calls)[-1])(count_calls(lambda x: x)) == 1 ## Keyword arguments work too.
@hint
Define `wrapper(*args, **kwargs)` inside; add 1 to `wrapper.calls`, then `return fn(*args, **kwargs)`. Set `wrapper.calls = 0` before returning `wrapper`.
@solution
def count_calls(fn):
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return fn(*args, **kwargs)
    wrapper.calls = 0
    return wrapper
:::

## @challenge f07 | 5 | Objects and recursion
:::drill python A Money class
Write a class `Money` made with `Money(amount)` (a whole number). It has an `amount` attribute, `Money(5) + Money(7)` gives `Money(12)`, and two `Money` with the same amount are equal (`==`).
@starter
# write your class below this line

@check
defines("Money") ## Define class Money.
Money(5).amount == 5 ## It remembers the amount.
(Money(5) + Money(7)).amount == 12 ## Adding gives a new Money.
Money(5) == Money(5) ## Same amount: equal.
(Money(5) == Money(6)) == False ## Different amount: not equal.
@hint
Define `__init__`, `__add__` (return `Money(self.amount + other.amount)`) and `__eq__`.
@solution
class Money:
    def __init__(self, amount):
        self.amount = amount

    def __add__(self, other):
        return Money(self.amount + other.amount)

    def __eq__(self, other):
        return isinstance(other, Money) and self.amount == other.amount
:::

## @challenge f08 | 5 | Objects and recursion
:::drill python Every path in a tree
Write `walk(tree)` as a **generator**: `tree` is a nested dictionary where a dictionary is a folder and any other value is a file. Yield the path of every file, joined with `/`: `{"a": {"b": 1}, "c": 2}` yields `"a/b"` and `"c"`.
@starter
# write your generator below this line

@check
defines("walk") ## Define walk(tree).
sorted(walk({"a": {"b": 1}, "c": 2})) == ["a/b", "c"] ## Two files.
sorted(walk({})) == [] ## An empty tree.
sorted(walk({"x": {"y": {"z": 0}}})) == ["x/y/z"] ## Three levels deep.
sorted(walk({"a": 1, "b": {"c": 2, "d": 3}})) == ["a", "b/c", "b/d"] ## A mix.
@hint
For each `name, value`: if `value` is a dictionary, loop over `walk(value)` and `yield name + "/" + inner`; otherwise `yield name`.
@solution
def walk(tree):
    for name, value in tree.items():
        if isinstance(value, dict):
            for inner in walk(value):
                yield name + "/" + inner
        else:
            yield name
:::

## @challenge p01 | 6 | Mini-projects
:::drill python Project: the coffee shop bill
KopiKu needs a till. Write two functions. `bill(order, menu)`: `order` is a list of item names, `menu` maps a name to its price in rupiah. Return `{"subtotal": ..., "discount": ..., "total": ...}`. When the subtotal is **120,000 or more**, the discount is 10% of it (a whole number, rounded down); otherwise 0. An item that is not on the menu raises `ValueError`. `best_seller(orders)`: `orders` is a list of orders (each a list of names); return the name sold most often over all of them (a tie goes to the alphabetically first name), or `None` if nothing was sold.
@starter
# write your two functions below this line

@check
defines("bill") ## Define bill(order, menu).
bill(["kopi", "kopi", "teh"], {"kopi": 25000, "teh": 15000}) == {"subtotal": 65000, "discount": 0, "total": 65000} ## A small order: no discount.
bill(["kopi"] * 4 + ["roti"], {"kopi": 25000, "roti": 20000}) == {"subtotal": 120000, "discount": 12000, "total": 108000} ## Exactly 120,000: the discount applies.
bill([], {"kopi": 25000}) == {"subtotal": 0, "discount": 0, "total": 0} ## An empty order.
raises_error(ValueError, bill, ["latte"], {"kopi": 25000}) == True ## Not on the menu.
best_seller([["kopi", "teh"], ["kopi"], ["teh", "teh", "roti"]]) == "teh" ## teh 3, kopi 2, roti 1.
best_seller([["b"], ["a"]]) == "a" ## A tie: alphabetical.
best_seller([]) is None ## Nothing sold.
@hint
For `bill`: look each name up in the menu (let a missing one raise `ValueError` yourself), add up, then `discount = subtotal // 10` only when `subtotal >= 120000`. For `best_seller`: count every name in every order with a dictionary, then take the best with `min(counts, key=lambda k: (-counts[k], k))`.
@solution
def bill(order, menu):
    subtotal = 0
    for name in order:
        if name not in menu:
            raise ValueError("not on the menu: " + name)
        subtotal += menu[name]
    discount = subtotal // 10 if subtotal >= 120000 else 0
    return {"subtotal": subtotal, "discount": discount, "total": subtotal - discount}

def best_seller(orders):
    counts = {}
    for order in orders:
        for name in order:
            counts[name] = counts.get(name, 0) + 1
    if not counts:
        return None
    return min(counts, key=lambda k: (-counts[k], k))
:::

## @challenge p02 | 6 | Mini-projects
:::drill python Project: the word detective
Analyse a piece of text. `clean_words(text)`: return the words in lower case, with these punctuation marks removed from the ends of each word: `. , ! ? ; : " ' ( )`. Skip empty results. `top_words(text, n)`: the `n` most common cleaned words, most common first (a tie goes to the alphabetically first). `longest_word(text)`: the longest cleaned word (the first one if there is a tie), or `""` for no words.
@starter
# write your three functions below this line

@check
defines("clean_words") ## Define clean_words(text).
clean_words('Hello, World! "Hello"') == ["hello", "world", "hello"] ## Punctuation and capitals are gone.
clean_words("  ... ") == [] ## Only punctuation: no words.
top_words("a b a c b a", 2) == ["a", "b"] ## a 3, b 2, c 1.
top_words("x y", 5) == ["x", "y"] ## Asking for more than exist; tie is alphabetical.
longest_word("I love coffee, really!") == "coffee" ## The longest word.
longest_word("cat dog") == "cat" ## A tie: the first one.
longest_word("") == "" ## No words.
@hint
`word.strip('.,!?;:"\'()').lower()` cleans one word. Build `top_words` and `longest_word` on top of `clean_words`.
@solution
def clean_words(text):
    words = [w.strip('.,!?;:"\'()').lower() for w in text.split()]
    return [w for w in words if w]

def top_words(text, n):
    counts = {}
    for w in clean_words(text):
        counts[w] = counts.get(w, 0) + 1
    return sorted(counts, key=lambda k: (-counts[k], k))[:n]

def longest_word(text):
    words = clean_words(text)
    return max(words, key=len) if words else ""
:::

## @challenge p03 | 6 | Mini-projects
:::drill python Project: the log analyser
A server writes lines like `2026-01-05 10:03:12 ERROR payment failed`. Write `parse_line(line)`: return `(date, time, level, message)`, or `None` if the line has fewer than four parts or the level is not `INFO`, `WARN` or `ERROR`. Write `summarize(lines)`: a dictionary `{"INFO": n, "WARN": n, "ERROR": n, "bad": n}` counting the lines. Write `error_rate(lines)`: errors divided by the number of **good** lines (0 when there are none).
@starter
# write your three functions below this line

@check
defines("parse_line") ## Define parse_line(line).
parse_line("2026-01-05 10:03:12 ERROR payment failed") == ("2026-01-05", "10:03:12", "ERROR", "payment failed") ## The message keeps its spaces.
parse_line("2026-01-05 10:03:12 DEBUG hi") is None ## Not an allowed level.
parse_line("garbage") is None ## Too few parts.
summarize(["2026-01-05 10:00:00 INFO ok", "2026-01-05 10:00:01 ERROR no", "oops", "2026-01-05 10:00:02 INFO ok"]) == {"INFO": 2, "WARN": 0, "ERROR": 1, "bad": 1} ## Counts per level, and one bad line.
error_rate(["2026-01-05 10:00:00 INFO a", "2026-01-05 10:00:01 ERROR b", "x y"]) == 0.5 ## 1 error in 2 good lines (the bad line does not count).
error_rate([]) == 0 ## No lines.
@hint
`line.split(" ", 3)` gives at most four parts, so the message keeps its spaces. Build `summarize` and `error_rate` on `parse_line`.
@solution
def parse_line(line):
    parts = line.split(" ", 3)
    if len(parts) < 4 or parts[2] not in ("INFO", "WARN", "ERROR"):
        return None
    return tuple(parts)

def summarize(lines):
    out = {"INFO": 0, "WARN": 0, "ERROR": 0, "bad": 0}
    for line in lines:
        parsed = parse_line(line)
        if parsed is None:
            out["bad"] += 1
        else:
            out[parsed[2]] += 1
    return out

def error_rate(lines):
    s = summarize(lines)
    good = s["INFO"] + s["WARN"] + s["ERROR"]
    return s["ERROR"] / good if good else 0
:::

## @challenge p04 | 6 | Mini-projects
:::drill python Project: the password checker
Write `strength(pw)`: one point each for: at least 8 characters; a lower-case letter; an upper-case letter; a digit; a symbol (a character that is not a letter or digit). A password that is `password`, `123456` or `qwerty` in any case scores 0. Write `verdict(pw)`: `"weak"` for 0 to 2 points, `"ok"` for 3 or 4, `"strong"` for 5.
@starter
# write your two functions below this line

@check
defines("strength") ## Define strength(pw).
strength("Kopi#2026x") == 5 ## Long, lower, upper, digit and symbol.
strength("abc") == 1 ## Only a lower-case letter.
strength("ABCDEFGH") == 2 ## 8 characters and upper case.
strength("QWERTY") == 0 ## A common password scores 0, in any case.
verdict("abc") == "weak" ## 1 point.
verdict("Kopi2026") == "ok" ## 4 points: length, lower, upper, digit.
verdict("Kopi#2026x") == "strong" ## 5 points.
@hint
Add the five tests as `+ (condition)` (a True counts as 1). Use `any(c.islower() for c in pw)` and so on; a symbol is `not c.isalnum()`.
@solution
def strength(pw):
    if pw.lower() in ("password", "123456", "qwerty"):
        return 0
    return (
        (len(pw) >= 8)
        + any(c.islower() for c in pw)
        + any(c.isupper() for c in pw)
        + any(c.isdigit() for c in pw)
        + any(not c.isalnum() for c in pw)
    )

def verdict(pw):
    s = strength(pw)
    return "weak" if s <= 2 else "ok" if s <= 4 else "strong"
:::

## @challenge p05 | 6 | Mini-projects
:::drill python Project: a tiny inventory
Write a class `Inventory`. `add(item, qty)` adds stock. `remove(item, qty)` takes stock away, but if there is not enough it raises `ValueError` and **changes nothing**. `stock(item)` returns how many there are (0 if never added). `low_stock(limit)` returns the sorted list of items whose stock is `limit` or less.
@starter
# write your class below this line

@check
defines("Inventory") ## Define class Inventory.
(lambda i: (i.add("tea", 5), i.add("tea", 3), i.stock("tea"))[-1])(Inventory()) == 8 ## Adding twice.
Inventory().stock("nothing") == 0 ## Never added.
(lambda i: (i.add("tea", 5), i.remove("tea", 2), i.stock("tea"))[-1])(Inventory()) == 3 ## Removing.
(lambda i: (i.add("tea", 1), raises_error(ValueError, i.remove, "tea", 5), i.stock("tea"))[-1])(Inventory()) == 1 ## Too much: error, and the stock is unchanged.
(lambda i: (i.add("b", 1), i.add("a", 2), i.add("c", 50), i.low_stock(2))[-1])(Inventory()) == ["a", "b"] ## Low stock, sorted.
@hint
Keep a dictionary `self.items`. In `remove`, check `self.stock(item) < qty` and raise **before** changing anything.
@solution
class Inventory:
    def __init__(self):
        self.items = {}

    def add(self, item, qty):
        self.items[item] = self.items.get(item, 0) + qty

    def remove(self, item, qty):
        if self.stock(item) < qty:
            raise ValueError("not enough " + item)
        self.items[item] -= qty

    def stock(self, item):
        return self.items.get(item, 0)

    def low_stock(self, limit):
        return sorted(name for name, qty in self.items.items() if qty <= limit)
:::

## @challenge p06 | 6 | Mini-projects
:::drill python Project: a pipeline in miniature
Build a small cleaning job for order rows (all values are text). `clean_row(row)`: return `(clean, reason)`. A row is `bad_id` if `order_id` is not all digits, then `bad_status` if the trimmed lower-case `status` is not `paid`, `shipped` or `cancelled`, then `bad_total` if `total_idr` (dots and a leading `Rp` allowed) is not a whole number. A good row gives `({"order_id": int, "status": text, "total_idr": int}, None)`; a bad one gives `(None, reason)`. `run(rows)`: return `{"valid": [...], "rejected": [reasons], "duplicates": n}`; a good row whose `order_id` was already seen counts as a duplicate (kept out of `valid`, not a rejection).
@starter
# write your two functions below this line

@check
defines("clean_row") ## Define clean_row(row).
clean_row({"order_id": "7", "status": " PAID ", "total_idr": "Rp 1.500"}) == ({"order_id": 7, "status": "paid", "total_idr": 1500}, None) ## A good row, cleaned.
clean_row({"order_id": "x", "status": "paid", "total_idr": "5"}) == (None, "bad_id") ## Not digits.
clean_row({"order_id": "1", "status": "teleported", "total_idr": "5"}) == (None, "bad_status") ## Unknown status.
clean_row({"order_id": "1", "status": "paid", "total_idr": "abc"}) == (None, "bad_total") ## Not a number.
run([{"order_id": "1", "status": "PAID", "total_idr": "Rp 1.500"}, {"order_id": "1", "status": "paid", "total_idr": "1500"}, {"order_id": "x", "status": "paid", "total_idr": "5"}, {"order_id": "2", "status": "teleported", "total_idr": "5"}, {"order_id": "3", "status": "shipped", "total_idr": "abc"}]) == {"valid": [{"order_id": 1, "status": "paid", "total_idr": 1500}], "rejected": ["bad_id", "bad_status", "bad_total"], "duplicates": 1} ## Five rows: one valid, one duplicate, three rejected.
run([]) == {"valid": [], "rejected": [], "duplicates": 0} ## Nothing in, nothing out.
@hint
Do `clean_row` first and test it. In `run`, keep a `seen` set of order ids.
@solution
def clean_row(row):
    if not row["order_id"].isdigit():
        return None, "bad_id"
    status = row["status"].strip().lower()
    if status not in ("paid", "shipped", "cancelled"):
        return None, "bad_status"
    raw = row["total_idr"].replace("Rp", "").replace(" ", "").replace(".", "")
    if not raw.isdigit():
        return None, "bad_total"
    return {"order_id": int(row["order_id"]), "status": status, "total_idr": int(raw)}, None

def run(rows):
    valid, rejected, seen, duplicates = [], [], set(), 0
    for row in rows:
        clean, reason = clean_row(row)
        if reason:
            rejected.append(reason)
        elif clean["order_id"] in seen:
            duplicates += 1
        else:
            seen.add(clean["order_id"])
            valid.append(clean)
    return {"valid": valid, "rejected": rejected, "duplicates": duplicates}
:::

## @challenge p07 | 6 | Mini-projects
:::drill python Project: guess the number
The rules of a guessing game, without typing. `judge(secret, guess)`: return `"higher"` if the guess is too low, `"lower"` if it is too high, `"correct"` if it is right. `play(secret, guesses)`: go through the guesses in order and stop at the first correct one; return `(won, tries)`. If none is correct, return `(False, len(guesses))`. `max_tries(low, high)`: the most guesses a perfect player needs for a secret between `low` and `high` (both included), by always guessing the middle: the smallest `k` with `2 ** k >= high - low + 1`.
@starter
# write your three functions below this line

@check
defines("judge") ## Define judge(secret, guess).
judge(50, 30) == "higher" ## 30 is too low: go higher.
judge(50, 80) == "lower" ## 80 is too high: go lower.
judge(50, 50) == "correct" ## Right.
play(7, [3, 9, 7, 1]) == (True, 3) ## Stops at the third guess.
play(7, [1, 2]) == (False, 2) ## Never right.
play(7, []) == (False, 0) ## No guesses.
max_tries(1, 100) == 7 ## 2**7 = 128 is the first power of 2 that covers 100 numbers.
max_tries(1, 1) == 0 ## Only one number: no guess needed.
@hint
For `max_tries`, count `k` up from 0 while `2 ** k < high - low + 1`. For `play`, `enumerate(guesses, start=1)` gives the try number.
@solution
def judge(secret, guess):
    if guess < secret:
        return "higher"
    if guess > secret:
        return "lower"
    return "correct"

def play(secret, guesses):
    for tries, guess in enumerate(guesses, start=1):
        if judge(secret, guess) == "correct":
            return True, tries
    return False, len(guesses)

def max_tries(low, high):
    k = 0
    while 2 ** k < high - low + 1:
        k += 1
    return k
:::
