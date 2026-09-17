export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="load-error" role="alert"><p>{message}</p><button type="button" className="btn btn-primary" onClick={onRetry}>Retry</button></div>;
}
