import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createBoardSchema = z.object({ title: z.string().min(1) });

async function assertBoardOwnership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board || board.ownerId !== userId) return null;
  return board;
}

router.get("/", async (req: AuthRequest, res) => {
  const boards = await prisma.board.findMany({
    where: { ownerId: req.userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(boards);
});

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await prisma.board.create({
    data: { title: parsed.data.title, ownerId: req.userId! },
  });
  res.status(201).json(board);
});

router.get("/:id", async (req: AuthRequest, res) => {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: { cards: { orderBy: { position: "asc" }, include: { labels: true } } },
      },
      labels: true,
    },
  });
  if (!board || board.ownerId !== req.userId) {
    return res.status(404).json({ error: "Board not found" });
  }
  res.json(board);
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = createBoardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await assertBoardOwnership(req.params.id, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const updated = await prisma.board.update({
    where: { id: board.id },
    data: parsed.data,
  });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const board = await assertBoardOwnership(req.params.id, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  await prisma.board.delete({ where: { id: board.id } });
  res.status(204).send();
});

export default router;
export { assertBoardOwnership };
