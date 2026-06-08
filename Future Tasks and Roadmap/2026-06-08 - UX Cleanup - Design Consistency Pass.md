# UX Clean-up Specification — Design Consistency Pass

## Context

The app (Preact D&D character sheet, Vite/PWA) has grown organically and accumulated visual inconsistency: **16 distinct font sizes**, **5+ text-color treatments**, **~8 divergent button styles**, toggle controls that mix circles / icons / checkboxes / stars, and action buttons placed inconsistently (some left, some right, some missing a Cancel). The backlog item "UX clean-up" asks to make all of this consistent.

This spec is written to be handed to a lighter-weight implementation model. It is **token-driven**: define a small design-token system in CSS, then point components at the tokens and fix the specific divergences. Steps are ordered and mechanical; each has acceptance criteria.

**Owner decisions already made (do not re-litigate):**
1. **Keep gold accent** (`#d4af37`). "Orange" in the backlog means "the accent color." Do **not** change the hue.
2. **2-state toggles → circles** (empty = off, filled accent = on, no extra border/background). **3+-state toggles → circles for stages 1–2, then icons for stage 3+**; those icons are **filled accent color, no border, no background**.
3. **Multi-state controls keep icons** (inventory equip = sword/shield; cantrip = star). Normalize their size/color only.
4. **Token-driven refactor** (not just spot fixes).

---

## The Design-Token System

Add the following to the existing `:root` block in **`index.css`** (lines ~45–62, where current tokens live). Keep all existing tokens; only ADD these.

```css
:root {
  /* … existing color tokens unchanged (--bg-color, --panel-bg, --text-primary,
     --text-secondary, --text-muted, --accent-color #d4af37, --accent-hover,
     --accent-muted, --error-color, --success-color, fonts, sidebar widths) … */

  /* NEW — status colors (replace hardcoded ad-hoc colors) */
  --warning-color: #ff9500;   /* was hardcoded for offline banner */
  --info-color:    #7baaf7;   /* was hardcoded for syncing banner / attuned blue */

  /* NEW — accent as RGB for alpha use (off-hand bg etc.) */
  --accent-rgb: 212, 175, 55;

  /* NEW — font scale (7 steps; replaces 16 ad-hoc sizes) */
  --fs-xs:   11px;   /* badges, tiny labels */
  --fs-sm:   12px;   /* secondary labels, hints, metadata */
  --fs-base: 14px;   /* body, list-item text, button text */
  --fs-md:   16px;   /* sub-headers, menu items */
  --fs-lg:   20px;   /* section titles */
  --fs-xl:   24px;   /* headers */
  --fs-2xl:  32px;   /* display numbers (ability score, big HP) */

  /* NEW — radius scale */
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-lg:   12px;
  --radius-pill: 999px;

  /* NEW — spacing scale (for button padding consistency) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}
```

---

## Implementation Sequence

Do these in order. Build + visually verify after each workstream.

> **Implementation status (2026-06-08):** A ✅ B ✅ C ✅ D ✅ E ✅ F ✅ — `npm run build` passes, all 63 tests green.
> - **A:** Token block added to `:root`; link rules added; `#e1e1e6` → `var(--text-primary)`.
> - **B:** `.cs-btn-main`/`.cs-btn-small` redefined with tokens; `.icon-action-btn` created; `SpellRow` + `FeaturesTab` updated; dead `.feat-action-btn`/`.spell-action-btn` CSS removed; stat chips normalized.
> - **C1:** Feature-active bolt → `.cs-prof-indicator` circle; modifier checkbox → circle (`.mod-toggle-label`/`.mod-toggle-cb` CSS removed). **C2:** `.item-cycle-btn.off-hand` border/bg removed. **C4:** Inspiration de-glowed + gray→gold normalized.
> - **D1/D2:** InventoryTab expanded actions consolidated right-aligned; Cancel button added to inline edit. **D3:** `CustomFeatureModal` + `ModifierModal` inline button styles → `cs-btn-small`/`cs-btn-main` classes.
> - **E:** All raw `font-size: <px>` across 6 CSS files snapped to tokens. ⚠️ `.cs-attr-score-val` bumped 28→32px (`--fs-2xl`) — needs visual verification on Stats tab.
> - **F:** `inventory.css` item state colors → `--success-color`/`--info-color`; `index.css` banner colors → `--warning-color`/`--info-color`.
> - **Pending:** Visual walkthrough of all tabs per Verification section. No UI testing done (requires browser).

