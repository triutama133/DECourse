#!/usr/bin/env bash
# Lab 1.1, part A: summarise a KopiKu events.ndjson file using only shell tools and jq.
#
#   bash labs/mod-1-1/report.sh data/events.ndjson
#
# Print exactly these lines, in this order (key=value, no spaces):
#   lines_total=<number of lines in the file>
#   malformed_lines=<lines that are not valid JSON objects>
#   valid_events=<lines that are valid JSON objects>
#   unique_event_ids=<number of different event_id values among valid events>
#   distinct_users=<number of different non-null user_id values among valid events>
#   type.<event_type>=<count>      one line per event_type, alphabetical, counting each event_id once
#
# Rules: never load the whole file into memory in one tool call that cannot stream if you can avoid it;
# fail loudly (set -euo pipefail); clean up temporary files even if the script fails (trap).
set -euo pipefail

echo "TODO: implement report.sh" >&2
exit 1
