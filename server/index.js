import "dotenv/config";
import { connectDb } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;

await connectDb(process.env.MONGODB_URI);
await seedIfEmpty();
createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));
