import { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { emitToUser } from "../socket";

export async function notifyUser(
  userId: string,
  type: NotificationType,
  message: string,
  extra?: { boardId?: string; cardId?: string },
) {
  const notification = await prisma.notification.create({
    data: { userId, type, message, boardId: extra?.boardId, cardId: extra?.cardId },
  });
  emitToUser(userId, "notification:new", notification);
  return notification;
}
