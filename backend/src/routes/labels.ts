import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { assertBoardOwnership } from "./boards";

const router = Router();
router.use(requireAuth);

const createLabelSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1),
  color: z.string().min(1),
});

router.get("/", async (req: AuthRequest, res) => {
  const boardId = req.query.boardId as string | undefined;
  if (!boardId) return res.status(400).json({ error: "boardId is required" });

  const board = await assertBoardOwnership(boardId, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const labels = await prisma.label.findMany({ where: { boardId } });
  res.json(labels);
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createLabelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await assertBoardOwnership(parsed.data.boardId, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const label = await prisma.label.create({
    data: { title: parsed.data.title, color: parsed.data.color, boardId: board.id },
  });
  res.status(201).json(label);
});

router.post("/:id/cards/:cardId", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label || label.board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Label not found" });
  }

  const card = await prisma.card.findUnique({
    where: { id: req.params.cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card || card.list.board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Card not found" });
  }

  await prisma.card.update({
    where: { id: card.id },
    data: { labels: { connect: { id: label.id } } },
  });
  res.status(204).send();
});

router.delete("/:id/cards/:cardId", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label || label.board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Label not found" });
  }

  await prisma.card.update({
    where: { id: req.params.cardId },
    data: { labels: { disconnect: { id: label.id } } },
  });
  res.status(204).send();
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label || label.board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Label not found" });
  }

  await prisma.label.delete({ where: { id: label.id } });
  res.status(204).send();
});

export default router;
