# hackaton_lookfor — Meta-Automata Factory

> **逆水行舟，不进则退** — Like rowing upstream: no advance is to drop back
>
> This is the FACTORY level. It spawns demo-brand projects.
> Each brand uses the plugin. The plugin evolves through use.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         META-AUTOMATA HIERARCHY                               ║
║                                                                               ║
║   hackaton_lookfor/           ← YOU ARE HERE (Factory)                        ║
║   ├── cortex                  ← Factory CLI: ./cortex init <brand>            ║
║   ├── demo-brand/             ← First spawned brand                           ║
║   │   └── plugin/             ← meta-agentic-loop (writable)                  ║
║   ├── [brand-2]/              ← Future brands                                 ║
║   └── [brand-n]/              ← Each isolated, each using plugin              ║
║                                                                               ║
║   meta-agentic-loop evolves through ALL brand projects                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## AUTOMATA LEVELS

```
L0: meta-agentic-loop (GitHub)     ← The immortal pattern
    ↓ submodule
L1: hackaton_lookfor (THIS)        ← Factory that spawns brands
    ↓ ./cortex init
L2: demo-brand, brand-2, ...       ← Individual brand projects
    ↓ plugin/
L3: plugin/ in each brand          ← Writable instance of L0
    ↓ git push
L0: meta-agentic-loop              ← Improvements flow back
```

**The loop is complete.** L3 feeds back to L0.

---

## COMMANDS

### Factory Commands (this level)
```bash
./cortex                    # Show command ontology
./cortex init <brand>       # Spawn new brand project
./cortex status             # Status of all brands
```

### Enter a Brand
```bash
cd demo-brand               # Enter first brand
./cortex                    # Brand-level commands
claude                      # Start Claude Code session
```

### Cross-Brand Plugin Development
```bash
# Make change in any brand's plugin/
cd demo-brand/plugin
# ... make improvements ...
git add . && git commit -m "Improve X"
git push origin main

# Other brands get update:
cd ../brand-2/plugin
git pull origin main
```

---

## SPAWNED BRANDS

| Brand | Status | Plugin Version |
|-------|--------|----------------|
| demo-brand | Active | Latest |
| (spawn more with `./cortex init <name>`) | | |

---

## PHILOSOPHY

### Self-Referential Automata
- The factory uses the pattern it distributes
- Each brand instance can improve the pattern
- Improvements propagate to all instances
- The system evolves through use

### Cortical Hierarchy (L1-L6)
```
L1 Context    → What brand? What domain?
L2/3 Associate → How do brands relate?
L4 Observe    → What is each brand's state?
L5 Act        → Spawn brands, develop plugin
L6 Learn      → Accumulate cross-brand truths
```

---

## START

```bash
# See what's here
ls -la

# Show command tree
./cortex

# Enter first brand and start working
cd demo-brand
claude
```

---

*Factory level. Type `./cortex init <name>` to spawn brands. 不进则退*
