# Custom CSS — A Player's Guide

Your character sheet already has a full colour palette, fonts, and a background
image in the **Customize** drawer. Custom CSS is the layer underneath all of
that: a text box where you can write your own styling rules to change anything
the palette doesn't cover.

No programming experience needed. If you can fill in a form, you can copy a
block from [custom-css-recipes.md](custom-css-recipes.md), paste it, and change
a few values.

---

## 1. Where to put your custom CSS

1. Open a character sheet.
2. Click **Customize** (top-right of the sheet) to open the drawer.
3. Scroll to the bottom: **Custom CSS (advanced)**.
4. Type or paste CSS into the box. It saves automatically and applies **as you
   type** — there is no Apply button and no save button.

Custom CSS is stored **per character**, in the same record as the palette, so
each sheet can look completely different. It also travels in **Export** JSON
files, so a sheet you share carries its styling with it.

> **To remove everything you've written:** select all the text in the box,
> delete it, and the sheet returns to the palette-only look. This is also the
> fix for "I pasted something and the sheet looks broken."

---

## 2. How it works

The text you write is inserted into the page as a stylesheet that belongs to
your sheet. Three consequences matter:

- **A rule like `.ability-card { ... }` styles every ability card on your
  sheet.** You never need to touch HTML or edit the sheet's markup.
- **Your rules apply to the whole app window, not just the sheet box.** The
  stylesheet is loaded on the page, so a rule such as `body { ... }` or
  `button { ... }` also restyles the dice tray, modals, and the rest of the app.
  Keeping every selector starting with `.character-sheet` (or a class you saw
  inside it) avoids that entirely.
- **Clicking the sheet's name or buttons is unaffected** — CSS changes looks,
  never behaviour or your data.

