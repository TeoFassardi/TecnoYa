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
> & { imageBase64?: string; imageUrl?: string };
interface ProductPage {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export type UserRole = "user" | "admin";
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
interface ManagedSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string | null;
}
export interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
  products?: AssistantProduct[];
}
export type AssistantProduct = Pick<Product, "name" | "brand" | "category" | "priceCents" | "stock" | "imageUrl"> & { id: string };

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "include" }),
  tagTypes: ["Products", "Users", "Sessions"],
  endpoints: (builder) => ({
    chat: builder.mutation<
      { message: string; products: AssistantProduct[] },
      { message: string; history: Pick<AssistantMessage, "role" | "text">[] }
    >({
      query: (body) => ({ url: "/assistant/chat", method: "POST", body }),
    }),
    users: builder.query<{ items: ManagedUser[]; page: number; totalPages: number }, number>({
      query: (page) => ({ url: "/admin/users", params: { page } }),
      providesTags: ["Users"],
    }),
    changeRole: builder.mutation<void, { id: string; role: UserRole }>({
      query: ({ id, role }) => ({
        url: `/admin/users/${id}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: ["Users"],
    }),
    userSessions: builder.query<{ items: ManagedSession[] }, string>({
      query: (id) => `/admin/users/${id}/sessions`,
      providesTags: (_result, _error, id) => [{ type: "Sessions", id }],
    }),
    revokeSession: builder.mutation<void, { id: string; sessionId: string }>({
      query: ({ id, sessionId }) => ({
        url: `/admin/users/${id}/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Sessions", id }],
    }),
    products: builder.query<
      ProductPage,
      { page: number; limit?: number; status?: string; category?: string }
    >({
      query: ({ status, ...params }) => ({
        url: status ? "/admin/products" : "/products",
        params: status ? { ...params, status } : params,
      }),
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
