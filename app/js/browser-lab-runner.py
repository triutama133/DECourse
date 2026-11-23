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
def _drill_dir(files):
    """A clean working folder for a drill, holding the sample files it gives the learner."""
    root = "/drill"
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(root, exist_ok=True)
    for name, text in (files or {}).items():
        with open(os.path.join(root, name), "w", encoding="utf-8", newline="") as f:
            f.write(text)
    os.chdir(root)


def check_drill(code, checks, files=None):
    """Run `code` in a fresh namespace, then evaluate each check: a list of [expression, message].

    An expression sees the learner's variables, `out` (what the code printed, whitespace-trimmed), `code` (the source)
    and the helpers calls(name), uses(name), defines(name). Returns a JSON text:
    {"output": ..., "error": ... or "", "results": [{"ok": bool, "msg": str}, ...]}.
    """
    import ast
    import json
    import traceback

    _drill_dir(files)
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

        def has(kind):
            return any(type(n).__name__ == kind for n in ast.walk(tree))

        def count(kind):
            return sum(1 for n in ast.walk(tree) if type(n).__name__ == kind)

        def capture(fn, *args):
            """What `fn(*args)` prints."""
            sink = io.StringIO()
            with contextlib.redirect_stdout(sink):
                fn(*args)
            return sink.getvalue().strip()

        def raises(exc, fn, *args):
            """True when `fn(*args)` raises exactly that kind of error (and not another)."""
            try:
                fn(*args)
            except exc:
                return True
            except BaseException:  # noqa: BLE001 - a different error is a different answer
                return False
            return False

        def rerun(name, value):
            """Run the learner's code again with the first assignment to `name` replaced by `value`: the namespace afterwards.
            It shows whether the code works for other data too, not only for the numbers in the task."""
            fresh = ast.parse(code, "<drill>")
            node = next((n for n in fresh.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets)), None)
            if node is None:
                raise NameError(name)
            node.value = ast.parse(repr(value), mode="eval").body
            ast.fix_missing_locations(fresh)
            space = {"__name__": "__main__", "input": no_input}
            sink = io.StringIO()
            with contextlib.redirect_stdout(sink):
                exec(compile(fresh, "<drill>", "exec"), space)
            space["__out__"] = sink.getvalue().strip()
            return space

        scope = dict(ns)
        scope.update({"out": output.strip(), "code": code, "calls": calls, "uses": uses, "defines": defines, "has_node": has, "count_nodes": count, "printed_by": capture, "raises_error": raises, "rerun_with": rerun, "ns": ns})
        scope["read_file"] = lambda name: open(os.path.join("/drill", name), encoding="utf-8", newline="").read()
        for expression, message in checks:
            err = ""
            try:
                ok = bool(eval(expression, scope))
            except Exception as exc:  # noqa: BLE001 - a missing variable or a wrong type means the check is not met
                ok = False
                err = f"{type(exc).__name__}: {exc}"   # kept, so the page can explain WHY the check could not run
            results.append({"ok": ok, "msg": message, "err": err})
    return json.dumps({"output": output, "error": error, "results": results})


# ---- "watch it run": the program executed line by line, with the variables after each step (like Python Tutor) ----
def trace_code(code, files=None):
    """Run `code` and record, before every line that runs, which line it is and what every variable holds.
    Returns a JSON text: {"steps": [{"line": n, "frames": [{"name": ..., "vars": [[name, text, label], ...]}], "out": printed so far,
    "event": "line"|"return"|"end", "ret": text}], "error": ""}. A mutable value (list, dict, set) gets a label like list#1, so two
    names for the same object can be seen."""
    import json
    import sys
    import types

    _drill_dir(files)
    steps = []
    buf = io.StringIO()
    ns = {"__name__": "__main__"}
    labels = {}
    LIMIT = 150

    def no_input(*args, **kwargs):
        raise EOFError("input() cannot ask for typing here.")

    ns["input"] = no_input

    def short(v):
        text = repr(v)
        return text if len(text) <= 90 else text[:87] + "..."

    def label(v):
        if isinstance(v, (list, dict, set)):
            key = id(v)
            if key not in labels:
                labels[key] = len([1 for k in labels]) + 1
            return type(v).__name__ + "#" + str(labels[key])
        return ""

    def variables(mapping):
        rows = []
        for k, v in list(mapping.items()):
            if k.startswith("__") or k == "input" or isinstance(v, types.ModuleType):
                continue
            rows.append([k, "function" if isinstance(v, types.FunctionType) else short(v), label(v)])
        return rows

    def snapshot(frame):
        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == "<trace>":
                chain.append(f)
            f = f.f_back
        chain.reverse()
        return [{"name": "Global" if f.f_code.co_name == "<module>" else f.f_code.co_name + "()", "vars": variables(f.f_locals)} for f in chain]

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "<trace>":
            return None
        if event == "line":
            steps.append({"line": frame.f_lineno, "frames": snapshot(frame), "out": buf.getvalue(), "event": "line"})
        elif event == "return" and frame.f_code.co_name != "<module>":
            steps.append({"line": frame.f_lineno, "frames": snapshot(frame), "out": buf.getvalue(), "event": "return", "ret": short(arg)})
        if len(steps) > LIMIT:
            raise RuntimeError("This program runs too many steps to show.")
        return tracer

    error = ""
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        sys.settrace(tracer)
        try:
            exec(compile(code, "<trace>", "exec"), ns)
        except BaseException as exc:  # noqa: BLE001 - the program may fail on purpose, to show an error
            error = type(exc).__name__ + ": " + str(exc)
        finally:
            sys.settrace(None)
    steps.append({"line": 0, "frames": [{"name": "Global", "vars": variables(ns)}], "out": buf.getvalue(), "event": "end"})
    return json.dumps({"steps": steps, "error": error})