Custom CSS belongs to **your sheet page**: it is not applied inside the GM
Screen's expanded panels, it does not follow you onto a different character's
(or an NPC's) sheet — those load their own styling — and it is skipped along
with the rest of a sheet's customization while *Settings → Character Sheets →
Match app theme* is on.

### The two things you can change

| You want to… | Do this |
| --- | --- |
| Change a **colour, font, or spacing** that appears in many places | Set a **variable** (section 5) |
| Change **one specific thing** — the portrait, tab bar, ability cards | Write a **rule** targeting that class (sections 6–7) |
| Style **words inside an ability's text** | Invent your own class and use it inline (section 8) |

---

## 3. The CSS rule

A rule has two parts:

```css
.ability-card {          /* selector — WHAT you are styling */
  border-radius: 4px;    /* property: value; — HOW it looks */
  padding: 0.6rem;
}
```

- **Selectors** start with a `.` and name a class, e.g. `.hero-section__name`.
  You can chain them to be more specific: `.character-sheet .ability-card`.
- **Properties** are the thing being changed; **values** are the setting.
  Every declaration ends with a **semicolon** — a missing one silently kills
  the rest of the block, and it is the single most common beginner mistake.
- **Comments** are written `/* like this */`.
- **Sizes**: `rem` is relative to the page's base font size, so `1rem` ≈ 16px.
  `0.5rem` = 8px, `1.5rem` = 24px. You can also use `px`, `%`, or `2vw`.
- **Colours**: `#c9a227`, `rgb(201 162 39)`, or a name like `tomato`.
  `transparent` is a colour too.

The properties you'll reach for most: `color` (text), `background`,
`border`, `border-radius`, `padding`, `margin`, `gap`, `font-size`,
`font-weight`, `letter-spacing`, `text-transform`, `box-shadow`, `opacity`,
`display`, and `width` / `height`.

Changing a single property — say a heading's size — needs only that one line:

```css
.character-sheet .sheet-section__heading {
  font-size: 1.3rem;   /* only the size changes; colour and font are kept */
}
```

---

## 4. A starter block

Paste this in and edit the values. Everything else on the sheet keeps working.

```css
/* ===== My sheet ===== */

/* 1. Colours and fonts — the sheet obeys these everywhere */
.character-sheet {
  --accent-violet: #c9a227;          /* main accent */
  --accent-violet-soft: #e6c76a;     /* headings / soft accent */
  --sheet-text-font: Georgia, serif;
}

/* 2. One-off tweaks */
.character-sheet .sheet-section__heading {
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
```

Put **variables first**, then your tweaks, so it stays easy to find things
later. Comments are free — use them.

---

## 5. Variables: the fastest way to restyle

The sheet is painted almost entirely with *variables* (CSS custom properties).
Set one and every element that uses it updates at once.

```css
.character-sheet {
  --accent-violet: #c9a227;
}
```

### Colors

| Variable | What it colours |
| --- | --- |
| `--sheet-bg` | The sheet card's background |
| `--bg-surface` | Section / card panels |
| `--bg-surface-raised` | Raised bits — stat tokens, pills, bar segments |
| `--bg-surface-hover` | Background of hovered rows and buttons |
| `--text-primary` | Body text |
| `--text-secondary` | Labels |
| `--text-muted` | Muted / helper text |
| `--border` | Strong border lines |
| `--border-soft` | Hairline separators, section outlines |
| `--accent-violet` | Main accent — ability card borders, buttons, focus |
| `--accent-violet-soft` | Section headings, the character's name |
| `--accent-blush` | The blush/pink accent (named `--hp-bar-color` in the palette) |
| `--danger` | Damage, delete, and Mortal Wound red |
| `--danger-hover` | `--danger` on hover (set automatically from it) |
| `--color-success` | Success green |
| `--color-minor-ability` | The tint used on Minor ability cards |
| `--hp-bar-color` / `--fp-bar-color` / `--ap-bar-color` / `--end-bar-color` | The four resource bars |
| `--color-token-mortal-wounds` | The Mortal Wounds block's accent |

The remaining `--color-token-*` variables exist in the sheet's palette but are
painted per token (see the note below), so writing them has no visible effect —
use the **Stat Tokens** swatches for those.

### Fonts

| Variable | What it affects |
| --- | --- |
| `--sheet-heading-font` | Section headings and the character's name |
| `--sheet-heading-weight` | Weight of those headings (`600`, `bold`, …) |
| `--sheet-label-font` | Field labels and small caps-ish text |
| `--sheet-text-font` | Body text, ability descriptions, bio |
| `--sheet-helper-font` | Helper text and italic hints |

Use a family that's already installed (`Georgia, serif`), a system stack
(`system-ui, sans-serif`), or one you imported in the Customize drawer's font
section. A font imported there is available by name:

```css
.character-sheet { --sheet-heading-font: 'Cinzel', serif; }
```

### Scoped variables

Because variables are inherited, setting one on a *section* restyles only that
section:

```css
/* Only the Ability Pool goes gold */
.character-sheet .sheet-section--pool {
  --accent-violet: #c9a227;
}

/* Only the attribute boxes get a lilac value text */
.character-sheet .attr-box {
  --text-primary: #d9c9f0;
}
```

This is usually cleaner and safer than writing many separate rules.

**One limit:** the Customize palette writes its values directly onto the sheet
element, and inline styles beat stylesheet rules. Setting
`.character-sheet { --text-primary: ... }` therefore wins for everything
*inside* the sheet, but one value is genuinely out of reach:

- **The Combat Stats token accents** — each token's stripe and icon colour is
  set inline per token, so no rule can override it. Use the **Stat Tokens**
  swatches in the Customize drawer. (You can still restyle the tokens' shape,
  spacing, and text freely.)

Everything else on the sheet is fair game.

---

## 6. The sheet's structure

Sections stack top to bottom, and almost every visible thing has a class you
can style. You only need the names of things you want to touch.

```
.character-sheet              the sheet card itself
├── .tab-bar                  the tab strip above the sheet (.tab-bar__tab, --active)
├── .hero-section             portrait, name, tags, Combat Stats, action buttons
│   ├── .hero-section__portrait          the portrait image
│   ├── .hero-section__name              the character's name
│   ├── .hero-section__player            the player name
│   ├── .stat-tokens / .stat-token       Combat Stats tokens (__label, __value, __icon)
│   ├── .stat-bars / .resource-bar       HP, FP, AP, END, custom bars
│   ├── .custom-attr-strip / .custom-attr-box   the player's own attributes (__abbr, __value, __name, −/+ steppers)
│   └── .stat-mortals / .mw-card         Mortal Wounds
├── .sheet-section--attributes   .attr-boxes (grid) / .attribute-list (list)
├── .sheet-section--core         innate / basic attack / fatebreaker
├── .sheet-section--slotted      Slotted Abilities  → .ability-grid--cards|--list
│   └── .ability-activation / .ability-card-wrap   one per ability (see below)
├── .sheet-section--pool         Ability Pool
├── .sheet-section--custom-text  Custom text section (rich markdown text)
├── .sheet-section--custom       Custom ability / NPC section
├── .character-sheet__bottom     two columns on desktop, stacked on phones
│   ├── .sheet-section--skills   .skill-list / .skill-list__item
│   └── .sheet-section--bio      .profile__block, .profile__text
└── (you can name your own sections — the section's heading text is its name)
```

Ability cards (`.ability-card`) are shared by every ability section, with
`.ability-card__name`, `.ability-card__trait`, `.cost-badge`, `.ability-card__description`,
`.ability-card__flavor`, `.ability-card__overcharge`, and `.ability-card--minor`.

**An ability with an Activate button is two elements, not one.** In View mode it
renders as a card plus a footer strip, wrapped together:

```
.ability-activation             ← style the whole block here
├── .ability-card               ← content
└── .ability-activation__footer ← the Activate strip
```

The app deliberately removes the card's bottom border and radius (and the
footer's top border and radius) so the two read as one shape. If you set a
border, corner radius, or shadow on `.ability-card` alone, **it stops dead at
the Activate strip** — that outline is the app's split, not a bug in your CSS.
Style `.ability-activation` instead. Cards *without* an Activate button sit
alone in `.ability-card-wrap`, so style that one too when you want every ability
to match. The [recipes](custom-css-recipes.md#give-an-ability-block-a-real-border)
have the full pattern.

**Useful shared pieces:** `.sheet-section` (the panel around every section),
`.sheet-section__heading` (the heading text), `.sheet-input`, `.sheet-textarea`,
`.btn` (with `.btn--primary`, `.btn--ghost`, `.btn--icon`, `.btn--danger`).

**Don't rely on section order.** Sections can be reordered and renamed, so
prefer the `--attributes` / `--pool` / `--skills` style modifiers, or the
section's own name class, over `:nth-child(...)`.

---

## 7. Useful techniques

**Reorder sections** — the sheet is a vertical flex column, so numbered
`order` values work on any top-level section. Only the two panels inside
`.character-sheet__bottom` (Skills and Bio) sit in their own two-column grid and
can't be lifted out of it:

```css
.character-sheet .sheet-section--skills { order: 1; }  /* moves to the very top */
.character-sheet .sheet-section--pool   { order: 2; }
```

**Hide a section you don't use:**

```css
.character-sheet .sheet-section--pool { display: none; }
```

Hidden sections still exist in Edit mode — remove content from the sheet itself
if you want it gone for good.

**Reshape the card grid.** Ability grids are CSS multi-column, so change
`column-count`, not `grid-template-columns`:

```css
.character-sheet .ability-grid--cards { column-count: 2; column-gap: 1rem; }
```

**Give sections a look** — an accent line, tighter corners, a slight lift:

```css
.character-sheet .sheet-section {
  border-radius: 4px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 35%);
}
.character-sheet .sheet-section__heading {
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 0.35rem;
}
```

**Add an accent to just one section by name.** A custom section is a
`.sheet-section--custom`, and `nth-of-type` picks it by its position among the
custom sections on the tab — note that reordering sections in Edit mode
renumbers them:

```css
/* the 1st custom section on the tab (counting only custom sections) */
.character-sheet .sheet-section--custom:nth-of-type(1) {
  --accent-violet: #6fd3c7;
}
```

**Wrap text and centre the sheet** on a wide monitor:

```css
.character-sheet {
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}
```

**Background texture** (works nicely with *Hide section backgrounds* on):

```css
.character-sheet {
  background-image:
    radial-gradient(circle at 20% 10%, rgb(255 255 255 / 5%), transparent 60%),
    repeating-linear-gradient(45deg, rgb(0 0 0 / 4%) 0 2px, transparent 2px 6px);
}
```

**Print a clean sheet** — hide the controls before printing:

```css
@media print {
  .character-sheet .tab-bar,
  .character-sheet .hero-section__actions,
  .character-sheet .ability-card__actions { display: none; }
}
```

**Match the app colour to your sheet** for a seamless look:

```css
.sheet-page__bg-color { background: #14101c !important; }
```

The page canvas is outside the sheet, so this one needs `!important` (the app
sets its colour directly on the element).

---

## 8. Your own classes for fancy text

**Yes, you can invent your own classes.** Nothing limits the Custom CSS box to
the app's existing names: any `.something { ... }` rule you write is a brand-new
class, and you can apply it inside your sheet's *text* by writing a little HTML
inline.

### The two halves

**1. Define the class in Custom CSS** (as many as you like):

```css
.character-sheet .text-glow {
  color: var(--accent-violet-soft);
  text-shadow: 0 0 8px currentColor;
}

.character-sheet .text-tag {
  border: 1px solid var(--accent-violet);
  border-radius: 999px;
  padding: 0 0.4rem;
  font-size: 0.85em;
}
```

**2. Use it in a text field** by wrapping the words in a `span`:

```html
Deals <span class="text-tag">fire</span> damage, and
<span class="text-glow">ignores armour</span>.
```

That text then shows `fire` in a pill and `ignores armour` glowing. Nothing else
on the sheet is affected. A class only changes what you wrap in it.

### Where you can use it (any Markdown text field)

An ability's **Description**, **Overcharge**, and **Flavor Text** fields, a
**custom text section**, the innate description, physical description /
backstory, and an NPC section's description. Bold, italics, tables, lists,
quotes, and `~~strikethrough~~` also work in all of them — your classes are
simply extra vocabulary on top.

### Motion and gradients in one minute

**Gradients on text** aren't painted with `color`. You set a `background-image`
and clip it to the letterforms, which means the text colour must become
transparent — and any `text-shadow` has to go, or it paints behind invisible
letters:

```css
.character-sheet .hero-section__name {
  background-image: linear-gradient(90deg, var(--accent-violet-soft), var(--accent-blush));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
}
```

**Animations** have two halves: a `@keyframes` block describing the states, and
an `animation` line that plays it.

```css
.character-sheet .ability-activation { animation: card-pulse 3s ease-in-out infinite; }

@keyframes card-pulse {
  0%, 100% { border-color: var(--border-soft); }
  50%      { border-color: var(--accent-violet); }
}
```

The shorthand reads as *name, duration, easing, delay, repeat*. Useful values:
`ease-in-out` for anything that breathes, `linear` for continuous sweeps,
`2s`–`4s` for ambience, `infinite` for a loop.

Wrap animations in the reduced-motion guard so players who prefer stillness get
the plain sheet. The sheet's own stylesheet does **not** do this for you — your
custom CSS is the only place it can happen for your additions:

```css
@media (prefers-reduced-motion: no-preference) {
  /* animation rules go here */
}
```

Also note that ability cards are moved by the drag-and-drop library, which
writes a `transform` onto the card wrapper while you reorder. So animate
`box-shadow`, `border-color`, `background`, `opacity`, or `filter` on an ability
block — never `transform`, which the library would override or fight. And
because an activatable ability is split into a card plus a footer, animate
`.ability-activation` (the wrapper) rather than `.ability-card`, or the effect
will stop at the Activate strip.

### Rules of thumb

- **One small vocabulary, reused.** Three or four well-chosen classes (a glow, a
  chip, a warning box) go further than twenty one-offs, and they keep the sheet
  looking intentional.
- **Prefix your names** to avoid clashing with the app's own classes —
  `text-`, `sheet-`, or your character's name. Anything "fancy" is fine as long
  as it's distinctive.
- **Keep the HTML on one line and close every tag.** A stray `>` or an unclosed
  `</span>` will spill the tags into your visible text. Inline Markdown still
  works inside a tag: `<span class="text-glow">**ignores armour**</span>` is
  bold *and* glowing.
- **The tags are visible while editing.** Descriptions render their raw HTML in
  the editor box — that's expected. The styled result is what View mode (and
  your players) see.
- **Tag sparingly.** If every line sparkles, nothing does. Save a class for the
  thing the eye should land on: the damage type, a rule the GM must not miss,
  the ability's signature line.
- **Classes live in the sheet's Custom CSS.** If you paste that text onto
  another character, its styles come along with the description — but the class
  itself must be defined on *that* sheet too. The simplest approach is to keep
  your text classes at the top of every sheet's Custom CSS box.

A minimal starter set — the [recipes](custom-css-recipes.md#fancy-text-in-your-descriptions)
open with a fuller version of the same four names — then write those spans
straight into your ability text:

```css
/* Text classes — use as <span class="text-tag">fire</span> */
.character-sheet .text-glow { color: var(--accent-violet-soft); text-shadow: 0 0 8px currentColor; }
.character-sheet .text-tag { border: 1px solid var(--accent-violet); border-radius: 999px; padding: 0 0.4rem; font-size: 0.85em; white-space: nowrap; }
.character-sheet .text-danger { color: var(--danger); font-weight: 600; }
.character-sheet .text-faded { opacity: 0.65; font-style: italic; }
```

---

## 9. Good habits

- **Copy a block, then change one value at a time.** If something breaks, you
  know exactly which line did it.
- **Keep every selector anchored** to `.character-sheet` or a class inside it.
  Unanchored selectors like `button`, `h3`, or `body` leak into the rest of the
  app.
- **Stay away from `*`** (it hits everything, including dialogs) and from
  `position: fixed` / `z-index` on sheet content — you can end up covering
  buttons you need.
- **Use `!important` only when a change refuses to apply**, and only for that
  one property.
- **Add motion carefully.** Wrap animations in a reduced-motion guard so
  players who prefer stillness aren't affected (section 8):

  ```css
  @media (prefers-reduced-motion: no-preference) {
    .character-sheet .ability-card { transition: box-shadow 0.2s ease; }
    .character-sheet .ability-card:hover { box-shadow: 0 6px 18px rgb(0 0 0 / 40%); }
  }
  ```

- **Keep animation on `transform`, `opacity`, and colours.** Those are cheap;
  animating `width`, `margin`, `filter`, or `box-shadow` across a large area is
  what makes a sheet stutter on a laptop at the table. One ambient animation per
  sheet is plenty.

- **Keep contrast readable.** Body text should stay clearly lighter (on a dark
  sheet) than its background, and never let a background image do the work of a
  colour — the palette has a darken slider for that.
- **Keep a copy of your CSS in a notes file.** Deleting the box is instant and
  the sheet export is the only other backup.
- **Test in Edit mode too.** Some controls only appear there; make sure nothing
  you hid was the only way to reach a button you still need.
- **Found a class name?** Right-click the element in the browser → *Inspect*,
  then read the class on the highlighted line. That is how every recipe in the
  companion file was written.

---

## 10. Fixing things

| Symptom | Cause and fix |
| --- | --- |
| Nothing happens | Missing `;` or `}` earlier in the block, or a selector that matches nothing. Re-read the block from the top. |
| Colour change does nothing | Something more specific already sets it — target the element itself (section 5). |
| Rule affects the whole app | The selector isn't anchored. Prefix it with `.character-sheet `. |
| Change disappears when the window is narrow | The app has its own phone/tablet rules (e.g. the card grid drops to 1 column under 640px). Add your own `@media` inside the same breakpoint to override it. |
| Two rules fight | Later rules win at equal specificity; so does the more specific selector. Put the rule you want last, or add `.character-sheet` in front. |
| An animation never plays | The `@keyframes` block is missing, its name doesn't match the `animation` line exactly, or your system's *reduce motion* setting is on and the rule sits inside a `prefers-reduced-motion: no-preference` guard (that guard is working as intended). |
| Gradient text is invisible or shows a fuzzy band | `color: transparent` without `background-clip: text` hides the text, and a leftover `text-shadow` paints behind it. Include both `-webkit-background-clip` and `background-clip`, and set `text-shadow: none`. |
| A gradient border tints the whole card instead of outlining it | In a two-layer border background, the surface layer must come **first** and be opaque — a `transparent` stop in the top layer paints over the card's content. Or use the masked ring, which has no such trap ([recipes](custom-css-recipes.md#gradient-border)). |
| A ring, ornament, or glow is invisible | Something is painting over it. Give the pseudo-element `z-index: 1` while its parent keeps `position: relative`, and check the parent isn't clipping it with `overflow: hidden`. |
| A hover lift makes cards jump while dragging | You animated `transform` on an ability card — the drag library writes its own transform there. Use `box-shadow` / `border-color` instead. |
| A card border is cut off at the bottom, above the Activate button | An activatable ability is a card plus a footer strip. Style `.ability-activation` (the wrapper) and stop the card and footer drawing their own borders (section 6). |
| Sheet looks wrong and you don't know which line did it | Cut the block in half and re-paste each half to find the culprit, or select all and delete to start over. The Customize drawer is always reachable — it's app chrome, not part of the sheet. |

---

**Next:** [custom-css-recipes.md](custom-css-recipes.md) — full themed looks and
one-line tweaks you can paste as-is.
