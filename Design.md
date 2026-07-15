# Design

## Product Vision
- Grimoire's primary function is to help users to create and manage character sheets for the homebrew TTRPG game "Divergence" using an aesthetically pleasing and intuitive UI. 
- Players will build characters by allocating stats, creating abilities, and making write-ups for their backstories. 
- During live sessions, players will be able to track their character's stats and roll dice using inline dice notation.
- Players will have full control over how their sheet looks, including customizing color scheme, fonts, and layout. 

## Platform and Tech Stack
- Grimoire is a web app built using [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/).
- Grimoire runs locally, and is perfectly functional offline. 
- Everything is stored on device using IndexedDB (with localStorage as a fallback). No data is stored in a remote database or server.

## Divergence Ruleset

### Core Philosophy
- Divergence is a very DIY system. There is no compendium with spells or items. The players are expected for creating their characters' abilities and equipment from scratch, using the system as a framework. Thus, most of of a character sheet will consist of structured text fields for describing a character's abilities and equipment, providing an opportunity for the player to exercise their creativity and game design skills. Do not place any pre-written content in these fields or put unnecessary constraints. The primary goal is to support player freedom.
- Equipment has no dedicated section on the sheet. Equipment is flavored through Slotted Abilities and has no functional distinction from them.

### Brief Gameplay Overview
- For the purposes of Grimoire, the most important thing to note is the four types rolls most often made in Divergence: the skill check, attack, save, and effectiveness rolls. 
- Divergence is a D20 system. Everything—save for effectiveness rolls—is D20 + any relevant modifiers. 
  - Example: If you're rolling to hit, it's D20 + MAR/POW. If you want to lie to someone, it's D20 + Deceive. 
- Effectiveness rolls, on the other hand, are always D6 + any relevant modifiers. Effectiveness rolls refer to things like damage and healing, and are most often associated with Abilities.

### The Character Sheet
- Below are the different components of the character sheet. They must all be displayed clearly and grouped into sensible categories for easier navigation.

#### Character Name
- The character's name. This is displayed prominently at the top of the sheet.

#### Milestones
- Milestones are used to track a character's growth and progress. They are analogous to levels, but are not tied to an XP value. The GM decides when a player receives a Milestone.
- Upon reaching a Milestone, a player must increase one of their character's Attributes by 1, and increase one of their character's Skills by 2. 
- Every two Milestones, they must choose between giving their character an additional Ability Slot or raise their maximum Fate Points by 1. 
- **Milestone Bonus:** A Milestone Bonus is a bonus added to all saves and attack rolls a character makes, and determines their Save DC. A character's Milestone Bonus is equal to Milestones / 2.

#### Attributes
- Attributes determine a character's physical and mental capabilities. They include:
  - Martial (MAR): Physical combat capabilities, primarily fighting prowess and knowledge of martial arts.
  - Power (POW): Non-physical combat capabilties, including but not limited to magic or some kind of sci-fi technology.
  - Agility (AGI): Reaction and movement speed.
  - Vitality (VIT): Health and resilience.
  - Grit (GRT): Mental fortitude.
- Attributes start at a standard array of 3, 2, 1, 0, and -1. The player decides what starting value they want for each Attribute.
- Attributes can be increased via Milestones, up to a maximum of 8.
- For every point a character has in an Attribute, they gain a +1 modifier to all rolls made with that attribute.

#### Skills
- Skills represent a character's prowess in a range of different tasks outside of combat.
- At the beginning of character creation, a player chooses 3 of their character's Skills to have at +2. All other Skills start at +0. No stacking is allowed during character creation — each of the 3 chosen skills must be distinct.
- Upon every Milestone, a character gains +2 to a Skill of the player's choosing. Milestone skill increases can be stacked on the same Skill, up to a maximum of +6 per Skill.
- The list of Skills include:
  - Move Quickly
  - Use Force
  - Spot Something
  - Sneak
  - Handle Precisely
  - Build Rapport
  - Read Someone
  - Pull Favors
  - Deceive
  - Provoke
  - Analyze or Recall
  - Make or Fix
  - Operate a Vehicle
  - Sabotage
  - Heal

