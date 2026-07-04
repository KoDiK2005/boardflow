import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return { token: res.body.token as string, user: res.body.user };
}

describe("notifications", () => {
  let ownerToken: string;
  let boardId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com");
    ownerToken = owner.token;

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Board" });
    boardId = board.body.id;
  });

  it("notifies a user when invited to a board", async () => {
    const invitee = await registerUser("invitee@example.com");

    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "invitee@example.com", role: "EDITOR" });

    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${invitee.token}`);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].type).toBe("BOARD_INVITE");
    expect(list.body[0].read).toBe(false);
  });

  it("notifies a member when their role changes", async () => {
    const member = await registerUser("member@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member@example.com", role: "VIEWER" });

    await request(app)
      .patch(`/api/boards/${boardId}/members/${member.user.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "EDITOR" });

    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${member.token}`);

    const roleChanged = list.body.filter((n: { type: string }) => n.type === "ROLE_CHANGED");
    expect(roleChanged).toHaveLength(1);
  });

  it("notifies the board owner about a new comment from a member", async () => {
    const member = await registerUser("commenter@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "commenter@example.com", role: "EDITOR" });

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ boardId, title: "List" });
    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId: list.body.id, title: "Card" });

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ cardId: card.body.id, text: "Hello" });

    const ownerNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);

    const commentNotifs = ownerNotifications.body.filter(
      (n: { type: string }) => n.type === "COMMENT",
    );
    expect(commentNotifs).toHaveLength(1);
  });

  it("does not notify the comment author about their own comment", async () => {
    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ boardId, title: "List" });
    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId: list.body.id, title: "Card" });

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ cardId: card.body.id, text: "Hello" });

    const ownerNotifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(ownerNotifications.body).toHaveLength(0);
  });

  it("marks a notification as read and reflects unread-count", async () => {
    const invitee = await registerUser("invitee2@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "invitee2@example.com", role: "EDITOR" });

    const before = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(before.body.count).toBe(1);

    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${invitee.token}`);
    const notifId = list.body[0].id;

    await request(app)
      .patch(`/api/notifications/${notifId}/read`)
      .set("Authorization", `Bearer ${invitee.token}`);

    const after = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(after.body.count).toBe(0);
  });

  it("marks all notifications as read", async () => {
    const invitee = await registerUser("invitee3@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "invitee3@example.com", role: "EDITOR" });
    await request(app)
      .patch(`/api/boards/${boardId}/members/${invitee.user.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "VIEWER" });

    const before = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(before.body.count).toBe(2);

    await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${invitee.token}`);

    const after = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(after.body.count).toBe(0);
  });
});
