"""Lab 1.5 reference solution. Try on your own first!"""
import pandas as pd


def load_orders(source):
    df = pd.read_csv(source, dtype={"order_id": "string", "customer_id": "string", "quantity": "Int64"}, na_values=["-"])
    df["order_date"] = pd.to_datetime(df["order_date"], format="%Y-%m-%d", errors="coerce")
    return df


def data_quality_report(df):
    return {"rows": int(len(df)),
            "nulls": {c: int(df[c].isna().sum()) for c in df.columns},
            "duplicate_order_ids": int(df["order_id"].duplicated().sum())}


def clean_orders(df):
    out = df.copy()
    out["country"] = out["country"].str.strip().str.upper()
    out["product"] = out["product"].str.strip().str.lower()
    out["status"] = out["status"].str.strip().str.lower()
    out = out.drop_duplicates(subset="order_id", keep="first")
    out = out.dropna(subset=["order_date", "quantity", "unit_price_idr"])
    out["quantity"] = out["quantity"].astype("int64")
    return out.reset_index(drop=True)


def paid_only(df):
    return df[df["status"] == "paid"].reset_index(drop=True)


def add_revenue(df):
    return df.assign(revenue_idr=df["quantity"] * df["unit_price_idr"])


def revenue_by_country(df):
    g = df.groupby("country", as_index=False).agg(orders=("order_id", "nunique"), revenue_idr=("revenue_idr", "sum"),
                                                  avg_order_idr=("revenue_idr", "mean"))
    return g.sort_values("revenue_idr", ascending=False).reset_index(drop=True)


def monthly_revenue(df):
    month = df["order_date"].dt.strftime("%Y-%m").rename("month")
    table = df.pivot_table(index=month, columns="country", values="revenue_idr", aggfunc="sum", fill_value=0)
    table.columns.name = None
    return table


def top_products_per_country(df, n=2):
    g = df.groupby(["country", "product"], as_index=False)["revenue_idr"].sum()
    g = g.sort_values(["country", "revenue_idr", "product"], ascending=[True, False, True])
    g["rank"] = g.groupby("country").cumcount() + 1
    return g[g["rank"] <= n].reset_index(drop=True)


def add_customer_history(df):
    out = df.sort_values(["customer_id", "order_date", "order_id"]).reset_index(drop=True)
    by_customer = out.groupby("customer_id")
    out["order_number"] = by_customer.cumcount() + 1
    out["customer_revenue_to_date"] = by_customer["revenue_idr"].cumsum()
    out["days_since_previous"] = by_customer["order_date"].diff().dt.days
    return out


def join_customers(orders, customers):
    merged = orders.merge(customers, on="customer_id", how="left", validate="m:1")
    merged["tier"] = merged["tier"].fillna("unknown")
    return merged


def orphan_customer_ids(orders, customers):
    return sorted(set(orders["customer_id"]) - set(customers["customer_id"]))


def shrink_memory(df):
    out = df.copy()
    for col in out.columns:
        s = out[col]
        if pd.api.types.is_integer_dtype(s) and not isinstance(s.dtype, pd.api.extensions.ExtensionDtype):
            out[col] = pd.to_numeric(s, downcast="integer")
        elif (pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s)) and s.nunique() < 0.5 * len(s):
            out[col] = s.astype("category")
    return out


def chunked_revenue_by_country(path, chunksize=500):
    parts = []
    for chunk in pd.read_csv(path, usecols=["country", "quantity", "unit_price_idr"], chunksize=chunksize):
        revenue = chunk["quantity"] * chunk["unit_price_idr"]
        parts.append(revenue.groupby(chunk["country"]).sum())
    return pd.concat(parts).groupby(level=0).sum().sort_index()


def write_parquet(df, path):
    df.to_parquet(path, index=False)


def read_parquet_columns(path, columns):
    return pd.read_parquet(path, columns=list(columns))
