// Display expected API errors, not arbitrary exceptions or server diagnostics.
export class LibraryRequestError extends Error {}

export function libraryErrorMessage(error: unknown, fallback: string) {
  return error instanceof LibraryRequestError ? error.message : fallback;
}

export async function libraryRequest(url: string, options: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(url, options); }
  catch {
    // A lost response does not prove that the server failed to save. Never
    // automatically repeat a write and risk creating duplicate records.
    throw new LibraryRequestError("Could not confirm the change. Check your connection and the record before trying again.");
  }
  if (response.ok) return response;
  if (response.status >= 400 && response.status < 500) {
    const body: unknown = await response.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body
      && typeof body.error === "string" && body.error.trim() && body.error.length <= 500) {
      throw new LibraryRequestError(body.error.trim());
    }
  }
  throw new LibraryRequestError("Could not complete this change. Please try again shortly.");
}
