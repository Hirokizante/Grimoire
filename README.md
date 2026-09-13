# Grimoire

A character sheet creation and management app for the homebrew TTRPG **Divergence**. Built with React, TypeScript, and Vite — runs entirely in the browser, offline-first.

> Still in alpha. Storage format may change between pre-1.0 releases — export your characters regularly.

---

## Table of Contents

- [About Divergence](#about-divergence)
- [Features](#features)
- [GM Screen](#gm-screen)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Building for Production](#building-for-production)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Data Model Overview](#data-model-overview)
- [Key Concepts](#key-concepts)
- [Architecture](#architecture)
- [Testing](#testing)
- [Storage & Privacy](#storage--privacy)
- [License](#license)

---

## About Divergence

Divergence is a DIY tabletop RPG system — there is no compendium of spells or items. Players build their characters' abilities and equipment from scratch, using the system as a creative framework. Grimoire is built to support that freedom: structured text fields for abilities, full creative control over look and feel, and live-play tools for tracking resources and rolling dice.

---

## Features

### Character Creation & Editing
- **Guided character creation** — start with a named sheet and begin filling in attributes, skills, and abilities immediately.
- **Labels** — tag any character or NPC sheet with custom labels (each with an optional value) from the sheet page; labels also appear on the list pages for at-a-glance organization. Labels are local-only metadata — they are never included in exports. (Sheet filtering by label is coming soon.)
- **Five Attributes** (MAR, POW, AGI, VIT, GRT) allocated from the standard array (3, 2, 1, 0, -1), each with click-to-roll support.
- **Fifteen Skills** with selectable proficiencies and click-to-roll support.
- **Core Ability** — Innate narrative, Innate Abilities, Basic Attack, and Fatebreaker ultimate.
- **Slotted Abilities** — equip abilities for an encounter; drag-and-drop to reorder or move to/from the pool.
- **Ability Pool** — unlimited inactive abilities available to swap in before an encounter. Nothing in the pool activates: pooled cards carry no Activate button, and neither do the sub-abilities nested under them (a sub-ability is bound to its parent and cannot be slotted on its own). Only the use steppers stay — a counter is not an activation.
- **Minor Abilities** — flagged abilities that occupy half a slot instead of a full one.
- **Ability Block editor** — structured fields for name, traits, cost (AP/END/FP), damage, description, overcharge, and flavor text. Supports Markdown in description and overcharge.
- **Custom ability costs** — abilities can also spend any custom resource bar: "+ Add Cost" in the Ability Block editor picks a bar, and the cost renders as a color-matched badge next to AP/END/FP and auto-deducts on Activate (sub-abilities included).
- **Ability stat & attribute modifiers** — an ability can modify the sheet's Attributes (MAR, POW, AGI, VIT, GRT) and combat stats (Evasion, Armor, Movement, Save DC, Max HP, END Recovery). Ticking "Modifies combat stats / attributes" in the Ability Block editor reveals one row per modifier, where you pick the target, choose **+** (add) or **−** (subtract), and enter the amount. Switching the card's modifier toggle on in view mode applies every modifier; switching it off removes them. Every switched-on ability counts, wherever it sits (core, slotted, pool, or a custom tab) — the switch, not the slot, is what applies a modifier. Modifiers are never baked into the stored sheet — attributes, derived stats, dice rolls, and live-play maths all read the *effective* values, and modified values are flagged with a small delta chip. NPC abilities support the same feature (minus END Recovery, which NPCs don't have). On an **NPC base sheet** the switch is visible but inert — a base record is the static reference the GM Screen spawns instances from, so its flags are template data — while each **GM Screen instance** owns its switches, and its choice moves its own Evasion/Armor/Movement/Save DC/Max HP and Attributes (plus the damage it takes) without touching the base or its siblings.
- **Limited-use abilities** — tick "Limited uses" in the Ability Block editor to cap how many times an ability may be used. Set the maximum (1–99, which also refills the budget: the authored number is the whole limit) and choose whether clicking Activate spends one of those uses (on by default; untick it to track a budget that something else consumes). The remaining count renders on the ability card: **one circle per use for 5 or fewer** (filled = available, hollow = spent), and a plain `current / max` number above that. Every limited ability (and limited sub-ability) is flanked by compact **− / + steppers** so you can spend or hand back a use by hand (a reaction spent out of turn, a GM-granted refill, undoing a mis-click) — the plus stops at the ability's maximum, the minus at zero, and stepping never costs resources or triggers the Activate logic. The steppers show on every limited ability wherever it lives on a **player sheet** (core, slotted, pool, custom tabs, sub-abilities) and in both sheet modes, whether or not the ability has an Activate button — and on every limited ability of a **GM Screen NPC instance**, where they move that panel's own count. An NPC base sheet is the one place they do not appear: a base record is the static reference the GM Screen spawns instances from, so its ability budgets are template data — they read on the card, and the instances that copy them each track their own uses (see [GM Screen](#gm-screen)). A limited ability with no uses left cannot be activated — its button is disabled with an explanatory tooltip. Uses are per-ability live-play state on a player sheet: they follow the ability wherever it sits on the sheet (core, slotted, pool, custom tabs, and sub-abilities), are saved with the sheet (so they survive a reload), and are **always refilled to their maximum on a rest / full restore**.
- **Ability templates** — pre-filled starting points for common ability types (melee, ranged, buff, debuff) that remain fully editable.
- **Custom tabs & sections** — create up to 6 custom tabs, each with named sections, for organizing homebrew content. When adding a section, choose between an **Ability Block** group, an **NPC Sheet** (a blank, editable NPC bundled directly into the tab), or a **Text** section (a free-form Markdown body for unique mechanics, flavor text, or lore).
- **NPC sections** — attach a full NPC to a custom tab. NPC sheets show portrait, combat stats, attributes, skills, abilities, and description in a compact inline layout, and are editable in place within the tab; NPC attributes and skills are click-to-roll, matching the main sheet. The abilities block **is** the NPC sheet's own Abilities section — same heading row with the grid/list toggle, same "+ Add Ability" button, same card grid, and the same drag-to-reorder grips in edit mode (only the section shell and the `h3` heading give way to the bundled NPC's `h5` block label). A drag reorders the attached NPC's own record, so the order matches the NPC's sheet page. Attached NPCs are exported and re-imported alongside their parent character, and removing an NPC section only detaches the reference — the NPC record stays in the NPC list.
- **Custom resource bars** — define named point pools (current/max) rendered below Endurance, with optional refill on Recover.
- **Portrait upload** — square-crop your portrait first (rule-of-thirds grid overlay with a zoom slider), then it is compressed and stored as a base64 dataURL (max 512px, JPEG 0.85 quality); "Use Original" skips the crop.
- **Physical description & backstory** — Markdown-supported bio fields.

### Live Play (View Mode)
- **Edit / View mode toggle** — Edit mode for building the sheet; View mode locks fields and enables live-play interactions.
- **Automatic HP tracking** — input damage and the system applies Armor reduction (1d6 per point), Resistance (halve), and Temp HP absorption, then handles Mortal Wound overflow and knock-out.
- **Temporary HP** — tracked separately; reduced before regular HP; highest value takes precedence.
- **Resource tracking** — FP, AP, and END bars with inline +/− controls; costs auto-deducted when abilities are activated.
- **Recover action** — spend 3 AP to regain all END.
- **End Turn** — converts unspent AP to END (1:1) and applies END Recovery.
- **Mortal Wound rolling** — D20 roll on the 20-entry Mortal Wounds table when HP reaches 0; up to 2 wounds tracked. A wound that is *named* rather than rolled (an ability in play, an NPC's authored effect, a GM ruling) can also be **recorded by hand**: **Add Mortal Wound…** opens the same table as a searchable picker and applies the chosen entry with its own D20 — on the sheet and from either panel's ⋯ menu (see [GM Screen](#gm-screen)). The sheet's block reads top to bottom: a `[skull] Mortal Wounds n / max` header (no empty slot boxes), one card per wound with its D20, name and rules text, a warning once the track is full, and **one row** carrying every action the track has — *Roll Mortal Wound (d20)*, *Add Mortal Wound…* and *Rest (Full Restore)*, each a peer-sized button with an icon. Edit mode renders the same block read-only.
- **Death Save tracking** — success/failure pips, auto-roll with nat 20/nat 1 doubling, revive at 3 successes or die at 3 failures. Its **Roll Death Save (d20)** button is the sheet's shared compact action button, the same one the wound block's roll uses. A character is **Knocked Out** on the rules' own terms — 0 HP with no Mortal Wound left to take — never merely because the track is full: filling it raises the *Critical Condition* warning instead, and the sheet announces each at the moment it actually happens (`isKnockedOut`, `lib/mortalWounds.ts`).
- **Exhaustion support** — the Exhaustion mortal wound adds +1 to all END costs automatically.
- **Ability modifier switches** — each ability that declares modifiers (see above) carries an on/off switch on its card. Switching it on instantly applies the ability's stat/attribute changes to the sheet; switching it off removes them. It is independent from the Activate button, costs no resources, and does not require the ability to be activated — so passive stances, forms, and auras work without spending AP. A GM Screen NPC instance has these switches per instance (see [GM Screen](#gm-screen)); an NPC base sheet shows them read-only.
- **Limited-use tracking** — an ability flagged as limited (see above) shows its remaining uses on its card and spends one per Activate when configured to. At zero uses the Activate button is disabled until a rest refills the budget, and unlimited abilities are completely unaffected. NPC base sheets show the budget read-only; a GM Screen instance owns and spends its own.
- **GM Screen** — run several sheets at once on one surface, including each NPC instance's **own turn**: 3 AP, working Activate buttons, its own limited-ability uses (spent on Activate and steppable by hand), its own stat/attribute modifier switches, and Recharge cooldowns resolved by a Recharge Die roll. See [GM Screen](#gm-screen).
- **Mortal Wounds on the GM Screen** — **both** panel kinds carry the same wound track under the HP bar, and both resolve the D20 for the GM: an NPC instance uses the base's own **Mortal Wounds** stat as its allowance, and a player character's two slots are rolled as the panel deals the damage instead of being left on "Pending Roll". A base with `Mortal Wounds: 0` is untouched and still just goes Downed at 0 HP. Either panel's ⋯ menu can also **Add mortal wound…** — pick a specific table entry and it lands with no D20 (see [GM Screen](#gm-screen)).

### Dice Roller
- **Inline dice notation** — `d20`, `2d6+4`, `1d6+POW`, `2d6+POW/MAR` are auto-detected in any text field and become clickable in view mode.
- **Variable substitution** — attribute abbreviations (MAR, POW, AGI, VIT, GRT) and skill names resolve to the character's actual values.
- **Roll breakdown** — full per-term breakdown showing each die, each substituted variable, and the total (e.g. `2d6+POW → 4 + 3 + 4 = 11`).
- **Critical / fumble detection** — nat 20 and nat 1 badges on d20 rolls.
- **Roll log** — persistent, per-character roll history in a slide-out drawer; entries are saved to IndexedDB and survive reloads.

### Status Compendium
- **Status conditions** — reference records for game effects like "Poisoned" or "Hidden", each with an icon, rules text, and categorization tags. The compendium ships seeded with the built-in Divergence conditions and supports player-created custom ones.
- **Inline references** — write `[StatusName]` in any sheet markdown (ability descriptions, overcharge, flavor text, innate description, custom text sections); it renders as a highlighted, clickable reference with a tooltip showing the condition's details. Matching is case-insensitive.
- **Compendium page** — browse, sort, create, edit, and delete conditions; pick an icon from emoji, the bundled icon pack, or an uploaded image.
- **Searchable icon picker** — all three icon sources are searched, not scrolled: any of the 1,900+ Unicode emoji by name (with a quick-pick row, and tabletop aliases so "poisoned" reaches ☠️ and "grappled" reaches ⛓️), any of RPG-Awesome's 496 fantasy icons, or an uploaded SVG/PNG. Pasting an emoji into the search box still works, and statuses saved with the older Lucide pack keep rendering their icon.
- **Referencing sheets** — the compendium shows which characters reference each condition, and character exports bundle every status the sheet references.
- **GM Screen tracking** — the same records back the GM Screen's per-panel status pills (see [GM Screen](#gm-screen)); that tracking state lives on the panel, not on any character sheet.

### Customization
- **Full color palette** — every sheet element (surfaces, text, borders, accents, resource bars, stat tokens, etc.) exposed as color swatches — no custom CSS required.
- **Theme presets** — one-click themes that replace the palette in a single click, including presets that match each app theme (Parchment, Mikami, Pitch Black) for a cohesive app + sheet look. Full list: Default, Midnight, Parchment, Mikami, Pitch Black, Solar, Ocean, Sakura, Dracula, Nord, Gruvbox, Solarized Dark, Tokyo Night, Catppuccin.
- **Per-element font selection** — independent font families for headings, labels, body text, and helper text.
- **Google Fonts import** — type any Google Fonts family name to add it to the font pickers.
- **Background image** — upload an image, with darken and blur overlays.
- **Custom CSS** — advanced users can append raw CSS that overrides the sheet.
- **Section background toggle** — hide section backgrounds for a flatter layout.
- **View modes per section** — grid or list layout for Slotted Abilities, Ability Pool, each custom section, and an NPC's Abilities (on the NPC's own sheet page *and* in every bundled-NPC section of a character sheet, which keeps the parent tab's choice), persisted per sheet.

### App Settings
- **App themes** — switch the app's own color scheme (header, list pages, modals, dice UI — everything *around* the sheets) in Settings. Ships with **Midnight** (the default violet-dark palette), **Parchment** (warm charcoal `#262626` with parchment `#c5b8a0` highlights, plus a matching alternate title-bar glyph), **Mikami** (Nord on near-black, from Ghostty), and **Pitch Black** (pure black with cream, gold, and muted teal, from Ghostty). The choice persists in `localStorage` and applies before first paint. Sheet color themes are unaffected — those stay per-character in the Customization panel.
- **Home page animation** — pick the ambient effect behind the home page title in Settings: **Arcane Glow** (the default — a volumetric shaft of light falling through a dark room, air haze where it lands, and a slow field of out-of-focus dust motes at three depths, the ones caught in the beam glowing warm) or **Terminal Boot** (a startup log that types itself out, as if Grimoire were launched from a shell, then settles to a dim static trace). Animations can also be switched off entirely for a plain, motion-free home page. The choice persists in `localStorage`.
- **GM panel sheets can match the app theme** — Settings → GM Screen → **Match app theme** makes a player panel's expanded sheet body drop its custom colors, card background, and fonts and use the app theme instead, exactly as an NPC panel always renders. Off by default, so each panel keeps the character's own customization unless the GM asks otherwise. Display only: the character's own sheet page, its Customization panel, and its exports are never changed.
- **One Combat Stats palette for every sheet** — `STAT_TOKEN_COLORS` in `themeUtils.ts` gives each app theme a tuned accent per stat, covering both rows a sheet can show: a player's (Milestones, Evasion, Armor, Movement, Save DC, END Recovery) and an NPC's (Evasion, Armor, Movement, Save DC, HP, Mortal Wounds). The four stats the two rows share hold the **same** hue in both, so a stat is never two colors. Every stripe stays clearly distinct from its row-mates and from the card behind it in every theme (a unit test enforces a floor of ΔE(CIE76) ≥ 16 within a row and ≥ 3.5:1 contrast; the shipped palettes sit at ≥ 18 and ≥ 3.7:1). A standalone NPC sheet reads this palette because it has no customization of its own; a player's own sheet page uses the character's per-sheet token colors from the Customization panel, while a **GM panel's Combat Stats row — either kind — always reads this palette** (see [GM Screen](#gm-screen)). NPC sections embedded in a player character sheet never apply colors of their own, so the player sheet's theme takes precedence there.

### Import / Export
- **Export as JSON** — downloads a versioned file (`Character Name v1.2.3.json`).
- **Automatic versioning** — each export bumps the patch version (or a manual override).
- **Version history** — every export creates a snapshot stored in IndexedDB; browse, re-download, restore, or delete past versions.
- **Import from JSON** — load a previously exported sheet back in.
- **Update existing** — importing a sheet whose name matches an existing character offers to update in place (preserving live-play state: HP, END, AP, FP, mortal wounds, death saves) or import as a new copy.
- **Version resolution** — when updating, the imported version is used if strictly newer; otherwise the existing version is bumped forward.
- **Attached NPCs** — when a character has NPC sections, the export includes those NPCs as a bundle (`attachedNpcs`). On import, each NPC is persisted as its own record and the parent's section references are rewritten to the fresh IDs, so the parent↔NPC link round-trips intact.
- **Full backup & restore** — Settings → Backup & Restore downloads *everything* (all characters and NPCs, the status compendium, GM screens, version history, and the roll log) as a single JSON file (`Grimoire Backup YYYY-MM-DD.json`). Restoring from a backup **replaces** all current data in one atomic IndexedDB transaction, after an explicit confirmation. Backups carry a `backupVersion` (currently **2**); newer-version backups are refused with a clear message, and **v1 backups still restore** — they simply carry no screens. Single-character exports are *not* backups — restore points you at the Characters page import instead.
- **Attached statuses** — statuses referenced by a sheet are bundled into the export (`attachedStatuses`). On import they are restored by id and name conflicts are resolved — references match by name, so they keep working even after a condition is renamed.

---

## GM Screen

The GM Screen is a saved, named surface that holds **panels** — one per sheet you want to run. It lives behind the **GM Screen** entry in the title bar (and on the home page) and is deliberately app chrome: it uses the active app theme, while each panel's sheet content keeps its own customization (optionally switched off — see below).

That split is deliberate and precise. The **panel chrome** — header, name, HP bar, the tracked status pills, the AP/END/FP and Evasion/Armor stat tokens, HP steppers — always follows the **app theme**, never the sheet's palette. A screen shows several sheets side by side, so per-sheet token colors would make every panel read differently and destroy the at-a-glance consistency that is the whole point of the GM Screen; a player panel and an NPC panel therefore color their shared stats identically. The sheet's own palette is injected only inside the **expanded panel's sheet content**, where a player's customization belongs.

**Settings → GM Screen → *Match app theme*** turns even that off. With it on, a player panel's body is rendered through the same helper an NPC panel uses (`gmPanelSheetPresentation` in `themeUtils.ts`), so it carries the app theme's palette and no per-sheet background, fonts, or flat-section override — every panel on the screen, player or NPC, reads in one voice. It is off by default, and it is **purely cosmetic**: the panel reads the character's config and never writes it, so the character's own sheet page, its Customization panel, its exported theme, and its version history are unaffected.

The **Combat Stats row** is app chrome in its own right, whichever way that switch is set: both panel kinds color it from the app theme's shared stat palette (`STAT_TOKEN_COLORS`), so Evasion is one color on a player panel, on an NPC panel beside it, and in the chrome above them. A character's per-sheet token colors apply to their own sheet page, not to a panel — that is what stops two panels from disagreeing about what a stat looks like.

An expanded panel also **prints those stats in shorthand** — `Miles / Eva / Arm / Move / Save / END Rec`, and `Wounds` on an NPC — because a panel's token column is ~7.5rem wide and the full names ellipsised there ("MILEST…", "SAVE …", "END RE…"), which tells a GM nothing mid-turn. The shorthand is one shared vocabulary (`SHORT_STAT_LABELS` in `statTokenLabels.ts`) that the panel chrome's own Eva/Arm/Move/DC tokens use too, and every token keeps its full stat name as a tooltip. A sheet page has the width, so it keeps the full names. Every stat token is **one line and one height**, on every sheet: the icon and value on the left, the label (plus a stat's own bonus number, if it has one) on the right. The Milestones bonus is printed inline — `Miles +2`, `Milestones +2` on a sheet page — rather than as a second line under the label, which is what keeps a token to a single line and its grid row free of reserved slack: nothing has to be paid for up front, so a player panel's tokens are exactly the size of an NPC panel's beside it, and the content is centred in the token. The bonus is its own element, so the label's ellipsis can never eat the number, and it is omitted entirely when a character's bonus is 0.

### Two kinds of panel

| Panel | What it is |
| --- | --- |
| **Character panel** | A live **reference** to a player `Character`. HP/AP/END/FP changed from the panel is the same state the player sees on their own sheet, and vice versa — one source of truth, no copies. |
| **NPC instance** | A spawned instance of an NPC sheet used as a **template**. |

NPC instances follow one rule: **instances are deltas, not clones.** Spawning "Bandit" three times creates three panels with independent HP, temp HP, condition, **Mortal Wounds, Action Points, Recharge cooldowns, limited-ability uses, and modifier switches**, while stats, abilities, portrait, and description are all read from the base record at render time. Editing the base updates every instance of it, and the NPC list keeps showing only bases — there is never a "which Bandit is the real one?" question.

### Using it

- **Screens** — create as many as you like ("Session 4", "Dungeon Run"), switch between them with the pill row, rename inline, and delete with a confirmation. Screens persist in IndexedDB and survive reloads; the screen you had open reopens automatically.
- **Add Character** — searchable picker over your player sheets. A character can only appear once per screen (the row is disabled with "Already on this screen"); use NPC instances when you need multiples of one statblock.
- **Add NPC** — pick an NPC base to spawn an instance, with each row showing how many instances are already on the screen. **New NPC…** creates a base record *and* spawns an instance in one step, without navigating away.
- **Compact / expanded** — compact is a glance-height card (portrait, name, HP bar, the **Action Point meter**, key stat tokens, condition badge); expanded renders the sheet content inline.
  - Expanded player and NPC panels use the **same condensed body** (`PanelSheet`), so a panel reads identically whichever kind of sheet it holds: Combat Stats → Attributes → (Core Ability) → Abilities → Skills. It is deliberately *not* the full `CharacterSheet`/`NPCSheet`, which are page-scale views far too tall for a panel sharing its row with another.
  - Deliberately omitted from the body, because the panel chrome already shows them: the **player HP bar**, the **Action Points bar**, and the **Mortal Wounds track** (all live under the panel header, with their own steppers, chips and Damage dialog — printing them again inside the body would double every number the GM is watching), the **NPC Core Ability** section (NPCs have no core abilities — those fields only ever hold the generated Basic Attack / Fatebreaker defaults), and **Description / Character Background** on both (reference material, not at-the-table information).
  - The `saving…` indicator reserves its width permanently and toggles only `visibility`, so it can never resize the header — saves fire on every panel action, and an in-flow badge made the screen name and pills jump sideways on each one.
  - Expanding a panel **animates** (~190ms, ease-out) rather than snapping. The body mounts and unmounts, so height cannot be transitioned directly; it transitions `grid-template-rows: 0fr → 1fr` instead, which needs no measurement, and the body stays mounted only for the duration of the collapse so a collapsed screen is not carrying every sheet's DOM. `prefers-reduced-motion` disables it.
  - Panel **stat tokens** are shaped like the sheet's cost badges (`.cost-badge` / `.dice-notation`): a 1px accent-tinted border on all four edges rather than a thick left stripe, keeping each token's own colour. **Every token leads with an icon** — Eva (wind), Arm (shield), Move (swords), DC (target) on an NPC panel, and Eva/Arm/END (heart)/FP (sparkles) on a player panel — because several pools share a hue (AP and END are both violet in the default theme), so the glyph is what separates them at a glance.
  - **Attributes** show the shorthand only (MAR/POW/…) in five strictly equal columns — the full names were what forced uneven column widths, since `repeat(5, 1fr)` is `minmax(auto, 1fr)` and that `auto` floor is the column's own content size. **Skills** render in even columns with uniform rows: the sheet's `nth-child(odd)` striping is neutralised inside panels, where a two-column grid would otherwise put every striped row in the left column and read as "the left column is highlighted".
  - The ability section is player *Slotted Abilities* (the Ability Pool is a build-time concept with no place on a live panel) or the NPC's *Abilities*, and is **always list view with no grid/list toggle** — a grid at panel width is unreadable, so grid is not offered at all.
  - Both render their ability cards against the panel's own entity, so dice notation like `1d6+MAR` resolves against *that* sheet's stats and Activate deducts from *that* record (previously the cards fell back to `currentCharacter`, which is null on the GM Screen).
- **Turns: Action Points & Recharge** — **every panel shows AP under its HP bar**, player and NPC alike, from one component (`PanelApBar`): the sheet's own segmented meter plus the panel's shared bar chrome, so HP and AP read as one control family — a label row (`HP 20/20`, `ACTION POINTS 3/3`) and a `[−] bar [+]` row with that row's action button (Damage… / Start new turn) at the end. Both bars render the same `PanelStepper` — lucide `−`/`+` glyphs in identical 1.75rem boxes — and disable each end exactly when its action would be a no-op (full HP, 0 AP), the rule the player sheet's bars use. An NPC instance is initialised with **3 AP per turn**; a player panel spends and restores the character's real AP, shared with their own sheet, and its AP token was dropped from the stat strip so the panel never prints the same number twice. Spending AP by hand is always available; activating an ability spends it automatically. **A panel whose entity is out of AP dims itself** — header, HP bar, tokens and the expanded sheet body — so a glance down the screen shows who has already acted. The AP block stays at full strength (it holds both ways back: the manual `+` and Start new turn), nothing is disabled or made un-clickable, and the panel returns to normal the instant AP does.
  - **Every NPC ability with a cost gets an Activate button** in a panel — the same button, plan, and cost deduction the player sheets use (`useAbilityActivation` with the panel's own resource adapter), not a second implementation. The ability's own *Show Activate* flag does not gate it: NPC abilities are authored in a mode that never offers the flag, and the panel's rule is "a cost means a button". Ability cards with no cost stay static reference cards; a cost-free ability that carries **Recharge** still gets one, because the cooldown is the thing being tracked.
  - **Limited uses are the instance's own.** An ability flagged as limited shows its remaining uses on the panel and spends one per Activate when the ability is set to (an instance never spends a use for an ability whose *Expend on activate* is off, and a limited ability at 0 uses has its button disabled with the usual "No uses" tooltip). The **− / + steppers** work here too — they move *that panel's* count without touching AP, resources, or the base record. Three spawned Bandits therefore each begin at the ability's authored maximum and drain their own budget; the base sheet's own count is template data no instance reads, which is also why the base sheet's meter renders without steppers. Each instance's counts are saved with the screen and survive a reload.
  - **Stat/attribute modifier switches are per instance.** An ability that declares modifiers carries its usual on/off switch on the panel, and flipping it applies the modifiers to *that instance*: its Evasion / Armor / Movement / Save DC / Max HP tokens, the expanded body's Combat Stats and Attributes rows, the dice that resolve against them, and the damage pipeline (an active Armor modifier really does reduce the next hit, a Max HP one really does move the HP bar's cap and clamp current HP when switched off). Three spawned Bandits can therefore rage independently — the switch never reaches the base record, and the base sheet renders the same control disabled with a tooltip saying where it can be flipped.
  - **Recharge** is fully implemented for NPC abilities on the GM Screen. Using an ability with the `Recharge (X)` trait marks it **on cooldown** and disables its button (tooltip: "On cooldown — Recharge X"). The trait chip under the ability name *is* the live read-out: it renders `⧗ Recharge X` in place of the authored `Recharge (X)` text and switches to `⧗ On cooldown — Recharge X` with a tinted chip while cooling, so the state is never printed twice. A collapsed panel shows a `2 on cooldown` count next to the AP meter so the state is visible without expanding.
  - **Start new turn** appears as a button the moment AP hits **0** — on both panel kinds, and always available in the ⋯ panel menu for a turn that ends early. On an NPC instance it refills AP to 3 and rolls one **Recharge Die (1d6)**: every cooling ability whose Recharge value is **≤ the roll** comes back, everything above it stays cooling. The roll is announced in a toast ("Bandit's turn — Recharge Die: 5 · recharged: Fire Breath") and written to the roll log as a `1d6` entry tagged `Recharge Die: Bandit`, so a session's turns read back like a journal. On a player panel it runs the character sheet's own **End Turn** — unspent AP becomes END 1:1, END Recovery is applied, AP refills — and reports the gain the same way the sheet does ("Vex's turn — AP restored · +2 END").
  - Nothing about a turn reaches the base NPC record: the standalone NPC sheet has **no Activate button, no AP meter, no cooldowns, and no use steppers** — it stays the static reference it has always been, and the panel never spends another instance's uses. NPC abilities cost AP only (the NPC ability editor offers no END/FP costs), so the panel deducts AP and leaves untracked pools out of the tooltip rather than blocking on resources it cannot show.
  - Traits are parsed by one reusable helper, `lib/abilityTraits.ts`: it turns any `Name` / `Name (Value)` tag ("Recharge (4)", "Multi-Hit(2)", "Status (Quick)") into a structured trait with a name, text, and numeric value, matched case-insensitively by registry key or display name. Recharge's *rules* live in `lib/abilityRecharge.ts` (die size, cooldown resolution against the base's traits at roll time), so a future trait — Cooldown, Multi-Hit, Reliable — only needs a registry entry plus its own rules module, never a new regex.
- **Damage** — the same `DamageDialog` used on character sheets, targeting whichever panel opened it. Armor for an NPC instance comes from the base's `npcStats.armor` and max HP from `npcStats.hp`, temp HP is the instance's own; a player panel damages the character's real pool, through the same id-targeted action their sheet uses. Reaching 0 HP follows the Mortal Wound rule on both, and either panel resolves the D20 as it deals the damage (see below); healing a downed instance revives it, and the panel menu can flag it `dead` (which healing never clears).
- **Mortal Wounds** — the track is one component on **both** panel kinds (`PanelMortalWounds`), drawn in the panel chrome right under the HP bar: `[skull Wounds n/max | chips | ⚠ Next 0 HP: …]`. Each chip carries the **D20 result** and the wound's name, with the full rules text in its tooltip — the same table data the player sheet's wound cards show. Wounds persist until cleared (the chip's own ✕, or the panel menu's **Clear mortal wounds**) or a Rest; **healing never clears them**. Like the status strip it is one line that scrolls sideways instead of wrapping — with a trackpad swipe *or* a mouse wheel (`useHorizontalWheelScroll`) — so a wounded boss never makes its panel taller than the mook beside it.
  - **The roll is made for the GM on both kinds.** Damage that drives the target to 0 HP rolls the D20 in the store, refills HP to max with the spill-over, and records the wound. There is no "Pending Roll" step and no second card to click — a GM running four bandits (or watching a player drop) gets the wound result without leaving the damage dialog. The outcome announces itself in a toast ("Bandit takes a Mortal Wound: Fracture (d20 14) — HP reset to 15."), because an HP bar that refills to max would otherwise look like nothing happened; the panel's own `−` stepper runs the same pipeline and raises the same toast.
  - **A player character keeps their own sheet flow.** The panel writes to the character's real slots, but only *its* damage auto-rolls: a hit the player takes on their own sheet still parks the slot on "Pending Roll" for them to roll from the sheet's Mortal Wound card, which is the sheet's design. Such a slot shows up on the panel as a dashed `?` chip, and the ⋯ menu offers **Roll Mortal Wound (d20)** for it (the same wording as the sheet's own button), so the track is always resolvable from the screen; a panel-applied hit resolves the oldest pending slot, so it never adds one. The roll lives in the menu rather than in the row because the row is deliberately the same shape on both panel kinds — and the same one line at 360px. A full track (both slots) warns `⚠ Next 0 HP: Knocked Out` — the character's own word for it, and the next 0 HP really does start Death Saves.
  - **A wound can also be applied by hand, with no D20** — an ability in play, an NPC's authored effect, or a GM ruling can *name* the wound, and then rolling a die to discover it would be theatre. Either panel's ⋯ menu offers **Add mortal wound…**, which opens `MortalWoundPicker`: the same twenty entries as a searchable list (D20, name, rules text), applied by picking one. On a player panel it writes the character's real slots (`characterStore.addMortalWound`), exactly like the menu's roll — naming a slot the player left on "Pending Roll" resolves it. On an NPC instance it appends to the instance's own track through `gmScreenStore.addInstanceMortalWound`, storing the entry's D20 beside the name, so a hand-added chip reads exactly like an auto-rolled one ("Damaged Throat · 8"). The picker is one component shared with the player sheet's wound block, and it stays open across picks (an NPC whose base allows several wounds takes them in one visit) — re-reading the track as it writes, marking what is already on it, and locking itself with the reason once there is no slot left. Room is the same rule the roll uses: `MAX_MORTAL_WOUNDS` for a character, the base's allowance for an instance, so a `mortalWounds: 0` mook offers no add at all and a full track offers nothing to click. The entry point lives in the ⋯ menu, never in the wound row, for the reason the roll does — the row must stay one line at 360px on both panel kinds.
  - **An NPC instance's allowance is the base's `npcStats.mortalWounds`** — the editable stat on the NPC sheet (evasion/armor/movement/save DC/HP/Mortal Wounds), read at damage time like every other base stat, so editing the base updates every instance of it. The stat's tooltip says so on the sheet. A player character simply always allows two, so a player panel shows its (possibly empty) track from the start, exactly as an NPC whose base allows wounds does.
  - `mortalWounds: 0` is the **mook case and changes nothing**: no roll, no row on the panel, and 0 HP simply sets the instance `downed` — exactly the behaviour panels had before. Once the allowance is used up (or the base allows none), reaching 0 HP also downs the instance instead of rolling, and the panel shows the ⚠ warning while the track is full.
  - One hit can burn through several wounds: damage past 0 refills HP to max each time and costs a wound per refill, so a huge hit on a three-wound boss that still ends below 0 downs it — and a hit that fills a character's last slot knocks them out, which the panel reports as such.
- **Statuses** — every panel (player *and* NPC instance) has an **Add Status** icon button at the end of its HP row that opens the compendium picker: search it, then pick one of the five SRD durations (Quick, Persistent, Countdown, Permanent, Conditional). Tracked statuses render as two-segment pills **inline with the HP number** — the **filled left segment** carries the status's icon and its full name, the quiet right segment the duration and the stack stepper — in a single line that scrolls sideways rather than wrapping (with a trackpad swipe or a mouse wheel; the wheel moves on to the page once the strip ends), so a panel never grows taller because the GM stacked conditions on it. That filled segment is also the condition's **reference**, behaving exactly like a `[StatusName]` reference on a sheet: **clicking it opens the status's description** in the global status modal, and **hovering (or focusing) it shows the shared icon/name/description card**.
  - The duration is shown as an **icon only** (label and rules reminder in its tooltip), which is what buys the room for the rest of the pill. It is a **label, not a timer**: nothing expires on its own, and a Countdown is ticked down by hand with the stepper.
  - Status names are **never truncated** — a pill keeps its natural width and the strip scrolls instead, so "Regeneration" always reads in full.
  - The hover card is **portalled to `document.body`** (`StatusTooltip`) rather than positioned inside the pill: a pill clips its own contents (that is what keeps its filled cap inside the rounded border) and the strip scrolls sideways, so an in-place card would be a sliced-off sliver. It is anchored to the pill's measured rect, flips below the pill when there is no room above, follows page/strip scrolling, and never changes the pill's or the row's geometry.
  - The picker itself is a **viewport-level dialog**, portalled to `document.body` for the same reason (`AddStatusModal`): the panel it is opened from can be dimmed — a **dead** instance sits at `opacity: 0.75` — and an `opacity` ancestor both fades every descendant and becomes the containing block for `position: fixed`, which painted the picker translucent inside the panel's own box instead of centring it over a full-viewport backdrop. Portalled, no panel state can reach it, and it stays on the documented modal layer (below the title bar, above every sheet surface) — while the title bar recedes behind it exactly as it does behind every other modal (the chrome-recede rules are scoped to `body:has(.modal-overlay)`, so they see an overlay wherever it is mounted).
  - Each pill's `−`/`+` adjusts stacks; at one stack the `−` becomes an explicit `✕` remove, so a status can never vanish from a mis-click on a decrement. Stacks are clamped to `[1, 99]`.
  - Picking a duration chip on a status already on the panel **changes its duration in place** (the chips double as the duration editor and the applied one is filled in), and the modal stays open so several conditions can be applied in one pass.
  - Statuses are **GM Screen state only** — they live on the `ScreenPanel`, never on the character or NPC record, so nothing about them reaches a player's own sheet. They reference the compendium record by id (name/icon are read at render time), so a rename propagates and a deleted status leaves a clearly-marked "Missing status" pill that is still removable — and, having no description left to open, it stays a plain label instead of a clickable reference.
  - Each duration carries its own accent per app theme (`STATUS_DURATION_COLORS`), like the panel stat tokens: those tones sit shoulder to shoulder in one hairline pill (and as the picker's chips), so `themeUtils.test.ts` enforces ΔE ≥ 16 between every pair and ≥ 4.5:1 contrast on every theme's surface.
- **Rolls** — attribute, skill, and ability rolls from a panel resolve against that panel's entity and land in the roll log. Rolls from an instance are noted with the instance label ("Bandit 2"), so they stay distinguishable. The roll-log drawer is available on the screen in "all characters" mode.
- **Reordering** — drag a panel by its grip handle (a 6px activation distance keeps it from fighting page scrolling) to reorder it; panels flow in array order down each column.
- **Layout** — 2 columns above 700px, 1 column at ≤700px. Two wide columns beat three narrow ones: at three, panels were ~320px and every sheet name truncated. On phones the Add buttons collapse into a sticky bottom-right group, and panels never overflow horizontally.
- **Placeholders** — deleting an NPC base or a character that a screen references is still allowed; the delete confirmation lists the affected screens ("Referenced on GM screen: Session 4"), and those panels become a **Missing NPC / Missing character** placeholder with a Remove button. Nothing cascades, and the placeholder state is derived at render time rather than stored.

### Data model

A `GMScreen` is `{ id, name, panels, createdAt, updatedAt }`, where `ScreenPanel` is a discriminated union:

| Variant | Shape |
| --- | --- |
| `kind: 'character'` | `{ id, characterId, density, statuses }` — a reference to a player `Character` |
| `kind: 'npc-instance'` | `{ id, baseNpcId, label, density, statuses, state }` where `state` is `{ currentHP, tempHP, condition, currentAP, cooldowns, mortalWounds, abilityUses }`, `condition` is `'active' \| 'downed' \| 'dead'`, `currentAP` is the instance's own turn budget (spawned at 3), `cooldowns` lists the ids of the base's abilities currently waiting on a Recharge Die, `mortalWounds` is the instance's own track of `{ roll, name }` wounds, `abilityUses` maps an ability id to the uses this instance has left of it, and `abilityModifiers` maps an ability id to whether this instance has its stat/attribute modifiers switched on |

`statuses` is the GM's own tracking list — `{ statusId, duration, stacks }[]`, where `duration` is `'quick' \| 'persistent' \| 'countdown' \| 'permanent' \| 'conditional'` and `statusId` references a compendium `StatusCondition`. It never leaves the panel: the referenced character/NPC record is untouched, and duplicating an NPC instance deliberately spawns a *fresh* instance with no inherited statuses.

`currentAP`, `cooldowns`, `abilityUses` and `abilityModifiers` are the same kind of state: **the instance's, never the base's.** Three Bandits each spend their own AP and cool their own abilities down, and nothing a GM does at the table reaches the standalone NPC sheet. `cooldowns` stores bare ability ids rather than Recharge values, so the value is always read from the base's traits at roll time — editing a trait, or deleting the ability, can never leave a cooldown pinned to a stale number (an id that no longer resolves to a Recharge ability is dropped on the next roll). See `lib/abilityRecharge.ts`.

`abilityUses` is deliberately **sparse**: it records only a budget the instance has actually spent into, and an absent key reads as the ability's authored `max`, so a fresh instance starts full, an ability added to the base later arrives full, and raising a base ability's maximum lifts every instance that had not spent into it. A write that lands back on the maximum removes the key again. The base record's own `uses.current` is never read — a base sheet is a static reference — and nothing here is ever written back to it. `lib/abilityUses.ts` owns the whole story (`withInstanceAbilityUses` projects the map onto the base at render time, `instanceAbilityUsesRemaining` reads one entry, `normalizeInstanceAbilityUses` repairs the map on load), and `gmScreenStore.spendInstanceAbilityUse` mirrors `characterStore.spendAbilityUse` for the Activate path.

`abilityModifiers` follows the identical shape for the modifier switches: an absent key means "untouched — still on the ability's own `modifiersActive` flag", so a fresh instance matches its base sheet (whose flags are template data) and records only the switches the GM flipped here. A flip back to the ability's own value removes the key. `lib/abilityModifiers.ts` owns the projection (`withInstanceAbilityModifiers`, `instanceAbilityModifiersActive`, `normalizeInstanceAbilityModifiers`), and `gmScreenStore.setInstanceAbilityModifiersActive` writes it — clamping current HP when a Max HP modifier goes off. `lib/gmScreenUtils.ts`'s `withInstanceState(base, state)` composes both projections, and is **the** definition of an instance's entity: the expanded panel renders it, the chrome's stat tokens and HP cap read it, and the damage pipeline takes its Armor and Max HP from it, so no two surfaces can disagree about what an instance's switches do.

`mortalWounds` is the instance's too, and it stores **the wounds themselves** (`{ roll, name }` — the D20 and the table entry) rather than a count, so the panel can print "Damaged Throat · d20 8" and the table's current rules text. A wound the GM **picked by hand** is stored in exactly that shape — the entry's own id is its `roll` — which is why a hand-added chip is indistinguishable from an auto-rolled one. The **allowance is deliberately not stored on the instance**: it is `base.npcStats.mortalWounds`, read at damage and render time like max HP, so raising a base's allowance applies to every instance already on the screen (and to the next hand-added wound: `addInstanceMortalWound` compares the track against it live). A **player panel stores nothing extra at all**: its track is the character's own `mortalWounds` slots (two names, one per slot, `'Pending Roll'` while one is unresolved), which is why clearing a chip on the panel is visible on the player's sheet and survives a reload. `lib/mortalWounds.ts` owns the table lookup, the D20 roll and the slot rules for every surface — the player's `MortalWoundRoller`, an NPC instance's automatic roll, a player panel's (`characterStore.takePanelDamage`), the manual add on all three, and the `characterMortalWounds` projection the panel chips and the picker both read — so a wound's name and description can never disagree.

Screens live in their own IndexedDB object store (`screens`, DB version 5) with no indexes — the panel lists are stored inline and the whole set is read at once. Like characters, screens are **normalized on read** (`normalizeScreen`), which backfills `panels: []`, guarantees every panel's `id`/`density`/`statuses`, completes instance state (including a full turn — `currentAP: 3` and no cooldowns — for screens written before AP tracking existed, and an empty Mortal Wound track for screens written before instance wounds existed), and stamps timestamps — so hand-edited or older records load cleanly with no bulk migration (unusable status entries are dropped, stacks are repaired into `[1, 99]`, cooldown ids are de-duplicated and filtered to non-empty strings, and a wound entry with no name is dropped).

Screens travel **only** in full backups; there is no per-screen JSON export (yet).

### Store API

`gmScreenStore` mirrors `characterStore` conventions, autosaving the affected screen with a 500ms debounce:

| Action | Notes |
| --- | --- |
| `loadScreens`, `createScreen`, `renameScreen`, `deleteScreen`, `selectScreen`, `saveScreen` | Screen CRUD; the open screen id is mirrored to `localStorage` |
| `addCharacterPanel` | Returns `false` (no state change) for a character already on the screen |
| `addNpcInstancePanel` | Spawns at full HP, a full turn (3 AP, nothing cooling), full ability budgets and the base's own switch state, with an auto-numbered label ("Bandit", "Bandit 2", …) |
| `duplicatePanel` | NPC instances only — spawns a *fresh* instance, never a copy of its HP, AP, cooldowns, ability uses or modifier switches |
| `createNpcBaseAndInstance` | Quick-create: writes a base NPC record without navigating, then spawns |
| `removePanel`, `movePanel`, `setPanelDensity`, `renameInstance` | Panel management (reorder is wired to @dnd-kit sortable) |
| `setPanelStatus`, `adjustPanelStatusStacks`, `removePanelStatus` | GM-screen-only status tracking on a panel (add/change duration, ±stacks clamped to `[1, 99]`, remove) |
| `updateInstanceState`, `setInstanceCondition` | Replace an instance's live state / condition |
| `damageInstance`, `healInstance`, `setInstanceTempHP`, `adjustInstanceHP` | Instance live play (armor → resistance → temp HP → HP, with a Mortal Wound rolled automatically at 0 HP while the base allows one; `adjustInstanceHP` returns the same `DamageResult` for a downward step so the panel can announce it) |
| `clearInstanceMortalWound`, `clearInstanceMortalWounds` | Remove one wound from an instance's track, or all of them (the panel's Rest equivalent) |
| `addInstanceMortalWound` | Applies a **specific** Mortal Wounds table entry to the instance's own track, with no D20 (the manual counterpart of the automatic roll). Stores the entry's id as the wound's `roll`, so the chip reads like a rolled one; refuses — writing nothing and returning `false` — for a name off the table or a track already at the base's live allowance |
| `spendInstanceAP`, `restoreInstanceAP` | The instance's own Action Points (`spend` reports whether it could afford it; `restore` clamps to 3) |
| `markAbilityCooldown` | Flags one of the base's abilities as cooling on this instance (idempotent) |
| `setInstanceAbilityUses` | Sets how many uses the instance has left of one limited ability, clamped to the base's authored `max`; a count back at the maximum clears the entry |
| `spendInstanceAbilityUse` | Spends one of the instance's uses (the Activate path) and reports whether one was really spent — unlimited, `expendOnActivate: false` and 0-left all refuse |
| `setInstanceAbilityModifiersActive` | Flips one ability's stat/attribute modifiers on this instance (clamping current HP when a Max HP modifier goes off); a flip back to the ability's own flag clears the entry |
| `startInstanceTurn` | Refills AP and rolls one Recharge Die, returning `{ roll, recharged, stillCooling }` so the caller can toast it and log it — the store itself never notifies |
| `baseFor`, `screensReferencing` | Reference lookups used for placeholders and delete warnings |

Every live-play character mutation was refactored to be **id-targeted** (`takeDamage(id, …)`, `spendAP(id, …)`, …) so the GM Screen can drive several sheets in one tick. `updateCurrentCharacter(updater)` remains as a thin wrapper over `updateCharacter(id, updater)` for the sheet pages, and autosave now uses per-character debounce timers so edits to several panels each persist their own record.

---

## Tech Stack

- **React 19** — UI framework
- **TypeScript 6** — type-safe codebase
- **Vite 8** — build tool and dev server with HMR
- **Zustand** — lightweight state management (character store, dice roll store, roll log store, status store, app theme store)
- **@dnd-kit** — drag-and-drop for abilities (sortable lists, cross-list moves)
- **Lucide Icons** — the app's own icon library (chrome, panels, sheet actions)
- **RPG-Awesome** — the 496-icon fantasy pack the status icon picker offers
- **unicode-emoji-json** — the Unicode emoji names/groups behind the picker's emoji search
- **react-colorful** — color picker for the customization panel
- **react-markdown** + **remark-gfm** + **rehype-raw** — Markdown rendering in ability descriptions and bio fields
- **Vitest** + **Testing Library** — unit and component tests
- **Playwright** — end-to-end tests
- **oxlint** — fast linter

---

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** ≥ 18 (20+ recommended) — [Download Node.js](https://nodejs.org/)
- **npm** ≥ 9 (bundled with Node.js)

To verify your installations:

```bash
node --version
npm --version
```

No other dependencies, databases, or services are required. The app runs entirely in the browser and stores data locally.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/Hirokizante/Grimoire.git
cd grimoire

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm run dev
```

pnpm is the package manager this repo locks with (`pnpm-lock.yaml`), and the
Pages workflow installs from that same lockfile. `npm install` and `npm run …`
still work — pnpm is just what keeps the deploy build identical to a local one.

Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

The first time you open the app you'll land on the Home screen. Click **Characters** to enter the character list, then **+ New** or **Import** to add your first character.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm run icons:rpg-awesome` | Regenerate the status icon pack's key list from the installed `rpg-awesome` |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run test` | Run unit tests once via vitest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright e2e tests headless |
| `npm run test:e2e:ui` | Run Playwright with the UI runner |

---

## Building for Production

```bash
npm run build
```

This runs `tsc -b` (type-checking) followed by `vite build`. Static output lands in `dist/` — deployable to any static host (Netlify, Vercel, S3, etc.). See [Deployment](#deployment) for the built-in GitHub Pages setup.

To preview the production build locally:

```bash
npm run preview
```

---

## Deployment

The repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the app to GitHub Pages:

- Every push to `main` (and manual runs via the Actions tab) builds the app and deploys `dist/` automatically.
- The build installs with **pnpm** (`pnpm install --frozen-lockfile`) from the tracked `pnpm-lock.yaml`, so the deployed bundle is built from the same dependency tree as a local one. Bumping a dependency means committing the updated lockfile with it — the workflow fails rather than re-resolving.
- Vite's `base` is set to `/Grimoire/` so the app works under the project-page subpath.
- The live app is hosted at **https://hirokizante.github.io/Grimoire/** — the repo's Pages source must be set to "GitHub Actions" (repo Settings → Pages) for the workflow to be able to deploy.

---

## Project Structure

```
Grimoire/
├── Divergence SRD.md       # Full game rules
├── IDEA.md                 # Project vision
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── src/
│   ├── App.tsx             # Root component, routing between pages
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   ├── App.css            # App-level layout styles
│   ├── components/
│   │   ├── TitleBar.tsx    # Top navigation bar
│   │   ├── gmscreen/       # GM Screen panels & pickers
│   │   │   ├── CharacterPanel.tsx      # Live reference to a player sheet
│   │   │   ├── NpcInstancePanel.tsx    # NPC base + independent live state
│   │   │   ├── MissingPanel.tsx        # Placeholder for a deleted record
│   │   │   ├── PanelHeader.tsx         # Portrait, name, density, ⋯ menu
│   │   │   ├── PanelMortalWounds.tsx   # Wound track for BOTH panel kinds
│   │   │   ├── PanelStatuses.tsx       # Tracked status pills + Add Status
│   │   │   ├── SortablePanel.tsx       # dnd-kit drag-handle shell
│   │   │   ├── AddCharacterModal.tsx   # Player-character picker
│   │   │   ├── AddNpcModal.tsx         # NPC spawner + quick-create
│   │   │   ├── AddStatusModal.tsx      # Compendium status + duration picker
│   │   │   └── gmscreen.css            # GM Screen styles
│   │   ├── sheet/          # Character sheet layout & editing
│   │   │   ├── CharacterSheet.tsx      # Full sheet layout
│   │   │   ├── HeroSection.tsx         # Portrait, name, stats, attributes
│   │   │   ├── StatsSection.tsx         # Combat stats, resources, live play
│   │   │   ├── AttributesSection.tsx    # Five attributes with click-to-roll
│   │   │   ├── SkillsSection.tsx        # Fifteen skills with click-to-roll
│   │   │   ├── CoreAbilitySection.tsx   # Innate, basic attack, fatebreaker
│   │   │   ├── SlottedAbilitiesSection.tsx
│   │   │   ├── AbilityPoolSection.tsx
│   │   │   ├── AbilityBlockCard.tsx     # Single ability card renderer
│   │   │   ├── AbilityBlockEditor.tsx   # Inline ability form
│   │   │   ├── AbilityEditorModal.tsx   # Full-screen ability editor
│   │   │   ├── AbilityActivation.tsx    # Activate button + cost deduction
│   │   │   ├── AbilityModifierFields.tsx # Stat/attribute modifier editor rows
│   │   │   ├── AbilityModifierToggle.tsx # Card switch + modifier chips
│   │   │   ├── SortableAbilityCard.tsx  # Draggable ability card
│   │   │   ├── AbilitiesDndContext.tsx # Slotted ↔ pool drag context
│   │   │   ├── SectionViewToggle.tsx   # Shared grid/list section switch
│   │   │   ├── CustomTabContent.tsx     # Custom tab renderer
│   │   │   ├── CustomAbilitySection.tsx # Custom section renderer
│   │   │   ├── CustomNPCSection.tsx     # Compact bundled-NPC section
│   │   │   ├── CustomTextSection.tsx    # Free-form Markdown text section
│   │   │   ├── AddSectionChoiceModal.tsx # Ability / NPC / Text section chooser
│   │   │   ├── CustomTabDndContext.tsx # DnD for custom sections
│   │   │   ├── npc/                     # NPC-specific sheet components
│   │   │   │   ├── NPCSheet.tsx
│   │   │   │   ├── NPCHeroSection.tsx
│   │   │   │   ├── NPCStatsSection.tsx
│   │   │   │   ├── NPCAbilitiesSection.tsx  # Shared by the NPC sheet + bundled NPCs
│   │   │   │   ├── NpcAbilitiesDndContext.tsx # Reorder context for an NPC's list
│   │   │   │   ├── NPCDescriptionSection.tsx
│   │   │   │   └── NPCExportDialog.tsx
│   │   │   ├── TabBar.tsx              # Sheet tab navigation
│   │   │   ├── ProfileSection.tsx      # Physical description, backstory
│   │   │   ├── ResourceBar.tsx         # Segmented bar +/− controls
│   │   │   ├── DamageDialog.tsx        # Apply damage modal
│   │   │   ├── RecoverAction.tsx       # Recover + End Turn buttons
│   │   │   ├── DeathSaveTracker.tsx    # Death save pips + roll
│   │   │   ├── MortalWoundRoller.tsx   # Wound cards, roll, manual add, Rest
│   │   │   ├── MortalWoundPicker.tsx   # The table as a picker (sheet + panels)
│   │   │   ├── MilestoneDialog.tsx     # Guided level-up wizard
│   │   │   ├── CustomizationPanel.tsx  # Colors, fonts, layout editor
│   │   │   ├── FontImportSection.tsx   # Google Fonts importer
│   │   │   ├── PortraitUploader.tsx    # Image upload + compression
│   │   │   ├── ExportDialog.tsx        # Versioned export + history
│   │   │   ├── CreateCharacterModal.tsx
│   │   │   ├── ConfirmDeleteModal.tsx
│   │   │   ├── UpdateCharacterModal.tsx # Import conflict resolution
│   │   │   ├── CustomResourceBarModal.tsx
│   │   │   └── sheet.css               # Sheet-specific styles
│   │   ├── dice/          # Dice roller, overlay, log drawer
│   │   │   ├── DiceHighlighter.tsx     # Inline dice notation clicker
│   │   │   ├── DiceRollOverlay.tsx     # Modal wrapper
│   │   │   ├── DiceResultModal.tsx     # Full-screen roll breakdown
│   │   │   ├── RollLogDrawer.tsx       # Persistent roll history
│   │   │   └── dice.css
│   │   ├── status/        # Status conditions compendium
│   │   │   ├── StatusModal.tsx          # View/edit status modal
│   │   │   ├── CreateStatusModal.tsx    # New-status form
│   │   │   ├── StatusIconPicker.tsx     # Searchable emoji / RPG-Awesome / upload picker
│   │   │   ├── StatusIcon.tsx           # Status icon renderer
│   │   │   ├── StatusHighlighter.tsx    # Inline [Name] reference highlighting
│   │   │   ├── StatusReference.tsx      # Clickable reference + hover card
│   │   │   └── StatusTooltip.tsx        # Shared status card (+ portalled variant)
│   │   └── ui/            # Low-level UI primitives
│   │       ├── SegmentedBar.tsx        # Filled/empty segment bar
│   │       └── MarkdownText.tsx        # Markdown renderer
│   ├── constants/
│   │   ├── gameData.ts    # Attribute/skill metadata, mortal wounds table, defaults
│   │   ├── statuses.ts    # Built-in status conditions + defaults
│   │   ├── rpgAwesomeIcons.ts # Generated: the pack's 496 icon keys
│   │   └── statusIcons.ts # Icon-pack keys/labels + legacy Lucide fallback
│   ├── context/
│   │   └── NotificationContext.tsx # Toast notification system
│   ├── hooks/
│   │   ├── useModalDialog.ts      # Shared modal behavior: scroll lock, Esc, focus trap/restore
│   │   ├── useMediaQuery.ts        # CSS media-query subscription (GM Screen columns)
│   │   ├── useAbilityActivation.ts # Shared Activate planner (sheet resources or a GM panel's adapter)
│   │   ├── useNpcInstanceActivation.tsx # GM NPC live play: panel AP, ability uses + modifier switches, Recharge, turn roll
│   │   └── useImportedFonts.ts     # Google Fonts link injection
│   ├── lib/
│   │   ├── calculations.ts  # Pure derived-stat formulas (HP, EVA, etc.)
│   │   ├── abilityModifiers.ts # Ability stat/attribute modifiers → effective values
│   │   ├── abilityTraits.ts  # Reusable "Name (Value)" trait parser + trait registry
│   │   ├── abilityRecharge.ts # Recharge rules: Recharge Die, cooldown resolution
│   │   ├── db.ts            # IndexedDB wrapper (characters, versions, roll logs, statuses, screens)
│   │   ├── gmScreenUtils.ts # Panel resolution, placeholders, damage outcome wording
│   │   ├── dice.ts          # Single die roll utility
│   │   ├── diceParser.ts    # Tokenizer + parser for dice notation
│   │   ├── diceRoller.ts    # Evaluates parsed expressions with stats
│   │   ├── emojiCatalog.ts  # Lazy Unicode emoji catalog + name/alias search
│   │   ├── exportImport.ts  # JSON export/import, versioning, snapshots
│   │   ├── imageProcessing.ts # Canvas-based image resize + compression
│   │   ├── mortalWounds.ts  # Table lookup, roll, and the wound-slot rules
│   │   ├── rollSourceUtils.ts # Human-readable roll source labels
│   │   ├── slotLogic.ts    # Minor/regular slot counting
│   │   ├── statusReference.ts # [Name] reference parsing + status mapping
│   │   └── themeUtils.ts   # SheetColors → CSS custom properties + NPC stat accents
│   ├── pages/
│   │   ├── HomePage.tsx          # Landing screen
│   │   ├── CharacterListPage.tsx # Grid/list of all characters
│   │   ├── CharacterSheetPage.tsx # Sheet wrapper with mode toggle
│   │   ├── NPCListPage.tsx       # Grid/list of all NPCs
│   │   ├── NPCSheetPage.tsx      # NPC sheet wrapper with mode toggle
│   │   ├── GMScreenPage.tsx      # Multi-sheet GM view (panels, pickers, reorder)
│   │   ├── StatusCompendiumPage.tsx # Status compendium browser
│   │   └── SettingsPage.tsx         # App preferences (theme, GM panels, animation, backup)
│   ├── store/
│   │   ├── appThemeStore.ts   # Zustand store: app theme (localStorage)
│   │   ├── characterStore.ts  # Zustand store: characters + live play (id-targeted)
│   │   ├── gmScreenStore.ts   # Zustand store: saved GM screens + panels
│   │   ├── gmPanelThemeStore.ts # Zustand store: GM panel sheet theming (localStorage)
│   │   ├── diceRollStore.ts    # Zustand store: dice roll modal lifecycle
│   │   ├── listPrefsStore.ts   # Zustand store: list sort/filter prefs (localStorage)
│   │   ├── rollLogStore.ts     # Zustand store: persistent roll log
│   │   └── statusStore.ts      # Zustand store: status compendium
│   ├── types/
│   │   ├── index.ts       # Barrel re-exports
│   │   ├── ability.ts     # AbilityBlock, AbilityCost
│   │   ├── character.ts   # Character, SheetConfig, SheetColors, etc.
│   │   ├── gmScreen.ts    # GMScreen, ScreenPanel, NpcInstanceState
│   │   ├── rollLog.ts      # RollLogEntry, RollSource
│   │   └── status.ts       # StatusCondition, StatusIconType
│   └── test/
│       └── setup.ts        # Vitest setup (jest-dom matchers)
├── e2e/
│   ├── gm-screen.spec.ts   # Playwright: assemble, damage, persist, placeholders
│   └── status-icons.spec.ts # Playwright: search both icon sources, save, reload
├── scripts/
│   └── generate-rpg-awesome-icons.mjs # Regenerates the icon pack's key list
└── playwright.config.ts    # E2E config (runs against `vite preview`)
```

---

## Data Model Overview

The central domain object is a **`Character`**, which holds everything about a single Divergence character sheet:

| Field | Purpose |
| --- | --- |
| `id`, `name`, `playerName` | Identity |
| `kind` | Discriminator: `'character'` (player sheet) or `'npc'` (static NPC reference) |
| `version` | Semantic version (MAJOR.MINOR.PATCH) for export tracking |
| `milestones` | Character progression level |
| `attributes` | The five Attributes (MAR, POW, AGI, VIT, GRT) |
| `skills` | The fifteen Skills |
| `maxFP`, `maxAbilitySlots` | Caps that grow with milestones |
| `currentHP`, `tempHP`, `currentEND`, `currentAP`, `currentFP` | Live-play resource pools |
| `mortalWounds` | Up to 2 active wounds (by name; `Pending Roll` while a slot awaits its D20 — a hand-picked wound is stored by its table name, so its entry's D20 comes back with it) |
| `deathSaves` | Success/failure tracker |
| `innateDescription`, `innateAbilities` | Core Ability narrative + mechanical innates |
| `basicAttack`, `fatebreaker` | Fixed-shape core abilities |
| `slottedAbilities`, `abilityPool` | Active vs. inactive slotted abilities |
| `portrait` | Base64 data URL |
| `physicalDescription`, `backstory` | Bio fields |
| `customTabs` | User-created tabs with sections (`CustomAbilitySection`, `CustomNPCSection`, or `CustomTextSection`) |
| `config` | Full aesthetic configuration (colors, fonts, CSS, background image) |
| `viewModes` | Per-section grid/list preference |
| `customResourceBars` | User-defined resource pools |
| `npcStats` | Manually-entered combat stats (NPCs only: evasion, armor, movement, save DC, HP, mortal wounds) |
| `description` | Long-form NPC description (NPCs only) |
| `createdAt`, `updatedAt` | Timestamps |

**AbilityBlock** is the structured representation of any ability (Core, Slotted, or Pool):

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity |
| `traits` | Free-form tags (Action, Range, Type, Status, etc.) |
| `cost` | AP / END / FP costs (all optional) |
| `damage` | Dice notation string (e.g. `2d6+POW`) |
| `description`, `overcharge`, `flavorText` | Prose fields (Markdown-supported) |
| `isMinor` | Half-slot flag |
| `showActivate` | Whether to show the Activate button in view mode. Offered in the player ability editors only — an NPC's ability editor (and every sub-ability editor on an NPC sheet) hides it, because an NPC outside a GM Screen never activates |
| `modifiers` | Stat/attribute modifiers applied while the card's modifier toggle is on (`[{ target, value }]`; signed — positive adds, negative subtracts) |
| `modifiersActive` | Whether those modifiers are currently applied to the sheet (view-mode switch; defaults to `false`). On an NPC base record it is template data — the base sheet shows it read-only, and a GM Screen instance records its own switch state instead (`NpcInstanceState.abilityModifiers`) |
| `uses` | Limited-use budget, present only on abilities flagged as limited: `{ max, current, expendOnActivate }`. `current` moves when the ability is activated and is refilled to `max` on a full restore; omitted entirely for unlimited abilities. On an NPC base record it is template data — the base sheet shows it read-only, and a GM Screen instance tracks its own counts instead (`NpcInstanceState.abilityUses`) |

**CustomSection** is a discriminated union describing one section inside a custom tab:

| Variant | Shape |
| --- | --- |
| `CustomAbilitySection` (`kind: 'ability'`) | `{ kind, id, name, abilities: AbilityBlock[] }` — a free-form group of abilities |
| `CustomNPCSection` (`kind: 'npc'`) | `{ kind, id, name, npcId }` — a reference to a bundled NPC `Character` (with `kind: 'npc'`) |
| `CustomTextSection` (`kind: 'text'`) | `{ kind, id, name, content }` — a free-form Markdown body (mechanics, flavor text, lore) |

**GMScreen** is a saved, named list of panels (see [GM Screen](#gm-screen)):

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; the name is shown in the screen switcher |
| `panels` | Ordered `ScreenPanel[]` — array order is display order |
| `createdAt`, `updatedAt` | Timestamps |

`ScreenPanel` is a discriminated union on `kind`: `'character'` carries `{ id, characterId, density }` (a reference to a player sheet), and `'npc-instance'` carries `{ id, baseNpcId, label, density, state }`, where `state` is the instance's own live play (`{ currentHP, tempHP, condition, currentAP, cooldowns, mortalWounds, abilityUses }` — see the [GM Screen](#gm-screen) section).

**StatusCondition** is a compendium record referenced from any sheet text:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; `[name]` references match case-insensitively |
| `icon`, `iconType` | Icon payload (`'emoji'`, `'pack'` RPG-Awesome class key such as `'ra-crossed-swords'`, or `'image'` data URL). Lucide keys saved by older releases still render |
| `description` | Full rules text for the condition |
| `tags` | Categorization tags; built-ins carry `'Default'` |
| `createdAt`, `updatedAt` | Timestamps |

---

## Key Concepts

### Calculated Fields

The following are derived from Attributes and Milestones and are always read-only:

| Field | Formula |
| --- | --- |
| HP | `max(20, 20 + VIT × 5)` |
| Evasion | `10 + AGI` |
| Armor | `floor(VIT / 2)` |
| Movement | `5 + floor(AGI / 2)` |
| Milestone Bonus | `floor(Milestones / 2)` |
| Save DC | `10 + Milestone Bonus` |
| END Recovery | `max(1, 1 + floor(GRT / 2))` |

Ability modifiers layer on top of these formulas without ever changing them: attribute modifiers change the Attributes first (so `+1 VIT` also raises Max HP and Armor), then direct stat modifiers are added to the derived values. Everything that reads an attribute or a combat stat — display, dice rolls, damage/armor resolution, heal caps, END Recovery — uses the *effective* value, and switching the modifier off restores the base instantly.

### Slot Logic

- A regular Slotted Ability occupies **1 slot**.
- A Minor Slotted Ability occupies **0.5 slots**.
- Characters start with **3 slots** and gain an additional slot every 2 Milestones (or choose +1 Max FP instead).

### View Modes

- **Edit Mode** — all fields editable; live-play trackers hidden.
- **View Mode** — all fields read-only; live-play interactions enabled (resource bars, dice rolling, ability activation, ability modifier switches, damage, death saves, mortal wounds — rolled *or* picked by hand from the table).

### Dice Notation

The dice parser supports:

- Standard dice: `d20`, `2d6`, `3d8`
- Constants: `+4`, `-1`
- Variables: `POW`, `MAR`, `Sneak` (resolved to the character's actual value)
- Variable alternatives: `POW/MAR` (player's choice; higher used by default)
- Combined: `2d6+POW`, `d20+3`, `1d6+POW/MAR`

---

## Architecture

### State Management

Zustand stores manage all application state:

- **`characterStore`** — the character list, the currently-selected sheet, live-play mutations (damage, healing, resource spending, milestone application), and version history. Every live-play action is **id-targeted** (`takeDamage(id, …)`, `spendAP(id, …)`, …) so several sheets can be driven at once; `updateCurrentCharacter` is a thin wrapper over `updateCharacter(id, …)`. Mutations are debounce-autosaved (500ms, per-character timers) to IndexedDB.
- **`gmScreenStore`** — saved GM screens and their panels: screen CRUD, panel add/remove/reorder, NPC instancing (spawn, duplicate, auto-labelling), instance live state (damage/heal/condition), and reference lookups for placeholders and delete warnings. Autosaved per screen with the same 500ms debounce.
- **`diceRollStore`** — the dice roll modal lifecycle: parse notation → evaluate with character stats → show result → forward to the roll log.
- **`rollLogStore`** — persistent roll history across all characters, stored in IndexedDB and filterable by character.
- **`statusStore`** — the status-condition compendium: CRUD, icon picking, and bundling referenced statuses into character exports. Persisted to IndexedDB.
- **`listPrefsStore`** — remembered list-page display prefs (sort key + filter selections for the character list, NPC list, and status compendium). Persisted to localStorage so choices survive page switches and reloads.
- **`appThemeStore` / `homeAnimationStore` / `gmPanelThemeStore`** — app-level UI preferences persisted to localStorage (synchronously available before first paint): the app chrome theme, the home page ambient animation, and whether a GM panel's expanded sheet body follows the app theme instead of the character's own palette. Preferences only — no sheet data is stored here.

### Persistence

A thin promise wrapper around the native IndexedDB API (`src/lib/db.ts`) manages five object stores (DB version 5):

- `characters` — live `Character` records keyed by `id`.
- `versions` — `VersionSnapshot` records for export history, indexed by `characterId`.
- `roll_logs` — `RollLogEntry` records for the dice roll log, indexed by `characterId`.
- `statuses` — `StatusCondition` records for the status compendium, seeded with the built-in Divergence conditions on first run.
- `screens` — `GMScreen` records (panel lists stored inline; no indexes).

Schema migrations are handled on read via `normalizeCharacter` and `normalizeScreen`, which upgrade older records to the latest shape (e.g. migrating `innateAbility` → `innateAbilities`, adding `showActivate`, ensuring `customTabs` and `customResourceBars` exist, sanitizing ability `modifiers` (unknown targets / non-finite values dropped; the modifier switch is dropped when nothing survives), stamping the `kind` discriminator on legacy custom-tab sections, and completing GM-screen panels). No bulk migration is needed.

**Autosave durability:** debounced writes are flushed on `visibilitychange`/`pagehide` (`flushPendingCharacterSaves`, `flushPendingScreenSaves`, installed by `App`), which covers switching tabs and backgrounding. A write that is *initiated* during page unload is cancelled by the browser before it can commit, so reloading within the 500ms debounce window can still lose the last keystroke-level edit — the same last-writer-wins reality as running two tabs.

**The storage layer is self-healing.** Three failure modes are handled explicitly, because IndexedDB's are unusually hostile:

- **Blocked upgrade → no hang.** `indexedDB.open()` has a **10-second deadline** (`OPEN_TIMEOUT_MS`). A version upgrade is *blocked* — not failed — while another connection holds the database open (a stale tab, or a cached older build), and in that state the browser fires no useful event and the request never settles. Now `openDB` rejects, `loadCharacters`/`loadScreens` record a `loadError`, and the page shows the reason with a **Try again** button instead of spinning forever.
- **Half-applied upgrade → repaired on open.** If an upgrade is interrupted, the database can be stamped at the current version while an object store was never created. Re-opening at the same version can never fire `upgradeneeded` again, so every query fails with *"One of the specified object stores was not found."* `openDB` therefore **verifies the schema on every open** and, if a store is missing, closes and reopens at `version + 1` to create it — an upgrade never touches existing records. The repair is announced once via a toast (`wasSchemaRepaired()`).
- **One shared connection.** All helpers share a single long-lived connection (`withConnection`), which is what makes the repair safe: concurrent opens from `loadCharacters` and `loadScreens` used to race, and one of them minted a newer version while the other was still asking for the old one (`VersionError`). The connection is released on `versionchange` so another tab can upgrade, and `withConnection` transparently reconnects and retries if a connection was closed underneath a call. A single unreadable record is skipped and logged rather than failing an entire load.

### Theming

Every configurable color lives in `SheetColors`. `themeUtils.colorVars()` maps them onto CSS custom properties, which the entire sheet reads from. The `CustomizationPanel` is a slide-out drawer (right edge on desktop, bottom sheet on phones) that exposes every color as a swatch + hex input, organized into groups (Surfaces, Text, Borders, Accents, Resource Bars, Stat Tokens). The sheet stays visible and interactive while the drawer is open, so changes apply live via CSS variables and persist per-character.

### Drag and Drop

Built on `@dnd-kit`. The `AbilitiesDndContext` wraps the Slotted Abilities and Ability Pool sections, enabling cross-list moves (slotted ↔ pool) and reordering within a list. Custom ability sections have their own `CustomTabDndContext`. An NPC has a single ability list, so `NpcAbilitiesDndContext` only reorders — and it is mounted *inside* `NPCAbilitiesSection`, so the same drag works on the NPC's own sheet page and in an NPC section bundled into a player sheet's custom tab while staying out of that tab's cross-section drags (a card can never be dropped from an ability section into an NPC). The GM Screen wraps its panel canvas in a `SortableContext` (`SortablePanel` + `verticalListSortingStrategy`); only the frameless grip handle activates a drag, with a 6px `PointerSensor` distance so touch scrolling and in-panel controls keep working. Every ability list uses that same activation constraint, `closestCorners` collision detection, keyboard sensor and drag overlay, so a reorder feels identical wherever it happens.

---

## Testing

```bash
# Unit tests (vitest + Testing Library)
npm run test

# Unit tests in watch mode
npm run test:watch

# End-to-end tests (Playwright)
npm run test:e2e

# E2E with Playwright's UI runner
npm run test:e2e:ui
```

Unit tests cover the pure logic modules (`calculations`, `diceParser`, `diceRoller`, `slotLogic`, `exportImport`, `db`, `backup`, `mortalWounds` — the table resolved face by face, the slot rules, the `{ slot, roll, name }` projection, and `isKnockedOut`: a full track standing is *not* out, 0 HP with a slot in hand is not either, 0 HP with none is), the character store's id-targeted mutations and autosave (including `addMortalWound`: filling the oldest slot that can take a name, resolving a `Pending Roll` slot, refusing off-table names and a full track, and a hand-added wound really reaching healing), the GM Screen store (CRUD, panel ops, duplicate guard, auto-labelling, instance damage/heal/downed flow, the instance Mortal Wound track — automatic rolls, spill-over, going down when the allowance runs out, per-instance isolation and clearing, and `addInstanceMortalWound` — the entry's D20 stored beside the name, refusal at the allowance and for off-table names, the live read of a raised allowance, and per-panel isolation — panel status tracking, per-instance ability uses — spending, clamping, per-panel isolation and the untouched base record — per-instance modifier switches — flipping, per-panel isolation, the HP clamp, effective Armor in the damage pipeline — per-screen autosave), the player sheet's wound block (the `n / max` counter with no empty slot boxes, the read-only track edit mode renders, one action row whose roll/add/rest buttons share the `sheet-action-btn` class and each carry an icon, the Death Save roll sharing that same class, which toast each wound raises — the Critical Condition when the roll fills the last slot, the knock-out only at 0 HP with no slot left, and nothing for an ordinary wound — the picker's search and "on track" marking, the dialog locking itself on a full track, and a pending slot named by hand instead of rolled), and the GM Screen components (panels, pickers, placeholder, status pills + Add Status picker — including a pill's click-through to the status description and its hover card — limited-use cards on a panel — activation spending the instance's own use, working ± steppers, refusal at 0 — modifier switches moving an instance's tokens/body without touching its sibling or the base — manual Mortal Wound adds on both panel kinds, and `DamageDialog` against an NPC instance, both the mook case and an auto-rolled wound), and the status icon picker (emoji search run against the real shipped catalog — name ranking, a game term like "poisoned" reaching ☠️, every alias verified to point at an emoji that catalog contains, the pasted-emoji path and the result cap — the RPG-Awesome pack's 496 keys matching every word of a query, the selection mark on both grids, and `StatusIcon` drawing a saved RPG-Awesome key as a font glyph while still drawing the Lucide keys older records carry).

End-to-end tests live in `e2e/` and run against the **production build** served by `vite preview` (not a dev server). `e2e/status-icons.spec.ts` walks the icon picker in a real browser — search the emoji tab, pick, search the RPG-Awesome pack, pick, save, reload — and asserts the pack's `@font-face` actually resolved (`document.fonts.check('16px RPGAwesome')`), which is the one thing jsdom can never cover. `e2e/npc-abilities.spec.ts` drags a real ability card with a real pointer on both NPC surfaces — the NPC's own sheet page and an NPC bundled into a character's custom tab — asserting the drop reorders the record, survives a reload, and that the two surfaces lay the list out identically (unit tests pin the drop handler itself, since jsdom has no layout for dnd-kit to measure). `e2e/gm-screen.spec.ts` covers screen creation, mixing a character with two NPC instances, damaging one instance to 0 HP while its sibling is unaffected, an instance's Mortal Wound track walked end to end (auto-rolled wound with its d20, spill-over refill, the full-track warning, going down on the next 0 HP, a cleared wound surviving a reload, and the row staying one line without overflow at 360px), a specific wound recorded by hand on the sheet and on both panel kinds (searching the picker, the card/chip landing with the entry's D20, the menu entry disappearing once the track is full, and both tracks surviving a reload), a character walked 20 → 15 → 10 → 1 → 0 HP on their own sheet to pin when the knock-out is announced (the second wound and the full track raise the Critical Condition instead, the hit that finally has no wound to pay for it is the knock-out), persistence across a reload, player/panel state parity, delete-reference placeholders, status tracking (per-panel pills, durations, stacks, hovering a pill for its card — asserted to render un-clipped outside the pill — clicking through to its description, and a panel that stays exactly as tall with five statuses as with one — on desktop and at 360px), and a 360px-wide layout with no horizontal overflow. `e2e/storage-failure.spec.ts` pins the recovery contract for all three failure modes: a blocked upgrade must not hang (it must explain itself, and Retry must succeed once the blocking connection goes away), a half-applied upgrade must repair itself **without losing data**, and a sequence of mixed reads and writes must keep working on the shared connection (every helper used to close it on exit, silently breaking everything after the first call). Run `npx playwright install chromium` once before the first `npm run test:e2e`.

---

## Storage & Privacy

- **Everything is stored locally on the user's device** — in IndexedDB, with no server, no account, and no network requirement for normal operation.
- The only external network calls are to the Google Fonts API, and only when the user explicitly imports a font.
- Character data never leaves the browser unless the user explicitly exports a JSON file.
- Deleting a character removes it from IndexedDB. Clearing browser data for the site removes all stored characters, version history, and roll logs.

---

## License

This project is licensed under the MIT license.

Bundled third-party work keeps its own license: the status icon pack is
[RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) (font under SIL OFL 1.1,
CSS under MIT), drawn from [Game Icons](https://game-icons.net/), and the emoji names and
groups behind the picker's emoji search come from
[unicode-emoji-json](https://github.com/muan/unicode-emoji-json) (MIT), which repackages
Unicode's emoji data.
