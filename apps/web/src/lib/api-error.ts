/**
 * What to say when a write fails.
 *
 * The axios instance rejects a failed request with the API's translated body
 * on `response.data` (`{ success: false, message }`), not with its own
 * `message`, which Axios leaves as "Request failed with status code 400". So a
 * hook reports `error.message` and tells the reader nothing useful: it is the
 * API's `message` that was written for them, and that is what this reads.
 *
 * A network failure has no response at all, so it answers `undefined` and the
 * caller's own fallback copy is used.
 */
export const messageOf = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;

  const body = (error as { response?: { data?: unknown } }).response?.data;
  if (body && typeof body === "object") {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }

  return undefined;
};
