/**
 * Utilities for parsing 5etools {@tag ...} markup in compendium text.
 *
 * Tag syntax:
 *   {@spell Fireball}              → "Fireball"  (clickable ref)
 *   {@spell Fireball|phb}          → "Fireball"
 *   {@item Shield|phb}             → "Shield"
 *   {@condition Exhaustion|XPHB}   → "Exhaustion"
 *   {@creature Goblin}             → "Goblin"
 *   {@feat Alert|phb}              → "Alert"
 *   {@dice 1d6}                    → "1d6"
 *   {@damage 1d6}                  → "1d6"
 *   {@b text}                      → "text" (bold — stripped here)
 *   {@i text}                      → "text" (italic)
 *   {@variantrule Name|Source}     → "Name"
 *   {@action Name}                 → "Name"
 *   {@quickref Name}               → "Name"
 *   {@class Fighter}               → "Fighter"
 *   {@chance 50}                   → "50%"
 *   {@h}                           → "" (hit notation)
 *   {@dc 15}                       → "DC 15"
 *   {@scaledice ...}               → first part
 *   {@filter text|...}             → "text"
 */

/** CLICKABLE_TAGS: these generate a link element when parseTagsToJsx is used */
export const CLICKABLE_TAG_TYPES = new Set([
  'spell', 'item', 'creature', 'monster', 'feat', 'class', 'condition',
]);

/** Strip all {@tag} markup and return plain text */
export function stripTags(text: string): string {
  return text.replace(/\{@(\w+)(?:\s([^}]*))?\}/g, (_, tag, inner) => {
    return tagToPlainText(tag, inner ?? '');
  });
}

function tagToPlainText(tag: string, inner: string): string {
  switch (tag) {
    case 'h':       return '';
    case 'dc':      return `DC ${inner.trim()}`;
    case 'chance':  return `${inner.trim()}%`;
    case 'dice':
    case 'damage':
    case 'scaledice':
    case 'scaledamage': {
      // May have display text after |
      const parts = inner.split('|');
      return parts[1] ?? parts[0] ?? inner;
    }
    default: {
      if (!inner) return tag;
      // "Name|Source|DisplayText" → use DisplayText if present, else Name
      const parts = inner.split('|');
      if (parts.length >= 3 && parts[2]) return parts[2].trim();
      return parts[0].trim();
    }
  }
}

/** A single parsed segment — either raw text or a ref span */
export type TagSegment =
  | { kind: 'text'; text: string }
  | { kind: 'ref'; display: string; tagType: string; refName: string };

/**
 * Parse text into an array of segments, splitting on {@tag} markers.
 * Use this when you need to render tags as interactive elements (e.g. in Preact).
 */
export function parseTagSegments(text: string): TagSegment[] {
  const segments: TagSegment[] = [];
  const regex = /\{@(\w+)(?:\s([^}]*))?\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }

    const tag = match[1];
    const inner = match[2] ?? '';
    const display = tagToPlainText(tag, inner);

    if (CLICKABLE_TAG_TYPES.has(tag) && display) {
      const parts = inner.split('|');
      const refName = parts[0].trim();
      segments.push({ kind: 'ref', display, tagType: tag, refName });
    } else {
      segments.push({ kind: 'text', text: display });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}
