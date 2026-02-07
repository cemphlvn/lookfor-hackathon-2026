# hackaton_lookfor — Self-Referential Meta-Automata

> **逆水行舟，不进则退** — Like rowing upstream: no advance is to drop back
>
> This project is BOTH factory AND instance.
> It spawns brands. It uses the plugin. It improves the plugin.
> The system builds itself while building what it builds.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SELF-REFERENTIAL AUTOMATA                                  ║
║                                                                               ║
║   hackaton_lookfor/           ← Factory + Instance (BOTH)                     ║
║   ├── plugin/                 ← meta-agentic-loop (THIS COPY IS CANONICAL)    ║
║   ├── cortex                  ← ./cortex init <brand>                         ║
║   ├── scrum/SYSTEM_TICKETS.md ← Plugin improvement tickets                    ║
║   ├── demo-brand/             ← Spawned brand (has own plugin/)               ║
║   └── [brand-n]/              ← More brands                                   ║
║                                                                               ║
║   Work here = Build brands + Improve plugin                                   ║
║   System tickets → plugin/ → git push → ALL projects updated                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## DUAL PURPOSE

### 1. FACTORY — Spawn Brands
```bash
./cortex init <brand-name>    # Creates new brand project
cd <brand-name> && claude     # Work in that brand
```

### 2. INSTANCE — Improve System
```bash
# Work on system tickets
cat scrum/SYSTEM_TICKETS.md   # See what needs doing

# Improve plugin directly
cd plugin
# ... make changes ...
git add . && git commit -m "SYS-001: Improve X"
git push origin main

# Update this project's reference
cd ..
git add plugin && git commit -m "Update plugin: SYS-001"
```

---

## SYSTEM TICKETS

Active tickets in `scrum/SYSTEM_TICKETS.md`:

| ID | Title | Scope |
|----|-------|-------|
| SYS-001 | Ralph loop testing | plugin/hooks |
| SYS-002 | Cortex command completion | plugin/scripts |
| SYS-003 | Skill loading from plugin | plugin/skills |

**Workflow:**
```
Pick ticket → Work in plugin/ → Test → Commit → Push → Update submodule
```

---

## AUTOMATA HIERARCHY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ L0: meta-agentic-loop (GitHub)                                               │
│     The immortal pattern. Source of truth.                                   │
│         ↑ git push                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ L1: hackaton_lookfor/plugin/ (THIS)                                          │
│     Canonical working copy. System tickets addressed here.                   │
│         ↓ ./cortex init                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ L2: demo-brand/, brand-2/, ...                                               │
│     Spawned brands. Each has own plugin/ copy.                               │
│         ↓ brand work                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ L3: Brand-specific improvements                                              │
│     Discovered while using brands.                                           │
│         ↓ bubble up                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ L1: hackaton_lookfor/plugin/                                                 │
│     Improvements consolidated here.                                          │
│         ↑ git push                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ L0: meta-agentic-loop (GitHub)                                               │
│     Loop complete. All instances get update.                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## COMMANDS

### Cortex (Cognitive Ontology)
```bash
./cortex                    # Command tree (L1-L6)
./cortex init <brand>       # Spawn new brand
./cortex status             # All brands status
./cortex loop               # Continue the loop
```

### Claude Code Skills
```
/loop                       # Loop state
/playground                 # Observability dashboard
/agents                     # Agent hierarchy
/orchestrate                # Orchestration cycle
```

### System Development
```bash
cat scrum/SYSTEM_TICKETS.md # View tickets
cd plugin && git status     # Check plugin state
./cortex health             # System health
```

---

## CRITICAL FILES

```yaml
factory:
  - cortex                       # Brand spawner
  - scrum/SYSTEM_TICKETS.md      # Plugin improvement queue

instance:
  - .claude/settings.json        # Hooks configured
  - .remembrance                 # Truth log
  - plugin/                      # THE working copy

spawned_brands:
  - demo-brand/                  # First brand
  - (more via ./cortex init)
```

---

## START

```bash
# Option 1: Work on system tickets (improve plugin)
cat scrum/SYSTEM_TICKETS.md
cd plugin
# ... address ticket ...

# Option 2: Spawn and work in a brand
./cortex init my-brand
cd my-brand && claude

# Option 3: Work in existing brand
cd demo-brand && claude
```

---

## SPAWNED BRANDS

| Brand | Status | Purpose |
|-------|--------|---------|
| demo-brand | Active | First test brand |

---

*Self-referential. Factory + Instance. System builds itself. 不进则退*
