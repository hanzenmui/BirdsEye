import { ApiError } from "./auth";

// Route handlers do not inherit Server Actions' body-size limit. Bound the
// public sign-in payload before JSON parsing, even with no Content-Length.
export async function readSmallJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("Enter a passcode.", 400);
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ApiError("The sign-in request is too long.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
