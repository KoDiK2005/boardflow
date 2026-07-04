import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return res.body.token as string;
}

describe("boards", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerUser("owner@example.com");
  });

  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/boards");
    expect(res.status).toBe(401);
  });

  it("creates and lists boards for the authenticated user", async () => {
    const create = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "My board" });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get("/api/boards")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe("My board");
  });

  it("prevents one user from accessing another user's board", async () => {
    const create = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Private board" });
    const boardId = create.body.id;

    const otherToken = await registerUser("intruder@example.com");
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it("prevents deleting a board owned by another user", async () => {
    const create = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Private board" });
    const boardId = create.body.id;

    const otherToken = await registerUser("intruder2@example.com");
    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it("returns nested lists and cards on board detail", async () => {
    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board with lists" });
    const boardId = board.body.id;

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "To Do" });

    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId: list.body.id, title: "First card" });

    const detail = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body.lists).toHaveLength(1);
    expect(detail.body.lists[0].cards).toHaveLength(1);
    expect(detail.body.lists[0].cards[0].title).toBe("First card");
  });
});
