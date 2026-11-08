#!/usr/bin/env bash
# Prints the Markdown notes of an ITG release: a link to the upstream Orca release notes, then the
# ITG changes on HEAD that upstream main and the previous ITG release do not have.
# Usage: itg-release-notes.sh <base X.Y.Z> <upstream main SHA> <PR author>
set -euo pipefail

base="$1"
upstream="$2"
author="$3"

# The upstream PR each feature branch was opened as; ITG-only branches have none.
prs="$(gh pr list --repo stablyai/orca --author "$author" --state all --limit 200 \
  --json number,title,url,headRefName,state \
  --jq '.[] | [.headRefName, "\(.title) ([#\(.number)](\(.url))\(if .state == "MERGED" then ", already merged upstream" else "" end))"] | @tsv')"

# Each release lists only what changed since the previous one; the first lists everything.
previous="$(git describe --tags --abbrev=0 --match 'v*-itg.*' HEAD 2>/dev/null || true)"

declare -A seen=()
changes=()
for commit in $(git rev-list --first-parent --reverse HEAD --not "$upstream" ${previous:+"$previous"}); do
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
    changes+=("$entry")
  done <<<"$entries"
done

if ((${#changes[@]} == 0)); then
  echo "Orca ITG upgraded to Orca v${base}, with no ITG changes ${previous:+since $previous}."
else
  echo "Orca ITG is Orca v${base} plus the changes below."
fi
echo
echo "## Orca v${base}"
echo
echo "See the [Orca v${base} release notes](https://github.com/stablyai/orca/releases/tag/v${base})."
if ((${#changes[@]} > 0)); then
  echo
  if [[ -n "$previous" ]]; then
    echo "## ITG changes since ${previous}"
  else
    echo "## ITG changes"
  fi
  echo
  printf -- '- %s\n' "${changes[@]}"
fi
