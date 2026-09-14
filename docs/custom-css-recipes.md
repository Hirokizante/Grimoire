# Custom CSS — Recipes

Copy-paste companions to the [Custom CSS guide](custom-css-guide.md). Paste a
whole theme into the **Customize → Custom CSS** box, then tweak the values;
paste the small snippets to adjust one thing at a time.

**How to use a themed look:** it only sets variables, so it will not fight with
anything else you write — but your palette swatches and font pickers still
apply on top of it. For the closest match to a theme below, leave the palette
at **Default** first, then adjust from there.

---

### Bigger, wider name

```css
.character-sheet .hero-section__name {
  font-size: 2.6rem;
  letter-spacing: 0.04em;
}
```

### Round the portrait into a medallion

```css
.character-sheet .hero-section__portrait {
  border-radius: 50%;
  border: 2px solid var(--accent-violet);
  width: 132px;
  height: 132px;
}
```

### Denser ability cards

```css
.character-sheet .ability-card {
  padding: 0.6rem 0.7rem;
  border-radius: 0;      /* let .ability-activation round the whole block */
}
.character-sheet .ability-card__name { font-size: 0.98rem; }
.character-sheet .ability-grid--cards { column-gap: 0.5rem; }
.character-sheet .ability-grid--cards > * { margin-bottom: 0.5rem; }
```

### Give an ability block a real border

An ability with an **Activate** button is not one box. It renders as a card plus
a footer strip, and the app flattens the card's bottom edge so the two read as
one shape:

```
.ability-activation            ← the box you want to style
├── .ability-card              ← content (bottom border/radius removed by the app)
└── .ability-activation__footer← the Activate strip (top border/radius removed)
```

So a border, radius, or shadow set on `.ability-card` alone stops at the top of
the Activate strip — the outline is cut off exactly there. Style the wrapper
instead, and flatten the two children:

```css
/* The card and its Activate strip stop drawing their own box */
.character-sheet .ability-card,
.character-sheet .ability-activation__footer {
  border: none;
  border-radius: 0;
  background: color-mix(in srgb, var(--bg-surface) 60%, var(--bg-surface-raised));
}

/* The wrapper becomes the one visible card */
.character-sheet .ability-activation {
  gap: 0;
  overflow: hidden;          /* clips the children to the rounded corner */
  border-radius: 8px;
  border: 1px solid var(--accent-violet);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--bg-base) 45%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* A divider between the content and the Activate strip */
.character-sheet .ability-activation__footer {
  border-top: 1px solid var(--border);
}

/* Plain cards (no Activate button) keep their own box */
.character-sheet .ability-card-wrap > .ability-card {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
}
```

The `gap: 0` and `overflow: hidden` lines are what make it look like a single
block: the children meet with no seam, and the corners are clipped to the
wrapper's radius. If a tiny line still shows at the join, set the two children's
`background` to the same value.

### Two columns instead of three

```css
.character-sheet .ability-grid--cards { column-count: 2; }
@media (max-width: 640px) {
  .character-sheet .ability-grid--cards { column-count: 1; }
}
```

### Two-column skill list

```css
.character-sheet .skill-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1rem;
}
@media (max-width: 640px) {
  .character-sheet .skill-list { grid-template-columns: 1fr; }
}
```

### Resource bars as thin strips

```css
.character-sheet .resource-bar {
  gap: 0;
}
.character-sheet .resource-bar__head {
  padding: 0;
}
.character-sheet .seg-bar__track {
  height: 6px;
}
```

