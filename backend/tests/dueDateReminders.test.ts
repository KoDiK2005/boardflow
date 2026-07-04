import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { checkDueDates } from "../src/jobs/dueDateReminders";
import { prisma } from "../src/lib/prisma";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return { token: res.body.token as string, user: res.body.user };
}

describe("due date reminders", () => {
  let ownerToken: string;
  let boardId: string;
  let listId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com");
    ownerToken = owner.token;

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Board" });
    boardId = board.body.id;

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ boardId, title: "List" });
    listId = list.body.id;
  });

  it("notifies the owner about a card due within 24 hours", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const dueSoon = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Due soon card", dueDate: dueSoon.toISOString() });

    await checkDueDates(now);

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const dueSoonNotifs = notifications.body.filter((n: { type: string }) => n.type === "DUE_SOON");
    expect(dueSoonNotifs).toHaveLength(1);
    expect(dueSoonNotifs[0].cardId).toBe(card.body.id);
  });

  it("notifies the owner about an overdue card", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const overdue = new Date(now.getTime() - 60 * 60 * 1000);

    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Overdue card", dueDate: overdue.toISOString() });

    await checkDueDates(now);

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const overdueNotifs = notifications.body.filter((n: { type: string }) => n.type === "OVERDUE");
    expect(overdueNotifs).toHaveLength(1);
  });

  it("does not repeat the same reminder on subsequent runs", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const overdue = new Date(now.getTime() - 60 * 60 * 1000);

    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Overdue card", dueDate: overdue.toISOString() });

    await checkDueDates(now);
    await checkDueDates(new Date(now.getTime() + 60 * 60 * 1000));

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const overdueNotifs = notifications.body.filter((n: { type: string }) => n.type === "OVERDUE");
    expect(overdueNotifs).toHaveLength(1);
  });

  it("notifies board members in addition to the owner", async () => {
    const member = await registerUser("member@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member@example.com", role: "VIEWER" });

    const now = new Date("2026-01-01T12:00:00.000Z");
    const overdue = new Date(now.getTime() - 60 * 60 * 1000);
    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Overdue card", dueDate: overdue.toISOString() });

    await checkDueDates(now);

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${member.token}`);
    const overdueNotifs = notifications.body.filter((n: { type: string }) => n.type === "OVERDUE");
    expect(overdueNotifs).toHaveLength(1);
  });

  it("ignores cards without a due date", async () => {
    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "No due date" });

    const result = await checkDueDates(new Date("2026-01-01T12:00:00.000Z"));
    expect(result.dueSoonCount).toBe(0);
    expect(result.overdueCount).toBe(0);
  });

  it("resends a reminder after the due date is changed", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const overdue = new Date(now.getTime() - 60 * 60 * 1000);

    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Card", dueDate: overdue.toISOString() });

    await checkDueDates(now);

    const stillOverdue = new Date(now.getTime() - 30 * 60 * 1000);
    await request(app)
      .patch(`/api/cards/${card.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ dueDate: stillOverdue.toISOString() });

    await checkDueDates(new Date(now.getTime() + 60 * 60 * 1000));

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const overdueNotifs = notifications.body.filter((n: { type: string }) => n.type === "OVERDUE");
    expect(overdueNotifs).toHaveLength(2);
  });

  it("resets notified flags on the card record after sending", async () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const overdue = new Date(now.getTime() - 60 * 60 * 1000);

    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId, title: "Card", dueDate: overdue.toISOString() });

    await checkDueDates(now);

    const dbCard = await prisma.card.findUnique({ where: { id: card.body.id } });
    expect(dbCard?.overdueNotifiedAt).not.toBeNull();
  });
});
