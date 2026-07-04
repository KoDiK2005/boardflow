import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return res.body.token as string;
}

describe("position assignment", () => {
  let token: string;
  let boardId: string;

  beforeEach(async () => {
    token = await registerUser("owner@example.com");
    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });
    boardId = board.body.id;
  });

  it("assigns unique, increasing positions to cards after a middle one is deleted", async () => {
    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "List" });
    const listId = list.body.id;

    const cardA = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId, title: "A" });
    const cardB = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId, title: "B" });
    await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId, title: "C" });

    expect([cardA.body.position, cardB.body.position]).toEqual([0, 1]);

    // Delete the middle card (B), leaving A(0) and C(2)
    await request(app)
      .delete(`/api/cards/${cardB.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    const cardD = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId, title: "D" });

    const board = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    const positions = board.body.lists[0].cards.map((c: { position: number }) => c.position);
    const uniquePositions = new Set(positions);

    expect(uniquePositions.size).toBe(positions.length);
    expect(cardD.body.position).toBe(3);
  });

  it("assigns unique, increasing positions to lists after a middle one is deleted", async () => {
    const listA = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "A" });
    const listB = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "B" });
    await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "C" });

    expect([listA.body.position, listB.body.position]).toEqual([0, 1]);

    await request(app)
      .delete(`/api/lists/${listB.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    const listD = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "D" });

    const board = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    const positions = board.body.lists.map((l: { position: number }) => l.position);
    const uniquePositions = new Set(positions);

    expect(uniquePositions.size).toBe(positions.length);
    expect(listD.body.position).toBe(3);
  });
});