#### Hit Points and Mortal Wounds
- Hit Points (HP) represent a character's health. Once a character's HP reaches 0, they incur a Mortal Wound and their HP is reset to maximum.
- A character can take up to two Mortal Wounds, and if a character takes damage greater than their current HP and can take a Mortal Wound, the rest of that damage spills over to the HP they regain.
- If a character takes enough damage, they can incur multiple Mortal Wounds at once.
- Characters are returned to max HP at the end of an encounter. Mortal Wounds are cleared when a character Rests.
- HP is calculated as follows: 20 + (VIT * 5)
- The minimum max HP is 20.
- When taking a Mortal Wound, the player must roll a D20 to determine which one they get from the list below:
  - (1) Grave Danger: Character is knocked out, immediately starting off with 1 failure.
  - (2) Muscle Rupture: Automatically take 1d6 physical damage for performing MAR related actions.
  - (3) Entropic Discharge: Automatically take 1d6 magic damage for performing POW related actions.
  - (4) Anterior Cruciate Ligament: Automatically take 1d6 physical damage for performing AGI related actions.
  - (5) Lymphedema: Automatically take 1d6 physical damage for performing VIT related actions.
  - (6) Severe Headache: Automatically take 1d6 physical damage for performing GRT related actions.
  - (7) Hemorrhage: Take 1d6 physical damage at the end of your turn.
  - (8) Damaged Throat: Unable to regain END passively. Recovery only restores half your END.
  - (9) Exhaustion: All actions that cost END costs 1 more than usual.
  - (10) Asthenia: -1 Max AP.
  - (11) Major Memory Loss: Maximum Ability Slots are halved, rounded up.
  - (12) Sprain: MAR is halved, rounded down.
  - (13) Negentropy: POW is halved, rounded down.
  - (14) Fracture: AGI stat is halved, rounded down.
  - (15) Damaged Liver: VIT is halved, rounded down.
  - (16) Concussion: GRT is halved, rounded down.
  - (17) Black Eye: Range of all attacks are halved, rounded up.
  - (18) Circulatory Dysfunction: Healing received is halved, rounded down.
  - (19) Damaged Lung: -3 Max END.
  - (20) Worn Out: -1 AP for the first round of the conflict, no further effects.

##### Temporary HP
- Temporary HP is a form of HP separate from a character's regular HP. It is usually gained through Abilities.
- When taking damage, Temporary HP is reduced before a character's normal HP.
- A character can only have one instance of Temporary HP at a time. If a new source grants Temporary HP while one is already active, the higher value takes precedence (they do not stack).
- Temporary HP should be tracked separately from regular HP on the sheet.

##### Death Saves
- When a character is Knocked Out (0 HP and 2 Mortal Wounds), they must make Death Saves on their turn.
- A Death Save is a D20 roll against DC 10. It cannot be modified in any way.
- Rolling 20 or above counts as 2 successes. Rolling 1 or below counts as 2 failures.
- Upon reaching 3 successes, the character regains consciousness at 1 HP.
- Upon reaching 3 failures, the character dies.
- The app should track successes and failures (up to 3 each) for knocked-out characters.

#### Evasion
- Evasion (EVA) is a character's ability to avoid being hit by attacks.
- EVA is calculated as follows: 10 + AGI

#### Movement
- Movement determines how many spaces a character can move on their turn.
- Movement is calculated as follows: 5 + floor(AGI / 2)

#### Armor
- Armor is a character's natural resistance to damage from attacks.
- For every point of armor, a character gains 1d6 damage reduction.
- Armor is calculated as follows: floor(VIT / 2)

#### Save DC
- A character's Save DC determines what other characters must roll against when attempting to resist or avoid the effects of their Abilities.
- Save DC is calculated as follows: 10 + Milestone Bonus

#### Fate Points
- Fate Points (FP) can be used by characters to alter the outcome of dice rolls or change narrative details to their advantage.
- All characters start with a maximum of 3 FP, with the option to increase the cap every two Milestones.
- FP is regained whenever a character Rests.

#### Action Points
- Action Points (AP) determine how many actions a character can take on their turn.
- All characters have a maximum of 3 AP, and always start their turn with 3 AP.
- Unused AP is converted 1:1 into END at the end of a character's turn. 

#### Endurance and Endurance Recovery
- Endurance (END) is a resource that characters spend to use Abilities.
- All characters have a maximum of 10 END, and start all encounters with 10 END.
- Characters can regain END by Recovering. END is also naturally regenerated at the end of a character's turn.
- The amount of END regenerated at the end of each turn is equal to a character's END Recovery, which is calculated as follows: max(1, 1 + floor(GRT / 2))

#### Recover
- Recover is a standard combat action that costs 3 AP.
- When a character Recovers, they immediately regain all Endurance. This action must be taken at the start of the character's turn, and no other actions can be taken thereafter.
- Using Recover also grants the option to clear 1 status effect the character is currently afflicted with.

