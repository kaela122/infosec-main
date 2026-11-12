import mongoose from "mongoose";

const { Schema, model } = mongoose;

// We keep the app's existing string ids ("p1", "s3", ...) as _id so that
// references between collections keep working, and expose them as `id` in JSON.
const options = {
  versionKey: false,
  toJSON: {
    transform: (_doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  },
};

const make = (name, definition) =>
  model(name, new Schema({ _id: { type: String, required: true }, ...definition }, options));

export const Supplier = make("Supplier", {
  name: { type: String, required: true, trim: true },
  contact: String,
  email: String,
  phone: String,
  city: String,
  leadTime: Number,
  rating: Number,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
});

export const Product = make("Product", {
  sku: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: String,
  supplierId: String,
  cost: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 0 },
  unit: String,
  location: String,
  updatedAt: { type: Date, default: Date.now },
});

export const Movement = make("Movement", {
  productId: { type: String, required: true, index: true },
  type: { type: String, enum: ["in", "out", "adjust"], required: true },
  quantity: Number,
  note: String,
  user: String,
  at: { type: Date, default: Date.now, index: true },
});

export const Order = make("Order", {
  code: { type: String, required: true, unique: true },
  supplierId: String,
  status: { type: String, enum: ["Draft", "Sent", "Received", "Cancelled"], default: "Draft" },
  createdAt: { type: Date, default: Date.now },
  expectedAt: Date,
  items: [{ _id: false, productId: String, quantity: Number, unitCost: Number }],
});

export const User = make("User", {
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: String,
  status: { type: String, default: "Active" },
  mfa: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
});

export const Audit = make("Audit", {
  actor: String,
  action: String,
  detail: String,
  at: { type: Date, default: Date.now, index: true },
});

export const models = { Supplier, Product, Movement, Order, User, Audit };
