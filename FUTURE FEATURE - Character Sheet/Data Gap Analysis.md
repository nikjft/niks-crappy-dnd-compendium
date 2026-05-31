# Data Model Gap Analysis: Compendium XML to 5.5e Character Sheet

This document outlines the specific functional gaps between the existing
`compendium.xsd` / XML structure and the data model required to support
the new 5.5e Character Sheet and Calculation Engine, along with
migration and additive update strategies.

## 1. Universal Modifiers

**Current State (XML):** Modifiers are heavily hardcoded into specific
elements.

- `<trait>`, `<item>`, `<feat>`, etc., have rigidly defined `<modifier>`
  tags that often map to specific enums (e.g., `category="bonus"`,
  `type="ac"`).

- Formulas and complex derivations (like `2 * {char.level}`) are not
  natively supported; modifiers are typically static integers.

**Required State (JSON/NoSQL):** A universal, flexible `modifiers` array
must be attachable to *any* entity type.

- **Gap:** The parser must be updated to extract existing `<modifier>`
  tags and transform them into the new JSON structure.

- **Gap:** The new structure requires `target` (e.g., "ac", "hp.max"),
  `type` ("add", "set", "max", "min", "ignore"), and `value` (which can
  be a string formula).

## 2. Backgrounds and Attribute Bonuses

**Current State (XML):** Attribute bonuses are exclusively tied to the
`<race>` element via the `<trait>` structure.

- Backgrounds (`<background>`) only provide skills, tools, and
  languages.

**Required State (2024/5.5e Rules):** Attribute bonuses (+2/+1 or
+1/+1/+1) are tied to Backgrounds.

- **Gap:** The `<background>` schema needs to support the new
  `modifiers` array specifically targeting `str`, `dex`, `con`, `int`,
  `wis`, and `cha`.

- **Gap:** The character creation UI logic must shift the attribute
  selection step from Species (Race) to Background.

- **Gap:** Legacy 5e XML data (where races have stats) must either be
  migrated or the engine must handle both gracefully.

## 3. Subclass Inheritance & Optional Features

**Current State (XML):** Classes (`<class>`) contain all `<autolevel>`
elements. Subclass features are nested within the main class under
specific `<name>` tags (e.g.,
`<name>Martial Archetype: Champion</name>`).

**Required State:** Subclasses should be distinct entities that inherit
from a parent class, and relationships should be strictly mapped.

- **Gap:** The data model needs a distinct `Subclass` entity type.

- **Gap:** Explicit relationships (`rel`) need to be mapped to
  `autolevel` elements to associate them reliably with their base
  subclass, preventing the need for brittle name-string parsing.

- **Gap:** `autolevel` objects need an `"optional": true` boolean flag
  to support optional class features introduced in Tasha's Cauldron and
  the 2024 rules.

## 4. State Dictionary & Derived Stats

**Current State (XML):** The XML primarily stores static text and
values. Derived stats (like Passive Perception or AC) are calculated by
the client application (Fight Club 5e) using hardcoded logic.

**Required State:** The data model must explicitly recognize a
dictionary of variables that the Calculation Engine can target.

- **Gap:** The schema needs to define standard keys for the engine to
  resolve (e.g., `{str.mod}`, `{prof_bonus}`, `{skill.perception}`).

- **Gap:** The engine must support stateful skill modifiers (`0` for
  none, `0.5` for Half-Proficiency/Jack of All Trades, `1` for
  Proficient, `2` for Expertise).

## 5. "Lists" Architecture Support

**Current State (XML):** Entities like Spells (`<spell>`) or Items
(`<item>`) are standalone definitions in the compendium. Character state
(what is equipped/prepared) is handled entirely outside the compendium
schema by the client app.

**Required State:** The Character Sheet data model requires "Lists" to
hold copies of these entities with added state metadata.

- **Gap:** The character data structure must support arrays (Lists) of
  entities (Spells, Items, Features).

- **Gap:** Every entity within a List requires local state flags:
  `favorite` (boolean), `selected` (boolean), and `active` (boolean).

- **Gap:** The model must support a completely new `Bestiary` list type
  for summons and wild shapes.

- **Gap:** The model must support a completely new `Modifiers` list type
  for arbitrary, user-defined bonuses.

## 6. Counters and Explicit Relationships

**Current State (XML):** Counters already exist in the underlying data
model, but they lack explicit links to the features or items that grant
them. They function, but rely on loose coupling.

