# Plugins and Workflow Packs

`subagent-evals` is the generic eval engine. Workflow packs and host-specific installers should stay separate.

## Ownership split

- `subagent-evals`
  - lint, eval, score engine
  - replay cache and live runners
  - badge, diff, hosted reporting
- `multiagent-cli`
  - shell-first orchestration workflow
  - markdown subagents and commands
  - workflow-owned eval fixtures
- `@subagent-evals/plugin-multiagent`
  - optional installer/scaffolder
  - Claude/Codex host templates
  - conservative config wiring

## Why this split exists

The engine should not vendor full workflow repos. That creates duplication and drift.

Instead:

- workflow repos own their own fixtures and agent packs
- plugins copy or scaffold those templates into user repos
- `subagent-evals` remains host-agnostic

## multiagent-cli

The `multiagent-cli` workflow fixture set should live in the workflow repo under an `evals/` directory, not inside `subagent-evals`.

## plugin-multiagent

The plugin is the install surface for users who want:

- Claude-style `.claude/` scaffolding
- Codex-style `.codex/` scaffolding
- pre-wired `subagent-evals.config.yaml`
- runtime/security cases and doctor checks
