import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

beforeEach(async () => {
  await prisma.comment.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.label.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
