"""Lab 0.0, Part A: plain Python, no functions yet.

You write ordinary lines of Python. Each step gives you some data and asks you to fill in ONE variable:
replace the `None` after the `=` with your own code, save the file, and check your work.

  See your values:     python3 labs/mod-0-0/practice.py
  Check all steps:     pytest labs/mod-0-0/test_practice.py -v
  Check one step:      pytest labs/mod-0-0/test_practice.py -k Step1 -v
  (In the browser preview: press "Run tests".)

Do the steps in order, each right after its lesson: Step 1 after Lesson 1, Step 2 after Lesson 2, and so on.
The checker runs your file again with other numbers in place of the INPUTS, to make sure your code works for
any data and not only for these. So do not change the lines between the INPUTS markers, and do not delete them.
"""

# ===== INPUTS: given to you, do not change =====
amount = 1250000
row1 = {"order_id": "1001", "status": "paid", "total_idr": "150000"}
row2 = {"order_id": "1002", "status": "paid", "total_idr": "90000"}
orders = [
    {"order_id": "1001", "customer_id": "7", "status": "paid", "total_idr": "150000"},
    {"order_id": "1002", "customer_id": "3", "status": "cancelled", "total_idr": "90000"},
    {"order_id": "1003", "customer_id": "7", "status": "paid", "total_idr": "25000"},
    {"order_id": "1004", "customer_id": "5", "status": "delivered", "total_idr": "60000"},
]
ids_seen = [7, 3, 7, 5]
signed_amount = -45000
totals = [150000, 25000]
items = [1, 2, 3, 4, 5]
batch_size = 2
# ===== END OF INPUTS =====


# ---------------------------------------------------------------- Step 1 (after Lesson 1): types
# 1a. `amount` is a whole number. Write it as text with dots between the thousands: 1250000 becomes "Rp 1.250.000".
formatted = None

# 1b. In row1 and row2 the totals are TEXT, as they come out of a CSV file. Add the two totals as numbers.
two_totals = None


# ---------------------------------------------------------------- Step 2 (after Lesson 2): lists, dicts, sets
# 2a. How many orders are in the list `orders`?
order_count = None

# 2b. The status of the FIRST order.
first_status = None

# 2c. The total of the LAST order, as a number.
last_total = None

# 2d. `ids_seen` has repeats. Make a list of the different ids, each once, smallest first.
unique_ids = None


# ---------------------------------------------------------------- Step 3 (after Lesson 3): decisions
# 3a. Like step 1a, but for `signed_amount`, which can be negative. The minus sign goes BEFORE "Rp":
#     -45000 becomes "-Rp 45.000", and a positive amount such as 500 becomes "Rp 500".
signed_text = None

# 3b. The average of the numbers in `totals`. When `totals` is empty there is no average: use None.
average = None


# ---------------------------------------------------------------- Step 4 (after Lesson 4): loops
# 4a. How many orders does each status have? A dictionary such as {"paid": 2, "cancelled": 1}.
status_counts = None

# 4b. Add up the totals (as numbers) of the orders whose status is not "cancelled" and not "refunded".
revenue = None

# 4c. The different customer ids in `orders`, as whole numbers, smallest first.
customer_ids = None

# 4d. Cut `items` into pieces of at most `batch_size` items, keeping the order: [[1, 2], [3, 4], [5]].
batches = None


# ---------------------------------------------------------------- Your results
# These lines show your values when you run the file. Leave them as they are.
print("1a formatted     :", formatted)
print("1b two_totals    :", two_totals)
print("2a order_count   :", order_count)
print("2b first_status  :", first_status)
print("2c last_total    :", last_total)
print("2d unique_ids    :", unique_ids)
print("3a signed_text   :", signed_text)
print("3b average       :", average)
print("4a status_counts :", status_counts)
print("4b revenue       :", revenue)
print("4c customer_ids  :", customer_ids)
print("4d batches       :", batches)
