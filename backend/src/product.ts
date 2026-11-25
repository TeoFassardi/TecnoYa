import mongoose from "mongoose";
import { z } from "zod";
export const categories = [
  "teclados",
  "mouse",
  "auriculares",
  "monitores",
] as const;
export const productInput = z.strictObject({
  name: z.string().trim().min(1, "Ingresá un nombre").max(100),
  description: z.string().trim().min(1, "Ingresá una descripción").max(2000),
  brand: z.string().trim().min(1, "Ingresá una marca").max(80),
  category: z.enum(categories),
  priceCents: z.number().int().positive().max(100000000000),
  stock: z.number().int().min(0).max(1000000),
  imageUrl: z
    .union([
      z.url().refine((v) => v.startsWith("https://"), "Usá una URL HTTPS"),
      z.literal(""),
    ])
    .default(""),
});
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String, required: true },
    category: { type: String, enum: categories, required: true },
    priceCents: { type: Number, required: true },
    stock: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ archivedAt: 1, createdAt: -1 });
export const Product = mongoose.model("Product", schema);
