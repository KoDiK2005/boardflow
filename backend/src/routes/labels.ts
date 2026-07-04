import { Router } from "express";
import { z } from "zod";
import { canEdit, getBoardRole, hasBoardAccess } from "../lib/access";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { assertBoardAccess } from "./boards";
import { emitToBoard } from "../socket";

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

  const board = await assertBoardAccess(boardId, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const labels = await prisma.label.findMany({ where: { boardId } });
  res.json(labels);
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createLabelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await prisma.board.findUnique({ where: { id: parsed.data.boardId } });
  if (!board) return res.status(404).json({ error: "Board not found" });
  const role = await getBoardRole(board.ownerId, board.id, req.userId!);
  if (!role) return res.status(404).json({ error: "Board not found" });
  if (!canEdit(role)) return res.status(403).json({ error: "Insufficient permissions" });

  const label = await prisma.label.create({
    data: { title: parsed.data.title, color: parsed.data.color, boardId: board.id },
  });
  emitToBoard(board.id, "label:created", label);
  res.status(201).json(label);
});

router.post("/:id/cards/:cardId", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label) return res.status(404).json({ error: "Label not found" });
  const role = await getBoardRole(label.board.ownerId, label.boardId, req.userId!);
  if (!canEdit(role)) return res.status(404).json({ error: "Label not found" });

  const card = await prisma.card.findUnique({
    where: { id: req.params.cardId },
    include: { list: { include: { board: true } } },
  });
  if (
    !card ||
    !(await hasBoardAccess(card.list.board.ownerId, card.list.boardId, req.userId!))
  ) {
    return res.status(404).json({ error: "Card not found" });
  }

  await prisma.card.update({
    where: { id: card.id },
    data: { labels: { connect: { id: label.id } } },
  });
  emitToBoard(label.boardId, "card:label-changed", {
    cardId: card.id,
    label,
    attached: true,
  });
  res.status(204).send();
});

router.delete("/:id/cards/:cardId", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label) return res.status(404).json({ error: "Label not found" });
  const role = await getBoardRole(label.board.ownerId, label.boardId, req.userId!);
  if (!canEdit(role)) return res.status(404).json({ error: "Label not found" });

  await prisma.card.update({
    where: { id: req.params.cardId },
    data: { labels: { disconnect: { id: label.id } } },
  });
  emitToBoard(label.boardId, "card:label-changed", {
    cardId: req.params.cardId,
    label,
    attached: false,
  });
  res.status(204).send();
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const label = await prisma.label.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (!label) return res.status(404).json({ error: "Label not found" });
  const role = await getBoardRole(label.board.ownerId, label.boardId, req.userId!);
  if (!canEdit(role)) return res.status(404).json({ error: "Label not found" });

  await prisma.label.delete({ where: { id: label.id } });
  emitToBoard(label.boardId, "label:deleted", { id: label.id });
  res.status(204).send();
});

export default router;
