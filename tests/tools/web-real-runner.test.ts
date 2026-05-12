import { describe, expect, it, vi } from "vitest";
import { createRealWebFetch } from "../../src/tools/web/real-runner.js";

describe("createRealWebFetch", () => {
  it("fetches a URL and returns text content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "hello from web",
    });
    const runner = createRealWebFetch(5000, fetchMock as unknown as typeof fetch);

    const result = await runner({ url: "https://example.com" });
    expect(result.url).toBe("https://example.com");
    expect(result.text).toBe("hello from web");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("throws with status code on non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    const runner = createRealWebFetch(5000, fetchMock as unknown as typeof fetch);

    await expect(runner({ url: "https://example.com/notfound" })).rejects.toThrow(/HTTP 404/);
  });

  it("throws on network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection refused"));
    const runner = createRealWebFetch(5000, fetchMock as unknown as typeof fetch);

    await expect(runner({ url: "https://down.example.com" })).rejects.toThrow(/network error/);
  });

  it("throws on timeout", async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        const err = new DOMException("aborted", "AbortError");
        reject(err);
      });
    });
    const runner = createRealWebFetch(100, fetchMock as unknown as typeof fetch);

    await expect(runner({ url: "https://slow.example.com" })).rejects.toThrow(/timed out/);
  });
});
