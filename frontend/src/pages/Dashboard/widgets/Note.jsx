/* The only widget whose content is its config. onConfigChange is debounced by
   the canvas, so typing does not push an undo step per keystroke. */
export default function Note({ widget, onConfigChange, editing }) {
  return (
    <textarea
      className="w-note"
      value={widget.config?.text || ''}
      placeholder="Write a note…"
      readOnly={editing}
      onChange={e => onConfigChange({ ...widget.config, text: e.target.value })}
    />
  );
}
