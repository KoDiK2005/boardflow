import { prisma } from "./prisma";

const mentionPattern = /@([A-Za-z0-9_]+)/g;

export async function extractMentionedUserIds(text: string, boardId: string, ownerId: string) {
  const tokens = [...text.matchAll(mentionPattern)].map((m) =>
    m[1].replace(/_/g, " ").toLowerCase(),
  );
  if (tokens.length === 0) return new Set<string>();

  const boardUsers = await prisma.user.findMany({
    where: {
      OR: [{ id: ownerId }, { boardMemberships: { some: { boardId } } }],
    },
    select: { id: true, name: true },
  });

  const matched = boardUsers.filter((u) => tokens.includes(u.name.toLowerCase()));
  return new Set(matched.map((u) => u.id));
}
