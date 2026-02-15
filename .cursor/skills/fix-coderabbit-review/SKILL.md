---
name: fix-coderabbit-review
description: Fetch CodeRabbit review comments for the current PR, categorize by severity, and automatically fix every issue in the codebase. Use when the user says "fix review", "fix coderabbit", "address review comments", "fix PR review", or asks to resolve CodeRabbit feedback.
---

# Fix CodeRabbit Review

Automatically fetch, categorize, and fix all CodeRabbit review comments for the current branch's PR.

## Workflow

Follow these steps **in order**. Do not skip steps.

### Step 1: Fetch Reviews

Run the helper script to get structured review data:

```bash
bash scripts/fetch-coderabbit-reviews.sh
```

If the script fails (no PR, `gh` not authenticated, etc.), report the error to the user and stop.

Parse the JSON output. The structure is:

```json
{
  "pr": { "number": 36, "title": "...", "url": "..." },
  "summary": { "inline_comments": 14, "review_level_comments": 2 },
  "inline_comments": [
    { "path": "src/foo.ts", "line": 42, "body": "...", "id": 123 }
  ],
  "review_bodies": [
    { "state": "COMMENTED", "body": "..." }
  ]
}
```

### Step 2: Categorize by Severity

Parse each comment's `body` field to extract severity. CodeRabbit uses these markers:

| Marker in body | Severity | Priority |
|---|---|---|
| `🔴 Critical` | Critical | 1 (fix first) |
| `🟠 Major` | Major | 2 |
| `🟡 Minor` | Minor | 3 |
| No marker / informational | Info | 4 (skip unless actionable) |

Also look for these category markers:
- `⚠️ Potential issue` -- a bug or correctness problem, always fix
- `🛠️ Refactor suggestion` -- a code quality improvement, fix it
- `💡 Suggestion` / `📝 Note` -- informational, fix only if clearly actionable

**Skip** comments that are purely informational with no concrete code change suggested.

Group the remaining actionable comments by file path, then sort files so the highest-severity issue comes first.

### Step 3: Create a Todo List

Use `TodoWrite` to create a task list. Each todo item should include:
- The file path
- The severity level
- A short summary of what needs fixing

Order: Critical first, then Major, then Minor.

Example:
```
1. CRITICAL: Fix garbage className in components/ai/Foo.tsx
2. MAJOR: Add timeout to fetch calls in lib/api.ts
3. MINOR: Fix stale dep in useEffect in pages/index.tsx
```

### Step 4: Fix Each Issue

For each todo item, follow this loop:

1. **Mark as in_progress** via TodoWrite
2. **Read the affected file** (at minimum the lines around the issue)
3. **Understand the fix**:
   - If the comment body contains a `Prompt for AI Agents` block (inside `<details>` tags), use that as the primary instruction
   - If the comment contains a `Proposed fix` or `Committable suggestion` diff block, apply that diff
   - Otherwise, reason about the fix from the comment description
4. **Apply the fix** using StrReplace (or Write for full rewrites)
5. **Respect project rules**: Follow `.cursorrules` -- use shadcn Dialog (not hand-rolled modals), Tailwind only (no inline styles), try/catch for error handling, no `any` types, etc.
6. **Mark as completed** via TodoWrite

**Important**: Fix one issue at a time. Do not batch unrelated fixes into one edit.

### Step 5: Verify

After all fixes are applied:

1. Run `ReadLints` on every file that was modified
2. If new lint errors were introduced, fix them immediately
3. Confirm zero new lint errors before proceeding

### Step 6: Report Summary

Print a markdown summary for the user:

```markdown
## CodeRabbit Review Fixes -- PR #<number>

### Critical (<count>)
1. **`path/to/file.ts`** -- <short description of fix>

### Major (<count>)
1. **`path/to/file.ts`** -- <short description of fix>

### Minor (<count>)
1. **`path/to/file.ts`** -- <short description of fix>

### Skipped (<count>)
1. **`path/to/file.ts`** -- <reason skipped>

All fixes verified with linter. No new errors introduced.
```

## Edge Cases

- **No CodeRabbit comments**: Report "No CodeRabbit review comments found for this PR." and stop.
- **PR not found**: Report the error from the script and suggest the user push their branch or create a PR first.
- **Comment already resolved by prior code**: Read the file, check if the issue still exists. If already fixed, skip and note in summary.
- **Ambiguous fix**: If a comment does not have a clear code suggestion and the fix is ambiguous, describe what was found and ask the user for guidance rather than guessing.

## Tips

- CodeRabbit comments use the username `coderabbitai[bot]`
- The `Prompt for AI Agents` block inside comments is specifically written for AI consumption -- prefer it over the human-readable description
- Some comments include diff suggestions in markdown `suggestion` blocks -- these are directly applicable
- Always check if a fix has already been applied before making changes (the PR may have been updated since the review)
