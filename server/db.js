import mongoose from "mongoose";

export async function connectDb(uri) {
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB connected (${mongoose.connection.name})`);
}
