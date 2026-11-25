import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({ plugins: [adminClient()] });
export interface Product {
  _id: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type ProductInput = Pick<
  Product,
  | "name"
  | "description"
  | "brand"
  | "category"
  | "priceCents"
  | "stock"
  | "imageUrl"
>;
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "include" }),
  tagTypes: ["Products"],
  endpoints: (builder) => ({
    products: builder.query<{ items: Product[] }, string | void>({
      query: (status) =>
        status ? `/admin/products?status=${status}` : "/products",
      providesTags: ["Products"],
    }),
    product: builder.query<Product, { id: string; admin?: boolean }>({
      query: ({ id, admin }) => `${admin ? "/admin" : ""}/products/${id}`,
      providesTags: ["Products"],
    }),
    save: builder.mutation<Product, { id?: string; data: ProductInput }>({
      query: ({ id, data }) => ({
        url: `/products${id ? `/${id}` : ""}`,
        method: id ? "PATCH" : "POST",
        body: data,
      }),
      invalidatesTags: ["Products"],
    }),
    action: builder.mutation<
      void,
      { id: string; action: "archive" | "restore" | "permanent" }
    >({
      query: ({ id, action }) => ({
        url: `/products/${id}${action === "archive" ? "" : `/${action}`}`,
        method: action === "restore" ? "POST" : "DELETE",
      }),
      invalidatesTags: ["Products"],
    }),
  }),
});
export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});
export const money = (cents: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "data" in error) {
    const d = error.data;
    if (
      typeof d === "object" &&
      d &&
      "message" in d &&
      typeof d.message === "string"
    )
      return d.message;
  }
  return "No pudimos completar la operación. Revisá la conexión e intentá nuevamente.";
}
