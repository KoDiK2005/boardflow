import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("auth", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.email).toBe("alice@example.com");
  });

  it("rejects registering the same email twice", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "bob@example.com", password: "password123", name: "Bob" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "bob@example.com", password: "password123", name: "Bob" });

    expect(res.status).toBe(409);
  });

  it("rejects registration with an invalid payload", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "short", name: "" });

    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "carol@example.com", password: "password123", name: "Carol" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "carol@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
  });

  it("rejects login with wrong password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "dave@example.com", password: "password123", name: "Dave" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "dave@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});
