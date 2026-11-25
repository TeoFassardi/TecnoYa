import mongoose from "mongoose";
import { config } from "./config.js";
import { Product } from "./product.js";
await mongoose.connect(config.MONGODB_URI);
try {
  const samples = [
    ["Logitech", "K380", "teclados", 65000],
    ["Redragon", "Kumara K552", "teclados", 82000],
    ["HyperX", "Alloy Origins", "teclados", 155000],
    ["Genius", "Smart KB-101", "teclados", 21000],
    ["Logitech", "G203 Lightsync", "mouse", 38000],
    ["Razer", "DeathAdder Essential", "mouse", 55000],
    ["Redragon", "Cobra M711", "mouse", 32000],
    ["Logitech", "MX Master 3S", "mouse", 190000],
    ["HyperX", "Cloud Stinger 2", "auriculares", 88000],
    ["Logitech", "G435", "auriculares", 110000],
    ["Redragon", "Zeus X", "auriculares", 95000],
    ["JBL", "Quantum 100", "auriculares", 63000],
    ["Samsung", "T350 24 pulgadas", "monitores", 210000],
    ["LG", "UltraGear 24 pulgadas", "monitores", 340000],
    ["Asus", "TUF Gaming 27 pulgadas", "monitores", 490000],
    ["Philips", "Serie 3000 24 pulgadas", "monitores", 195000],
  ] as const;
  for (const [index, [brand, model, category, price]] of samples.entries()) {
    const name = `${brand} ${model}`;
    await Product.updateOne(
      { name },
      {
        $setOnInsert: {
          name,
          brand,
          category,
          priceCents: price * 100,
          stock: index % 5 === 0 ? 0 : 8 + index,
          description: `${name}. Una opción para completar tu espacio de trabajo o de juego.\nProducto de demostración: precio y disponibilidad ilustrativos.`,
          imageUrl: "",
          archivedAt: null,
        },
      },
      { upsert: true },
    );
  }
  console.log(
    "16 productos de demostración cargados sin sobrescribir los existentes.",
  );
} finally {
  await mongoose.disconnect();
}
