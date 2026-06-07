/**
 * TagText — renders a string containing 5etools {@tag} markup.
 *
 * Clickable tags (spell, item, condition, creature, feat, class) become
 * inline <button> elements that open the legacy detail modal.
 * All other tags are stripped to plain text.
 */
import { parseTagSegments } from '../../utils/parseTagMarkup.js';

interface Props {
  text: string;
  /** Extra CSS class on the wrapper span. Default: none. */
  class?: string;
}

export function TagText({ text, class: cls }: Props) {
  const segments = parseTagSegments(text);

  const nodes = segments.map((seg, i) => {
    if (seg.kind === 'text') {
      return seg.text ? <span key={i}>{seg.text}</span> : null;
    }
    // ref — clickable
    return (
      <button
        key={i}
        class="tag-ref-btn"
        onClick={() => (window as any).__legacyOpenTagRef?.(seg.tagType, seg.refName)}
        title={`Look up ${seg.display}`}
      >
        {seg.display}
      </button>
    );
  });

  return <span class={cls}>{nodes}</span>;
}
