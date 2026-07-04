import cron from "node-cron";
import { notifyUser } from "../lib/notify";
import { prisma } from "../lib/prisma";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

async function getRecipients(boardOwnerId: string, boardId: string) {
  const members = await prisma.boardMember.findMany({
    where: { boardId },
    select: { userId: true },
  });
  const recipients = new Set(members.map((m) => m.userId));
  recipients.add(boardOwnerId);
  return recipients;
}

export async function checkDueDates(now: Date = new Date()) {
  const soonThreshold = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  const dueSoonCards = await prisma.card.findMany({
    where: {
      dueDate: { gt: now, lte: soonThreshold },
      dueSoonNotifiedAt: null,
    },
    include: { list: { include: { board: true } } },
  });

  for (const card of dueSoonCards) {
    const recipients = await getRecipients(card.list.board.ownerId, card.list.boardId);
    for (const userId of recipients) {
      await notifyUser(userId, "DUE_SOON", `Срок карточки «${card.title}» истекает в течение суток`, {
        boardId: card.list.boardId,
        cardId: card.id,
      });
    }
    await prisma.card.update({ where: { id: card.id }, data: { dueSoonNotifiedAt: now } });
  }

  const overdueCards = await prisma.card.findMany({
    where: {
      dueDate: { lt: now },
      overdueNotifiedAt: null,
    },
    include: { list: { include: { board: true } } },
  });

  for (const card of overdueCards) {
    const recipients = await getRecipients(card.list.board.ownerId, card.list.boardId);
    for (const userId of recipients) {
      await notifyUser(userId, "OVERDUE", `Карточка «${card.title}» просрочена`, {
        boardId: card.list.boardId,
        cardId: card.id,
      });
    }
    await prisma.card.update({ where: { id: card.id }, data: { overdueNotifiedAt: now } });
  }

  return { dueSoonCount: dueSoonCards.length, overdueCount: overdueCards.length };
}

export function startDueDateReminderJob() {
  return cron.schedule("*/15 * * * *", () => {
    checkDueDates().catch((err) => console.error("Due date reminder job failed", err));
  });
}
