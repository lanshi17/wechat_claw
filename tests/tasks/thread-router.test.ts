import { describe, expect, it } from "vitest";
import { routeThread } from "../../src/tasks/thread-router.js";

describe("routeThread", () => {
  it("reuses the latest queued thread for the same admin", () => {
    const selected = routeThread(
      [
        { id: "t1", fromUserId: "wxid_admin", status: "queued" },
        { id: "t2", fromUserId: "wxid_other", status: "waiting_approval" },
      ],
      "wxid_admin",
    );

    expect(selected?.id).toBe("t1");
  });

  it("reuses the latest waiting approval thread for the same admin", () => {
    const selected = routeThread(
      [
        { id: "t1", fromUserId: "wxid_admin", status: "waiting_approval" },
      ],
      "wxid_admin",
    );

    expect(selected?.id).toBe("t1");
  });

  it("does not reuse done threads", () => {
    const selected = routeThread(
      [
        { id: "t1", fromUserId: "wxid_admin", status: "done" },
      ],
      "wxid_admin",
    );

    expect(selected).toBeUndefined();
  });

  it("returns the most recent unfinished thread when multiple unfinished threads exist", () => {
    const selected = routeThread(
      [
        { id: "t1", fromUserId: "wxid_admin", status: "queued" },
        { id: "t2", fromUserId: "wxid_admin", status: "done" },
        { id: "t3", fromUserId: "wxid_admin", status: "waiting_approval" },
      ],
      "wxid_admin",
    );

    expect(selected?.id).toBe("t3");
  });
});
