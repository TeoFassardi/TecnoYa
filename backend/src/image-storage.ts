import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const imageSizeLimit = 2 * 1024 * 1024;
const base64SizeLimit = Math.ceil(imageSizeLimit / 3) * 4;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const imageUpload = z.base64().max(base64SizeLimit).transform((data, ctx) => {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > imageSizeLimit) {
    ctx.addIssue({ code: "custom", message: "La imagen debe pesar hasta 2 MB" });
    return z.NEVER;
  }
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(pngSignature) &&
      bytes.toString("ascii", 12, 16) === "IHDR")
    return { bytes, extension: "png", contentType: "image/png" };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes.readUInt16BE(bytes.length - 2) === 0xffd9)
    return { bytes, extension: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) === bytes.length - 8 &&
      ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16)))
    return { bytes, extension: "webp", contentType: "image/webp" };
  ctx.addIssue({ code: "custom", message: "Elegí una imagen JPEG, PNG o WebP válida" });
  return z.NEVER;
});

export interface ImageStorage {
  upload(image: z.output<typeof imageUpload>): Promise<string>;
  owns(url: string): boolean;
  remove(url: string): Promise<void>;
}

export function createImageStorage(url: string, secret: string, bucketName: string): ImageStorage {
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    },
  });
  const bucket = client.storage.from(bucketName);
  const prefix = bucket.getPublicUrl("tecno").data.publicUrl.slice(0, -"tecno".length);
  function keyFor(publicUrl: string) {
    if (!publicUrl.startsWith(prefix)) return undefined;
    const key = publicUrl.slice(prefix.length);
    return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key) ? key : undefined;
  }
  return {
    async upload({ bytes, extension, contentType }) {
      const key = `${randomUUID()}.${extension}`;
      const { error } = await bucket.upload(key, bytes, {
        contentType, cacheControl: "86400", upsert: false,
      });
      if (error) throw new Error("Falló la carga a Storage");
      return bucket.getPublicUrl(key).data.publicUrl;
    },
    owns: (publicUrl) => Boolean(keyFor(publicUrl)),
    async remove(publicUrl) {
      const key = keyFor(publicUrl);
      if (!key) return;
      const { error } = await bucket.remove([key]);
      if (error) throw new Error("Falló la limpieza en Storage");
    },
  };
}
