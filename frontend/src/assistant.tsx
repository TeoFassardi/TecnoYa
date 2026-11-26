import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, MessageCircle, Package, Send } from "lucide-react";
import { Link } from "react-router";
import { api, errorMessage, money, type AssistantMessage, type AssistantProduct } from "./data";
import { Bubble, BubbleContent } from "./components/ui/bubble";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import "./assistant.css";

const questions = [
  "¿Qué teclados tienen stock?",
  "¿Qué auriculares hay por menos de $100.000?",
  "Compará los dos monitores más económicos.",
];
const maxLength = 500;

function Recommendation({ product }: { product: AssistantProduct }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link className="assistant-product" to={`/products/${product.id}`}>
      <div className="assistant-product-image">
        {product.imageUrl && !failed ? (
          <img src={product.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : <Package size={20} aria-hidden="true" />}
      </div>
      <div>
        <span className="brand">{product.brand}</span>
        <strong>{product.name}</strong>
        <span>{money(product.priceCents)} · {product.stock ? "Disponible" : "Sin stock"}</span>
      </div>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [chat] = api.useChatMutation();
  const request = useRef<ReturnType<typeof chat> | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  async function send(value: string) {
    const message = value.trim();
    if (!message || message.length > maxLength || request.current) return;
    setDraft(value);
    setError("");
    setPending(message);
    const history = messages.slice(-8).map(({ role, text, products }) => ({
      role,
      text: products?.length
        ? `${text.slice(0, 850)}\nFichas mostradas: ${products.map(({ id, name }) => `${name} (${id})`).join(", ")}`.slice(0, 1500)
        : text,
    }));
    const currentRequest = chat({ message, history });
    request.current = currentRequest;
    try {
      const answer = await currentRequest.unwrap();
      setMessages((previous) => [
        ...previous,
        { role: "user", text: message },
        { role: "assistant", text: answer.message, products: answer.products },
      ]);
      setDraft("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      request.current = null;
      setPending("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <section className="assistant">
      <div className="assistant-heading">
        <MessageCircle size={28} aria-hidden="true" />
        <div>
          <h1>Asistente del catálogo</h1>
          <p>Encontrá periféricos por precio, stock o marca.</p>
        </div>
      </div>
      <div className="assistant-panel">
        <div className="assistant-log" role="log" aria-label="Conversación" ref={transcript}>
          {!messages.length && !pending && (
            <div className="assistant-start">
              <h2>¿Qué estás buscando?</h2>
              <div className="assistant-prompts">
                {questions.map((question) => (
                  <Button key={question} type="button" variant="outline" onClick={() => void send(question)}>
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map(({ role, text, products }, index) => (
            <div key={index} className="assistant-turn" data-role={role}>
              <Bubble align={role === "user" ? "end" : "start"} variant={role === "user" ? "default" : "muted"}>
                <BubbleContent>{text}</BubbleContent>
              </Bubble>
              {!!products?.length && (
                <div className="assistant-products">
                  {products.map((product) => <Recommendation key={product.id} product={product} />)}
                </div>
              )}
            </div>
          ))}
          {pending && (
            <>
              <Bubble align="end"><BubbleContent>{pending}</BubbleContent></Bubble>
              <p className="muted" role="status">Consultando el catálogo…</p>
            </>
          )}
        </div>
        <form className="assistant-composer" onSubmit={submit}>
          {error && <p className="field-error" role="alert">{error}</p>}
          <label htmlFor="assistant-question">Tu pregunta</label>
          <div className="assistant-input">
            <Textarea
              id="assistant-question"
              rows={2}
              maxLength={maxLength}
              placeholder="Por ejemplo, un mouse con stock por menos de $50.000"
              value={draft}
              disabled={!!pending}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" disabled={!!pending || !draft.trim()}>
              <Send size={16} aria-hidden="true" />
              Enviar
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
