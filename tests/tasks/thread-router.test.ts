import { describe, expect, it } from "vitest";
import { routeThread, type ThreadRouteRecord } from "../../src/tasks/thread-router.js";

function makeThread(
  overrides: Partial<ThreadRouteRecord> & Pick<ThreadRouteRecord, "id" | "fromUserId" | "status">,
): ThreadRouteRecord {
  return {
    id: overrides.id,
    fromUserId: overrides.fromUserId,
    status: overrides.status,
  };
}

describe("routeThread", () => {
  it("reuses the latest queued thread for the same user", () => {
    const thread = routeThread(
      [
        makeThread({ id: "thread-1", fromUserId: "wxid_admin", status: "queued" }),
        makeThread({ id: "thread-2", fromUserId: "wxid_other", status: "queued" }),
        makeThread({ id: "thread-3", fromUserId: "wxid_admin", status: "queued" }),
      ],
      "wxid_admin",
    );

    expect(thread?.id).toBe("thread-3");
  });

  it("reuses the latest waiting_approval thread for the same user", () => {
    const thread = routeThread(
      [
        makeThread({ id: "thread-1", fromUserId: "wxid_admin", status: "queued" }),
        makeThread({ id: "thread-2", fromUserId: "wxid_admin", status: "waiting_approval" }),
      ],
      "wxid_admin",
    );

    expect(thread?.id).toBe("thread-2");
  });

  it("does not reuse done threads", () => {
    const thread = routeThread(
      [makeThread({ id: "thread-1", fromUserId: "wxid_admin", status: "done" })],
      "wxid_admin",
    );

    expect(thread).toBeUndefined();
  });

  it("prefers the most recent unfinished thread when done and unfinished threads both exist", () => {
    const thread = routeThread(
      [
        makeThread({ id: "thread-1", fromUserId: "wxid_admin", status: "queued" }),
        makeThread({ id: "thread-2", fromUserId: "wxid_admin", status: "done" }),
        makeThread({ id: "thread-3", fromUserId: "wxid_admin", status: "waiting_approval" }),
      ],
      "wxid_admin",
    );

    expect(thread?.id).toBe("thread-3");
  });
});
