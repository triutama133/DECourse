#!/usr/bin/env bash
# Reference solution for Lab 1.1 part A.
set -euo pipefail

file="${1:?usage: report.sh <events.ndjson>}"
valid="$(mktemp)"
trap 'rm -f "$valid"' EXIT

# Parse every line on its own. fromjson? silently skips lines that are not valid JSON.
jq -R -c 'fromjson? | select(type == "object")' "$file" > "$valid"

lines_total=$(wc -l < "$file")
valid_events=$(wc -l < "$valid")

echo "lines_total=$lines_total"
echo "malformed_lines=$((lines_total - valid_events))"
echo "valid_events=$valid_events"
echo "unique_event_ids=$(jq -r '.event_id' "$valid" | sort -u | wc -l)"
echo "distinct_users=$(jq -r 'select(.user_id != null) | .user_id' "$valid" | sort -u | wc -l)"

# One (event_id, event_type) pair per event, duplicates removed, then count per type.
jq -r '[.event_id, .event_type] | @tsv' "$valid" | sort -u | cut -f2 | LC_ALL=C sort | uniq -c \
  | awk '{printf "type.%s=%d\n", $2, $1}'
