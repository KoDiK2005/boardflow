import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return { token: res.body.token as string, user: res.body.user };
}

describe("board members", () => {
  let ownerToken: string;
  let boardId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com");
    ownerToken = owner.token;

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Shared board" });
    boardId = board.body.id;
  });

  it("invites a member by email", async () => {
    await registerUser("member@example.com");

    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "member@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("member@example.com");
  });

  it("rejects invite for an unknown email", async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(404);
  });

  it("rejects invite from a non-owner", async () => {
    const other = await registerUser("intruder@example.com");
    await registerUser("member2@example.com");

    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ email: "member2@example.com" });

    expect(res.status).toBe(404);
  });

  it("lets an invited member access the board and add lists", async () => {
    const member = await registerUser("collab@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "collab@example.com" });

    const detail = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(detail.status).toBe(200);

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ boardId, title: "Member's list" });
    expect(list.status).toBe(201);

    const boards = await request(app)
      .get("/api/boards")
      .set("Authorization", `Bearer ${member.token}`);
    expect(boards.body.some((b: { id: string }) => b.id === boardId)).toBe(true);
  });

  it("prevents a member from deleting the board", async () => {
    const member = await registerUser("collab2@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "collab2@example.com" });

    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(res.status).toBe(404);
  });

  it("removes a member's access after they are removed", async () => {
    const member = await registerUser("collab3@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "collab3@example.com" });

    await request(app)
      .delete(`/api/boards/${boardId}/members/${member.user.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const detail = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(detail.status).toBe(404);
  });
});
