# System Tickets — Meta-Agentic-Loop Development

> Work here improves the plugin. Plugin improvements flow to ALL projects.

## Active Tickets

| ID | Title | Status | Scope |
|----|-------|--------|-------|
| SYS-001 | Ralph loop testing | Ready | plugin/hooks |
| SYS-002 | Cortex command completion | Ready | plugin/scripts |
| SYS-003 | Skill loading from plugin | Ready | plugin/skills |

## Ticket Template

```yaml
id: SYS-XXX
title: "What needs to happen"
status: Backlog | Ready | In Progress | Done
scope: plugin/hooks | plugin/scripts | plugin/skills | plugin/agents
description: |
  Detailed description
acceptance:
  - [ ] Criterion 1
  - [ ] Criterion 2
```

## Completed

| ID | Title | Completed | Pushed |
|----|-------|-----------|--------|
| (none yet) | | | |

---

## Workflow

1. **Pick ticket** from Active
2. **Work in plugin/** directory
3. **Test** in hackaton_lookfor or demo-brand
4. **Commit** to plugin: `cd plugin && git add . && git commit`
5. **Push** to origin: `git push origin main`
6. **Update** submodule ref: `cd .. && git add plugin && git commit`
7. **Mark Done** in this file

Changes propagate to:
- hackaton_lookfor (this project)
- demo-brand
- logicsticks.ai
- All future projects using the plugin
