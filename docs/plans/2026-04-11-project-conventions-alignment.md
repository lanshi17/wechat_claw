# Project Conventions Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the repository with the new `AGENTS.md` conventions by creating the missing root operational directories, adding `progress.txt` and `lesson.md` templates, and appending a small conventions note to `README.md`.

**Architecture:** This is a documentation-and-layout-only slice. It should touch only repository scaffolding files and `README.md`, leaving runtime code, package scripts, and business logic unchanged. The work should be kept minimal, explicit, and easy to review.

**Tech Stack:** Markdown, plain text templates, existing TypeScript/pnpm repository structure.

---

### Task 1: Create the tracking-file templates

**Files:**
- Create: `progress.txt`
- Create: `lesson.md`
- Check: `AGENTS.md:78-93`

**Step 1: Write the failing expectation**

Check that the files do not exist yet.

Run:

```bash
ls progress.txt lesson.md
```

Expected: shell reports that one or both files do not exist.

**Step 2: Write minimal implementation**

Create `progress.txt` with a short, usable template like:

```text
[YYYY-MM-DD] Task:
Status:
Next:
```

Create `lesson.md` with a short markdown template like:

```markdown
# Lessons Learned

## YYYY-MM-DD - Topic
- Symptom:
- Cause:
- Attempts:
- Resolution:
- Prevention:
```
```

Keep both files concise.

**Step 3: Run verification**

Run:

```bash
ls progress.txt lesson.md
```

Expected: both files are listed.

**Step 4: Commit**

```bash
git add progress.txt lesson.md
git commit -m "docs: add project tracking templates"
```

### Task 2: Create the root operational directories

**Files:**
- Create: `scripts/`
- Create: `database/`
- Create: `logs/`
- Check: `AGENTS.md:53-68`

**Step 1: Write the failing expectation**

Check that the directories do not exist yet.

Run:

```bash
ls -d scripts database logs
```

Expected: shell reports that one or more directories do not exist.

**Step 2: Write minimal implementation**

Create the three directories exactly at the repository root:

- `scripts/`
- `database/`
- `logs/`

Do not add scripts, schema files, or log files in this task.

**Step 3: Run verification**

Run:

```bash
ls -d scripts database logs
```

Expected: all three directories are listed.

**Step 4: Commit**

```bash
git add scripts database logs
git commit -m "chore: add convention-aligned root directories"
```

### Task 3: Append the minimal README conventions section

**Files:**
- Modify: `README.md`
- Check: `AGENTS.md:40-45`
- Check: `AGENTS.md:78-88`
- Check: `AGENTS.md:153-157`

**Step 1: Write the failing expectation**

Read `README.md` and confirm it does not yet mention:

- `AGENTS.md`
- `progress.txt`
- `lesson.md`
- `docs/archive/`

Treat this gap as the red phase.

**Step 2: Write minimal implementation**

Append one short section near the end of `README.md`, for example `## Project conventions`, containing four concise bullets:

- `AGENTS.md` is the project conventions source
- active docs live in `docs/`; completed/outdated docs move to `docs/archive/`
- task-node progress updates go in `progress.txt`
- debugging/iteration retrospectives go in `lesson.md`

Do not rewrite existing install, configure, command, smoke verification, or runtime sections.

**Step 3: Run verification**

Read the appended portion of `README.md` and check that all four points are present and the existing runtime documentation remains intact.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add repository conventions note"
```

### Task 4: Final verification and progress update

**Files:**
- Modify: `progress.txt`
- Check: `README.md`
- Check: `AGENTS.md`
- Check: `docs/plans/2026-04-11-project-conventions-alignment-design.md`

**Step 1: Verify file and directory state**

Run:

```bash
ls -d scripts database logs && ls progress.txt lesson.md
```

Expected: all required directories and files exist.

**Step 2: Verify README note**

Read the final `README.md` section and confirm it mentions `AGENTS.md`, `docs/archive/`, `progress.txt`, and `lesson.md`.

**Step 3: Record progress**

Update `progress.txt` with a real entry describing that the repository was aligned to the new project conventions at the filesystem/documentation level.

Example content:

```text
[2026-04-11] Task: project conventions alignment
Status: created root directories, added tracking templates, updated README conventions note
Next: apply the conventions incrementally to future repo changes
```

**Step 4: Commit**

```bash
git add progress.txt README.md scripts database logs lesson.md
git commit -m "docs: align repository with project conventions"
```
