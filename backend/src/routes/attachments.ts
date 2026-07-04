import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { canEdit, getBoardRole, hasBoardAccess } from "../lib/access";
import { prisma } from "../lib/prisma";
import { uploadsDir } from "../lib/uploads";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { emitToBoard } from "../socket";

const router = Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const uploaderInclude = { uploadedBy: { select: { id: true, name: true } } } as const;

async function assertCardEditAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card) return null;
  const role = await getBoardRole(card.list.board.ownerId, card.list.boardId, userId);
  return canEdit(role) ? card : null;
}

router.get("/cards/:cardId/attachments", async (req: AuthRequest, res) => {
  const card = await prisma.card.findUnique({
    where: { id: req.params.cardId },
    include: { list: { include: { board: true } } },
  });
  if (!card) return res.status(404).json({ error: "Card not found" });

  const allowed = await hasBoardAccess(card.list.board.ownerId, card.list.boardId, req.userId!);
  if (!allowed) return res.status(404).json({ error: "Card not found" });

  const attachments = await prisma.attachment.findMany({
    where: { cardId: card.id },
    orderBy: { createdAt: "asc" },
    include: uploaderInclude,
  });
  res.json(attachments);
});

router.post("/cards/:cardId/attachments", upload.single("file"), async (req: AuthRequest, res) => {
  const card = await assertCardEditAccess(req.params.cardId, req.userId!);
  if (!card) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Card not found" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const attachment = await prisma.attachment.create({
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      cardId: card.id,
      uploadedById: req.userId!,
    },
    include: uploaderInclude,
  });
  emitToBoard(card.list.boardId, "attachment:created", attachment);
  res.status(201).json(attachment);
});

router.get("/attachments/:id", async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: req.params.id },
    include: { card: { include: { list: { include: { board: true } } } } },
  });
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const allowed = await hasBoardAccess(
    attachment.card.list.board.ownerId,
    attachment.card.list.boardId,
    req.userId!,
  );
  if (!allowed) return res.status(404).json({ error: "Attachment not found" });

  const filePath = path.join(uploadsDir, attachment.filename);
  res.download(filePath, attachment.originalName);
});

router.delete("/attachments/:id", async (req: AuthRequest, res) => {
  const attachment = await prisma.attachment.findUnique({
    where: { id: req.params.id },
    include: { card: { include: { list: { include: { board: true } } } } },
  });
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const role = await getBoardRole(
    attachment.card.list.board.ownerId,
    attachment.card.list.boardId,
    req.userId!,
  );
  if (!canEdit(role)) return res.status(404).json({ error: "Attachment not found" });

  await prisma.attachment.delete({ where: { id: attachment.id } });
  fs.unlink(path.join(uploadsDir, attachment.filename), () => {});
  emitToBoard(attachment.card.list.boardId, "attachment:deleted", {
    id: attachment.id,
    cardId: attachment.cardId,
  });
  res.status(204).send();
});

export default router;
