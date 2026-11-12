import { Router } from "express";
import { randomUUID } from "node:crypto";
import { Supplier, Product, Movement, Order, User, Audit } from "../models/index.js";
import { resetToSeed } from "../seed.js";

const router = Router();
const uid = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const actorOf = (req) => req.get("x-actor") || "System";
const json = (doc) => (doc?.toJSON ? doc.toJSON() : doc);

const audit = (req, action, detail) =>
  Audit.create({ _id: uid("a"), actor: actorOf(req), action, detail, at: new Date() });

// Never let the client overwrite identifiers or server-managed fields.
const clean = (body, drop = []) => {
  const rest = { ...(body ?? {}) };
  ["id", "_id", ...drop].forEach((key) => delete rest[key]);
  return rest;
};

// ---- Bootstrap: everything the UI needs in one request ----
router.get(
  "/bootstrap",
  wrap(async (_req, res) => {
    const [products, suppliers, movements, orders, users, auditLog] = await Promise.all([
      Product.find().sort({ updatedAt: -1 }),
      Supplier.find().sort({ name: 1 }),
      Movement.find().sort({ at: -1 }),
      Order.find().sort({ createdAt: -1 }),
      User.find().sort({ name: 1 }),
      Audit.find().sort({ at: -1 }).limit(60),
    ]);
    res.json({
      products: products.map(json),
      suppliers: suppliers.map(json),
      movements: movements.map(json),
      orders: orders.map(json),
      users: users.map(json),
      audit: auditLog.map(json),
    });
  }),
);

// ---- Products ----
router.post(
  "/products",
  wrap(async (req, res) => {
    const product = await Product.create({ ...clean(req.body), _id: uid("p"), updatedAt: new Date() });
    await audit(req, "Created product", `${product.sku} — ${product.name}`);
    res.status(201).json(product);
  }),
);

router.patch(
  "/products/:id",
  wrap(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...clean(req.body), updatedAt: new Date() },
      { new: true, runValidators: true },
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    await audit(req, "Updated product", `${product.sku} — ${product.name}`);
    res.json(product);
  }),
);

router.delete(
  "/products/:id",
  wrap(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    await Movement.deleteMany({ productId: req.params.id });
    await audit(req, "Deleted product", `${product.sku} — ${product.name}`);
    res.status(204).end();
  }),
);

// ---- Stock movements (adjusts product quantity, never below zero) ----
router.post(
  "/movements",
  wrap(async (req, res) => {
    const { productId, type, note } = req.body ?? {};
    const amount = Number(req.body?.quantity) || 0;
    if (!["in", "out", "adjust"].includes(type)) return res.status(400).json({ error: "Invalid movement type" });

    const delta = type === "out" ? -Math.abs(amount) : amount;
    const now = new Date();
    // Aggregation-pipeline update lets us clamp at 0 atomically.
    const product = await Product.findOneAndUpdate(
      { _id: productId },
      [{ $set: { quantity: { $max: [0, { $add: ["$quantity", delta] }] }, updatedAt: now } }],
      { new: true },
    );
    if (!product) return res.status(404).json({ error: "Product not found" });

    const movement = await Movement.create({
      _id: uid("m"),
      productId,
      type,
      quantity: amount,
      note: note?.trim() || "No reference provided",
      user: actorOf(req),
      at: now,
    });
    const verb = type === "in" ? "Received stock" : type === "out" ? "Released stock" : "Adjusted stock";
    await audit(req, verb, `${product.sku} — ${delta > 0 ? "+" : ""}${delta} ${product.unit ?? "units"}`);
    res.status(201).json(movement);
  }),
);

// ---- Suppliers ----
router.post(
  "/suppliers",
  wrap(async (req, res) => {
    const supplier = await Supplier.create({ ...clean(req.body), _id: uid("s") });
    await audit(req, "Created supplier", supplier.name);
    res.status(201).json(supplier);
  }),
);

router.patch(
  "/suppliers/:id",
  wrap(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, clean(req.body), {
      new: true,
      runValidators: true,
    });
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    await audit(req, "Updated supplier", supplier.name);
    res.json(supplier);
  }),
);

router.delete(
  "/suppliers/:id",
  wrap(async (req, res) => {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    await audit(req, "Deleted supplier", supplier.name);
    res.status(204).end();
  }),
);

// ---- Purchase orders ----
router.post(
  "/orders",
  wrap(async (req, res) => {
    const order = await Order.create({ ...clean(req.body, ["createdAt"]), _id: uid("o"), createdAt: new Date() });
    await audit(req, "Created purchase order", order.code);
    res.status(201).json(order);
  }),
);

router.patch(
  "/orders/:id/status",
  wrap(async (req, res) => {
    const { status } = req.body ?? {};
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const shouldReceive = status === "Received" && order.status !== "Received";
    order.status = status;
    await order.save(); // runs enum validation before any stock is touched

    if (shouldReceive) {
      const now = new Date();
      for (const line of order.items) {
        await Product.updateOne({ _id: line.productId }, { $inc: { quantity: line.quantity }, $set: { updatedAt: now } });
      }
      await Movement.insertMany(
        order.items.map((line) => ({
          _id: uid("m"),
          productId: line.productId,
          type: "in",
          quantity: line.quantity,
          note: `Received via ${order.code}`,
          user: actorOf(req),
          at: now,
        })),
      );
    }
    await audit(req, "Updated purchase order", `${order.code} → ${status}`);
    res.json(order);
  }),
);

// ---- Users ----
router.post(
  "/users",
  wrap(async (req, res) => {
    const user = await User.create({ ...clean(req.body), _id: uid("u") });
    await audit(req, "Invited user", `${user.name} (${user.role})`);
    res.status(201).json(user);
  }),
);

router.patch(
  "/users/:id",
  wrap(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, clean(req.body), { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    await audit(req, "Updated user", user.name);
    res.json(user);
  }),
);

router.delete(
  "/users/:id",
  wrap(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    await audit(req, "Removed user", user.name);
    res.status(204).end();
  }),
);

// ---- Reset demo data ----
router.post(
  "/reset",
  wrap(async (_req, res) => {
    await resetToSeed();
    res.status(204).end();
  }),
);

export default router;
