import { describe, expect, it } from "vitest";
import { canEdit, canManageMembers, getMyRole } from "../permissions";
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
    ...overrides,
  };
}

describe("getMyRole", () => {
  it("returns OWNER for the board owner", () => {
    const board = makeBoard();
    expect(getMyRole(board, "owner-1")).toBe("OWNER");
  });

  it("returns the member's role when present", () => {
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
    expect(getMyRole(board, "user-2")).toBe("EDITOR");
  });

  it("returns null for a user with no relation to the board", () => {
    const board = makeBoard();
    expect(getMyRole(board, "stranger")).toBeNull();
  });
});

describe("canEdit", () => {
  it("allows OWNER, ADMIN, and EDITOR", () => {
    expect(canEdit("OWNER")).toBe(true);
    expect(canEdit("ADMIN")).toBe(true);
    expect(canEdit("EDITOR")).toBe(true);
  });

  it("disallows VIEWER and null", () => {
    expect(canEdit("VIEWER")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});

describe("canManageMembers", () => {
  it("allows OWNER and ADMIN", () => {
    expect(canManageMembers("OWNER")).toBe(true);
    expect(canManageMembers("ADMIN")).toBe(true);
  });

  it("disallows EDITOR, VIEWER, and null", () => {
    expect(canManageMembers("EDITOR")).toBe(false);
    expect(canManageMembers("VIEWER")).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });
});
