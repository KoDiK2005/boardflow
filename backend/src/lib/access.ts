import { BoardRole } from "@prisma/client";
import { prisma } from "./prisma";

export type EffectiveRole = "OWNER" | BoardRole;

export async function getBoardRole(
  ownerId: string,
  boardId: string,
  userId: string,
): Promise<EffectiveRole | null> {
  if (ownerId === userId) return "OWNER";
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  return membership?.role ?? null;
}

export async function hasBoardAccess(ownerId: string, boardId: string, userId: string) {
  return (await getBoardRole(ownerId, boardId, userId)) !== null;
}

export function canEdit(role: EffectiveRole | null) {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR";
}

export function canManageMembers(role: EffectiveRole | null) {
  return role === "OWNER" || role === "ADMIN";
}
