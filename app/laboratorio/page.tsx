"use client";

/*
  AutoPrint Studio · Laboratorio (página interna, no enlazada en la tienda)
  Manda el MISMO pedido por el mismo proceso (brief + dirección de arte) y genera cada propuesta
  con FLUX y con GPT Image, para compararlos lado a lado. Requiere la clave LAB_KEY de Vercel.
*/

import { useEffect, useState } from "react";

type Mode = "playera" | "sticker";
type Slot = { image: string; label: string; ms?: number; reason?: string; done: boolean };

const PRESETS: { mode: Mode; label: string; text: string }[] = [
  { mode: "playera", label: "Florería Gauzon", text: "Tengo una florería que se llama Gauzon y quiero regalarles playeras a mis clientes" },
  { mode: "playera", label: "Independencia AutoPrint", text: "Tengo una imprenta que se llama AutoPrint y quiero regalarles unas playeras por motivo del día de la independencia mexicana" },
  { mode: "playera", label: "Cumpleaños Jozue", text: "Quiero un diseño que tenga que ver con montañas, dinosaurios y flores para la playera de mi sobrino que cumplirá 5 años, su nombre es Jozue" },
  { mode: "playera", label: "Cumpleaños Nilda", text: "Quiero un diseño para una playera de cumpleaños. La festejada cumple 32 años y le gustan los gatos y bailar. Su nombre es Nilda" },
  { mode: "sticker", label: "Taller FEMSA", text: "Quiero regalar stickers redondos a mis clientes para que los peguen en sus refrigeradores, es sobre mi taller de maquinados que se llama FEMSA" },
];

