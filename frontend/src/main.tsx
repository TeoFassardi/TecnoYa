import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useNavigationType,
  useParams,
  useSearchParams,
} from "react-router";
import {
  Keyboard,
  Mouse,
  Headphones,
  Monitor,
  ArrowUpRight,
  Archive,
  RotateCcw,
  Trash2,
  Plus,
  Pencil,
  Plug,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  api,
  authClient,
  store,
  money,
  errorMessage,
  type Product,
} from "./data";
import "./styles.css";
const Assistant = lazy(() => import("./assistant"));
const categories = [
  { id: "teclados", name: "Teclados", Icon: Keyboard },
  { id: "mouse", name: "Mouse", Icon: Mouse },
  { id: "auriculares", name: "Auriculares", Icon: Headphones },
  { id: "monitores", name: "Monitores", Icon: Monitor },
];
function ProductVisual({ product, decorative = false }: { product: Product; decorative?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const Icon = categories.find((c) => c.id === product.category)?.Icon ?? Plug;
  return (
    <div className={`product-visual ${product.category}`} aria-hidden={decorative || undefined}>
      {product.imageUrl && product.imageUrl !== failedUrl ? (
        <img
          src={product.imageUrl}
          alt={decorative ? "" : product.name}
          loading="lazy"
          onError={() => setFailedUrl(product.imageUrl)}
        />
      ) : (
        <Icon aria-hidden="true" strokeWidth={1.1} />
      )}
    </div>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}

function Loading({ label, layout }: {
  label: string;
  layout?: "catalog" | "detail" | "list";
}) {
  return (
    <div className="loading-state" role="status">
      <p><span className="loading-dot" aria-hidden="true" />{label}</p>
      {layout === "catalog" && (
        <div className="product-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="loading-card" key={index}>
              <div className="product-visual loading-shape" />
              <div className="product-info">
                <div className="loading-line loading-shape" />
                <div className="loading-line loading-shape loading-short" />
              </div>
            </div>
          ))}
        </div>
      )}
      {layout === "detail" && (
        <div className="detail" aria-hidden="true">
          <div className="product-visual loading-shape" />
          <div className="loading-copy">
            <div className="loading-line loading-shape" />
            <div className="loading-line loading-shape loading-short" />
            <div className="loading-line loading-shape" />
          </div>
        </div>
      )}
      {layout === "list" && (
        <div className="loading-list" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="loading-row" key={index}>
              <div className="loading-thumbnail loading-shape" />
              <div className="loading-line loading-shape" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Layout() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const content = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [error, setError] = useState("");
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    content.current?.focus({ preventScroll: true });
    if (navigation !== "POP") window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, navigation]);
  async function logout() {
    const result = await authClient.signOut();
    if (result.error) {
      setError("No pudimos cerrar la sesión. Intentá nuevamente.");
      return;
    }
    store.dispatch(api.util.resetApiState());
    navigate("/");
  }
  return (
    <>
      <a className="skip" href="#main">
        Ir al contenido
      </a>
      <header>
        <Link className="logo" to="/">
          tecno<span>ya</span>
          <span className="logo-dot" />
        </Link>
        <nav aria-label="Principal">
          <NavLink to="/" end>Catálogo</NavLink>
          {session && <NavLink to="/assistant">Asistente</NavLink>}
          {session?.user.role === "admin" && (
            <>
              <NavLink to="/admin/products">Administración</NavLink>
              <NavLink to="/admin/users">Usuarios</NavLink>
            </>
          )}
          {session ? (
            <>
              <span className="user-name">Hola, {session.user.name}</span>
              <button className="button subtle" onClick={() => void logout()}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link className="button subtle" to="/login">
              Ingresar <ArrowUpRight size={16} />
            </Link>
          )}
        </nav>
      </header>
      {error && <Notice>{error}</Notice>}
      <main id="main" className="page-enter" key={pathname} ref={content} tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <Link className="logo" to="/">
          tecno<span>ya</span>
        </Link>
        <p>Tu próximo setup empieza acá.</p>
        <span>Catálogo de periféricos · Precios en ARS</span>
      </footer>
    </>
  );
}
function Pagination({ page, totalPages, onChange, label = "Paginación de productos" }: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button className="button subtle" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span role="status">Página {page} de {totalPages}</span>
      <button className="button subtle" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}