#### Abilities
- Abilities are a character's primary means of dealing damage and otherwise affecting the battlefield. They are what make characters unique and powerful.

#### Ability Block
- This is the most important component of a character sheet, as it is how an Ability—be it a Core Ability or a Slotted Ability—is defined. An Ability Block consists of the following components:
  - Name: The name of the Ability.
  - Traits: Keywords or tags that determine the Ability's type, range, area of effect and other special properties.
  - Cost: The amount of END, AP, and/or FP required to use the Ability.
  - Damage: How much damage the Ability deals.
  - Description: A detailed description of what the Ability does.
  - Overcharge: Additional effects that can be activated if a player spends one or more FP.
  - Flavor Text: The in-game lore behind the Ability.
- A sheet will have multiple Ability Blocks under different sections: Core Ability, Slotted Abilities, and Ability Pool.
- Some Abilities are so simple that the Description field is unnecessary.
- Example of an Ability Block:
  - Name: Psychic Spear
  - Traits: Action, Range (20), Status (Quick), Psychic
  - Cost: 2 AP, 4 END
  - Damage: 2d6+POW
  - Description: Make a ranged attack roll against a target within range. On a hit, the target must make a GRT save or believe they have taken a Mortal Wound. They must make a Mortal Wound roll, and suffer from its effects until the end of their next turn.
  - Flavor Text: By activating certain regions of the brain, one can be made to believe they have suffered grievous injuries even if their body is intact.

