import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import boardRoutes from "./routes/boards";
import listRoutes from "./routes/lists";
import cardRoutes from "./routes/cards";
import labelRoutes from "./routes/labels";
import commentRoutes from "./routes/comments";
import attachmentRoutes from "./routes/attachments";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many attempts, please try again later" },
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/labels", labelRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api", attachmentRoutes);
