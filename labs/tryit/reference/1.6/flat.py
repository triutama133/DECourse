import json


def flatten(record, prefix=""):
    out = {}
    for key, value in record.items():
        name = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(flatten(value, name + "_"))
        elif isinstance(value, list):
            out[name] = json.dumps(value)
        else:
            out[name] = value
    return out


def type_changes(old, new):
    return [f"{k}: {type(old[k]).__name__} -> {type(new[k]).__name__}"
            for k in old if k in new and type(old[k]) is not type(new[k])]
