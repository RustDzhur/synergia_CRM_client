import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = global as typeof globalThis & { _mongoose?: Cache };
const cached: Cache = g._mongoose ?? (g._mongoose = { conn: null, promise: null });

export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    if (cached.conn) return cached.conn;
    if (!cached.promise) cached.promise = mongoose.connect(uri);
    cached.conn = await cached.promise;
    return cached.conn;
}