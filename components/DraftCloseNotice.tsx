export function DraftCloseNotice({ onKeepEditing, onDiscard, saving }: {
  onKeepEditing: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  return <div className="draft-close-notice" role="alert">
    <div><strong>Discard your unsaved changes?</strong><p>Your changes haven’t been saved yet.</p></div>
    <div className="draft-close-actions">
      <button type="button" className="btn btn-primary btn-sm" autoFocus disabled={saving} onClick={onKeepEditing}>Keep editing</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={onDiscard}>Discard changes</button>
    </div>
  </div>;
}
