"""Checks for the Try it exercises of Module 1.3 (advanced SQL). Used by check.py; not meant to be run directly."""
import json
import re
import subprocess
import sys

from check import ROOT, exercise, tail

DATASET = ROOT / "labs" / "mod-1-3" / "datasets" / "kopiku.sql"

# a changed copy of the data: a new city, a customer with no city, an order with no payment method
HOSTILE = """
INSERT INTO customers VALUES (11,'Tari','Medan','Gold','2026-01-25'),(12,'Gita',NULL,'Silver','2026-01-26'),(13,'Hadi','Makassar','Bronze','2026-01-27');
INSERT INTO orders VALUES (119,11,'2026-01-26','delivered','card',20000),(120,12,'2026-01-27','delivered',NULL,15000),
                          (121,13,'2026-01-28','cancelled','cod',25000),(122,12,'2026-01-29','delivered','card',15000);
INSERT INTO order_items VALUES (119,1,2,2,95000),(120,1,1,1,85000),(121,1,3,1,90000),(122,1,4,3,80000);
"""

EXPECTED = {
    "REVENUE_ROLLUP": ("""SELECT c.city, o.payment_method, SUM(i.qty * i.unit_price_idr) AS revenue_idr,
        GROUPING(c.city) + GROUPING(o.payment_method) AS level
        FROM orders o JOIN order_items i ON i.order_id = o.order_id JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.status = 'delivered' GROUP BY ROLLUP (c.city, o.payment_method)""", "city, payment_method, revenue_idr, level", 15),
    "STATUS_CUBE": ("SELECT status, payment_method, COUNT(*) FROM orders GROUP BY CUBE (status, payment_method)", "status, payment_method, orders", 19),
    "TIER_OR_METHOD": ("""SELECT c.tier, o.payment_method, COUNT(*) FROM orders o JOIN customers c ON c.customer_id = o.customer_id
        GROUP BY GROUPING SETS ((c.tier), (o.payment_method))""", "tier, payment_method, orders", 7),
}

HARNESS = r'''
import json, sys
sys.path.insert(0, ".")
import rollup
print(json.dumps({n: getattr(rollup, n, None) for n in ("REVENUE_ROLLUP", "STATUS_CUBE", "TIER_OR_METHOD")}))
'''

EXTENSION = re.compile(r"\b(ROLLUP|CUBE|GROUPING\s+SETS)\b", re.I)


def norm(rows):
    return sorted(json.dumps([round(v, 2) if isinstance(v, float) else v for v in r]) for r in rows)


@exercise("1.3-9", "subtotals and grand totals with ROLLUP, CUBE and GROUPING SETS", ["rollup.py"], [
    "Start from the plain GROUP BY query, then change only the GROUP BY clause. Try the three keywords on a small table first and look at where the NULLs appear.",
    "A subtotal row has NULL in the column that was rolled up, but real data can contain NULLs too. GROUPING(column) is 1 for a rolled-up column and 0 otherwise: build level from it, not from IS NULL.",
    "With two columns, GROUPING(a) + GROUPING(b) is 0, 1 or 2 as the exercise asks. GROUPING(a, b) with two arguments is a bit mask (0, 1, 3), a different thing. ROLLUP (a, b) keeps the order you give: city first, then payment method."])
def ex_1_3_9(ctx):
    if not ctx.need_files(["rollup.py"]):
        return
    try:
        import duckdb
    except ImportError:
        ctx.fail("DuckDB is installed", "run  pip install duckdb  in your virtual environment and check again")
        return
    (ctx.work / "_harness.py").write_text(HARNESS, encoding="utf-8")
    try:
        p = subprocess.run([sys.executable, "_harness.py"], cwd=str(ctx.work), capture_output=True, text=True, timeout=30)
        found = json.loads(p.stdout.strip().splitlines()[-1])
    except (subprocess.TimeoutExpired, ValueError, IndexError):
        ctx.fail("rollup.py can be imported", tail(p.stderr) if "p" in locals() else "it took too long")
        return
    dataset = DATASET.read_text(encoding="utf-8")
    for name, (reference, columns, n_rows) in EXPECTED.items():
        sql = found.get(name)
        if not isinstance(sql, str) or not sql.strip():
            ctx.fail(f"{name} is defined as a text with your SQL", f"add  {name} = \"\"\"SELECT ...\"\"\"  to rollup.py")
            continue
        ctx.check(EXTENSION.search(sql) is not None, f"{name} uses ROLLUP, CUBE or GROUPING SETS",
                  "the point is to get the subtotals from one GROUP BY, not from several queries glued with UNION ALL")
        for label, extra in (("on the KopiKu data", ""), ("on a changed copy of the data (a new city, a customer with no city, an order with no payment method)", HOSTILE)):
            con = duckdb.connect()
            con.execute(dataset)
            if extra:
                con.execute(extra)
            want = con.execute(reference).fetchall()
            try:
                mine = con.execute(sql).fetchall()
                width = len(con.description)
            except Exception as e:                       # the learner's SQL is data here: report its error, never raise
                ctx.fail(f"{name} runs {label}", str(e).splitlines()[0][:160])
                con.close()
                break
            con.close()
            if width != len(want[0]):
                ctx.fail(f"{name} returns the columns {columns}", f"it returns {width} columns, expected {len(want[0])}")
                break
            same = norm(mine) == norm(want)
            hint = f"it returns {len(mine)} rows, expected {len(want)}" if len(mine) != len(want) else "the number of rows is right but some values are not: compare the subtotal rows"
            if not ctx.check(same, f"{name} returns the expected {len(want)} rows {label}", hint):
                break
