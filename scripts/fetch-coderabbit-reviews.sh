#!/usr/bin/env bash
# scripts/fetch-coderabbit-reviews.sh
# Fetches all CodeRabbit review comments for the current branch's PR.
# Outputs structured JSON: one object per inline comment, plus PR-level review bodies.
#
# Usage:
#   bash scripts/fetch-coderabbit-reviews.sh          # auto-detect branch
#   bash scripts/fetch-coderabbit-reviews.sh --pr 36  # explicit PR number
#
# Requirements: gh (GitHub CLI), jq, git
set -euo pipefail

# ---------- helpers ----------
die() { echo "ERROR: $*" >&2; exit 1; }

command -v gh  >/dev/null 2>&1 || die "gh (GitHub CLI) is not installed. Install it: https://cli.github.com"
command -v jq  >/dev/null 2>&1 || die "jq is not installed. Install it: brew install jq"
command -v git >/dev/null 2>&1 || die "git is not installed."

# ---------- parse args ----------
PR_NUMBER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    *)    die "Unknown argument: $1" ;;
  esac
done

# ---------- resolve PR ----------
if [[ -z "$PR_NUMBER" ]]; then
  BRANCH=$(git branch --show-current 2>/dev/null) || die "Not inside a git repository."
  [[ -n "$BRANCH" ]] || die "Could not determine current branch (detached HEAD?)."

  # Try gh pr view first (works for any state: open, merged, closed)
  PR_VIEW=$(gh pr view --json number,title,url 2>/dev/null) || true

  if [[ -n "$PR_VIEW" && "$PR_VIEW" != "null" ]]; then
    PR_NUMBER=$(echo "$PR_VIEW" | jq -r '.number')
    PR_TITLE=$(echo "$PR_VIEW" | jq -r '.title')
    PR_URL=$(echo "$PR_VIEW" | jq -r '.url')
  else
    # Fallback: search across all states
    PR_JSON=$(gh pr list --head "$BRANCH" --state all --json number,title,url --jq '.[0]' 2>/dev/null) || true
    [[ -n "$PR_JSON" && "$PR_JSON" != "null" ]] || die "No PR found for branch '$BRANCH'."

    PR_NUMBER=$(echo "$PR_JSON" | jq -r '.number')
    PR_TITLE=$(echo "$PR_JSON" | jq -r '.title')
    PR_URL=$(echo "$PR_JSON" | jq -r '.url')
  fi
else
  PR_INFO=$(gh pr view "$PR_NUMBER" --json title,url 2>/dev/null) || die "PR #$PR_NUMBER not found."
  PR_TITLE=$(echo "$PR_INFO" | jq -r '.title')
  PR_URL=$(echo "$PR_INFO" | jq -r '.url')
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) || die "Could not determine repository."

# ---------- fetch inline review comments ----------
INLINE_COMMENTS=$(
  gh api "repos/$REPO/pulls/$PR_NUMBER/comments" --paginate \
    --jq '[.[] | select(.user.login | contains("coderabbit")) | {path: .path, line: .line, body: .body, created_at: .created_at, id: .id}]' \
    2>/dev/null
) || INLINE_COMMENTS="[]"

# ---------- fetch PR-level review bodies ----------
REVIEW_BODIES=$(
  gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
    --jq '[.[] | select(.user.login | contains("coderabbit")) | {state: .state, body: .body, submitted_at: .submitted_at}]' \
    2>/dev/null
) || REVIEW_BODIES="[]"

# ---------- count ----------
INLINE_COUNT=$(echo "$INLINE_COMMENTS" | jq 'length')
REVIEW_COUNT=$(echo "$REVIEW_BODIES" | jq 'length')

# ---------- output ----------
jq -n \
  --arg pr_number "$PR_NUMBER" \
  --arg pr_title "$PR_TITLE" \
  --arg pr_url "$PR_URL" \
  --arg repo "$REPO" \
  --argjson inline_count "$INLINE_COUNT" \
  --argjson review_count "$REVIEW_COUNT" \
  --argjson inline_comments "$INLINE_COMMENTS" \
  --argjson review_bodies "$REVIEW_BODIES" \
  '{
    pr: {
      number: ($pr_number | tonumber),
      title: $pr_title,
      url: $pr_url,
      repo: $repo
    },
    summary: {
      inline_comments: $inline_count,
      review_level_comments: $review_count
    },
    inline_comments: $inline_comments,
    review_bodies: $review_bodies
  }'
