export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="load-error" role="alert">
      <div className="load-error-mark" aria-hidden="true">!</div>
      <div className="load-error-copy">
        <strong>This view didn’t load</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}