function Catalog() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>();
  const { currentData: data, isFetching, isError, refetch } =
    api.useProductsQuery({ page, category, limit: 8 });
  function selectCategory(value?: string) {
    setCategory(value);
    setPage(1);
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">Encontrá tu próxima conexión</p>
          <h1>
            Un buen setup
            <br />
            cambia tu día.
          </h1>
          <p>
            Para trabajar, jugar o crear. Explorá periféricos y encontrá lo que
            va con vos.
          </p>
          <a className="button" href="#catalog">
            Explorar catálogo <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="hero-device">
          <img
            src="/images/catalog-hero.webp"
            alt="Teclado, mouse y monitor sobre un escritorio azul claro"
            width={1200}
            height={800}
            fetchPriority="high"
          />
        </div>
      </section>
      <section id="catalog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Elegí tu próximo upgrade</p>
            <h2>El catálogo</h2>
          </div>
          <span className="muted">
            {data ? `${data.total} productos` : ""}
          </span>
        </div>
        <div className="category-strip">
          <button className="button subtle" aria-pressed={!category} onClick={() => selectCategory()}>
            Todos
          </button>
          {categories.map(({ id, name, Icon }) => (
            <button className="button subtle" aria-pressed={category === id} onClick={() => selectCategory(id)} key={id}>
              <Icon size={22} />
              {name}
            </button>
          ))}
        </div>
        {isFetching && !data ? (
          <Loading label="Cargando productos…" layout="catalog" />
        ) : isError ? (
          <Notice>
            No pudimos cargar el catálogo. El servidor puede estar iniciando.{" "}
            <button onClick={() => void refetch()}>Reintentar</button>
          </Notice>
        ) : !data?.items.length ? (
          <Notice>
            {category
              ? "Por ahora no hay productos en esta categoría."
              : "Pronto vas a encontrar nuevos productos acá."}
          </Notice>
        ) : (
          <div className="product-grid catalog-results" key={`${category ?? "todos"}-${data.page}`}>
            {data.items.map((p) => (
              <Link
                className="product-card"
                to={`/products/${p._id}`}
                key={p._id}
              >
                <ProductVisual product={p} />
                <div className="product-info">
                  <span className="brand">{p.brand}</span>
                  <h3>{p.name}</h3>
                  <div className="product-bottom">
                    <strong>{money(p.priceCents)}</strong>
                    <ArrowUpRight size={20} />
                  </div>
                  <span className={p.stock ? "stock" : "muted"}>
                    {p.stock ? "Disponible" : "Sin stock"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      </section>
    </>
  );
}
function Detail() {
  const { id = "" } = useParams();
  const { data, isLoading, isError } = api.useProductQuery({ id });
  const { data: session } = authClient.useSession();
  if (isLoading) return <Loading label="Cargando producto…" layout="detail" />;
  if (isError || !data)
    return (
      <Notice>
        El producto no está disponible. <Link to="/">Volver al catálogo</Link>
      </Notice>
    );
  return (
    <section>
      <Link className="back" to="/">
        Volver al catálogo
      </Link>
      <div className="detail">
        <ProductVisual product={data} />
        <div>
          <span className="brand">
            {data.brand} / {data.category}
          </span>
          <h1>{data.name}</h1>
          <p className="detail-price">{money(data.priceCents)}</p>
          <span className={data.stock ? "stock" : "muted"}>
            {data.stock ? `${data.stock} unidades disponibles` : "Sin stock"}
          </span>
          <p className="description">{data.description}</p>
          <p className="muted">
            Catálogo informativo. No se realizan compras desde este sitio.
          </p>
          {session?.user.role === "admin" && (
            <Link className="button subtle" to={`/admin/products/${data._id}/edit?from=catalogo`}>
              <Pencil size={18} aria-hidden="true" />
              Editar producto
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
const authSchema = z.object({
  name: z.string(),
  email: z.email("Ingresá un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
function AuthForm({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const googleError = params.has("google") && params.has("error");
  async function signInWithGoogle() {
    setError("");
    setParams({}, { replace: true });
    setGooglePending(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/login?google=1",
      });
      if (!error) return;
      setError("No pudimos iniciar sesión con Google. Intentá nuevamente.");
    } catch {
      setError("No pudimos conectar con el servidor. Intentá nuevamente.");
    }
    setGooglePending(false);
  }
  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const submit = handleSubmit(async (values) => {
    if (register && !values.name.trim()) {
      setError("Ingresá tu nombre");
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = register
        ? await authClient.signUp.email({ ...values, name: values.name.trim() })
        : await authClient.signIn.email(values);
      if (result.error) {
        setError(
          register
            ? "No pudimos crear la cuenta. Revisá tus datos o probá iniciar sesión."
            : "Correo o contraseña incorrectos.",
        );
        return;
      }
      navigate("/");
    } catch {
      setError("No pudimos conectar con el servidor. Intentá nuevamente.");
    } finally {
      setPending(false);
    }
  });
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <Plug size={44} strokeWidth={1.3} />
        <h1>
          {register ? "Tu lugar en TecnoYa." : "Qué bueno verte de nuevo."}
        </h1>
        <p>Todo para encontrar tu próximo periférico.</p>
      </div>
      <form className="form-panel" onSubmit={submit} noValidate>
        <h2>{register ? "Crear cuenta" : "Iniciar sesión"}</h2>
        {register && (
          <label>
            Nombre
            <input autoComplete="name" {...field("name")} />
          </label>
        )}
        <label>
          Correo electrónico
          <input type="email" autoComplete="email" {...field("email")} />
          {errors.email && (
            <span className="field-error">{errors.email.message}</span>
          )}
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            {...field("password")}
          />
          {errors.password && (
            <span className="field-error">{errors.password.message}</span>
          )}
        </label>
        {(error || googleError) && (
          <p className="field-error" role="alert">
            {error || "No se completó el ingreso con Google. Si ya tenés una cuenta con ese correo, ingresá con tu contraseña."}
          </p>
        )}
        <button className="button" disabled={pending || googlePending}>
          {pending ? "Procesando…" : register ? "Crear cuenta" : "Ingresar"}
        </button>
        <button
          className="button subtle"
          type="button"
          disabled={pending || googlePending}
          onClick={() => void signInWithGoogle()}
        >
          {googlePending ? "Conectando con Google…" : "Continuar con Google"}
        </button>
        <p>
          {register ? "¿Ya tenés cuenta?" : "¿Primera vez por acá?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Iniciá sesión" : "Registrate"}
          </Link>
        </p>
      </form>
    </section>
  );
}
function Guard({ admin = true }: { admin?: boolean }) {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <Loading label="Comprobando sesión…" />;
  if (!data) return <Navigate to="/login" replace />;
  if (admin && data.user.role !== "admin")
    return (
      <Notice>
        No tenés permisos para acceder a la administración.{" "}
        <Link to="/">Volver al inicio</Link>
      </Notice>
    );
  return <Outlet />;
}
function Confirm({
  product,
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  product: Product;
  action: "archive" | "permanent";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = dialog.current;
    const previous = document.activeElement;
    d?.showModal();
    cancel.current?.focus();
    return () => {
      d?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-title">
        {action === "archive"
          ? "Archivar producto"
          : "Eliminar definitivamente"}
      </h2>
      <p>
        ¿{action === "archive" ? "Querés archivar" : "Querés eliminar"}{" "}
        <strong>{product.name}</strong>?
      </p>
      <p className="muted">
        {action === "archive"
          ? "Dejará de aparecer en el catálogo. Podés restaurarlo después."
          : "Se borrará de MongoDB. Esta acción no se puede deshacer."}
      </p>
      <div className="actions">
        <button
          ref={cancel}
          className="button subtle"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          {busy
            ? "Procesando…"
            : action === "archive"
              ? "Archivar"
              : "Eliminar definitivamente"}
        </button>
      </div>
    </dialog>
  );
}
function Admin() {
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const { currentData: data, isFetching, isError, refetch } = api.useProductsQuery({ page, status });
  function selectStatus(value: string) {
    setStatus(value);
    setPage(1);
  }
  useEffect(() => {
    if (data && !isFetching && data.page < page) setPage(data.page);
  }, [data, isFetching, page]);
  const [mutate, { isLoading: busy }] = api.useActionMutation();
  const [selected, setSelected] = useState<{
    product: Product;
    action: "archive" | "permanent";
  } | null>(null);
  const [message, setMessage] = useState("");
  async function act(
    product: Product,
    action: "archive" | "restore" | "permanent",
  ) {
    try {
      await mutate({ id: product._id, action }).unwrap();
      setSelected(null);
      setMessage(
        action === "restore"
          ? "Producto restaurado."
          : action === "archive"
            ? "Producto archivado."
            : "Producto eliminado definitivamente.",
      );
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Productos</h1>
        </div>
        <Link className="button" to="/admin/products/new">
          <Plus size={18} />
          Nuevo producto
        </Link>
      </div>
      <div className="tabs">
        <button
          aria-pressed={status === "active"}
          onClick={() => selectStatus("active")}
        >
          Activos
        </button>
        <button
          aria-pressed={status === "archived"}
          onClick={() => selectStatus("archived")}
        >
          Archivados
        </button>
      </div>
      {message && <Notice>{message}</Notice>}
      {isFetching && !data ? (
        <Loading label="Cargando productos…" layout="list" />
      ) : isError ? (
        <Notice>
          No pudimos cargar los productos.{" "}
          <button onClick={() => void refetch()}>Reintentar</button>
        </Notice>
      ) : !data?.items.length ? (
        <Notice>
          No hay productos {status === "active" ? "activos" : "archivados"}.
        </Notice>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="admin-product-cell">
                      <ProductVisual product={p} decorative />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.brand}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.priceCents)}</td>
                  <td>{p.stock}</td>
                  <td>
                    <div className="actions">
                      <Link
                        className="icon-button"
                        aria-label={`Editar ${p.name}`}
                        to={`/admin/products/${p._id}/edit`}
                      >
                        <Pencil size={18} />
                      </Link>
                      {status === "active" ? (
                        <button
                          className="icon-button"
                          aria-label={`Archivar ${p.name}`}
                          onClick={() =>
                            setSelected({ product: p, action: "archive" })
                          }
                        >
                          <Archive size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy}
                            className="icon-button"
                            aria-label={`Restaurar ${p.name}`}
                            onClick={() => void act(p, "restore")}
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Eliminar definitivamente ${p.name}`}
                            onClick={() =>
                              setSelected({ product: p, action: "permanent" })
                            }
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      {selected && (
        <Confirm
          {...selected}
          busy={busy}
          onCancel={() => setSelected(null)}
          onConfirm={() => void act(selected.product, selected.action)}
        />
      )}
    </section>
  );
}
const editSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre").max(100),
  brand: z.string().trim().min(1, "Ingresá una marca").max(80),
  description: z.string().trim().min(1, "Ingresá una descripción").max(2000),
  category: z.enum(["teclados", "mouse", "auriculares", "monitores"]),
  price: z
    .number("Ingresá un precio")
    .positive("El precio debe ser mayor que cero")
    .max(1000000000),
  stock: z
    .number("Ingresá un stock")
    .int("Usá un número entero")
    .min(0, "El stock no puede ser negativo")
    .max(1000000),
});

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 2 * 1024 * 1024;

function encodeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("No se pudo leer la imagen"));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromCatalog = Boolean(id && params.get("from") === "catalogo");
  const returnTo = fromCatalog ? `/products/${id}` : "/admin/products";
  const { data, isLoading, isError } = api.useProductQuery(
    { id: id ?? "", admin: true },
    { skip: !id },
  );
  const [save, { isLoading: busy }] = api.useSaveMutation();
  const [error, setError] = useState("");
  const [image, setImage] = useState<File>();
  const [removeImage, setRemoveImage] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageError = image && (
    !imageTypes.includes(image.type)
      ? "Elegí una imagen JPEG, PNG o WebP."
      : image.size === 0 || image.size > maxImageSize
        ? "La imagen debe pesar más de 0 y hasta 2 MB."
        : ""
  );
  const navigate = useNavigate();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      brand: "",
      description: "",
      category: "teclados",
      price: 0,
      stock: 0,
    },
  });
  useEffect(() => {
    if (data)
      reset({
        ...data,
        category: data.category as z.infer<typeof editSchema>["category"],
        price: data.priceCents / 100,
      });
  }, [data, reset]);
  if (isLoading) return <Loading label="Cargando producto…" layout="list" />;
  if (isError)
    return (
      <Notice>
        No pudimos cargar el producto. <Link to={returnTo}>Volver</Link>
      </Notice>
    );
  const submit = handleSubmit(async ({ price, ...values }) => {
    if (imageError) return;
    setError("");
    try {
      const imageData = image
        ? { imageBase64: await encodeImage(image) }
        : removeImage ? { imageUrl: "" } : {};
      await save({
        id,
        data: { ...values, priceCents: Math.round(price * 100), ...imageData },
      }).unwrap();
      navigate(returnTo, { replace: fromCatalog });
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
    }
  });
  return (
    <section className="editor">
      <Link className="back" to={returnTo} replace={fromCatalog}>
        {fromCatalog ? "Volver a la ficha" : "Volver a productos"}
      </Link>
      <h1>{id ? "Editar producto" : "Nuevo producto"}</h1>
      <form className="form-panel" onSubmit={submit} noValidate>
        <div className="form-grid">
          {(["name", "brand"] as const).map((key) => (
            <label key={key}>
              {key === "name" ? "Nombre" : "Marca"}
              <input {...register(key)} />
              {errors[key] && (
                <span className="field-error">{errors[key].message}</span>
              )}
            </label>
          ))}
          <label>
            Categoría
            <select {...register("category")}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Precio en ARS
            <input
              type="number"
              min="0.01"
              step="0.01"
              {...register("price", { valueAsNumber: true })}
            />
            {errors.price && (
              <span className="field-error">{errors.price.message}</span>
            )}
          </label>
          <label>
            Stock
            <input
              type="number"
              min="0"
              step="1"
              {...register("stock", { valueAsNumber: true })}
            />
            {errors.stock && (
              <span className="field-error">{errors.stock.message}</span>
            )}
          </label>
        </div>
        <div className="image-field">
          {data?.imageUrl && !removeImage && (
            <img src={data.imageUrl} alt="Imagen actual del producto" />
          )}
          <label>
            {data?.imageUrl ? "Reemplazar imagen" : "Imagen del producto (opcional)"}
            <input
              ref={imageInput}
              type="file"
              accept={imageTypes.join(",")}
              aria-invalid={Boolean(imageError)}
              aria-describedby={imageError ? "image-error" : "image-help"}
              onChange={(event) => {
                setImage(event.target.files?.[0]);
                setRemoveImage(false);
              }}
              disabled={isSubmitting || busy}
            />
          </label>
          <span id="image-help" className="muted">JPEG, PNG o WebP de hasta 2 MB.</span>
          {imageError && <span id="image-error" className="field-error" role="alert">{imageError}</span>}
          {image ? (
            <button className="button subtle" type="button" disabled={isSubmitting || busy} onClick={() => {
              if (imageInput.current) imageInput.current.value = "";
              setImage(undefined);
            }}>Descartar archivo</button>
          ) : data?.imageUrl && (
            <button className="button subtle" type="button" disabled={isSubmitting || busy} onClick={() => setRemoveImage(!removeImage)}>
              {removeImage ? "Conservar imagen" : "Quitar imagen"}
            </button>
          )}
        </div>
        <label>
          Descripción
          <textarea rows={5} {...register("description")} />
          {errors.description && (
            <span className="field-error">{errors.description.message}</span>
          )}
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="actions">
          <Link className="button subtle" to={returnTo} replace={fromCatalog}>
            Cancelar
          </Link>
          <button className="button" disabled={busy || isSubmitting || Boolean(imageError)}>
            {busy || isSubmitting ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </section>
  );
}
function AdminUsers() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: string; email: string }>();
  const [message, setMessage] = useState("");
  const { data: session, refetch: refreshSession } = authClient.useSession();
  const navigate = useNavigate();
  const { currentData: users, isFetching, error, refetch } = api.useUsersQuery(page);
  const sessions = api.useUserSessionsQuery(selected?.id ?? "", {
    skip: !selected,
    refetchOnMountOrArgChange: true,
  });
  const [changeRole, { isLoading: changingRole }] = api.useChangeRoleMutation();
  const [revokeSession, { isLoading: revoking }] = api.useRevokeSessionMutation();

  async function updateRole(id: string, email: string, role: "user" | "admin") {
    if (!window.confirm(`¿Cambiar el rol de ${email} a ${role}?`)) return;
    setMessage("");
    try {
      await changeRole({ id, role }).unwrap();
      setMessage("Rol actualizado.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function revoke(id: string, sessionId: string) {
    if (!window.confirm("¿Revocar esta sesión? La persona tendrá que volver a ingresar.")) return;
    setMessage("");
    try {
      await revokeSession({ id, sessionId }).unwrap();
      if (sessionId === session?.session.id) {
        store.dispatch(api.util.resetApiState());
        void refreshSession();
        navigate("/login", { replace: true });
        return;
      }
      setMessage("Sesión revocada.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <section>
      <h1>Usuarios y sesiones</h1>
      {message && <Notice>{message}</Notice>}
      {isFetching && !users ? (
        <Loading label="Cargando usuarios…" layout="list" />
      ) : error ? (
        <Notice>{errorMessage(error)} <button onClick={() => void refetch()}>Reintentar</button></Notice>
      ) : users?.items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {users.items.map(({ id, name, email, role }) => (
                <tr key={id}>
                  <td><strong>{name}</strong><small>{email}</small></td>
                  <td>{role === "admin" ? "Administrador" : "Usuario"}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="button subtle"
                        aria-pressed={selected?.id === id}
                        onClick={() => setSelected({ id, email })}
                      >
                        Ver sesiones
                      </button>
                      {id !== session?.user.id && (
                        <button
                          className="button subtle"
                          disabled={changingRole}
                          onClick={() => void updateRole(id, email, role === "admin" ? "user" : "admin")}
                        >
                          {role === "admin" ? "Quitar rol admin" : "Hacer administrador"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Notice>No hay usuarios en esta página.</Notice>
      )}
      {users && (
        <Pagination
          page={users.page}
          totalPages={users.totalPages}
          label="Paginación de usuarios"
          onChange={(next) => { setPage(next); setSelected(undefined); }}
        />
      )}
      {selected && (
        <section aria-labelledby="active-sessions">
          <h2 id="active-sessions">Sesiones activas</h2>
          <p>{selected.email}</p>
          {sessions.isFetching && !sessions.currentData ? (
            <Loading label="Cargando sesiones…" layout="list" />
          ) : sessions.error ? (
            <Notice>{errorMessage(sessions.error)} <button onClick={() => void sessions.refetch()}>Reintentar</button></Notice>
          ) : sessions.currentData?.items.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Navegador</th><th>Inicio</th><th>Vencimiento</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {sessions.currentData.items.map(({ id, createdAt, expiresAt, userAgent }) => (
                    <tr key={id}>
                      <td className="session-agent">{userAgent || "Desconocido"}</td>
                      <td>{new Date(createdAt).toLocaleString("es-AR")}</td>
                      <td>{new Date(expiresAt).toLocaleString("es-AR")}</td>
                      <td>
                        <button
                          className="button subtle"
                          disabled={revoking}
                          onClick={() => void revoke(selected.id, id)}
                        >
                          Revocar sesión
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice>Este usuario no tiene sesiones activas.</Notice>
          )}
        </section>
      )}
    </section>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="products/:id" element={<Detail />} />
        <Route path="login" element={<AuthForm />} />
        <Route path="register" element={<AuthForm register />} />
        <Route element={<Guard admin={false} />}>
          <Route path="assistant" element={
            <Suspense fallback={<Loading label="Cargando asistente…" />}>
              <Assistant />
            </Suspense>
          } />
        </Route>
        <Route element={<Guard />}>
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/products" element={<Admin />} />
          <Route path="admin/products/new" element={<Editor />} />
          <Route path="admin/products/:id/edit" element={<Editor />} />
        </Route>
        <Route
          path="*"
          element={
            <Notice>
              Página no encontrada. <Link to="/">Volver al inicio</Link>
            </Notice>
          }
        />
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