**Required State:** Counters and features need to be explicitly
relatable to support seamless UI rendering and logic mapping without
breaking existing functionality.

- **Gap:** The data model needs a relational attribute (e.g., `rel`)
  added to existing `<counter>` tags to firmly associate them with their
  source mechanics (e.g., Second Wind, Wild Shape).

## 7. Recommended Translation Approach (XML to JSON)

To safely map the legacy XML structures into the new dynamic Calculation
Engine without losing data, the ingestion parser should employ the
following strategies:

- **Mapping Legacy Modifiers:** Create a dictionary in the parser that
  maps legacy `<modifier>` attribute combinations to the new explicit
  syntax.

  - *Example:* `<modifier category="bonus" type="ac">1</modifier>`
    translates to `{ "target": "ac", "type": "add", "value": "1" }`.

  - *Example:* `<modifier category="set" type="strength">19</modifier>`
    translates to
    `{ "target": "str.score", "type": "set", "value": "19" }`.

- **Deriving Subclasses from Base Classes:** Because legacy XML nests
  subclass `<autolevel>` elements inside the base `<class>`, the parser
  should look for the new `rel` attribute. If absent (legacy data),
  fallback to analyzing the `<feature><name>` strings.

  - If an `<autolevel>` feature name contains recognizable archetype
    prefixes (e.g., "Martial Archetype:", "Primal Path:", "Divine
    Domain:"), the parser should dynamically generate a new `Subclass`
    entity JSON object, extracting those specific `autolevels` into the
    new entity and referencing the base class as its parent.

- **Extracting Implied Formulas:** Use RegEx matching on
  `<feature><text>` fields to dynamically synthesize engine modifiers
  that were never codified in XML.

  - *Example:* If text matches
    `/hit point maximum increases by an amount equal to twice your level/`,
    the parser synthesizes an injected modifier:
    `{ "target": "hp.max", "type": "add", "value": "2 * {char.level}" }`.

## 8. Recommended Additive XML Schema Changes

To explicitly support 5.5e and the advanced calculation engine while
ensuring backward compatibility with legacy apps (which simply ignore
unknown XML tags/attributes), we recommend expanding the source data
using the following non-breaking additions:

- **The `<engine_modifier>` Tag:** Alongside legacy `<modifier>` tags,
  introduce `<engine_modifier target="..." type="..." value="..." />`.

  - *Why:* Legacy apps ignore this tag. The new parser will prioritize
    `<engine_modifier>` if present, allowing the XML maintainers to
    write complex formulas like `value="2 * {char.level}"` without
    breaking Fight Club 5e.

- **Background Attribute Bonuses:** Inject `<engine_modifier>` blocks
  directly inside the `<background>` elements to grant the 5.5e +2/+1 or
  +1/+1/+1 Attribute allocations.

  - *Why:* Legacy apps only look for modifiers in `<race>` or `<item>`
    and will ignore modifiers in backgrounds. The new parser will read
    them and wire them into the background selection UI.

- **Explicit Relational Links (`rel` attribute):** Add a `rel` attribute
  to existing `<counter>` and `<autolevel>` tags to strictly bind them
  to their parent origins.

  - *Example (Counter):*
    `<counter rel="class.fighter.autolevel[Second Wind]">`

  - *Example (Autolevel):* `<autolevel rel="subclass.champion">`

  - *Why:* This maintains current functions completely, as legacy apps
    will ignore the `rel` attribute. However, it provides the new parser
    with explicit relationship mapping, removing the need to guess which
    counter belongs to which feature or which autolevel belongs to which
    subclass.

- **Optional Feature Flags:** Add `<optional>true</optional>` inside
  `<autolevel>`.

  - *Why:* Legacy apps will process it as a mandatory feature, but the
    new UI will allow users to toggle these on or off in the builder.

## 9. Explicit Translation Mapping Reference (XML to Engine)

### 9.1 Enum Mappings (Static Modifiers)

The ingestion script should utilize the following map to convert legacy
`<modifier>` tags into the new Engine Dictionary targets.

[TABLE]

### 9.2 Regex Pattern Injections (Dynamic Formulas)

Since legacy XML does not support math formulas, the parser should
execute these RegEx checks against `<feature><text>` or `<trait><text>`
elements to generate injected JSON modifiers.

[TABLE]