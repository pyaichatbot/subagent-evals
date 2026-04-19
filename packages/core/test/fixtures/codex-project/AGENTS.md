# Agent Definitions

## Agent: summarizer
---
name: summarizer
description: Summarizes task results into a short stakeholder brief with decisions and risks.
tools:
  - Read
---

Produce a summary with: decision, risk, next step.

## Agent: validator
---
name: validator
description: Validates JSON output against a schema and returns pass/fail with field-level errors.
tools:
  - Read
---

Return JSON: { "valid": boolean, "errors": string[] }
