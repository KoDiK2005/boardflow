import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { assertBoardOwnership } from "./boards";

const router = Router();
router.use(requireAuth);

const createListSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1),
});

const reorderSchema = z.object({ position: z.number().int().min(0) });

async function assertListOwnership(listId: string, userId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId }, include: { board: true } });
  if (!list || list.board.ownerId !== userId) return null;
  return list;
}

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createListSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await assertBoardOwnership(parsed.data.boardId, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  const count = await prisma.list.count({ where: { boardId: board.id } });
  const list = await prisma.list.create({
    data: { title: parsed.data.title, boardId: board.id, position: count },
  });
  res.status(201).json(list);
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = createListSchema
    .pick({ title: true })
    .partial()
    .merge(reorderSchema.partial())
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const list = await assertListOwnership(req.params.id, req.userId!);
  if (!list) return res.status(404).json({ error: "List not found" });

  const updated = await prisma.list.update({ where: { id: list.id }, data: parsed.data });
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const list = await assertListOwnership(req.params.id, req.userId!);
  if (!list) return res.status(404).json({ error: "List not found" });

  await prisma.list.delete({ where: { id: list.id } });
  res.status(204).send();
});

export default router;
export { assertListOwnership };
