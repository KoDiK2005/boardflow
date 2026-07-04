import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

async function registerUser(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "User" });
  return { token: res.body.token as string, user: res.body.user };
}

describe("attachments", () => {
  let token: string;
  let cardId: string;
  let boardId: string;

  beforeEach(async () => {
    const owner = await registerUser("owner@example.com");
    token = owner.token;

    const board = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });
    boardId = board.body.id;

    const list = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${token}`)
      .send({ boardId, title: "List" });

    const card = await request(app)
      .post("/api/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({ listId: list.body.id, title: "Card" });
    cardId = card.body.id;
  });

  it("uploads a file and lists it", async () => {
    const upload = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");

    expect(upload.status).toBe(201);
    expect(upload.body.originalName).toBe("note.txt");
    expect(upload.body.size).toBe(11);

    const list = await request(app)
      .get(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("downloads an uploaded file with the original name", async () => {
    const upload = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(download.status).toBe(200);
    expect(download.text).toBe("hello world");
    expect(download.headers["content-disposition"]).toContain("note.txt");
  });

  it("deletes an attachment", async () => {
    const upload = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");

    const del = await request(app)
      .delete(`/api/attachments/${upload.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });

  it("prevents a VIEWER from uploading but allows downloading", async () => {
    const viewer = await registerUser("viewer@example.com");
    await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "viewer@example.com", role: "VIEWER" });

    const uploadAttempt = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");
    expect(uploadAttempt.status).toBe(404);

    const ownerUpload = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");

    const download = await request(app)
      .get(`/api/attachments/${ownerUpload.body.id}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(download.status).toBe(200);
  });

  it("rejects access to attachments from users with no board access", async () => {
    const outsider = await registerUser("outsider@example.com");
    const upload = await request(app)
      .post(`/api/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), "note.txt");

    const res = await request(app)
      .get(`/api/attachments/${upload.body.id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(404);
  });
});
