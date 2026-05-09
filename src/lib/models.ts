import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "Misafir" },
    monthlyIncome: { type: Number, default: 0 },
    monthlyBudget: { type: Number, default: 0 },
    savingsGoal: { type: Number, default: 0 },
    riskTolerance: { type: String, enum: ["düşük", "orta", "yüksek"], default: "orta" },
    goals: { type: [String], default: [] },
  },
  { timestamps: true }
);

const TransactionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["gelir", "gider"], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    note: String,
    date: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

const ChatMessageSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserModel = models.User || model("User", UserSchema);
export const TransactionModel = models.Transaction || model("Transaction", TransactionSchema);
export const ChatMessageModel = models.ChatMessage || model("ChatMessage", ChatMessageSchema);

export type Mongo = typeof mongoose;
