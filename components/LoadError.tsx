export function LoadError({ message, onRetry, retainedContent = false }: { message: string; onRetry: () => void; retainedContent?: boolean }) {
  return (
    <div className="load-error" role="alert">
      <div className="load-error-mark" aria-hidden="true">!</div>
      <div className="load-error-copy">
        <strong>{retainedContent ? "Couldn’t refresh this view" : "This view didn’t load"}</strong>
        <p>{message}</p>
        {retainedContent && <p>Your loaded records are still available below.</p>}
      </div>
      <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}
