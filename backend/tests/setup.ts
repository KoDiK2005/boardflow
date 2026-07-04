import fs from "fs";
import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { uploadsDir } from "../src/lib/uploads";

beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.label.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();

  for (const file of fs.readdirSync(uploadsDir)) {
    fs.unlinkSync(`${uploadsDir}/${file}`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
