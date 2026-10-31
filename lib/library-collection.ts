type CollectionLoad<T> = {
  url: string;
  version: { current: number };
  onLoaded: (items: T[]) => void;
  onError: (message: string | null) => void;
  onSettled: () => void;
  errorMessage: string;
};

// Reads and confirmed writes share a version. Starting a fresh read after a
// write prevents any older snapshot (or error) from undoing that saved change.
export async function loadLibraryCollection<T>({
  url, version, onLoaded, onError, onSettled, errorMessage,
}: CollectionLoad<T>) {
  const request = ++version.current;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Library unavailable");
    const items: T[] = await response.json();
    if (request === version.current) {
      onLoaded(items);
      onError(null);
    }
  } catch {
    if (request === version.current) onError(errorMessage);
  } finally {
    if (request === version.current) onSettled();
  }
}
