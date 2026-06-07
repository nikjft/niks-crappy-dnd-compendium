/**
 * MarkdownContent — renders rich description text (markdown + 5etools markup)
 * by delegating to the legacy window.__parseMarkdown function (from app.js).
 *
 * The stored texts in spells/features contain markdown-encoded strings, e.g.:
 *   "A **bright streak** of fire..."
 *   "| d6 | Shard | Description |"
 *   "### At Higher Levels"
 *   "[Fireball](?category=spells&item=Fireball)"
 *
 * window.__parseMarkdown handles all of: tables, lists, bold/italic,
 * markdown links, blockquotes, headers, and preprocessCustomTables.
 *
 * Falls back to a simple <pre>-like display if the bridge is unavailable.
 */

interface Props {
  /** One or more lines of text — joined with '\n' before parsing */
  texts: string[];
  class?: string;
}

export function MarkdownContent({ texts, class: cls }: Props) {
  if (!texts || texts.length === 0) return null;

  const joined = texts.join('\n');

  const parseMarkdown = (window as any).__parseMarkdown as ((t: string) => string) | undefined;
  if (parseMarkdown) {
    const html = parseMarkdown(joined);
    return (
      <div
        class={`markdown-content${cls ? ` ${cls}` : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Fallback: render each text as a plain paragraph
  return (
    <div class={`markdown-content${cls ? ` ${cls}` : ''}`}>
      {texts.map((t, i) => <p key={i}>{t}</p>)}
    </div>
  );
}
