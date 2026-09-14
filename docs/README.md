# Grimoire documentation

Index of every document in this repository: who each one is for, what it covers,
and which file to update when the app changes.

---

## Where to start

| If you want to… | Read |
| --- | --- |
| Install and run the app | [README.md](../README.md) |
| Know what a feature does, in full | [features.md](features.md) |
| Contribute a change | [CONTRIBUTING.md](../CONTRIBUTING.md), then [development.md](development.md) |
| Understand the code before changing it | [architecture.md](architecture.md) and [data-model.md](data-model.md) |
| Work on the GM Screen | [gm-screen.md](gm-screen.md) |

---

## User guides

| Document | Contents |
| --- | --- |
| [features.md](features.md) | The complete behaviour reference: character sheets, live play, dice, statuses, customization, settings, import/export, and every option, default and limitation |
| [custom-css-guide.md](custom-css-guide.md) | A player's guide to the sheet's Custom CSS box — the variable and class reference, written for people with no CSS background |
| [custom-css-recipes.md](custom-css-recipes.md) | Paste-ready themed looks and one-thing tweaks for the Custom CSS box |

---

## Contributor and agent reference

| Document | Contents |
| --- | --- |
| [development.md](development.md) | Environment and setup, every script, an annotated project tree, the unit and end-to-end test suites, building, the GitHub Pages deployment, the contribution workflow, and local-only files |
| [architecture.md](architecture.md) | Tech stack, the Zustand stores, persistence and the IndexedDB invariants, theming, and drag and drop |
| [data-model.md](data-model.md) | The domain types (`Character`, `AbilityBlock`, custom sections, GM screens, statuses), the derived-stat formulas, slot logic, view modes, and dice notation |
| [gm-screen.md](gm-screen.md) | The GM Screen subsystem: panel kinds, the expanded panel body, turns and Recharge, damage, Mortal Wounds, statuses, its data model, and the `gmScreenStore` API |

---

## Which document to update

| When you change… | Update |
| --- | --- |
| A user-visible feature, option or limit | [features.md](features.md) — and [../README.md](../README.md) if the summary or setup changes |
| GM Screen behaviour, panel state, or `gmScreenStore` | [gm-screen.md](gm-screen.md) |
| A domain type, field, formula, or dice rule | [data-model.md](data-model.md) |
| A store, persistence/IndexedDB behaviour, theming, or drag and drop | [architecture.md](architecture.md) |
| A script, tool, test setup, or deployment step | [development.md](development.md) |
| The Custom CSS box or its recipes | [custom-css-guide.md](custom-css-guide.md) / [custom-css-recipes.md](custom-css-recipes.md) |
| Anything notable at all | [../CHANGELOG.md](../CHANGELOG.md), under `## Unreleased` |

---

## Documentation style

- One `#` title per file, sentence-case headings, and a `---` rule between
  top-level sections.
- Hard-wrap prose at ~100 columns (tables are exempt). Long lines are unreadable
  in an editor and are truncated by file-reading tooling.
- Prefer bullets and tables over long paragraphs: a reference page should be
  scannable, and one fact should be stated once.
- Link between pages with relative links, and fix the links when a file is
  renamed.
- These pages serve contributors and agents as much as readers: when you move a
  rule here, keep the *reason* behind it — the "deliberately" and "never" rules
  are what stop a fixed bug from coming back.
