import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const g = globalThis as unknown as { __mongoose?: Cached };
const cached: Cached = g.__mongoose || (g.__mongoose = { conn: null, promise: null });

export const isMongoEnabled = !!MONGODB_URI;

export async function connectMongo(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) return null;
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m)
      .catch((err) => {
        console.warn("[mongo] bağlantı başarısız, in-memory store kullanılacak:", err.message);
        cached.promise = null;
        throw err;
      });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch {
    return null;
  }
}
