import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name });
  return { token: res.body.token as string, user: res.body.user };
}

describe("comment mentions", () => {
  let ownerToken: string;
  let boardId: string;
  let cardId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com", "Board Owner");
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
    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ listId: list.body.id, title: "Card" });
    cardId = card.body.id;
  });

  it("notifies a mentioned board member with a MENTION notification", async () => {
    const member = await registerUser("jane@example.com", "Jane Doe");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "jane@example.com", role: "EDITOR" });

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ cardId, text: "Hey @Jane_Doe can you check this?" });

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${member.token}`);

    const mentions = notifications.body.filter((n: { type: string }) => n.type === "MENTION");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].message).toContain("упомянул");
  });

  it("does not create a mention notification for an unmatched name", async () => {
    await registerUser("jane2@example.com", "Jane Doe");

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ cardId, text: "Hey @Nonexistent_Person, ignore this" });

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(notifications.body).toHaveLength(0);
  });

  it("does not double-notify a mentioned user who is also a thread watcher", async () => {
    const member = await registerUser("bob@example.com", "Bob Smith");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "bob@example.com", role: "EDITOR" });

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ cardId, text: "First comment" });

    await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ cardId, text: "Reply @Bob_Smith thanks!" });

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${member.token}`);

    const commentOrMentionNotifs = notifications.body.filter(
      (n: { type: string }) => n.type === "COMMENT" || n.type === "MENTION",
    );
    expect(commentOrMentionNotifs).toHaveLength(1);
    expect(commentOrMentionNotifs[0].type).toBe("MENTION");
  });
});
