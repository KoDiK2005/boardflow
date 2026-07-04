import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return { token: res.body.token as string, user: res.body.user };
}

describe("board member roles", () => {
  let ownerToken: string;
  let boardId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com");
    ownerToken = owner.token;

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Role test board" });
    boardId = board.body.id;
  });

  it("defaults invited members to EDITOR", async () => {
    await registerUser("editor@example.com");
    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "editor@example.com" });

    expect(res.body.role).toBe("EDITOR");
  });

  it("prevents a VIEWER from creating lists", async () => {
    const viewer = await registerUser("viewer@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "viewer@example.com", role: "VIEWER" });

    const res = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ boardId, title: "Should fail" });

    expect(res.status).toBe(403);
  });

  it("allows a VIEWER to read the board", async () => {
    const viewer = await registerUser("viewer2@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "viewer2@example.com", role: "VIEWER" });

    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(res.status).toBe(200);
  });

  it("allows an EDITOR to create lists and cards", async () => {
    const editor = await registerUser("editor2@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "editor2@example.com", role: "EDITOR" });

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${editor.token}`)
      .send({ boardId, title: "Editor list" });

    expect(list.status).toBe(201);
  });

  it("prevents an EDITOR from inviting other members", async () => {
    const editor = await registerUser("editor3@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "editor3@example.com", role: "EDITOR" });

    await registerUser("newperson@example.com");
    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${editor.token}`)
      .send({ email: "newperson@example.com" });

    expect(res.status).toBe(403);
  });

  it("allows an ADMIN to invite members but not grant ADMIN role", async () => {
    const admin = await registerUser("admin@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "admin@example.com", role: "ADMIN" });

    await registerUser("newperson2@example.com");
    const okInvite = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: "newperson2@example.com", role: "EDITOR" });
    expect(okInvite.status).toBe(201);

    await registerUser("newperson3@example.com");
    const blockedInvite = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: "newperson3@example.com", role: "ADMIN" });
    expect(blockedInvite.status).toBe(403);
  });

  it("lets the owner change a member's role", async () => {
    const member = await registerUser("promote@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "promote@example.com", role: "VIEWER" });

    const res = await request(app)
      .patch(`/api/boards/${boardId}/members/${member.user.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "EDITOR" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("EDITOR");
  });
});