### Workstream A — Tokens & globals (`index.css`)
1. Add the token block above.
2. **Links** (no global rule exists today). Add, near the top global styles:
   ```css
   a, a:link, a:visited { color: var(--accent-color); text-decoration: underline; }
   a:hover { color: var(--accent-hover); }
   ```
   Visited and unvisited deliberately share one color (consistency requirement). Existing `.detail-body a`, `.markdown-content a`, `.tag-ref-btn` may keep their local rules but must also resolve to `--accent-color` / `--accent-hover` (they already do — just confirm, don't duplicate).
3. Replace the one hardcoded body text color `#e1e1e6` (index.css ~line 575) → `var(--text-primary)`.

**Acceptance:** all anchors render gold; visited links are not a different color; no `#e1e1e6` remains.

### Workstream B — Buttons (gold = primary, gray = everything else)
**Rule:** at most ONE gold (filled-accent) button per modal/section — the primary confirm/submit (Save, Add X). Every other action button is gray.

1. **Canonical classes** (redefine in terms of tokens; keep names to limit churn):
   - `.cs-btn-main` = **primary**: `background: var(--accent-color); color: var(--bg-color); border: none; font-family: var(--font-header); font-weight: 600; font-size: var(--fs-base); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);` hover → `--accent-hover`.
   - `.cs-btn-small` = **secondary/gray default**: `background: var(--panel-bg-hover); border: 1px solid var(--border-color); color: var(--text-primary); font-size: var(--fs-sm); padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm);` hover → accent border + `--accent-muted` bg + accent text. (Mostly already true; normalize padding/size to tokens.)
2. **Unify the two identical icon-action button classes.** `.feat-action-btn` (features.css) and `.spell-action-btn` (spells.css) are byte-for-byte equivalent. Create ONE shared class in `index.css`:
   ```css
   .icon-action-btn {
     background: none; border: 1px solid var(--border-color);
     border-radius: var(--radius-md); color: var(--text-muted);
     width: 28px; height: 28px; display: flex; align-items: center;
     justify-content: center; font-size: var(--fs-base); cursor: pointer;
     padding: 0; transition: background .15s, color .15s, border-color .15s;
   }
   .icon-action-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
   .icon-action-btn.danger:hover { border-color: var(--error-color); color: var(--error-color); }
   ```
   Update `SpellRow.tsx` and the `FeatureRow` overview sync button to use `.icon-action-btn` (and `.icon-action-btn.danger` for delete). Remove the now-dead `.feat-action-btn` / `.spell-action-btn` defs once unused. (Note: `.feat-action-btn.feat-btn-active` is the feature ACTIVE toggle — that one is being replaced by a circle in Workstream C, so it goes away entirely.)
3. **Stat chips are NOT action buttons** — exempt from the gold/gray rule. `.atk-bonus-btn` and `.qa-stat-btn` convey the key combat number, so they keep the accent treatment. Just normalize: `font-size: var(--fs-base); padding: var(--space-1) var(--space-2); border-radius: var(--radius-md);`. Leave their accent bg/border/color.
4. **Odd sizes:** snap all icon-only buttons (`.cs-icon-btn`, counter +/−/reset, `.cs-hp-btn`, `.qa-unpin-btn`, `.chip-remove`) to consistent dims — icon-action style is 28×28; tiny inline removers (`×`) stay small but use `--fs-sm` and `--radius-sm`. Snap every button `border-radius` to `--radius-sm` or `--radius-md`.

**Acceptance:** each modal has exactly one gold button (its Save/Add); all other buttons gray; feat/spell row action buttons share one class; no button uses a raw px border-radius.

### Workstream C — Toggles
1. **2-state toggles → circle.** Canonical circle is the existing `.cs-prof-indicator` (index.css ~2344): 12px, `border: 1px solid var(--text-muted)` when off; `.prof` → filled accent. Convert these to it:
   - **Feature active toggle** (`FeaturesTab.tsx` FeatureRow, lines ~72–78): replace the `bolt`-icon `.feat-action-btn` with a circle button. Off = empty circle; on = filled accent circle. Use class `cs-prof-indicator` + `prof` when `feature.active`. Remove the bolt `<span>`.
   - **Modifier active toggle** (`ModifiersSection.tsx`, the `.mod-toggle-cb` checkbox): replace native checkbox with the same circle button. Remove `.mod-toggle-cb` / `.mod-toggle-label` checkbox CSS.
2. **3+-state toggle (inventory cycle, `InventoryTab.tsx` + `inventory.css`).** Keep the staged model:
   - Stage 1 uncarried → empty circle (already correct).
   - Stage 2 carried → filled accent circle (already correct).
   - Stage 3 main-hand → **sword icon, filled accent color, NO border, NO background.**
   - Stage 4 off-hand → **shield icon, filled accent color, NO border, NO background.**
   - Non-weapon equipped → shield icon, same treatment.
   - **Fix:** the current `.item-cycle-btn.off-hand` has `border: 1px solid var(--accent-color)` + `rgba(...) background` — REMOVE both. The `.equipped` / `.main-hand` 28px boxes should also drop their transparent borders; the icon alone in accent color is the indicator. Keep the 28px hit-area but make it borderless/transparent.
3. **Cantrip star** (`SpellRow.tsx`, `.spell-prep-star ✦`): leave as-is (informational marker, owner-approved). Just ensure it uses `--accent-color` and a token font-size.
4. **Inspiration** (`.cs-inspiration-toggle`, legacy header in `index.css` / `index.html`): it is a *labeled* control ("Inspiration" + star), not a bare list-row indicator, so it stays a labeled toggle BUTTON — but normalize it to the standard toggle-button treatment: inactive = gray (`--panel-bg-hover` bg, `--border-color`, `--text-secondary`); active = accent (`--accent-muted` bg, `--accent-color` border + text + filled star). **Remove the `box-shadow` glow** (no other control glows). This is the single intentional label+control exception to the circle rule — call it out in the commit.
5. Pips already compliant — **do not touch**: `.slot-pip`, `.death-pip`, `.counter-pip`, `.qa-counter-pip`, `.conc-dot`. (Listed so the implementer doesn't "fix" them.)

**Acceptance:** Feature-active and Modifier toggles are empty/filled circles identical to proficiency dots; inventory equip icons have no border/background; inspiration has no glow and follows gray→gold; pips unchanged.

### Workstream D — Button placement / layout
**Convention:** row/card action buttons (edit, sync, delete, active-toggle) → right side of the row. Modal Save/Cancel → bottom-right (Cancel then Save, both right-aligned). Header "+ Add" → right of header.

Most components already comply (Features, Spells rows; all section headers). Fix the divergences:
1. **`InventoryTab.tsx` ItemRow expanded actions** (lines ~199–249): currently splits Edit/Sync/Pin on the LEFT and Delete on the RIGHT. Consolidate all four (Edit, Sync, Pin, Delete) into a single **right-aligned** action group. Keep the Container `<select>` separate (it's a control, not an action) — left or its own row.
2. **`InventoryTab.tsx` inline edit:** add a **Cancel** button next to Save (currently Edit→Save with no discard path). Cancel resets `editFields`/`isEditing` without patching.
3. **Modal button styling:** `CustomFeatureModal.tsx` and `ModifierModal.tsx` use inline `style={{…}}` for their buttons. Replace with classes: Cancel → `cs-btn-small`, primary → `cs-btn-main`. `CustomSpellModal.tsx` already uses `cs-btn-main`; align the other two to match. All three: Cancel (gray) left, primary (gold) right, in `.form-actions` (already bottom-right).
4. **"+ Pin" → "+ Add"?** Leave QuickActions as "+ Pin" — it's semantically distinct (pins an existing item, doesn't add new). Do not rename.

**Acceptance:** inventory expanded row has all actions right-aligned + a working Cancel; all three modals use `cs-btn-small`/`cs-btn-main` (no inline button styles); Cancel-left/Save-right everywhere.

### Workstream E — Font-size snapping
Replace every `font-size: <px>` across all CSS by snapping to the nearest token, per this table. This is mechanical; verify layout visually (especially large display numbers).

| Existing px | Token | Resolves to |
|---|---|---|
| 9, 10, 11 | `--fs-xs` | 11px |
| 12 | `--fs-sm` | 12px |
| 13, 13.5, 14, 15 | `--fs-base` | 14px |
| 16, 17 | `--fs-md` | 16px |
| 18, 20 | `--fs-lg` | 20px |
| 22, 24 | `--fs-xl` | 24px |
| 28, 32 | `--fs-2xl` | 32px |

⚠️ The ability-score number (`.cs-attr-score-val`, 28px) and any 28px→32px bumps may shift layout — visually verify the Stats tab ability cards and the HP header don't overflow. If a number clips, that specific element may keep an explicit value, but document why.

**Acceptance:** no raw `font-size` px values remain except documented exceptions; all tabs render without clipped/overflowing text.

### Workstream F — Text colors & stray colors
1. Item state colors in `inventory.css` (~401–408): `#4caf50` (equipped green) → `var(--success-color)`; `#2196f3` (attuned blue) → `var(--info-color)`.
2. Status banner colors in `index.css`: offline `#ff9500` → `var(--warning-color)`; syncing `#7baaf7` → `var(--info-color)`.
3. **Coin gradient colors** (inventory.css ~48–52, gp/sp/pp/cp/ep): **KEEP** — they semantically represent metal types and are intentional. Do not tokenize.
4. Any remaining ad-hoc grays for text → snap to `--text-primary` / `--text-secondary` / `--text-muted` (the only three allowed text colors).

**Acceptance:** the only text colors in use are the three `--text-*` tokens (plus coin metals and semantic status tokens); no stray hex grays.

---

## Files To Modify

| File | Changes |
|---|---|
| `index.css` | Token block (A); global link rules (A); `#e1e1e6`→token (A); redefine `.cs-btn-main`/`.cs-btn-small` + new `.icon-action-btn` (B); inspiration normalize + de-glow (C4); status colors→tokens (F); font snap (E) |
| `src/inventory.css` | `.item-cycle-btn` equip states: remove borders/bg (C2); item state colors→tokens (F); font/radius snap |
| `src/features.css` | Remove `.feat-action-btn`/`.feat-btn-active` once unused (B2, C1); font snap |
| `src/spells.css` | Remove `.spell-action-btn` once unused (B2); font snap |
| `src/combat.css` | `.atk-bonus-btn`/`.qa-stat-btn` normalize (B3); remove `.mod-toggle-*` checkbox CSS (C1); font/radius snap |
| `src/stats.css` | Font snap; verify ability-card display sizes (E) |
| `src/components/features/FeaturesTab.tsx` | Feature-active bolt → circle (C1); overview sync btn → `.icon-action-btn` (B2) |
| `src/components/spells/SpellRow.tsx` | Action btns → `.icon-action-btn` (B2); cantrip star token size (C3) |
| `src/components/combat/ModifiersSection.tsx` | Checkbox → circle toggle (C1) |
| `src/components/inventory/InventoryTab.tsx` | Cycle icon classes borderless (C2); expanded actions right-aligned + Cancel (D1, D2) |
| `src/components/features/CustomFeatureModal.tsx` | Inline button styles → classes (D3) |
| `src/components/combat/ModifierModal.tsx` | Inline button styles → classes (D3) |
| `src/components/spells/CustomSpellModal.tsx` | Confirm already class-based; align (D3) |

---

## Out Of Scope
- Changing the accent hue (stays gold).
- Restyling pips (slot/death/counter/qa-counter) — already compliant.
- Coin metal colors — intentional.
- Renaming "+ Pin".
- Any functional/logic change — this is presentation only.

---

## Test & Build Impact
- Markup changes will break tests that assert on old DOM:
  - `src/tests/inventory.test.tsx` already keys off the cycle button `title` — verify it still matches after borderless change (title text unchanged, should pass).
  - Search tests for assertions on the modifier checkbox (`type="checkbox"` / `.mod-toggle-cb`) and the feature `bolt` icon — update those to the new circle button (`.cs-prof-indicator`, role `button`, `aria-label`).
- Run `npm test -- --run` and fix any selector breakage.

## Verification (end-to-end)
1. `npm run build` — must succeed with no TS errors.
2. `npm test -- --run` — all tests pass (after selector updates).
3. Launch the app (use the `run` skill / preview) and walk every tab:
   - **Stats:** ability cards (score larger than mod, no clipping), skill/save proficiency circles, tool circles.
   - **Combat:** attacks (gold stat chips), quick actions, counters (pips unchanged), modifiers (new circle toggle), conditions, inspiration (no glow, gray→gold).
   - **Inventory:** cycle a weapon through all 4 states (empty circle → filled circle → sword → shield, icons borderless); expanded row actions all right-aligned; Cancel works.
   - **Spells:** prepared circles, cantrip star, row actions one class, slot pips unchanged.
   - **Features:** feature-active circle toggle, row actions, overview sync button.
   - **Modals:** Custom Feature / Custom Spell / Modifier — gray Cancel left, gold Save right, no inline styles.
4. Confirm: exactly one gold button per modal; all anchors gold (visited == unvisited); no stray font-size px or hex grays (grep `font-size:\s*\d` and `#[0-9a-fA-F]` in CSS to spot-check).

## Process
Significant change → already on a dedicated branch. Implement, test locally, then merge to main, commit, sync. Update `todo.md` (mark the UX clean-up item `*DONE*`). If any sub-item is deferred, append it to the bottom of the backlog with rationale.
