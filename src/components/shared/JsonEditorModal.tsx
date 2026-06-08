import { useState } from 'preact/hooks';

interface Props {
  title: string;
  value: object;
  onSave: (updated: object) => void;
  onClose: () => void;
}

export function JsonEditorModal({ title, value, onSave, onClose }: Props) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');

  function handleSave() {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    // Ctrl/Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Allow Tab to insert spaces inside textarea
    if (e.key === 'Tab' && e.target instanceof HTMLTextAreaElement) {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = el.value.substring(0, start) + '  ' + el.value.substring(end);
      setText(next);
      // Restore cursor after state update
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('json-editor-backdrop')) onClose();
  }

  return (
    <div class="json-editor-backdrop" onClick={handleBackdrop} onKeyDown={handleKey}>
      <div class="json-editor-box" role="dialog" aria-modal="true" aria-label={title}>
        <div class="json-editor-header">
          <span class="json-editor-title">{title}</span>
          <button class="bd-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <textarea
          class="json-editor-textarea"
          value={text}
          onInput={e => { setText((e.target as HTMLTextAreaElement).value); setError(''); }}
          spellcheck={false}
          autoFocus
        />
        {error && <p class="json-editor-error">{error}</p>}
        <div class="json-editor-footer">
          <span class="json-editor-hint">Ctrl+S to save · Esc to cancel</span>
          <div style="display:flex;gap:8px;">
            <button class="cs-btn-small" onClick={onClose}>Cancel</button>
            <button class="cs-btn-main" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
