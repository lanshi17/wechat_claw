export function createRealWebFetch(timeoutMs = 10_000, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {
  return async function webFetch(input: { url: string }): Promise<{ url: string; text: string }> {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetchFn(input.url, { signal: controller.signal });
      clearTimeout(timer);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw new Error(`web.fetch: request timed out after ${timeoutMs}ms: ${input.url}`);
      }
      throw new Error(`web.fetch: network error: ${(cause as Error).message}`);
    }

    if (!response.ok) {
      throw new Error(`web.fetch: HTTP ${response.status} for ${input.url}`);
    }

    const text = await response.text();
    return { url: input.url, text };
  };
}
