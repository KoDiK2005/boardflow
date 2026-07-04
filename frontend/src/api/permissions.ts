import { BoardDetail, EffectiveRole } from "./types";

export function getMyRole(board: BoardDetail, userId: string): EffectiveRole | null {
  if (board.ownerId === userId) return "OWNER";
  return board.members.find((m) => m.userId === userId)?.role ?? null;
}

export function canEdit(role: EffectiveRole | null) {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR";
}

export function canManageMembers(role: EffectiveRole | null) {
  return role === "OWNER" || role === "ADMIN";
}
