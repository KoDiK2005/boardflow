import { Router } from "express";
import { z } from "zod";
import { canEdit, canManageMembers, getBoardRole, hasBoardAccess } from "../lib/access";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { emitToBoard } from "../socket";

const router = Router();
router.use(requireAuth);

const createBoardSchema = z.object({ title: z.string().min(1) });
const roleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER"]);
const inviteMemberSchema = z.object({ email: z.string().email(), role: roleSchema.optional() });
const updateMemberRoleSchema = z.object({ role: roleSchema });

async function assertBoardOwnership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board || board.ownerId !== userId) return null;
  return board;
}

async function assertBoardAccess(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return null;
  const allowed = await hasBoardAccess(board.ownerId, board.id, userId);
  return allowed ? board : null;
}

router.get("/", async (req: AuthRequest, res) => {
  const boards = await prisma.board.findMany({
    where: {
      OR: [{ ownerId: req.userId }, { members: { some: { userId: req.userId } } }],
    },
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
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!board) return res.status(404).json({ error: "Board not found" });

  const allowed = await hasBoardAccess(board.ownerId, board.id, req.userId!);
  if (!allowed) return res.status(404).json({ error: "Board not found" });

  res.json(board);
});

router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = createBoardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ error: "Board not found" });

  const role = await getBoardRole(board.ownerId, board.id, req.userId!);
  if (!role) return res.status(404).json({ error: "Board not found" });
  if (!canEdit(role)) return res.status(403).json({ error: "Insufficient permissions" });

  const updated = await prisma.board.update({
    where: { id: board.id },
    data: parsed.data,
  });
  emitToBoard(board.id, "board:updated", updated);
  res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const board = await assertBoardOwnership(req.params.id, req.userId!);
  if (!board) return res.status(404).json({ error: "Board not found" });

  await prisma.board.delete({ where: { id: board.id } });
  res.status(204).send();
});

router.post("/:id/members", async (req: AuthRequest, res) => {
  const parsed = inviteMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ error: "Board not found" });

  const requesterRole = await getBoardRole(board.ownerId, board.id, req.userId!);
  if (!requesterRole) return res.status(404).json({ error: "Board not found" });
  if (!canManageMembers(requesterRole)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const role = parsed.data.role ?? "EDITOR";
  if (role === "ADMIN" && requesterRole !== "OWNER") {
    return res.status(403).json({ error: "Only the board owner can grant admin access" });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: "User with this email was not found" });

  if (user.id === board.ownerId) {
    return res.status(409).json({ error: "This user already owns the board" });
  }

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: board.id, userId: user.id } },
  });
  if (existing) return res.status(409).json({ error: "User is already a member" });

  const member = await prisma.boardMember.create({
    data: { boardId: board.id, userId: user.id, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  emitToBoard(board.id, "member:added", member);
  res.status(201).json(member);
});

router.patch("/:id/members/:userId", async (req: AuthRequest, res) => {
  const parsed = updateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ error: "Board not found" });

  const requesterRole = await getBoardRole(board.ownerId, board.id, req.userId!);
  if (!requesterRole) return res.status(404).json({ error: "Board not found" });
  if (!canManageMembers(requesterRole)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  if (parsed.data.role === "ADMIN" && requesterRole !== "OWNER") {
    return res.status(403).json({ error: "Only the board owner can grant admin access" });
  }

  const member = await prisma.boardMember.update({
    where: { boardId_userId: { boardId: board.id, userId: req.params.userId } },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  emitToBoard(board.id, "member:updated", member);
  res.json(member);
});

router.delete("/:id/members/:userId", async (req: AuthRequest, res) => {
  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ error: "Board not found" });

  const requesterRole = await getBoardRole(board.ownerId, board.id, req.userId!);
  if (!requesterRole) return res.status(404).json({ error: "Board not found" });
  if (!canManageMembers(requesterRole)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  await prisma.boardMember.deleteMany({
    where: { boardId: board.id, userId: req.params.userId },
  });
  emitToBoard(board.id, "member:removed", { userId: req.params.userId });
  res.status(204).send();
});

export default router;
export { assertBoardOwnership, assertBoardAccess };
