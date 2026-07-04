import { prisma } from "./prisma";

export async function isBoardMember(boardId: string, userId: string) {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  return !!membership;
}

export async function hasBoardAccess(ownerId: string, boardId: string, userId: string) {
  if (ownerId === userId) return true;
  return isBoardMember(boardId, userId);
}
