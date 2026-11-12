import { seedState } from "../src/lib/seed.js";
import { Supplier, Product, Movement, Order, User, Audit } from "./models/index.js";

const toDoc = ({ id, ...rest }) => ({ _id: id, ...rest });

export async function resetToSeed() {
  await Promise.all([Supplier, Product, Movement, Order, User, Audit].map((m) => m.deleteMany({})));
  await Promise.all([
    Supplier.insertMany(seedState.suppliers.map(toDoc)),
    Product.insertMany(seedState.products.map(toDoc)),
    Movement.insertMany(seedState.movements.map(toDoc)),
    Order.insertMany(seedState.orders.map(toDoc)),
    User.insertMany(seedState.users.map(toDoc)),
    Audit.insertMany(seedState.audit.map(toDoc)),
  ]);
}

export async function seedIfEmpty() {
  if ((await Product.estimatedDocumentCount()) > 0) return false;
  await resetToSeed();
  console.log("Seeded empty database with demo data");
  return true;
}