#### Traits
- Traits are keywords or tags that determine the Ability's type, range, area of effect and other special properties.
- They are important for communicating important information about an Ability at a glance.
- Below is a non-exhaustive list of traits an Ability can have:
  - Activation (Required): Can be either Action (used on the character's turn), Passive (always active), or Reaction (triggers on a condition, even when it's not the character's turn).
  - Range (Required): Can be Melee, Self, or Range (X), where X is the number of tiles the Ability can reach.
  - Area of Effect: Can be Line (X), Blast (X), Cone (X), or Aura (X), where X is the size of the area.
  - Type: Can be Physical, Magic, or Psychic
  - Status: Can be Status (X), where X can be Quick, Persistent, Countdown, Conditional, or Permanent.
  - Special Property: Any number of additional properties not mentioned previously.
- Alongside the Traits already defined, players are free to add custom Traits to their character's Abilities.

#### Core Ability
- A character's Core Ability is the heart of the character sheet. It defines their playstyle, sets them apart from other characters both narratively and mechanically, and often interacts with their Slotted Abilities.
- The Core Ability section starts with a narrative description of a character's powers and/or combat skills.
- This is optionally followed by an Ability Block, describing a foundational Ability that the character always has access to.
- This is also where a character's Basic Attack (BA) is defined. A BA is a character's simplest way of dealing damage, and can be performed at next to no cost. BAs are presented as an Ability Block with certain fixed properties:
  - Name: Basic Attack
  - Traits: Action, Melee/Range (8), Physical/Magic/Psychic, Basic
  - Cost: 1 AP
  - Damage: 1d6 + POW/MAR
  - Flavor Text: (Optional in-lore description)
- Lastly, the Core Ability defines a character's Fatebreaker—their ultimate attack that they can only use at the cost of FP. A Fatebreaker is presented as an Ability Block.

#### Slotted Abilities
- Slotted Abilities are Abilities that a character has chosen to use for an encounter. They represent the different ways a character can use their unique powers to their advantage in combat.
- A character's Ability Slots determine how many Slotted Abilities they can have active at any given time. All characters start with 3 Ability Slots, and have the option of gaining an additional slot every 2 Milestones.
- Active Slotted Abilities are displayed in a different section from inactive ones.
- All Slotted Abilities are presented as Ability Blocks.

##### Minor Abilities
- A Slotted Ability can be given the Minor trait. Minor Abilities are relatively weaker Abilities that do not take up an entire Ability Slot by themselves.
- One Ability Slot can hold either one regular Slotted Ability, or two Minor Abilities.
- Minor Abilities consume significantly fewer resources than regular Slotted Abilities.
- The Minor trait should be a toggle or flag on the Ability Block, not a text trait. The slot-counting logic must account for Minor Abilities taking half a slot each.

#### Ability Pool
- All inactive Slotted Abilities go into the Ability Pool.
- The Ability Pool is where the player browses through their available Abilities before an encounter to decide which ones to use.
- There is no limit to the number of Slotted Abilities that can be in the Ability Pool.

#### Character Portrait
- An image of the character.
- Portraits are uploaded from the user's device and stored as base64 data URLs within the character sheet data. URL input is not supported, as the app must remain fully functional offline.

#### Physical Description
- A short description of the character's physical appearance.

#### Backstory
- The character's backstory, including their origins and any significant events that have shaped their character.

## Features and Scope
- **Calculated Fields**: The system automatically calculates and displays fields such as HP, Evasion, Movement, Armor, Save DC, Milestone Bonus, and END Recovery. These fields are read-only and update automatically when their dependent attributes change.
- **Rich Text Editor in Ability Blocks**: Players can use a rich text editor to format and style the text in their Ability Blocks.
- **Multi Character Support**: Players can easily create and manage multiple character sheets and easily choose between them, whether to edit or use them for encounters.
- **Sheet Export**: Players can export their character sheets as .json files, which are automatically versioned and saved with a unique filename.
- **Automatic Sheet Versioning**: When a character sheet is saved and exported, the system automatically assigns a version number to the sheet, appending it to the filename. Players can also view the current version of their character sheet, and view previous versions.
- **Version Diffing**: Players can view a diff between two versions of a character sheet to see what changed (e.g., between v1.2 and v1.3). This is a future feature, not required for MVP.
- **Autosave**: The system automatically saves the player's character sheet whenever they make a change, so they don't need to manually save. However, the player can still manually save if they wish.
- **Drag-and-Drop Ability Blocks**: Ability Blocks can be dragged and dropped to and from the Ability Pool, and can be easily reordered in the same way. Minor Abilities occupy half a slot and must be visually distinguished from regular abilities.
- **Easy Ability Blocks**: New blank Ability Blocks can be added to the relevant sections with a click of a button.
- **Ability Block Templates**: New Ability Blocks can optionally be created from templates (e.g., basic melee attack, ranged attack, buff, debuff) that pre-fill common traits and structure. This helps new players without constraining creativity. Templates are suggestions, not constraints — all fields remain fully editable after creation.
- **Automatic HP Tracking**: The player can input an amount of damage their character just took (such as by clicking their health bar), and the system automatically updates their HP, taking into account Armor (1d6 reduction per Armor point) and Resistance (halves incoming damage). Temporary HP is reduced before regular HP.
- **Automatic Resource Tracking**: The player can select what Abilities they want to perform, and the costs are automatically deducted from their AP, END, and FP. Ability costs that reference HP are also tracked.
- **Temporary HP Tracking**: The sheet displays Temporary HP separately from regular HP. The player can add or remove Temporary HP. When damage is taken, Temporary HP is reduced first.
- **Death Save Tracking**: When a character is Knocked Out, the sheet displays a Death Save tracker showing successes and failures (up to 3 each). The player can tap to roll or manually record results. Rolling 20+ counts as 2 successes, rolling 1 counts as 2 failures.
- **Recover Action**: The player can use the Recover action (3 AP) to regain all END and optionally clear 1 status effect. This is the only standard combat action implemented in Grimoire.
- **Sheet Customization**: Players can aesthetically overhaul their sheets with full custom color pickers and font selectors for individual elements (background, section headings, labels, body text, helper text). No prebuilt themes are provided — all customization is user-driven.
- **Guided Level-Ups**: Whenever the player increases their character's Milestones, the system prompts them to select which Attributes/Skills to raise. On every 2 Milestones, they should be prompted to choose between increasing Ability Slots or max FP.
- **Inline Dice Rolls**: The system automatically detects and highlights dice notation in any text field on the sheet. When a player clicks dice notation, the system rolls the dice and displays the result.
  - **Recognized patterns**: Standard dice notation such as `1d6`, `2d6+POW`, `d20+3`, `1d6+POW/MAR`. Dice notation may appear in Damage fields, Description fields, or any free-text field on the sheet.
  - **Variable substitution**: Character stat references (MAR, POW, AGI, VIT, GRT, and skill names) are automatically substituted with the character's actual values when computing the roll result.
  - **Roll breakdown**: The dice roller displays a full breakdown of the result (e.g., `2d6+POW → 4 + 3 + 4 = 11`), showing each die result, each substituted variable, and the final total.

### View Modes
- The sheet has two modes: **Edit Mode** and **View Mode**.
- In **Edit Mode**, all fields are editable. The player can change Attributes, Skills, Ability descriptions, backstory, portrait, etc.
- In **View Mode**, all fields are read-only. The player can interact with live-session features: tracking HP, END, AP, FP, rolling dice, using the Recover action, tracking Death Saves, and activating Abilities (which deducts resource costs). This mode prevents accidental edits to character data during play.
- The layout remains identical across both modes. Only field editability changes.

### In Scope for Live Play
- ✅ HP tracking (input damage, auto-calculate with Armor and Resistance)
- ✅ Temporary HP tracking
- ✅ END / AP / FP tracking (spend resources, auto-deduct on ability activation)
- ✅ Dice rolling (inline notation)
- ✅ Ability activation (select ability → deduct costs)
- ✅ Recover action (regain all END, clear 1 status)
- ✅ Death Save tracking (successes/failures)
- ✅ Mortal Wound rolling (d20 on the Mortal Wounds table)

### Out of Scope
- **Live collaboration and any other form of cloud integration**: Reiterating that everything should run locally and remain fully functional offline.
- **Fari Import**: Importing character sheets from Fari (the previous solution) is not supported.
- **Combat Tracker View**: No 'combat mode' with initiative, turn order, battle maps, or NPC/enemy tracking is included. The focus is on character sheet management and per-character resource tracking.
- **Inventory / Equipment System**: Equipment has no dedicated section. It is flavored through Slotted Abilities.
- ❌ Initiative / turn order
- ❌ Battle map / positioning
- ❌ NPC / enemy tracking
- ❌ Round counter

## UI/UX
- The character sheet should be easy to navigate and understand, with clear sections and labeled fields. Use Lancer's COMP/CON for reference.
- Prioritize using interactive segmented bars over plain number displays, especially for things like HP.
- Consider dividing the character sheet into columns (whether parts of it or the whole thing) for readability.
- Grimoire should feel like a lovingly built story machine: visual, intimate, a little magical, and still practical enough for power users who live in settings panels. 
- The default surface is dark because users spend a lot of time workshopping Abilities and coming up with character lore, where bright white UI would fight the scene. 
- Light mode exists for comfort and accessibility, but the brand signal lives in blush, violet, soft glow, character art, and compact tools.
- The system rejects sterile SaaS dashboards, generic Discord-like surfaces, and developer-only control panels. Even dense controls should feel like part of an immersive engine, not a spreadsheet of toggles.
- Don't build developer-only control panels that assume technical confidence. Advanced settings still need clear labels, forgiving defaults, and helpful validation.
- Don't use colored side-stripe borders, decorative gradient text, nested cards, or glassmorphism as the default layout answer.

## Reference Character: Nacht

The following character ("Nacht") from the Fari export serves as a validation reference. All calculated fields should produce the expected values when this character's attributes are entered.

### Attributes
| Attribute | Value |
|-----------|-------|
| Martial (MAR) | -1 |
| Power (POW) | 4 |
| Agility (AGI) | 1 |
| Vitality (VIT) | 0 |
| Grit (GRT) | 5 |

### Milestones
- Milestones: 4

### Calculated Fields (Expected)
| Field | Expected Value | Formula |
|-------|---------------|---------|
| Milestone Bonus | 2 | floor(4 / 2) |
| HP | 20 | 20 + (VIT 0 × 5) |
| Evasion | 11 | 10 + AGI 1 |
| Armor | 0 | floor(VIT 0 / 2) |
| Movement | 5 | 5 + floor(AGI 1 / 2) |
| Save DC | 12 | 10 + Milestone Bonus 2 |
| END Recovery | 3 | max(1, 1 + floor(GRT 5 / 2)) |
| Ability Slots | 5 | 3 base + 2 from Milestone choices (slots chosen at milestones 2 and 4) |
| Max FP | 3 | 3 base (FP cap increase not chosen) |

### Skills
| Skill | Value |
|-------|-------|
| Move Quickly | 0 |
| Use Force | 0 |
| Spot Something | 0 |
| Sneak | 4 |
| Handle Precisely | 2 |
| Build Rapport | 0 |
| Read Someone | 2 |
| Pull Favors | 0 |
| Deceive | 4 |
| Provoke | 2 |
| Analyze or Recall | 0 |
| Make or Fix | 0 |
| Operate a Vehicle | 0 |
| Sabotage | 0 |
| Heal | 0 |

### Skill Allocation Breakdown
- **Character creation** (3 distinct skills at +2, no stacking): Handle Precisely +2, Read Someone +2, Provoke +2
- **Milestone 1**: Sneak +2
- **Milestone 2**: Sneak +4 (stacked)
- **Milestone 3**: Deceive +2
- **Milestone 4**: Deceive +4 (stacked)
- Final totals match the skill table above.
