"""Runs pytest inside Pyodide for the 'Run in your browser' labs. Loaded by pyodide-worker.js and scripts/verify_browser_labs.js."""
import contextlib
import importlib
import io
import os
import shutil
import sys

ROOT = "/lab"


def reset():
    os.chdir("/")
    shutil.rmtree(ROOT, ignore_errors=True)
    os.makedirs(ROOT, exist_ok=True)


def run_lab(args):
    os.chdir(ROOT)
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    # a second run must see the learner's NEW code, not modules cached from the previous run
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None)
        if isinstance(f, str) and f.startswith(ROOT + "/"):
            del sys.modules[name]
    importlib.invalidate_caches()
    import pytest

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        code = pytest.main(list(args))
    return buf.getvalue(), int(code)


# ---- the Python pad in the lessons: run a snippet like the >>> prompt does, and keep the variables between runs ----
_PADS = {}


def exec_pad(session, code, reset=False):
    """Run `code` in the namespace of `session`. A bare expression prints its value (as at the >>> prompt). Returns (output, ok)."""
    import ast
    import traceback

    if reset:
        _PADS.pop(session, None)
        return "", True
    ns = _PADS.setdefault(session, {"__name__": "__main__"})

    def no_input(*args, **kwargs):
        raise EOFError("input() cannot ask for typing in the browser pad: put the value in the code (name = ...) or run this one in your terminal.")

    ns["input"] = no_input
    buf = io.StringIO()
    ok = True
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            tree = ast.parse(code, "<pad>")
            for node in tree.body:
                if isinstance(node, ast.Expr):
                    value = eval(compile(ast.Expression(node.value), "<pad>", "eval"), ns)
                    if value is not None:
                        print(repr(value))
                else:
                    exec(compile(ast.Module([node], []), "<pad>", "exec"), ns)
        except BaseException as error:  # noqa: BLE001 - show whatever the learner's code raised, like the terminal does
            ok = False
            frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == "<pad>"]
            if isinstance(error, SyntaxError):
                print("".join(traceback.format_exception_only(type(error), error)).rstrip())
            else:
                print("Traceback (most recent call last):")
                print("".join(traceback.format_list(frames)).rstrip())
                print("".join(traceback.format_exception_only(type(error), error)).rstrip())
                if isinstance(error, NameError):
                    print("\nHint: Python does not know that name yet. Run the lines that create it first (the earlier examples of this lesson, "
                          "in order), or this example is only a piece of a bigger program: then run the complete program in your terminal.")
    return buf.getvalue(), ok


# ---- drills in the lessons (freeCodeCamp / DataCamp style): run the learner's code, then evaluate small checks ----
def check_drill(code, checks):
    """Run `code` in a fresh namespace, then evaluate each check: a list of [expression, message].

    An expression sees the learner's variables, `out` (what the code printed, whitespace-trimmed), `code` (the source)
    and the helpers calls(name), uses(name), defines(name). Returns a JSON text:
    {"output": ..., "error": ... or "", "results": [{"ok": bool, "msg": str}, ...]}.
    """
    import ast
    import json
    import traceback

    buf = io.StringIO()
    ns = {"__name__": "__main__"}
    error = ""

    def no_input(*args, **kwargs):
        raise EOFError("input() cannot ask for typing here: put the value in the code (name = ...) instead.")

    ns["input"] = no_input
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            tree = ast.parse(code, "<drill>")
            for node in tree.body:
                if isinstance(node, ast.Expr):
                    value = eval(compile(ast.Expression(node.value), "<drill>", "eval"), ns)
                    if value is not None:
                        print(repr(value))
                else:
                    exec(compile(ast.Module([node], []), "<drill>", "exec"), ns)
        except BaseException as exc:  # noqa: BLE001 - show whatever the learner's code raised, like the terminal does
            frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == "<drill>"]
            if isinstance(exc, SyntaxError):
                error = "".join(traceback.format_exception_only(type(exc), exc)).rstrip()
            else:
                error = "Traceback (most recent call last):\n" + "".join(traceback.format_list(frames)).rstrip() + "\n" + "".join(traceback.format_exception_only(type(exc), exc)).rstrip()
                if isinstance(exc, NameError):
                    error += "\n\nHint: Python does not know that name yet. Is it spelled exactly as in the task, and is the line that creates it above?"
    output = buf.getvalue()
    results = []
    if not error:
        try:
            tree = ast.parse(code)
        except SyntaxError:
            tree = ast.parse("")

        def calls(name):
            return any(isinstance(n, ast.Call) and ((isinstance(n.func, ast.Name) and n.func.id == name) or (isinstance(n.func, ast.Attribute) and n.func.attr == name)) for n in ast.walk(tree))

        def uses(name):
            return any((isinstance(n, ast.Name) and n.id == name) or (isinstance(n, ast.Attribute) and n.attr == name) for n in ast.walk(tree))

        def defines(name):
            return any(isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name == name for n in ast.walk(tree))

        scope = dict(ns)
        scope.update({"out": output.strip(), "code": code, "calls": calls, "uses": uses, "defines": defines, "ns": ns})
        for expression, message in checks:
            try:
                ok = bool(eval(expression, scope))
            except Exception:  # noqa: BLE001 - a missing variable or a wrong type means the check is not met
                ok = False
            results.append({"ok": ok, "msg": message})
    return json.dumps({"output": output, "error": error, "results": results})
