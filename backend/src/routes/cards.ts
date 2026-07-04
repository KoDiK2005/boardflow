import { Router } from "express";
import { z } from "zod";
import { canEdit, getBoardRole } from "../lib/access";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { assertListOwnership } from "./lists";
import { emitToBoard } from "../socket";

const router = Router();
router.use(requireAuth);

const createCardSchema = z.object({
  listId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  position: z.number().int().min(0).optional(),
  listId: z.string().uuid().optional(),
});

async function assertCardOwnership(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card) return null;
  const role = await getBoardRole(card.list.board.ownerId, card.list.boardId, userId);
  return canEdit(role) ? card : null;
}

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const list = await assertListOwnership(parsed.data.listId, req.userId!);
  if (!list) return res.status(404).json({ error: "List not found" });

  const maxPosition = await prisma.card.aggregate({
    where: { listId: list.id },
    _max: { position: true },
  });
  const card = await prisma.card.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      listId: list.id,
      position: (maxPosition._max.position ?? -1) + 1,
    },
    include: { labels: true, _count: { select: { attachments: true } } },
  });
  emitToBoard(list.boardId, "card:created", card);
  res.status(201).json(card);
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = updateCardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const card = await assertCardOwnership(req.params.id, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  if (parsed.data.listId) {
    const targetList = await assertListOwnership(parsed.data.listId, req.userId!);
    if (!targetList) return res.status(404).json({ error: "Target list not found" });
  }

  const { dueDate, ...rest } = parsed.data;
  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: { labels: true, _count: { select: { attachments: true } } },
  });
  emitToBoard(card.list.boardId, "card:updated", updated);
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const card = await assertCardOwnership(req.params.id, req.userId!);
  if (!card) return res.status(404).json({ error: "Card not found" });

  await prisma.card.delete({ where: { id: card.id } });
  emitToBoard(card.list.boardId, "card:deleted", { id: card.id });
  res.status(204).send();
});

export default router;
