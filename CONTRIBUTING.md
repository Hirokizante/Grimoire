# Contributing to Grimoire

Thanks for your interest in improving Grimoire. This page is the short version
of how to get a change merged; the technical detail lives in
[docs/development.md](docs/development.md).

---

## Getting set up

```bash
git clone https://github.com/Hirokizante/Grimoire.git
cd Grimoire
pnpm install
pnpm run dev
```

Node.js ≥ 18 and pnpm are the only requirements — no database, no backend, no
service. See [Prerequisites](docs/development.md#prerequisites) for versions and
[Project structure](docs/development.md#project-structure) for where things live.

---

## Ways to contribute

- **Bug reports** — include what you did, what happened, what you expected, and
  your browser and OS. Grimoire is in alpha and stores data in the browser, so
  mention whether a reload or a re-import changed anything.
- **Feature requests** — describe the tabletop situation you are trying to
  solve, not only the UI you have in mind. Divergence is a DIY system, so
  flexibility is usually worth more than a preset.
- **Code** — bug fixes, features, tests, and refactors that remove duplication.
- **Custom CSS recipes** — paste-ready looks for
  [docs/custom-css-recipes.md](docs/custom-css-recipes.md).

---

## Before you open a pull request

- [ ] The change does one thing, and matches the structure and naming around it.
- [ ] `pnpm run lint`, `pnpm run typecheck` and `pnpm run test` all pass.
- [ ] New behaviour has a test, and a bug fix has a test that fails without it.
  Unit tests go next to the code; add an e2e spec for anything visual,
  geometric, or spanning a reload (jsdom has no layout).
- [ ] `pnpm run build` passes for larger changes, and `pnpm run test:e2e` when
  behaviour or layout changed (build first — the e2e suite runs against `dist/`).
- [ ] The docs your change affects are updated — the mapping is in
  [docs/README.md](docs/README.md#which-document-to-update).
- [ ] [CHANGELOG.md](CHANGELOG.md) has an entry under `## Unreleased`, grouped
  under a `###` heading, stating the problem, the fix, and the test that pins
  it.

---

## Commit messages

Use the format already in the history:

```
<type>(<scope>): <summary>
```

- **Types** — `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
- **Scopes** — the area of the app, for example `sheet`, `gmscreen`, `status`,
  `mortal-wounds`, `mobile`, `dice`.

Examples from the log: `feat(gmscreen): let NPC instances own their ability
uses`, `fix(mobile): keep the list menus on-screen`,
`chore: bump version to v0.9.0-alpha`.

---

## Ground rules

- **Never commit directly to `main`.** A push there deploys to GitHub Pages
  immediately; work on a branch and open a pull request.
- **Don't hand-edit generated files.** `src/constants/rpgAwesomeIcons.ts` comes
  from `pnpm run icons:rpg-awesome`.
- **Keep storage compatible.** The storage format is alpha and may change, but
  changes must go through the read-time normalizers rather than a bulk
  migration, and exports must keep importing — see
  [architecture.md](docs/architecture.md#persistence).
- **Extend shared code instead of forking it.** One ability card, one wound
  track, one damage dialog and one activation planner serve every surface;
  a second implementation is how two surfaces drift apart.
- **Be respectful** in issues, reviews, and discussions, and assume good faith.

---

## License

Grimoire is MIT-licensed (see [LICENSE](LICENSE)). By contributing, you agree
that your contributions are licensed under the same terms.
