# Project Conventions Alignment Design

## Summary

This slice performs the smallest repository changes needed to align the workspace with the newly added `AGENTS.md` project conventions. It creates the missing top-level operational directories, adds lightweight root templates for progress and lesson tracking, and appends a short conventions section to `README.md` without rewriting the existing product/runtime documentation.

The goal is alignment, not reorganization. This work should not move existing source files, change runtime behavior, add dependencies, or rewrite the README beyond the minimum required policy notes.

## Scope

This slice includes exactly three outcomes:

1. Create the missing top-level directories `scripts/`, `database/`, and `logs/`.
2. Create root-level `progress.txt` and `lesson.md` templates.
3. Add a concise conventions section to `README.md` that points readers at `AGENTS.md` and states the archive/record-keeping rules.

## Non-Goals

This slice does not include:

- moving existing files into `scripts/`, `database/`, or `logs/`
- migrating archived plan docs from `docs/plans/archive/` to `docs/archive/`
- rewriting the README install/startup sections
- changing build, test, or runtime commands
- adding logging libraries, CI changes, or code refactors

## Current State

The repository now contains `AGENTS.md`, but several convention-driven filesystem entries are still missing:

- `scripts/` does not exist
- `database/` does not exist
- `logs/` does not exist
- root `progress.txt` does not exist
- root `lesson.md` does not exist

`README.md` describes the product and current project structure, but it does not yet mention the new project-level conventions document, the root tracking files, or the new archive expectation for completed/outdated docs.

## Approach

### Directory Alignment

Create the three missing top-level directories directly. They can remain empty for now because the immediate goal is to establish the expected workspace shape, not to populate them with scripts, schema files, or logs.

Because empty directories are not tracked by Git, this slice treats them as working-tree setup rather than versioned content. If the team later decides these directories must persist in clone-to-clone history, that should be handled in a separate change with explicit placeholder files.

### Template Files

Add two lightweight root documents:

- `progress.txt` for task-node progress records
- `lesson.md` for debugging and iteration retrospectives

Both should be templates, not verbose manuals. They should be short, readable, and immediately usable by a collaborator without additional explanation.

### README Update

Append one short section to `README.md` that:

- identifies `AGENTS.md` as the project conventions source
- states that completed/outdated docs should move to `docs/archive/`
- states that progress updates belong in `progress.txt`
- states that debugging retrospectives belong in `lesson.md`

This keeps the README synchronized with the new policy without disturbing the existing runtime instructions.

## Verification

This slice is complete when:

- `scripts/`, `database/`, and `logs/` exist in the workspace
- `progress.txt` exists with a usable progress template
- `lesson.md` exists with a usable retrospective template
- `README.md` contains a short conventions section referencing `AGENTS.md`
- no runtime commands, dependencies, or business code are changed

## Risks and Mitigations

### Risk: README policy text could overstate current repository state

Mitigation: keep the new README section narrowly scoped to forward-looking project conventions and avoid implying that archived plan docs have already been migrated.

### Risk: Empty directories are not durable in Git history

Mitigation: accept that limitation for this minimal-alignment slice and keep placeholder-file decisions out of scope.

## Success Criteria

This slice succeeds if a collaborator opening the repository can see:

- the expected operational directories at the root
- the two required record-keeping files
- a concise README pointer to the conventions now defined in `AGENTS.md`
