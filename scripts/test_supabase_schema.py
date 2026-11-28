#!/usr/bin/env python3
"""Check supabase/schema.sql on a real PostgreSQL: a learner sees and changes only their own row, nobody signed out
gets in, updated_at moves, and bad data is refused.

    DATABASE_URL=postgresql://postgres:pw@localhost:5432/postgres python3 scripts/test_supabase_schema.py

It needs a throw-away database (it creates the roles anon and authenticated, a minimal `auth` schema like
Supabase's, and the table). Without DATABASE_URL it says so and exits 0, like the lab tests that need a service.
Needs: pip install "psycopg[binary]"."""
import os
import sys
from pathlib import Path

URL = os.environ.get("DATABASE_URL")
if not URL:
    print("skipped: set DATABASE_URL to a throw-away PostgreSQL to run this check")
    sys.exit(0)

import psycopg  # noqa: E402

SCHEMA = (Path(__file__).resolve().parents[1] / "supabase" / "schema.sql").read_text(encoding="utf-8")
A, B = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
bad = 0


def check(cond, msg):
    global bad
    print(("ok   " if cond else "FAIL ") + msg)
    bad += 0 if cond else 1


def as_user(conn, uid):
    """Behave like PostgREST: switch to the `authenticated` role with the learner's id in the token claims."""
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claims', %s, false)", ('{"sub":"%s","role":"authenticated"}' % uid,) if uid else ("",))
    conn.execute("set role authenticated")


def refused(conn, sql, *params):
    try:
        with conn.transaction():
            conn.execute(sql, params)
        return False
    except psycopg.Error:
        return True


with psycopg.connect(URL, autocommit=True) as c:
    c.execute("drop schema if exists public cascade; create schema public")
    c.execute("drop schema if exists auth cascade; create schema auth")
    for role in ("anon", "authenticated"):
        c.execute(f"do $$ begin if not exists (select from pg_roles where rolname='{role}') then create role {role} nologin; end if; end $$")
    c.execute("grant usage on schema public, auth to anon, authenticated")
    c.execute("create table auth.users (id uuid primary key)")
    c.execute("""create function auth.uid() returns uuid language sql stable as
      $$ select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$""")
    c.execute("grant execute on function auth.uid() to anon, authenticated")
    c.execute("insert into auth.users values (%s), (%s)", (A, B))
    c.execute(SCHEMA)
    c.execute(SCHEMA)   # the file says "safe to run again"
    check(True, "schema.sql runs, and runs a second time")

    as_user(c, A)
    c.execute("insert into public.learning_progress (user_id, data) values (%s, %s)", (A, '{"df_lessons_done": {"v": "{}", "t": 1}}'))
    check(c.execute("select count(*) from public.learning_progress").fetchone()[0] == 1, "A: saves and reads their own row")
    first = c.execute("select updated_at from public.learning_progress").fetchone()[0]
    c.execute("update public.learning_progress set data = '{\"x\": 1}' where user_id = %s", (A,))
    second = c.execute("select updated_at from public.learning_progress").fetchone()[0]
    check(second > first, "updated_at moves on every update")
    check(c.execute("update public.learning_progress set data = '{}' where user_id = %s and updated_at = %s", (A, first)).rowcount == 0,
          "an update that still expects the old updated_at changes nothing (the compare-and-swap the web app uses)")
    check(c.execute("update public.learning_progress set data = '{}' where user_id = %s and updated_at = %s", (A, second)).rowcount == 1,
          "an update with the current updated_at goes through")

    as_user(c, B)
    check(c.execute("select count(*) from public.learning_progress").fetchone()[0] == 0, "B: cannot see A's row")
    check(c.execute("update public.learning_progress set data = '{\"hacked\": 1}' where user_id = %s", (A,)).rowcount == 0, "B: cannot change A's row")
    check(c.execute("delete from public.learning_progress where user_id = %s", (A,)).rowcount == 0, "B: cannot delete A's row")
    check(refused(c, "insert into public.learning_progress (user_id, data) values (%s, '{}')", A), "B: cannot create a row in A's name")
    c.execute("insert into public.learning_progress (user_id, data) values (%s, '{}')", (B,))
    check(refused(c, "insert into public.learning_progress (user_id, data) values (%s, '{}')", B), "B: a second row for the same learner is refused (the web app then updates instead)")
    check(refused(c, "update public.learning_progress set data = '[1,2]' where user_id = %s", B), "data must be a JSON object")

    c.execute("reset role")
    c.execute("set role anon")
    check(refused(c, "select * from public.learning_progress"), "signed out (anon key only): no access at all")
    check(refused(c, "insert into public.learning_progress (user_id, data) values (%s, '{}')", A), "signed out: cannot write either")

    as_user(c, A)
    check(c.execute("delete from public.learning_progress where user_id = %s", (A,)).rowcount == 1, "A: can delete their own online copy")
    c.execute("reset role")
    c.execute("delete from auth.users where id = %s", (B,))
    check(c.execute("select count(*) from public.learning_progress").fetchone()[0] == 0, "deleting an account removes its row (on delete cascade)")

print("schema: FAILED" if bad else "schema: all checks passed")
sys.exit(1 if bad else 0)