export default function Laboratorio() {
  const [labKey, setLabKey] = useState("");
  const [mode, setMode] = useState<Mode>("playera");
  const [prompt, setPrompt] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [brief, setBrief] = useState<{ label: string; value: string }[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [big, setBig] = useState<string>("");

  useEffect(() => {
    try {
      const k = localStorage.getItem("ap-lab-key");
      if (k) setLabKey(k);
    } catch {}
  }, []);

  async function run() {
    if (!labKey.trim() || prompt.trim().length < 3 || running) return;
    try {
      localStorage.setItem("ap-lab-key", labKey.trim());
    } catch {}
    setRunning(true);
    setError("");
    setSlots([]);
    setBrief([]);
    setPrompts([]);
    const wantsRound = mode === "sticker" && /(circular|redond|c[ií]rculo)/i.test(prompt);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          mode,
          chips: wantsRound ? ["circular"] : [],
          studioTab: "free",
          compare: true,
          labKey: labKey.trim(),
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(res.status === 429 ? "Límite de solicitudes: espera unos minutos." : `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let local: Slot[] = [];
      let isCompare = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (msg.type === "start") {
          isCompare = Array.isArray(msg.prompts);
          local = (msg.labels || []).map((l: string) => ({ image: "", label: String(l || ""), done: false }));
          setSlots([...local]);
          if (Array.isArray(msg.brief)) setBrief(msg.brief);
          if (Array.isArray(msg.prompts)) setPrompts(msg.prompts.map(String));
        } else if (msg.type === "image" || msg.type === "failed") {
          const i = Number(msg.index);
          local[i] = {
            image: msg.type === "image" ? String(msg.image || "") : "",
            label: String(msg.label || local[i]?.label || ""),
            ms: Number(msg.ms) || undefined,
            reason: msg.reason ? String(msg.reason) : msg.type === "failed" ? "No salió" : "",
            done: true,
          };
          setSlots([...local]);
        } else if (msg.type === "error") {
          setError(String(msg.error || ""));
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf("\n");
        while (nl >= 0) {
          handle(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf("\n");
        }
      }
      handle(buffer);
      if (!isCompare) setError("La clave no coincide con LAB_KEY (se generó solo con FLUX). Revisa la clave o la variable en Vercel.");
    } catch (err: any) {
      setError(err?.message || "Error");
    } finally {
      setRunning(false);
    }
  }

  const half = Math.ceil(slots.length / 2);
  const columns = slots.length > 3 ? [slots.slice(0, half), slots.slice(half)] : [slots];
  const titles = slots.length > 3 ? ["FLUX (actual)", "GPT Image"] : ["Resultado"];

  return (
    <main className="lab">
      <meta name="robots" content="noindex, nofollow" />
      <header>
        <p className="eyebrow">AutoPrint Studio · Laboratorio interno</p>
        <h1>FLUX vs GPT Image</h1>
        <p className="sub">
          El mismo pedido pasa por el mismo brief y la misma dirección de arte; solo cambia el generador. Cada prueba
          genera 6 imágenes (3 por generador).
        </p>
      </header>

      <section className="panel">
        <div className="row">
          <label>
            Clave del laboratorio
            <input type="password" value={labKey} onChange={(e) => setLabKey(e.target.value)} placeholder="LAB_KEY" />
          </label>
          <label>
            Producto
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="playera">Playera</option>
              <option value="sticker">Sticker</option>
            </select>
          </label>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setMode(p.mode);
                setPrompt(p.text);
              }}
            >
              {p.label} <small>{p.mode}</small>
            </button>
          ))}
        </div>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Escribe el pedido como lo haría un cliente" />
        <button className="go" type="button" disabled={running || !labKey.trim() || prompt.trim().length < 3} onClick={run}>
          {running ? "Generando… (puede tardar 1–2 minutos)" : "Comparar FLUX vs GPT Image"}
        </button>
        {error && <p className="err">{error}</p>}
      </section>

      {brief.length > 0 && (
        <section className="brief">
          {brief.map((b) => (
            <span key={b.label + b.value}>
              <b>{b.label}:</b> {b.value}
            </span>
          ))}
          {prompts.length > 0 && (
            <button type="button" className="link" onClick={() => setShowPrompts((v) => !v)}>
              {showPrompts ? "Ocultar prompts" : "Ver los 3 prompts enviados"}
            </button>
          )}
          {showPrompts && (
            <ol className="prompts">
              {prompts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {slots.length > 0 && (
        <section className={`cols n${columns.length}`}>
          {columns.map((col, c) => (
            <div key={c} className="col">
              <h2>{titles[c]}</h2>
              <div className="grid">
                {col.map((s, i) => (
                  <figure key={i} className="card">
                    <div className="img">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt={s.label} onClick={() => setBig(s.image)} />
                      ) : s.done ? (
                        <em>{s.reason || "No salió"}</em>
                      ) : (
                        <span className="spin" />
                      )}
                    </div>
                    <figcaption>
                      <span>{s.label.replace(/^(FLUX|GPT Image) · /, "")}</span>
                      {s.ms ? <small>{(s.ms / 1000).toFixed(1)} s</small> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {big && (
        <div className="big" onClick={() => setBig("")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="" />
        </div>
      )}

      <style jsx global>{`
        body {
          background: #0b0d12 !important;
        }
        .lab {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 20px 60px;
          color: #c4cad6;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .lab * {
          box-sizing: border-box;
        }
        .eyebrow {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7898ff;
        }
        .lab h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.02em;
          color: #f5f7fb;
        }
        .sub {
          max-width: 680px;
          margin: 8px 0 20px;
          font-size: 14px;
          line-height: 1.55;
        }
        .panel,
        .brief {
          padding: 18px;
          border-radius: 18px;
          background: #11141b;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 180px;
          gap: 12px;
        }
        .lab label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #8a92a4;
        }
        .lab input,
        .lab select,
        .lab textarea {
          width: 100%;
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
          background: #171b24;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          color: #f5f7fb;
          font-size: 15px;
          font-family: inherit;
        }
        .lab textarea {
          margin-top: 12px;
          resize: vertical;
        }
        .presets {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .presets button,
        .link {
          padding: 7px 12px;
          border: 0;
          border-radius: 999px;
          background: #171b24;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
          color: #f5f7fb;
          font-size: 13px;
          cursor: pointer;
        }
        .presets small {
          color: #8a92a4;
        }
        .go {
          width: 100%;
          height: 50px;
          margin-top: 12px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #6f92ff, #2347d6);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .go:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .err {
          margin: 10px 0 0;
          color: #ff9b93;
          font-size: 14px;
        }
        .brief {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          margin-top: 16px;
          font-size: 13px;
        }
        .brief b {
          color: #7898ff;
        }
        .prompts {
          flex-basis: 100%;
          margin: 6px 0 0;
          padding-left: 18px;
          font-size: 12px;
          line-height: 1.5;
          color: #8a92a4;
        }
        .prompts li {
          margin-bottom: 8px;
        }
        .cols {
          display: grid;
          gap: 18px;
          margin-top: 18px;
        }
        .cols.n2 {
          grid-template-columns: 1fr 1fr;
        }
        .col h2 {
          margin: 0 0 10px;
          font-size: 16px;
          color: #f5f7fb;
        }
        .grid {
          display: grid;
          gap: 12px;
        }
        .card {
          margin: 0;
          padding: 10px;
          border-radius: 16px;
          background: #11141b;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        }
        .img {
          display: grid;
          place-items: center;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          background: #fff;
          overflow: hidden;
        }
        .img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          cursor: zoom-in;
        }
        .img em {
          padding: 16px;
          font-style: normal;
          font-size: 13px;
          color: #b42318;
          text-align: center;
        }
        .spin {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid rgba(35, 71, 214, 0.2);
          border-top-color: #2347d6;
          animation: labspin 0.8s linear infinite;
        }
        figcaption {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          font-size: 13px;
          color: #f5f7fb;
        }
        figcaption small {
          color: #8a92a4;
        }
        .big {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.85);
          cursor: zoom-out;
        }
        .big img {
          max-width: 100%;
          max-height: 100%;
          border-radius: 12px;
          background: #fff;
        }
        @keyframes labspin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 760px) {
          .row,
          .cols.n2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