(These only respace the bar. To recolour HP / FP / AP / END, use the **Resource
Bars** swatches in the Customize drawer — those colours are set inline by the
app, so CSS can't reach them.)

### Small-caps labels everywhere

```css
.character-sheet .resource-bar__label,
.character-sheet .stat-token__label,
.character-sheet .sheet-section__counter {
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

### Underlined section headings

```css
.character-sheet .sheet-section__heading {
  display: inline-block;
  border-bottom: 2px solid var(--accent-violet);
  padding-bottom: 0.2rem;
}
```

### Folders-style tabs

```css
.character-sheet .tab-bar__tab {
  border-radius: 6px 6px 0 0;
  padding: 0.5rem 1rem;
}
.character-sheet .tab-bar__tab--active {
  background: var(--bg-surface-raised);
  border-color: var(--border);
  border-bottom-color: var(--bg-surface-raised);
}
```

### Hide what you don't use at the table

```css
.character-sheet .sheet-section--pool,
.character-sheet .sheet-section--bio,
.character-sheet .hero-section__version { display: none; }
```

### Reorder sections

Numbered `order` works on any top-level section — smaller numbers come first.
(Skills and Bio share a two-column row at the bottom, so they stay together.)

```css
.character-sheet .sheet-section--skills   { order: 1; }  /* to the top */
.character-sheet .sheet-section--pool     { order: 2; }  /* below it    */
.character-sheet .sheet-section--slotted  { order: 3; }
```

### Soft shadow and roomier sheet

```css
.character-sheet {
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 10px 40px rgb(0 0 0 / 45%);
  padding: 1.75rem;
}
```

### Fade sections in

```css
@media (prefers-reduced-motion: no-preference) {
  .character-sheet .sheet-section { animation: sheet-in 0.35s ease both; }
  @keyframes sheet-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
}
```

### Clean printout

```css
@media print {
  .character-sheet .tab-bar,
  .character-sheet .hero-section__actions,
  .character-sheet .ability-card__actions,
  .character-sheet .resource-bar__btn { display: none; }
  .character-sheet { border: none; box-shadow: none; }
}
```

### Page canvas to match your sheet

```css
.sheet-page__bg-color { background: #0b0a18 !important; }
```

---

## Fancy text in your descriptions

Every Markdown text field on the sheet — ability **description**, **overcharge**,
**flavor**, custom text sections, innate description, bio, NPC descriptions —
accepts inline HTML. So you can invent your own classes in Custom CSS and tag
words with them:

```html
Deals <span class="text-tag">fire</span> damage and
<span class="text-glow">ignores armour</span>.
<span class="text-faded">Once per rest.</span>
```

### Paste-ready text kit

Everything below is one vocabulary; drop it into your Custom CSS box and use
whichever parts you like. All the class names are prefixed `text-`/`callout-`
so they can't collide with the app's own classes.

```css
/* ===== Text classes =====
   <span class="text-glow">…</span>
   <span class="text-rule">…</span>
   <span class="text-tag">fire</span>
   <span class="text-danger">…</span>
   <span class="text-success">…</span>
   <span class="text-faded">…</span>
   <span class="text-label">REACTION</span>
   <span class="text-spent">…</span>          (or ~~strikethrough~~)
   <p class="callout callout--danger">…</p> */

.character-sheet .text-glow {
  color: var(--accent-violet-soft);
  text-shadow: 0 0 8px currentColor;
}

.character-sheet .text-rule {
  font-family: var(--sheet-heading-font, inherit);
  font-size: 1.05em;
  letter-spacing: 0.03em;
  color: var(--accent-violet-soft);
  border-bottom: 1px solid var(--border-soft);
}

.character-sheet .text-tag {
  display: inline-block;
  border: 1px solid var(--accent-violet);
  border-radius: 999px;
  padding: 0 0.45rem;
  font-size: 0.8em;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.character-sheet .text-danger  { color: var(--danger); font-weight: 600; }
.character-sheet .text-success { color: var(--color-success); }

.character-sheet .text-faded {
  color: var(--text-muted);
  font-style: italic;
}

.character-sheet .text-label {
  font-family: var(--sheet-label-font, inherit);
  font-size: 0.75em;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.character-sheet .text-spent { opacity: 0.5; }

.character-sheet .callout {
  margin: 0.6em 0;
  padding: 0.45em 0.7em;
  border-radius: 6px;
  background: var(--bg-surface-raised);
  border-left: 3px solid var(--accent-violet);
}
.character-sheet .callout--danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border-left-color: var(--danger);
}
.character-sheet .callout--success {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  border-left-color: var(--color-success);
}
```

**A ready-made description using it:**

```markdown
<span class="text-label">Action · 2 AP</span>

Rake the ground with a **cone of flame**.

Deals <span class="text-tag">fire</span> damage to everything in the area.
<span class="text-danger">Structures take double.</span>

<p class="callout callout--danger">Ignites flammable terrain for 3 rounds.</p>

<span class="text-faded">Once per scene.</span>
```

### Style the text without tagging it

Scoped selectors recolour a whole field, so a consistent look needs no HTML at
all:

```css
.character-sheet .profile__text            { font-size: 1.02rem; line-height: 1.65; }
.character-sheet .ability-card__description { font-size: 0.92rem; }
.character-sheet .ability-card__flavor {
  color: var(--text-secondary);
  font-style: italic;
  border-left: 2px solid var(--border-soft);
  padding-left: 0.6rem;
}
```

### Highlight the key line in every ability

Rather than tagging each card by hand, emphasise the first paragraph of every
description — the one line players actually read mid-combat:

```css
.character-sheet .ability-card__description > p:first-child {
  font-weight: 600;
  color: var(--text-primary);
}
```

### Illuminated opening line

A drop cap for the first paragraph of a bio or custom text section:

```css
.character-sheet .profile__text > p:first-child::first-letter {
  float: left;
  font-family: var(--sheet-heading-font, inherit);
  font-size: 2.6em;
  line-height: 0.85;
  padding: 0.05em 0.12em 0 0;
  color: var(--accent-violet-soft);
}
```

### On using classes in text

- **Keep the HTML on one line**, with blank lines around block tags like
  `<p class="callout">`, or Markdown may wrap them in an extra paragraph.
- **A class styles only what you wrap**, and the same class can be reused in
  every ability on the sheet.
- **These classes travel with the text.** Copy a description to another
  character and you must paste the class definitions into that sheet's Custom
  CSS box too.
- **Prefer a few.** One tag style, one callout style, and a faded tone is
  usually enough to make a sheet read beautifully.
- **Dice and `[Status]` references still work inside your tags** — `2d6` in a
  `.text-glow` span stays clickable.

---

## Advanced styling

Everything here is optional polish. Mix two or three — a gradient name, one
ambient animation, a hover response — and the sheet feels crafted rather than
decorated.

### Gradient text

Paint text with a gradient instead of a flat colour: the trick is
`background-clip: text` plus a transparent colour, so the background shows
through the letterforms.

```css
/* Just the character's name */
.character-sheet .hero-section__name {
  background-image: linear-gradient(
    100deg,
    var(--accent-violet-soft),
    var(--accent-blush) 45%,
    var(--accent-violet) 90%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;   /* a shadow would paint behind the invisible text */
}

/* Or every section heading */
.character-sheet .sheet-section__heading {
  background-image: linear-gradient(
    90deg,
    var(--accent-violet-soft),
    var(--accent-violet) 60%,
    var(--accent-blush)
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

Keep `--accent-violet-soft` as the first stop: it stays the most readable part
of the gradient, so the start of every heading still reads at a glance.

### Gradient text that shimmers

The same treatment, animated. A background wider than the text (`200%`) gives
the gradient room to travel:

```css
.character-sheet .hero-section__name {
  background-image: linear-gradient(
    100deg,
    var(--accent-violet-soft) 0%,
    var(--accent-blush) 25%,
    var(--accent-violet-soft) 50%,
    var(--accent-blush) 75%,
    var(--accent-violet-soft) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
}

@media (prefers-reduced-motion: no-preference) {
  .character-sheet .hero-section__name {
    animation: name-shimmer 8s linear infinite;
  }
  @keyframes name-shimmer {
    to { background-position: 200% center; }
  }
}
```

Eight seconds is deliberate — slow enough to read as a sheen rather than a
distraction. Two or three seconds looks like a loading spinner.

### Gradient border

`border-image` can't follow a `border-radius`, so a gradient border needs one of
two tricks. The reliable one is a **ring**: a pseudo-element that covers the
element, then gets its middle masked out so only the edge is painted.

```css
.character-sheet .hero-section {
  position: relative;
}

.character-sheet .hero-section::after {
  content: '';
  position: absolute;
  inset: -2px;                 /* how far outside the card the ring reaches */
  border-radius: inherit;      /* follow the card's corners */
  z-index: 1;                  /* stays above the card, even with other layers */
  padding: 2px;                /* how thick the ring is */
  background: linear-gradient(
    135deg,
    var(--accent-violet),
    var(--accent-blush)
  );
  /* Keep only the padding band: mask away everything the content box covers */
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;

  pointer-events: none;        /* never swallow clicks on the card */
}
```

Three things do the work: `padding` sets the thickness, `inset` sets how far the
ring sits outside the card, and the mask pair keeps only the padding band. Keep
`inset` and `padding` equal and the ring occupies exactly a `padding`-wide band
outside the card — a 2px "border" that shifts nothing, because the ring lives
outside the layout box. For a border *inside* the card's edge, use `inset: 0`
with the same padding.

Because it's a pseudo-element, the same block works on any card-shaped part of
the sheet — `.sheet-section`, `.hero-section`, `.ability-activation`,
`.ability-card-wrap`, `.stat-token`, `.tab-bar__tab`:

```css
.character-sheet .ability-activation,
.character-sheet .ability-card-wrap {
  position: relative;
  border: none;
  border-radius: 8px;
  overflow: visible;           /* the ring is drawn outside — don't clip it */
  background: var(--bg-surface-raised);
}
.character-sheet .ability-card,
.character-sheet .ability-activation__footer {
  border: none;
  border-radius: 0;
  background: transparent;
}
.character-sheet .ability-activation::after,
.character-sheet .ability-card-wrap::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  z-index: 1;
  padding: 1px;
  background: conic-gradient(
    from 210deg,
    var(--accent-violet),
    var(--accent-blush),
    var(--accent-violet)
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
```

**If you'd rather use a real border,** paint it with a transparent border and
two background layers: the surface filling the padding box, the gradient showing
through the border box. Layer order matters — the surface must be listed
**first** so it paints on top, leaving only the border band showing the gradient.

```css
.character-sheet .hero-section {
  border: 2px solid transparent;
  background-image:
    linear-gradient(var(--bg-surface), var(--bg-surface)),   /* surface, on top */
    linear-gradient(135deg, var(--accent-violet), var(--accent-blush));
  background-origin: padding-box, border-box;
  background-clip: padding-box, border-box;
}
```

Two things to know about this version. The border adds its own width to the
element, so the card grows by twice the border (a 2px border makes it 4px wider
and 4px taller) — the ring above shifts nothing. And the first (surface) layer
must be **opaque**: a layer with `transparent` stops paints straight over the
card's content area, which is how the earlier version of this recipe ended up
tinting the whole hero section instead of outlining it.

### Corner ornaments

Decorative brackets on every section, drawn with two pseudo-elements and
`border-image`-free corner tricks:

```css
.character-sheet .sheet-section {
  position: relative;
}

.character-sheet .sheet-section::before,
.character-sheet .sheet-section::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
  opacity: 0.8;
}
.character-sheet .sheet-section::before {
  top: 5px;
  left: 5px;
  border-top: 1px solid var(--accent-violet);
  border-left: 1px solid var(--accent-violet);
}
.character-sheet .sheet-section::after {
  bottom: 5px;
  right: 5px;
  border-bottom: 1px solid var(--accent-violet);
  border-right: 1px solid var(--accent-violet);
}
```

### Ambient glow behind the sheet

A soft radial bloom that makes the card feel lit from within. It sits behind the
sheet card, so it can't cover content:

```css
.character-sheet {
  position: relative;
}

.character-sheet::before {
  content: '';
  position: absolute;
  inset: -40px -20px auto -20px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 50% 0%,
    color-mix(in srgb, var(--accent-violet) 22%, transparent),
    transparent 70%
  );
  filter: blur(24px);
  opacity: 0.75;
  pointer-events: none;
  z-index: -1;
}
```

### Let the page background through

Instead of an opaque card, make the sheet translucent so your background image
reads through it — cheaper and crisper than a backdrop blur:

```css
.character-sheet {
  background: color-mix(in srgb, var(--sheet-bg) 72%, transparent);
  border-color: color-mix(in srgb, var(--border) 60%, transparent);
}
```

Use the Customize drawer's **darken** slider to keep text contrast comfortable.

### Entrance animations

Sections rise into place as the sheet loads. Staggering the delay makes them
cascade instead of arriving as a block:

```css
@media (prefers-reduced-motion: no-preference) {
  .character-sheet .sheet-section,
  .character-sheet .hero-section {
    animation: section-in 0.45s cubic-bezier(0.2, 0.8, 0.3, 1) both;
  }

  .character-sheet .sheet-section:nth-of-type(2) { animation-delay: 0.05s; }
  .character-sheet .sheet-section:nth-of-type(3) { animation-delay: 0.1s; }
  .character-sheet .sheet-section:nth-of-type(4) { animation-delay: 0.15s; }
  .character-sheet .sheet-section:nth-of-type(5) { animation-delay: 0.2s; }

  @keyframes section-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
}
```

### Pulsing glow on an ability card

A slow breathing glow, for the ability you always forget to use. Target
`.ability-activation` (the whole block) rather than `.ability-card`, or the glow
stops where the Activate strip begins — see **Give an ability block a real
border** above.

The rule animates the *wrapper's* border, so the card and its Activate strip
must stop drawing their own:

```css
/* One box per ability block, card + Activate strip inside it */
.character-sheet .ability-activation,
.character-sheet .ability-card-wrap {
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  overflow: hidden;
}
.character-sheet .ability-card,
.character-sheet .ability-activation__footer {
  border: none;
  border-radius: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .character-sheet .ability-activation,
  .character-sheet .ability-card-wrap {
    animation: card-glow 3.2s ease-in-out infinite;
  }
  @keyframes card-glow {
    0%, 100% {
      border-color: var(--border-soft);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-violet) 0%, transparent);
    }
    50% {
      border-color: color-mix(in srgb, var(--accent-violet) 55%, transparent);
      box-shadow: 0 0 14px 0 color-mix(in srgb, var(--accent-violet) 28%, transparent);
    }
  }
}
```

Animate `box-shadow` and `border-color` — **not** `transform` — on ability cards.
The drag-and-drop library writes a transform straight onto each card's wrapper
while you reorder, and a CSS transform animation would be ignored (or fight it).

### Shimmer across resource bars

A light sweep over the filled segments of HP / FP / AP / END:

```css
.character-sheet .seg-bar__segment--filled {
  position: relative;
  overflow: hidden;
}

@media (prefers-reduced-motion: no-preference) {
  .character-sheet .seg-bar__segment--filled::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      transparent 20%,
      rgb(255 255 255 / 35%) 50%,
      transparent 80%
    );
    animation: bar-shimmer 3.6s ease-in-out infinite;
  }
  @keyframes bar-shimmer {
    from { transform: translateX(-120%); }
    to   { transform: translateX(220%); }
  }
}
```

### Hover response without moving anything

Cards glow and their border warms on hover — no `transform`, so dragging stays
perfectly stable. Like the glow above, the hover effect belongs on the whole
ability block, not on the card inside it:

```css
/* One box per block — see "Give an ability block a real border" */
.character-sheet .ability-activation,
.character-sheet .ability-card-wrap {
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.character-sheet .ability-card,
.character-sheet .ability-activation__footer {
  border: none;
  border-radius: 0;
}

.character-sheet .ability-activation:hover,
.character-sheet .ability-card-wrap:hover {
  border-color: color-mix(in srgb, var(--accent-violet) 60%, var(--border-soft));
  box-shadow: 0 6px 20px color-mix(in srgb, var(--bg-base) 55%, transparent);
}
```

If you'd rather leave plain cards alone, apply the same pair of rules to
`.ability-activation` only.

### Animated link underline

Links in your bio and custom text sections grow an underline from the left:

```css
.character-sheet .md a {
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 1px;
  transition: background-size 0.25s ease;
}
.character-sheet .md a:hover {
  background-size: 100% 1px;
}
```

### Sticky section headings

Long sections — Skills, the Ability Pool — keep their heading pinned while you
scroll them, so you always know what you're reading:

```css
.character-sheet .sheet-section__heading {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--bg-surface);
  padding: 0.35rem 0.2rem;
  border-radius: 6px;
}

/* In flat mode there is no section surface to mask against */
.character-sheet--flat .sheet-section__heading {
  background: color-mix(in srgb, var(--sheet-bg) 88%, transparent);
}
```

### Typewriter reveal for a tagline

Text that types itself in. Use it on a short line — a motto under the name, or
the first line of a bio:

```css
@media (prefers-reduced-motion: no-preference) {
  .character-sheet .text-type {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    border-right: 2px solid var(--accent-violet);
    animation:
      typing 2.4s steps(28, end) 0.3s both,
      caret 0.9s step-end infinite;
  }
  @keyframes typing {
    from { width: 0; }
    to   { width: 100%; }
  }
  @keyframes caret {
    50% { border-color: transparent; }
  }
}
```

Pair it with one of your own classes from the text kit:

```html
<span class="text-label text-type">Once more into the dark</span>
```

Tune `steps(28)` to roughly the number of characters in the line so the reveal
lands evenly.

### Slow hue drift

For a living, breathing accent, rotate the sheet's hue very slowly. Keep the
range small (`-12deg` to `8deg`) — this affects everything drawn with the
accent colours:

```css
@media (prefers-reduced-motion: no-preference) {
  .character-sheet {
    animation: hue-breathe 24s ease-in-out infinite;
  }
  @keyframes hue-breathe {
    0%, 100% { filter: hue-rotate(-12deg); }
    50%      { filter: hue-rotate(8deg); }
  }
}
```

### What CSS can't do here

Worth knowing so you don't chase it:

- **No conditional styling.** CSS can't see that your HP is at 3 and react.
  (It *can* react to hover, focus, and `:has()`, which is often enough.)
- **No new content beyond `content:` in pseudo-elements** — decorative glyphs
  and rules are possible, real markup is not.
- **No animation of the stat token stripes or bar fill colours** — those are
  set inline by the app; you can animate the elements around them instead.
- **`filter` and `backdrop-filter` cost real performance** on large areas. One
  blurred pseudo-element is fine; blurring every card will stutter on a laptop
  at the table.

---

If you hit something that won't change, the [guide's troubleshooting
table](custom-css-guide.md#10-fixing-things) walks through the usual causes.
