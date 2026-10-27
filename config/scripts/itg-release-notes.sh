#!/usr/bin/env bash
# Prints the Markdown notes of an ITG release: a link to the upstream Orca release notes, then the
# ITG changes on HEAD that upstream main does not have.
# Usage: itg-release-notes.sh <base X.Y.Z> <upstream main SHA> <PR author>
set -euo pipefail

base="$1"
upstream="$2"
author="$3"

# The upstream PR each feature branch was opened as; ITG-only branches have none.
prs="$(gh pr list --repo stablyai/orca --author "$author" --state all --limit 200 \
  --json number,title,url,headRefName,state \
  --jq '.[] | [.headRefName, "\(.title) ([#\(.number)](\(.url))\(if .state == "MERGED" then ", already merged upstream" else "" end))"] | @tsv')"

echo "Orca ITG is Orca v${base} plus the changes below."
echo
echo "## Orca v${base}"
echo
echo "See the [Orca v${base} release notes](https://github.com/stablyai/orca/releases/tag/v${base})."
echo
echo "## ITG changes"
echo

declare -A seen=()
lines=0
for commit in $(git rev-list --first-parent --reverse HEAD --not "$upstream"); do
  read -r -a parents <<<"$(git rev-list --parents -n 1 "$commit")"
  if ((${#parents[@]} < 3)); then
    entries="$(git log -1 --format='%s' "$commit")"
  else
    side="${parents[2]}"
    # Merges that bring in upstream are not ITG changes.
    if git merge-base --is-ancestor "$side" "$upstream"; then
      continue
    fi
    # A feature can carry another PR's branch it was built on, merged inside it.
    branches="$({
      git log --merges --reverse --format='%s' "$side" --not "$upstream" "${parents[1]}"
      git log -1 --format='%s' "$commit"
    } | sed -n "s/^Merge branch '\([^']*\)'.*/\1/p")"
    entries="$(awk -F '\t' -v branches="$branches" '
      { pr[$1] = $2 }
      END { n = split(branches, b, "\n"); for (i = 1; i <= n; i++) if (b[i] in pr) print pr[b[i]] }
    ' <<<"$prs")"
    if [[ -z "$entries" ]]; then
      entries="$(git log --no-merges --reverse --format='%s' "$side" --not "$upstream" "${parents[1]}")"
    fi
  fi
  while IFS= read -r entry; do
    # Build and CI plumbing is not a change the team uses.
    if [[ -z "$entry" || "$entry" =~ ^(ci|build|chore)(\(.*\))?!?: || -n "${seen[$entry]:-}" ]]; then
      continue
    fi
    seen[$entry]=1
    echo "- $entry"
    lines=$((lines + 1))
  done <<<"$entries"
done

if ((lines == 0)); then
  echo "No ITG changes on top of upstream."
fi
