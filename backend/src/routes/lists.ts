import { Router } from "express";
import { z } from "zod";
import { canEdit, getBoardRole, requireBoardWithRole } from "../lib/access";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { emitToBoard } from "../socket";

const router = Router();
router.use(requireAuth);

const createListSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1),
});

const reorderSchema = z.object({ position: z.number().int().min(0) });

async function assertListOwnership(listId: string, userId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId }, include: { board: true } });
  if (!list) return null;
  const role = await getBoardRole(list.board.ownerId, list.boardId, userId);
  return canEdit(role) ? list : null;
}

router.post("/", async (req: AuthRequest, res) => {
  const parsed = createListSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ctx = await requireBoardWithRole(parsed.data.boardId, req.userId!);
  if (!ctx) return res.status(404).json({ error: "Board not found" });
  if (!canEdit(ctx.role)) return res.status(403).json({ error: "Insufficient permissions" });

  const maxPosition = await prisma.list.aggregate({
    where: { boardId: ctx.board.id },
    _max: { position: true },
  });
  const list = await prisma.list.create({
    data: {
      title: parsed.data.title,
      boardId: ctx.board.id,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });
  emitToBoard(ctx.board.id, "list:created", list);
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
  emitToBoard(list.boardId, "list:updated", updated);
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const list = await assertListOwnership(req.params.id, req.userId!);
  if (!list) return res.status(404).json({ error: "List not found" });

  await prisma.list.delete({ where: { id: list.id } });
  emitToBoard(list.boardId, "list:deleted", { id: list.id });
  res.status(204).send();
});

export default router;
export { assertListOwnership };
