"""Lab 1.5: clean and summarise messy data with pandas.

You clean the KopiKu orders export (orders_data.py makes it: look at its docstring first, then write the file and open it in a Python
session or notebook). Work in order and run the tests after each function:    pytest labs/mod-1-5/test_lab.py -v
Rules of the lab: no apply / iterrows / itertuples where a test says so (the tests forbid them): use column arithmetic and built-in methods.
"""
import pandas as pd  # noqa: F401


def load_orders(source):
    """Read the raw orders CSV (a path or a file-like object) into a DataFrame.   (lesson 2)

    - order_id and customer_id stay TEXT (customer ids like "00042" must keep their leading zeros): dtype "string".
    - quantity is a nullable integer ("Int64"), so empty cells become <NA> instead of turning the column into floats.
    - a "-" in the file means missing (unit_price_idr must end up float64 with NaN).
    - order_date becomes datetime64; anything that is not a valid YYYY-MM-DD date becomes NaT (do not raise).
    """
    raise NotImplementedError("TODO: implement load_orders")


def data_quality_report(df):
    """Return {"rows": int, "nulls": {column: int, ...}, "duplicate_order_ids": int} for a loaded (raw) frame.   (lesson 2)

    nulls has every column. duplicate_order_ids is the number of rows whose order_id already appeared earlier. Use plain Python ints.
    """
    raise NotImplementedError("TODO: implement data_quality_report")


def clean_orders(df):
    """Return a cleaned COPY of the raw frame (do not change the input).   (lesson 3)

    - country: strip spaces, UPPER case.  product and status: strip spaces, lower case.
    - one row per order_id (the first copy wins).
    - drop rows whose order_date, quantity or unit_price_idr is missing.
    - quantity becomes a plain int64 column.  The index is reset to 0..n-1.
    """
    raise NotImplementedError("TODO: implement clean_orders")


def paid_only(df):
    """Rows whose status is "paid", with a fresh 0..n-1 index.   (lesson 3: boolean masks)"""
    raise NotImplementedError("TODO: implement paid_only")


def add_revenue(df):
    """Return a new frame with a revenue_idr column = quantity * unit_price_idr. The input must not gain the column.   (lesson 3)"""
    raise NotImplementedError("TODO: implement add_revenue")


def revenue_by_country(df):
    """One row per country with columns, in this order: country, orders (DISTINCT order_id), revenue_idr (sum), avg_order_idr (mean of
    revenue_idr). Highest revenue first, index 0..n-1.   (lesson 4: groupby)"""
    raise NotImplementedError("TODO: implement revenue_by_country")


def monthly_revenue(df):
    """Pivot table: rows = month as text "YYYY-MM" (index named "month"), columns = country, values = sum of revenue_idr, 0 where there
    were no sales. The columns axis must have no name.   (lesson 4: pivot)"""
    raise NotImplementedError("TODO: implement monthly_revenue")


def top_products_per_country(df, n=2):
    """The n best products per country by total revenue_idr. Columns: country, product, revenue_idr, rank (1 = best).
    Ties are broken by product name A to Z. Sorted by country, then rank. Index 0..n-1.   (lesson 4: group + rank)"""
    raise NotImplementedError("TODO: implement top_products_per_country")


def add_customer_history(df):
    """Sort by customer_id, order_date, order_id (fresh index) and add, per customer:   (lesson 4: window-style columns)
      order_number               1, 2, 3 ... in that order
      customer_revenue_to_date   running sum of revenue_idr including this order
      days_since_previous        whole days since the customer's previous order (NaN for their first)
    The input must not be changed."""
    raise NotImplementedError("TODO: implement add_customer_history")


def join_customers(orders, customers):
    """Attach name, tier and signup_date to every order.   (lesson 5: joins)

    Keep every order exactly once (a left join). If the customer list has the same customer_id twice, raise pandas.errors.MergeError
    instead of silently multiplying orders (ask merge to validate). Orders whose customer is not in the list get tier "unknown".
    """
    raise NotImplementedError("TODO: implement join_customers")


def orphan_customer_ids(orders, customers):
    """Sorted list of customer_ids that appear in orders but not in the customer list (an anti-join).   (lesson 5)"""
    raise NotImplementedError("TODO: implement orphan_customer_ids")


def shrink_memory(df):
    """Return a copy that uses much less memory but holds the same values.   (lesson 6)

    Text columns with few distinct values (fewer than half as many as rows) become "category"; integer columns get the smallest
    integer type that fits (pd.to_numeric(..., downcast="integer")). Leave floats, dates and unique ids alone.
    """
    raise NotImplementedError("TODO: implement shrink_memory")


def chunked_revenue_by_country(path, chunksize=500):
    """Total quantity * unit_price_idr per country for a CSV that may be too big for memory.   (lesson 6)

    Read ONLY the columns country, quantity, unit_price_idr, `chunksize` rows at a time, and combine the partial sums. Never hold the
    whole file. Return a pandas Series indexed by country (sorted), values = revenue.
    """
    raise NotImplementedError("TODO: implement chunked_revenue_by_country")


def write_parquet(df, path):
    """Write the frame to a Parquet file without the pandas index.   (lesson 6)"""
    raise NotImplementedError("TODO: implement write_parquet")


def read_parquet_columns(path, columns):
    """Read only the given columns from a Parquet file.   (lesson 6: Parquet is columnar)"""
    raise NotImplementedError("TODO: implement read_parquet_columns")
