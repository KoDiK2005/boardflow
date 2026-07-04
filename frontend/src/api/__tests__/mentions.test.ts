import { describe, expect, it } from "vitest";
import { encodeMentionToken, getMentionableUsers } from "../mentions";
import { BoardDetail } from "../types";

function makeBoard(overrides: Partial<BoardDetail> = {}): BoardDetail {
  return {
    id: "board-1",
    title: "Test board",
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    lists: [],
    labels: [],
    members: [],
    owner: { id: "owner-1", name: "Board Owner" },
    ...overrides,
  };
}

describe("getMentionableUsers", () => {
  it("includes the owner", () => {
    const board = makeBoard();
    expect(getMentionableUsers(board)).toEqual([{ id: "owner-1", name: "Board Owner" }]);
  });

  it("includes members and dedupes by user id", () => {
    const board = makeBoard({
      members: [
        {
          id: "m1",
          userId: "user-2",
          boardId: "board-1",
          role: "EDITOR",
          user: { id: "user-2", name: "User Two", email: "u2@example.com" },
        },
      ],
    });
    const users = getMentionableUsers(board);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id)).toEqual(["owner-1", "user-2"]);
  });
});

describe("encodeMentionToken", () => {
  it("replaces spaces with underscores", () => {
    expect(encodeMentionToken("Jane Doe")).toBe("Jane_Doe");
  });

  it("trims surrounding whitespace", () => {
    expect(encodeMentionToken("  Jane Doe  ")).toBe("Jane_Doe");
  });
});
