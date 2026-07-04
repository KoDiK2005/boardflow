import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createCommentSchema = z.object({
  cardId: z.string().uuid(),
  text: z.string().min(1),
});

async function assertCardAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card || card.list.board.ownerId !== userId) return null;
  return card;
}

router.get("/", async (req: AuthRequest, res) => {
  const cardId = req.query.cardId as string | undefined;
  if (!cardId) return res.status(400).json({ error: "cardId is required" });

  const card = await assertCardAccess(cardId, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  const comments = await prisma.comment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });
  res.json(comments);
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const card = await assertCardAccess(parsed.data.cardId, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  const comment = await prisma.comment.create({
    data: { text: parsed.data.text, cardId: card.id, authorId: req.userId! },
    include: { author: { select: { id: true, name: true } } },
  });
  res.status(201).json(comment);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: { card: { include: { list: { include: { board: true } } } } },
  });
  if (!comment || comment.card.list.board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Comment not found" });
  }

  await prisma.comment.delete({ where: { id: comment.id } });
  res.status(204).send();
});

export default router;
