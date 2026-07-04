import { Router } from "express";
import { z } from "zod";
import { canEdit, getBoardRole, hasBoardAccess } from "../lib/access";
import { notifyUser } from "../lib/notify";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { emitToBoard } from "../socket";

const router = Router();
router.use(requireAuth);

const createCommentSchema = z.object({
  cardId: z.string().uuid(),
  text: z.string().min(1),
});

const authorInclude = { author: { select: { id: true, name: true } } } as const;

async function assertCardAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card) return null;
  const allowed = await hasBoardAccess(card.list.board.ownerId, card.list.boardId, userId);
  return allowed ? card : null;
}

async function assertCardEditAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card) return null;
  const role = await getBoardRole(card.list.board.ownerId, card.list.boardId, userId);
  return canEdit(role) ? card : null;
}

router.get("/", async (req: AuthRequest, res) => {
  const cardId = req.query.cardId as string | undefined;
  if (!cardId) return res.status(400).json({ error: "cardId is required" });

  const card = await assertCardAccess(cardId, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  const comments = await prisma.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    include: authorInclude,
  });
  res.json(comments);
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const card = await assertCardEditAccess(parsed.data.cardId, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  const priorAuthors = await prisma.comment.findMany({
    where: { cardId: card.id },
    select: { authorId: true },
    distinct: ["authorId"],
  });

  const comment = await prisma.comment.create({
    data: { text: parsed.data.text, cardId: card.id, authorId: req.userId! },
    include: authorInclude,
  });
  emitToBoard(card.list.boardId, "comment:created", comment);

  const recipients = new Set([...priorAuthors.map((c) => c.authorId), card.list.board.ownerId]);
  recipients.delete(req.userId!);
  for (const recipientId of recipients) {
    await notifyUser(
      recipientId,
      "COMMENT",
      `${comment.author.name} оставил(а) комментарий к карточке «${card.title}»`,
      { boardId: card.list.boardId, cardId: card.id },
    );
  }

  res.status(201).json(comment);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: { card: { include: { list: { include: { board: true } } } } },
  });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  const role = await getBoardRole(
    comment.card.list.board.ownerId,
    comment.card.list.boardId,
    req.userId!,
  );
  if (!canEdit(role)) return res.status(404).json({ error: "Comment not found" });

  await prisma.comment.delete({ where: { id: comment.id } });
  emitToBoard(comment.card.list.boardId, "comment:deleted", {
    id: comment.id,
    cardId: comment.cardId,
  });
  res.status(204).send();
});

export default router;
