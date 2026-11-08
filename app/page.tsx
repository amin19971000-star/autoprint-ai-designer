"use client";

/*
  AutoPrint · Estudio IA — v3 («un solo cuadro», estilo Precisión claro)
  - Un solo cuadro para la idea + 3 detalles opcionales (Texto exacto, Colores, Estilo).
  - Arranques que el cliente completa (no ejemplos inventados).
  - Asistente: si la idea menciona una frase o nombre, ofrece pasarlo a «Texto exacto».
  - Resultados: vista grande + miniaturas; la primera propuesta lista queda elegida sola.
  - Mismo backend: /api/generate (stream NDJSON), action "adjust", /api/save-selected-design.
*/

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type DesignMode = "sticker" | "playera";
type DetailPanel = "" | "texto" | "colores" | "estilo";

const MAX_COLORS = 2;
const MAX_TEXT = 40;
const FAILED = "__failed__";

const STARTERS: Record<DesignMode, { label: string; opener: string }[]> = {
  sticker: [
    { label: "Para mi negocio", opener: "Sticker para mi negocio de " },
    { label: "Para un cumpleaños", opener: "Sticker de cumpleaños para " },
    { label: "De mi mascota", opener: "Caricatura de mi mascota, " },
    { label: "Para regalar", opener: "Sticker para regalarle a " },
  ],
  playera: [
    { label: "Para mi negocio", opener: "Playera para mi negocio de " },
    { label: "Para un evento", opener: "Playera para el evento de " },
    { label: "Para mi equipo", opener: "Playera para mi equipo de " },
    { label: "Para un cumpleaños", opener: "Playera de cumpleaños para " },
  ],
};

const COLOR_OPTIONS: { id: string; label: string; swatch: string }[] = [
  { id: "rojo", label: "Rojo", swatch: "#E5484D" },
  { id: "azul", label: "Azul", swatch: "#2F6FED" },
  { id: "rosa", label: "Rosa", swatch: "#F27BB0" },
  { id: "morado", label: "Morado", swatch: "#8E4EC6" },
  { id: "verde", label: "Verde", swatch: "#2E9E5B" },
  { id: "amarillo", label: "Amarillo", swatch: "#F5C518" },
  { id: "negro", label: "Negro", swatch: "#14171F" },
  { id: "dorado", label: "Dorado", swatch: "linear-gradient(135deg,#F6E3A1,#C9A227 55%,#8C6A12)" },
  { id: "pastel", label: "Pastel", swatch: "linear-gradient(135deg,#FBD3E9,#C9E4FF 50%,#D9F5DD)" },
  { id: "multicolor", label: "Multicolor", swatch: "conic-gradient(#E5484D,#F5C518,#2E9E5B,#2F6FED,#8E4EC6,#E5484D)" },
];

// Cada estilo se traduce a las opciones que el servidor ya entiende (chips).
const STYLE_OPTIONS: {
  id: string;
  label: string;
  hint: string;
  sticker: string[];
  playera: string[];
}[] = [
  { id: "auto", label: "Automático", hint: "La IA elige", sticker: [], playera: [] },
  { id: "divertido", label: "Divertido", hint: "Alegre y colorido", sticker: ["divertido", "colores_vivos"], playera: ["divertido", "impacto_visual"] },
  { id: "elegante", label: "Elegante", hint: "Fino y limpio", sticker: ["elegante", "premium"], playera: ["elegante", "premium"] },
  { id: "retro", label: "Retro", hint: "Estilo clásico", sticker: ["vintage"], playera: ["vintage"] },
  { id: "minimal", label: "Minimalista", hint: "Pocos elementos", sticker: ["minimal", "iconico"], playera: ["minimal", "estilo_pecho"] },
  { id: "urbano", label: "Urbano", hint: "Atrevido, callejero", sticker: ["street", "alto_contraste"], playera: ["streetwear", "alto_contraste"] },
  { id: "rudo", label: "Rudo", hint: "Fuerte e intenso", sticker: ["feroz", "alto_contraste"], playera: ["feroz", "tonos_oscuros"] },
];

const ADJUST_OPTIONS: { id: string; label: string }[] = [
  { id: "simple", label: "Más simple" },
  { id: "colorido", label: "Más colorido" },
  { id: "colores", label: "Otros colores" },
  { id: "sintexto", label: "Sin texto" },
  { id: "textogrande", label: "Texto más grande" },
  { id: "tierno", label: "Más tierno" },
  { id: "elegante", label: "Más elegante" },
];

const COPY: Record<DesignMode, { title: string; sub: string; placeholder: string; noun: string }> = {
  sticker: {
    title: "Crea tu sticker con IA",
    sub: "Escribe tu idea con tus palabras. Te mostramos 3 propuestas y eliges la que más te guste.",
    placeholder: "Describe qué quieres ver: personaje, objeto o idea, y para qué es.",
    noun: "sticker",
  },
  playera: {
    title: "Crea el diseño de tu playera con IA",
    sub: "Escribe tu idea con tus palabras. Te mostramos 3 propuestas y eliges la que más te guste.",
    placeholder: "Describe qué quieres en tu playera: personaje, frase o idea, y para qué es.",
    noun: "playera",
  },
};

// ¿La idea menciona un texto? Si viene entre comillas, lo sacamos para sugerirlo.
const TEXT_HINT_RE = /(que diga|frase|nombre|letrero|leyenda|texto|\bdiga\b|["“”«»])/i;
function extractQuoted(value: string) {
  const m = value.match(/["“«]([^"”»]{1,60})["”»]/);
  return m ? m[1].trim() : "";
}

function splitLabel(raw: string | undefined, index: number) {
  const text = String(raw || "").trim();
  const parts = text.split(" · ");
  if (parts.length >= 2) return { style: parts[0], concept: parts.slice(1).join(" · ") };
  return { style: text || `Propuesta ${index + 1}`, concept: "" };
}

function Icon({ name }: { name: "text" | "palette" | "brush" | "spark" | "check" | "wand" | "edit" | "redo" | "x" }) {
  const paths: Record<string, string> = {
    text: "M5 5h14v3h-2V7h-4v10h2v2H9v-2h2V7H7v1H5z",
    palette:
      "M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
    brush:
      "M20.7 4.3a1 1 0 0 0-1.4 0l-8.6 8.6 1.4 1.4 8.6-8.6a1 1 0 0 0 0-1.4zM9.3 14.3c-1.9 0-3.3 1.4-3.3 3.2 0 .9-.6 1.5-2 1.5 1 1.3 2.6 2 4.2 2 2.4 0 4.1-1.7 4.1-4 0-1.5-1.3-2.7-3-2.7z",
    spark:
      "M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z",
    check: "M9.5 16.6 5.4 12.5 4 13.9l5.5 5.5L20 8.9l-1.4-1.4z",
    wand:
      "M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.6 5.3a1 1 0 0 0-1.4 0L1.3 19a1 1 0 0 0 0 1.4l2.3 2.3a1 1 0 0 0 1.4 0L16.7 11a1 1 0 0 0 0-1.4zm-1.1 5.5-2.1-2.1 2.4-2.4 2.1 2.1z",
    edit: "M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z",
    redo: "M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
    x: "M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z",
  };
  return (
    <svg className="ap-ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function StudioInner() {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embed") === "1";
  const forcedMode = searchParams.get("mode");
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<DesignMode>(() =>
    forcedMode === "playera" || forcedMode === "shirt" ? "playera" : "sticker"
  );
  const [prompt, setPrompt] = useState("");
  const [exactText, setExactText] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [styleId, setStyleId] = useState("auto");
  const [panel, setPanel] = useState<DetailPanel>("");
  const [hintDismissed, setHintDismissed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);

  const [images, setImages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [genPhase, setGenPhase] = useState<"idle" | "thinking" | "drawing">("idle");
  const [error, setError] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [genOffset, setGenOffset] = useState(0);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPresets, setAdjustPresets] = useState<string[]>([]);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = COPY[mode];
  const apiBase = isEmbedded ? "https://autoprint-ai-designer.vercel.app/api/generate" : "/api/generate";

  useEffect(() => {
    if (forcedMode === "sticker") setMode("sticker");
    else if (forcedMode === "playera" || forcedMode === "shirt") setMode("playera");
  }, [forcedMode]);

  // ---------- Altura del iframe (puente con Shopify) ----------
  function postEmbedHeight() {
    if (typeof window === "undefined" || window.parent === window) return;
    const wrap = document.querySelector(".page-wrap");
    if (!wrap) return;
    const height = wrap.scrollHeight + 24;
    const win = window as typeof window & { __lastSentHeight?: number };
    if (typeof win.__lastSentHeight === "number" && Math.abs(win.__lastSentHeight - height) < 8) return;
    win.__lastSentHeight = height;
    window.parent.postMessage({ type: "AUTOPRINT_AI_RESIZE", height }, "*");
  }

  useEffect(() => {
    if (!isEmbedded) return;
    let rafId = 0;
    const run = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(postEmbedHeight);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(document.body);
    const wrap = document.querySelector(".page-wrap");
    if (wrap) ro.observe(wrap);
    window.addEventListener("load", run);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("load", run);
      window.removeEventListener("resize", run);
    };
  }, [isEmbedded, images.length, selectedIndex, loading, error, panel, composerOpen, adjustOpen]);

  // ---------- Derivados ----------
  const readyCount = images.filter((img) => img && img !== FAILED).length;
  const hasResults = images.length > 0;
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : "";
  const selectedReady = !!selectedImage && selectedImage !== FAILED;
  const selectedLabel = selectedIndex !== null ? splitLabel(labels[selectedIndex], selectedIndex) : null;
  const styleDef = STYLE_OPTIONS.find((s) => s.id === styleId) || STYLE_OPTIONS[0];
  const colorDefs = COLOR_OPTIONS.filter((c) => colors.includes(c.id));
  const colorText = colorDefs.map((c, i) => (i ? c.label.toLowerCase() : c.label)).join(" y ");
  const canGenerate = prompt.trim().length >= 3 && !loading && !adjusting;

  const showTextHint =
    !hintDismissed && !exactText.trim() && panel !== "texto" && prompt.trim().length >= 8 && TEXT_HINT_RE.test(prompt);

  const fullPrompt = useMemo(() => {
    let p = prompt.trim().replace(/[.\s]+$/, "");
    if (exactText.trim()) {
      p += `. Texto exacto que debe aparecer en el diseño, respetando cada letra y acento: "${exactText.trim()}". No agregues otras palabras`;
    }
    if (colorDefs.length) {
      p += `. Colores principales: ${colorDefs.map((c) => c.label.toLowerCase()).join(" y ")}`;
    }
    return p ? `${p}.` : "";
  }, [prompt, exactText, colorDefs]);

  const stageText = genPhase === "thinking" ? "Entendiendo tu idea…" : "Dibujando tus propuestas…";
  const progressText =
    genPhase === "thinking"
      ? "Paso 1 de 2 · Preparamos 3 ideas distintas"
      : `Paso 2 de 2 · Dibujando · ${Math.max(readyCount - genOffset, 0)} de ${images.length - genOffset || 3} listas`;
  const progressPct =
    genPhase === "thinking" ? 12 : 12 + (Math.max(readyCount - genOffset, 0) / Math.max(images.length - genOffset, 3)) * 88;
  // Mientras la IA piensa, ya mostramos los 3 lugares nuevos (las propuestas anteriores se conservan).
  const thumbSlots = loading && genPhase === "thinking" ? [...images, "", "", ""] : images;
  const liveText = loading ? progressText : adjusting ? "Creando tu versión ajustada" : saved ? "Diseño agregado a tu producto" : "";

  // ---------- Acciones del formulario ----------
  function applyStarter(opener: string) {
    setPrompt(opener);
    setError("");
    requestAnimationFrame(() => {
      const el = promptRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(opener.length, opener.length);
    });
  }

  function openComposer() {
    setComposerOpen(true);
    requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: isEmbedded }));
  }

  function togglePanel(next: DetailPanel) {
    setPanel((cur) => (cur === next ? "" : next));
  }

  function acceptTextHint() {
    const quoted = extractQuoted(prompt);
    if (quoted && !exactText) setExactText(quoted.slice(0, MAX_TEXT));
    setPanel("texto");
  }

  function toggleColor(id: string) {
    setColors((cur) => {
      if (cur.includes(id)) return cur.filter((c) => c !== id);
      if (cur.length >= MAX_COLORS) return [cur[1], id];
      return [...cur, id];
    });
  }

  // ---------- Generar (stream: start / image / failed / error / done) ----------
  async function handleGenerate() {
    if (!canGenerate) {
      if (prompt.trim().length < 3) setError("Escribe tu idea para empezar.");
      return;
    }
    const sentPrompt = fullPrompt;
    // Las propuestas que ya salieron se conservan; las nuevas se agregan después.
    const keptImages: string[] = [];
    const keptLabels: string[] = [];
    images.forEach((img, i) => {
      if (img && img !== FAILED) {
        keptImages.push(img);
        keptLabels.push(labels[i] || "");
      }
    });
    const offset = keptImages.length;
    let gotAny = false;
    try {
      setLoading(true);
      setGenPhase("thinking");
      setError("");
      setSaved(false);
      setImages(keptImages);
      setLabels(keptLabels);
      setGenOffset(offset);
      setSelectedIndex(null);
      setAdjustOpen(false);
      setComposerOpen(false);
      setLastPrompt(sentPrompt);
      requestAnimationFrame(() => {
        const el = resultsRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        // Dentro de la tienda (iframe) no movemos la página; la tienda controla su scroll.
        if (!isEmbedded) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: sentPrompt,
          mode,
          chips: mode === "sticker" ? styleDef.sticker : styleDef.playera,
          studioTab: "free",
          eventData: null,
          businessData: null,
        }),
      });

      if (!res.ok) {
        let message = "No se pudieron crear las propuestas. Intenta de nuevo.";
        if (res.status === 429) {
          message = "Ya creaste varias propuestas seguidas. Espera unos minutos y vuelve a intentarlo.";
        } else {
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch {}
        }
        throw new Error(message);
      }
      if (!res.body) throw new Error("No se recibieron imágenes.");

      const slots: string[] = [...keptImages];
      const slotLabels: string[] = [...keptLabels];
      let okCount = 0;
      let streamError = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (msg.type === "start") {
          const total = Number(msg.total) || 3;
          for (let i = 0; i < total; i++) {
            slots[offset + i] = "";
            slotLabels[offset + i] = Array.isArray(msg.labels) ? String(msg.labels[i] || "") : "";
          }
          setGenPhase("drawing");
          setImages([...slots]);
          setLabels([...slotLabels]);
        } else if (msg.type === "image") {
          const idx = offset + Number(msg.index);
          slots[idx] = String(msg.image || "");
          if (msg.label) slotLabels[idx] = String(msg.label);
          okCount += 1;
          gotAny = true;
          setImages([...slots]);
          setLabels([...slotLabels]);
          setSelectedIndex((cur) => (cur === null ? idx : cur));
        } else if (msg.type === "failed") {
          slots[offset + Number(msg.index)] = FAILED;
          setImages([...slots]);
        } else if (msg.type === "error") {
          streamError = String(msg.error || "");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf("\n");
        while (nl >= 0) {
          handleLine(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf("\n");
        }
      }
      handleLine(buffer);

      if (!okCount) {
        setImages(keptImages);
        setLabels(keptLabels);
        throw new Error(streamError || "No se pudieron crear las propuestas. Intenta con otra idea.");
      }
      setTimeout(postEmbedHeight, 80);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error.");
      if (!offset && !gotAny) setComposerOpen(true);
    } finally {
      setLoading(false);
      setGenPhase("idle");
    }
  }

  // ---------- Ajustar ----------
  function toggleAdjustPreset(id: string) {
    setAdjustError("");
    setAdjustPresets((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return cur;
      return [...cur, id];
    });
  }

  async function handleAdjust() {
    if (selectedIndex === null || adjusting || !selectedReady) return;
    if (!adjustPresets.length && !adjustNote.trim()) {
      setAdjustError("Elige qué quieres cambiar o escríbelo.");
      return;
    }
    try {
      setAdjusting(true);
      setAdjustError("");
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          image: selectedImage,
          presets: adjustPresets,
          note: adjustNote.trim(),
          mode,
        }),
      });
      if (!res.ok) {
        let message = "No pudimos crear el ajuste.";
        if (res.status === 429) {
          message = "Ya hiciste varios cambios seguidos. Espera unos minutos y vuelve a intentarlo.";
        } else {
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch {}
        }
        throw new Error(message);
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      if (!data?.image) throw new Error("No pudimos crear el ajuste. Intenta de nuevo.");
      const newIndex = images.length;
      setImages((cur) => [...cur, String(data.image)]);
      setLabels((cur) => [...cur, String(data.label || "Ajuste")]);
      setSelectedIndex(newIndex);
      setAdjustOpen(false);
      setAdjustPresets([]);
      setAdjustNote("");
      setSaved(false);
      setTimeout(postEmbedHeight, 80);
    } catch (err: any) {
      setAdjustError(err?.message || "No pudimos crear el ajuste.");
    } finally {
      setAdjusting(false);
    }
  }

  // ---------- Usar este diseño (se guarda y se manda al producto) ----------
  async function handleUseDesign() {
    if (selectedIndex === null || !selectedReady || saving || saved) return;
    const label = String(labels[selectedIndex] || `Propuesta ${selectedIndex + 1}`);
    try {
      setSaving(true);
      setError("");
      const saveRes = await fetch("/api/save-selected-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage, label, prompt: lastPrompt, mode }),
      });
      let savedData: any = null;
      try {
        savedData = await saveRes.json();
      } catch {}
      if (!saveRes.ok || !savedData?.imageUrl) {
        throw new Error(savedData?.error || "No se pudo guardar el diseño. Intenta de nuevo.");
      }
      const payload = {
        type: "AUTOPRINT_AI_DESIGN_SELECTED",
        imageUrl: savedData.imageUrl,
        designRef: savedData.designRef,
        label,
        prompt: lastPrompt,
        mode,
      };
      if (isEmbedded && window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar el diseño.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Vista ----------
  const summaryChips = [
    exactText.trim() ? `Texto: “${exactText.trim()}”` : "",
    colorText,
    styleId !== "auto" ? styleDef.label : "",
  ].filter(Boolean);

  return (
    <main className={`ap-shell ${dmSans.className} ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="page-wrap ap-studio">
        <header className="ap-head">
          <p className="ap-eyebrow">AutoPrint · Estudio IA</p>
          <h1 className="ap-title">{copy.title}</h1>
          <p className="ap-sub">{copy.sub}</p>
          {!isEmbedded && !forcedMode && (
            <div className="ap-mode" role="radiogroup" aria-label="Producto">
              {(["sticker", "playera"] as DesignMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  className={`ap-mode__btn ${mode === m ? "is-on" : ""}`}
                  disabled={loading || adjusting || saving}
                  onClick={() => {
                    setMode(m);
                    setImages([]);
                    setLabels([]);
                    setSelectedIndex(null);
                    setComposerOpen(true);
                  }}
                >
                  {m === "sticker" ? "Sticker" : "Playera"}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ---------- Paso 1: la idea ---------- */}
        {composerOpen ? (
          <section className="ap-compose" aria-label="Tu idea">
            <label htmlFor="ap-prompt" className="ap-label">
              ¿Qué quieres en tu {copy.noun}?
            </label>

            <div className="ap-box">
              <textarea
                id="ap-prompt"
                ref={promptRef}
                className="ap-box__input"
                rows={3}
                maxLength={500}
                value={prompt}
                placeholder={copy.placeholder}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
              />
              <div className="ap-box__tools" role="group" aria-label="Detalles opcionales">
                <button
                  type="button"
                  className={`ap-tool ${panel === "texto" ? "is-open" : ""} ${exactText.trim() ? "is-set" : ""}`}
                  aria-expanded={panel === "texto"}
                  onClick={() => togglePanel("texto")}
                >
                  <Icon name="text" />
                  {exactText.trim() ? `“${exactText.trim().slice(0, 14)}${exactText.trim().length > 14 ? "…" : ""}”` : "Texto exacto"}
                </button>
                <button
                  type="button"
                  className={`ap-tool ${panel === "colores" ? "is-open" : ""} ${colors.length ? "is-set" : ""}`}
                  aria-expanded={panel === "colores"}
                  onClick={() => togglePanel("colores")}
                >
                  {colorDefs.length ? (
                    <span className="ap-tool__dots" aria-hidden="true">
                      {colorDefs.map((c) => (
                        <i key={c.id} style={{ background: c.swatch }} />
                      ))}
                    </span>
                  ) : (
                    <Icon name="palette" />
                  )}
                  {colorDefs.length ? colorText : "Colores"}
                </button>
                <button
                  type="button"
                  className={`ap-tool ${panel === "estilo" ? "is-open" : ""} ${styleId !== "auto" ? "is-set" : ""}`}
                  aria-expanded={panel === "estilo"}
                  onClick={() => togglePanel("estilo")}
                >
                  <Icon name="brush" />
                  {styleId !== "auto" ? styleDef.label : "Estilo"}
                </button>
              </div>
            </div>

            {!prompt.trim() && (
              <div className="ap-starters">
                <span className="ap-starters__lead">Empieza con:</span>
                {STARTERS[mode].map((s) => (
                  <button key={s.label} type="button" className="ap-starter" onClick={() => applyStarter(s.opener)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {showTextHint && (
              <div className="ap-hint" role="status">
                <Icon name="wand" />
                <p>
                  ¿Tu diseño lleva un nombre o frase? Escríbelo en <strong>Texto exacto</strong> para que salga tal cual.
                </p>
                <button type="button" className="ap-hint__yes" onClick={acceptTextHint}>
                  Agregar
                </button>
                <button type="button" className="ap-hint__no" aria-label="No, gracias" onClick={() => setHintDismissed(true)}>
                  <Icon name="x" />
                </button>
              </div>
            )}

            {panel === "texto" && (
              <div className="ap-panel">
                <label htmlFor="ap-text" className="ap-panel__title">
                  Texto que debe aparecer
                </label>
                <p className="ap-panel__help">Escríbelo como debe ir, con acentos. Entre más corto, mejor se lee.</p>
                <div className="ap-field">
                  <input
                    id="ap-text"
                    className="ap-input"
                    type="text"
                    maxLength={MAX_TEXT}
                    value={exactText}
                    placeholder="Nombre, frase o marca"
                    autoComplete="off"
                    onChange={(e) => setExactText(e.target.value)}
                  />
                  <span className="ap-count">
                    {exactText.length}/{MAX_TEXT}
                  </span>
                </div>
                {exactText && (
                  <button type="button" className="ap-link" onClick={() => setExactText("")}>
                    Quitar texto
                  </button>
                )}
              </div>
            )}

            {panel === "colores" && (
              <div className="ap-panel">
                <p className="ap-panel__title">Colores principales</p>
                <p className="ap-panel__help">Elige hasta 2. Si no eliges, la IA propone.</p>
                <div className="ap-swatches">
                  {COLOR_OPTIONS.map((c) => {
                    const on = colors.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`ap-swatch ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleColor(c.id)}
                      >
                        <i style={{ background: c.swatch }} aria-hidden="true" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {colors.length > 0 && (
                  <button type="button" className="ap-link" onClick={() => setColors([])}>
                    Sin preferencia
                  </button>
                )}
              </div>
            )}

            {panel === "estilo" && (
              <div className="ap-panel">
                <p className="ap-panel__title">Estilo</p>
                <p className="ap-panel__help">Opcional. En «Automático» las 3 propuestas salen con estilos distintos.</p>
                <div className="ap-styles" role="radiogroup" aria-label="Estilo">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={styleId === s.id}
                      className={`ap-style ${styleId === s.id ? "is-on" : ""}`}
                      onClick={() => setStyleId(s.id)}
                    >
                      <span className="ap-style__name">{s.label}</span>
                      <span className="ap-style__hint">{s.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && !hasResults && (
              <p className="ap-error" role="alert">
                {error}
              </p>
            )}

            <button type="button" className="ap-cta" disabled={!canGenerate} onClick={handleGenerate}>
              <Icon name="spark" />
              {hasResults ? "Crear 3 propuestas nuevas" : "Crear 3 propuestas"}
            </button>
            <p className="ap-cta__note">Después puedes ajustar la que elijas.</p>
          </section>
        ) : (
          <section className="ap-summary" aria-label="Tu idea">
            <div className="ap-summary__body">
              <p className="ap-summary__label">Tu idea</p>
              <p className="ap-summary__text">{prompt.trim()}</p>
              {summaryChips.length > 0 && (
                <div className="ap-summary__chips">
                  {summaryChips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="ap-btn ap-btn--ghost" disabled={loading} onClick={openComposer}>
              <Icon name="edit" />
              Editar idea
            </button>
          </section>
        )}

        {/* ---------- Paso 2: elegir ---------- */}
        <div ref={resultsRef} className="ap-results-anchor" tabIndex={-1} aria-label="Tus propuestas" />
        <p className="ap-sr" aria-live="polite">
          {liveText}
        </p>
        {(loading || hasResults) && (
          <section className="ap-results" aria-label="Propuestas">
            <div className="ap-stage">
              {selectedReady ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedImage} alt={selectedLabel ? `${selectedLabel.style} ${selectedLabel.concept}` : "Propuesta"} />
              ) : (
                <div className="ap-stage__wait">
                  <span className="ap-spinner" aria-hidden="true" />
                  <p>{stageText}</p>
                </div>
              )}
              {adjusting && (
                <div className="ap-stage__veil">
                  <span className="ap-spinner" aria-hidden="true" />
                  <p>Creando tu versión ajustada…</p>
                </div>
              )}
            </div>

            <div className="ap-side">
              {loading && (
                <div className="ap-progress">
                  <p>{progressText}</p>
                  <div className="ap-progress__bar">
                    <span style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              {selectedLabel && selectedReady && (
                <div className="ap-picked">
                  <p className="ap-picked__style">{selectedLabel.style}</p>
                  {selectedLabel.concept && <h2 className="ap-picked__concept">{selectedLabel.concept}</h2>}
                </div>
              )}

              <div className="ap-thumbs" role="radiogroup" aria-label="Tus propuestas">
                {thumbSlots.map((img, i) => {
                  const lab = splitLabel(labels[i], i);
                  const failed = img === FAILED;
                  const ready = !!img && !failed;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={selectedIndex === i}
                      aria-label={ready ? `${lab.style} ${lab.concept}` : failed ? "Esta propuesta no salió" : "Dibujando"}
                      disabled={!ready}
                      className={`ap-thumb ${selectedIndex === i ? "is-on" : ""} ${failed ? "is-failed" : ""} ${!img ? "is-wait" : ""}`}
                      onClick={() => {
                        setSelectedIndex(i);
                        setAdjustOpen(false);
                        setSaved(false);
                      }}
                    >
                      <span className="ap-thumb__img">
                        {ready ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" />
                        ) : failed ? (
                          <em>No salió</em>
                        ) : (
                          <span className="ap-shimmer" />
                        )}
                        {selectedIndex === i && ready && (
                          <span className="ap-thumb__check">
                            <Icon name="check" />
                          </span>
                        )}
                      </span>
                      <span className="ap-thumb__label">{ready || lab.style !== `Propuesta ${i + 1}` ? lab.style : `Propuesta ${i + 1}`}</span>
                    </button>
                  );
                })}
              </div>

              {error && hasResults && (
                <p className="ap-error" role="alert">
                  {error}
                </p>
              )}

              {!loading && (
                <div className="ap-actions">
                  <button type="button" className={`ap-cta ${saved ? "is-saved" : ""}`} disabled={!selectedReady || saving || saved || adjusting} onClick={handleUseDesign}>
                    {saving ? (
                      <>
                        <span className="ap-spinner ap-spinner--light" aria-hidden="true" />
                        Guardando…
                      </>
                    ) : saved ? (
                      <>
                        <Icon name="check" />
                        Diseño agregado
                      </>
                    ) : (
                      <>Usar este diseño</>
                    )}
                  </button>
                  <div className="ap-actions__row">
                    <button
                      type="button"
                      className={`ap-btn ${adjustOpen ? "is-on" : ""}`}
                      disabled={!selectedReady || adjusting}
                      aria-expanded={adjustOpen}
                      onClick={() => {
                        setAdjustOpen((v) => !v);
                        setAdjustError("");
                      }}
                    >
                      <Icon name="wand" />
                      Ajustar diseño
                    </button>
                    <button type="button" className="ap-btn" disabled={adjusting} onClick={handleGenerate}>
                      <Icon name="redo" />
                      3 propuestas más
                    </button>
                  </div>
                </div>
              )}

              {adjustOpen && !loading && (
                <div className="ap-panel ap-adjust">
                  <p className="ap-panel__title">¿Qué le cambiamos?</p>
                  <p className="ap-panel__help">Elige hasta 3 o escríbelo. Creamos 1 versión nueva y la original se queda.</p>
                  <div className="ap-chips">
                    {ADJUST_OPTIONS.map((o) => {
                      const on = adjustPresets.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={`ap-chip ${on ? "is-on" : ""}`}
                          aria-pressed={on}
                          disabled={adjusting}
                          onClick={() => toggleAdjustPreset(o.id)}
                        >
                          {on && <Icon name="check" />}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="ap-input"
                    type="text"
                    maxLength={300}
                    value={adjustNote}
                    disabled={adjusting}
                    placeholder="Otro cambio (opcional)"
                    onChange={(e) => {
                      setAdjustNote(e.target.value);
                      setAdjustError("");
                    }}
                  />
                  {adjustError && (
                    <p className="ap-error" role="alert">
                      {adjustError}
                    </p>
                  )}
                  <div className="ap-actions__row">
                    <button type="button" className="ap-btn ap-btn--primary" disabled={adjusting} onClick={handleAdjust}>
                      {adjusting ? "Creando…" : "Crear versión ajustada"}
                    </button>
                    <button type="button" className="ap-btn ap-btn--ghost" disabled={adjusting} onClick={() => setAdjustOpen(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        .ap-shell {
          --ink: #0b1220;
          --body: #3d4554;
          --muted: #6b7382;
          --faint: #9aa2af;
          --line: #e4e7ec;
          --line-h: #c9ced6;
          --soft: #f7f8fa;
          --tint: #f1f4f9;
          --blue: #2347d6;
          --blue-h: #1b39b0;
          --blue-soft: #eef2fd;
          --green: #067a57;
          --red: #b42318;
          min-height: 100%;
          padding: 24px 16px;
          background: #ffffff;
          color: var(--body);
          -webkit-font-smoothing: antialiased;
        }
        .ap-shell.is-embedded {
          padding: 0;
          background: transparent;
        }
        .ap-shell *,
        .ap-shell *::before,
        .ap-shell *::after {
          box-sizing: border-box;
        }
        .ap-shell button,
        .ap-shell input,
        .ap-shell textarea {
          font-family: inherit;
        }
        .ap-ic {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }
        .ap-ic path {
          fill: currentColor;
        }

        .ap-studio {
          max-width: 920px;
          margin: 0 auto;
          padding: 32px 32px 36px;
          background: #ffffff;
          border-radius: 20px;
        }
        .is-embedded .ap-studio {
          padding: 28px 24px 28px;
        }

        /* Encabezado */
        .ap-head {
          max-width: 640px;
          margin-bottom: 22px;
        }
        .ap-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 10px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ap-eyebrow::before {
          content: "";
          width: 22px;
          height: 1.5px;
          background: var(--line-h);
        }
        .ap-title {
          margin: 0;
          font-size: clamp(24px, 4vw, 32px);
          line-height: 1.12;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: var(--ink);
        }
        .ap-sub {
          margin: 10px 0 0;
          font-size: 15px;
          line-height: 1.55;
          color: var(--body);
        }
        .ap-mode {
          display: inline-flex;
          margin-top: 16px;
          padding: 4px;
          border-radius: 12px;
          background: var(--tint);
        }
        .ap-mode__btn {
          height: 36px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
        }
        .ap-mode__btn.is-on {
          background: #fff;
          color: var(--ink);
          box-shadow: 0 1px 3px rgba(11, 18, 32, 0.12);
        }

        /* Cuadro de la idea */
        .ap-label {
          display: block;
          margin-bottom: 8px;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .ap-box {
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ap-box:hover {
          border-color: var(--line-h);
        }
        .ap-box:focus-within {
          border-color: var(--blue);
          box-shadow: 0 0 0 4px rgba(35, 71, 214, 0.1);
        }
        .ap-box__input {
          display: block;
          width: 100%;
          min-height: 96px;
          padding: 16px 16px 8px;
          border: 0;
          outline: 0;
          resize: vertical;
          background: transparent;
          font-size: 16px;
          line-height: 1.5;
          color: var(--ink);
        }
        .ap-box__input::placeholder {
          color: var(--faint);
        }
        .ap-box__tools {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 12px 12px;
        }
        .ap-tool {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          max-width: 100%;
          padding: 0 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #fff;
          font-size: 13px;
          font-weight: 600;
          color: var(--body);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .ap-tool .ap-ic {
          width: 16px;
          height: 16px;
          color: var(--muted);
        }
        .ap-tool:hover {
          border-color: var(--line-h);
          color: var(--ink);
        }
        .ap-tool.is-open {
          border-color: var(--ink);
          color: var(--ink);
        }
        .ap-tool.is-set {
          border-color: var(--blue);
          background: var(--blue-soft);
          color: var(--blue);
        }
        .ap-tool.is-set .ap-ic {
          color: var(--blue);
        }
        .ap-tool__dots {
          display: inline-flex;
        }
        .ap-tool__dots i {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px var(--line);
        }
        .ap-tool__dots i + i {
          margin-left: -5px;
        }

        /* Arranques */
        .ap-starters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }
        .ap-starters__lead {
          font-size: 13px;
          color: var(--muted);
        }
        .ap-starter {
          height: 32px;
          padding: 0 12px;
          border: 1px dashed var(--line-h);
          border-radius: 999px;
          background: var(--soft);
          font-size: 13px;
          font-weight: 500;
          color: var(--body);
          cursor: pointer;
        }
        .ap-starter:hover {
          border-color: var(--blue);
          border-style: solid;
          color: var(--blue);
          background: #fff;
        }

        /* Asistente de texto */
        .ap-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 10px 10px 10px 14px;
          border-radius: 12px;
          background: var(--blue-soft);
          color: var(--ink);
          animation: apIn 0.25s ease both;
        }
        .ap-hint > .ap-ic {
          color: var(--blue);
        }
        .ap-hint p {
          flex: 1;
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
        }
        .ap-hint__yes {
          height: 32px;
          padding: 0 14px;
          border: 0;
          border-radius: 9px;
          background: var(--blue);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .ap-hint__yes:hover {
          background: var(--blue-h);
        }
        .ap-hint__no {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
        }
        .ap-hint__no:hover {
          background: rgba(11, 18, 32, 0.06);
        }

        /* Paneles de detalle */
        .ap-panel {
          margin-top: 12px;
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
          animation: apIn 0.2s ease both;
        }
        .ap-panel__title {
          display: block;
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
        }
        .ap-panel__help {
          margin: 4px 0 12px;
          font-size: 13px;
          line-height: 1.45;
          color: var(--muted);
        }
        .ap-field {
          position: relative;
        }
        .ap-input {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          font-size: 16px;
          color: var(--ink);
          outline: 0;
        }
        .ap-field .ap-input {
          padding-right: 62px;
        }
        .ap-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 4px rgba(35, 71, 214, 0.1);
        }
        .ap-input::placeholder {
          color: var(--faint);
        }
        .ap-count {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: var(--faint);
          font-variant-numeric: tabular-nums;
        }
        .ap-link {
          margin-top: 10px;
          padding: 0;
          border: 0;
          background: none;
          font-size: 13px;
          font-weight: 600;
          color: var(--blue);
          cursor: pointer;
        }
        .ap-link:hover {
          text-decoration: underline;
        }
        .ap-swatches {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .ap-swatch {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          height: 40px;
          padding: 0 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: var(--body);
          cursor: pointer;
          white-space: nowrap;
        }
        .ap-swatch i {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          border-radius: 50%;
          box-shadow: inset 0 0 0 1px rgba(11, 18, 32, 0.12);
        }
        .ap-swatch:hover {
          border-color: var(--line-h);
        }
        .ap-swatch.is-on {
          border-color: var(--blue);
          box-shadow: 0 0 0 1px var(--blue);
          color: var(--ink);
          font-weight: 600;
        }
        .ap-styles {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .ap-style {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          text-align: left;
          cursor: pointer;
        }
        .ap-style:hover {
          border-color: var(--line-h);
        }
        .ap-style.is-on {
          border-color: var(--blue);
          box-shadow: 0 0 0 1px var(--blue);
        }
        .ap-style__name {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-style__hint {
          font-size: 12px;
          color: var(--muted);
        }

        /* Botón principal */
        .ap-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 54px;
          margin-top: 18px;
          border: 0;
          border-radius: 12px;
          background: var(--blue);
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .ap-cta:hover:not(:disabled) {
          background: var(--blue-h);
        }
        .ap-cta:active:not(:disabled) {
          transform: translateY(1px);
        }
        .ap-cta:disabled {
          background: #c9d1ee;
          cursor: not-allowed;
        }
        .ap-cta.is-saved:disabled {
          background: var(--green);
          cursor: default;
        }
        .ap-cta__note {
          margin: 10px 0 0;
          text-align: center;
          font-size: 13px;
          color: var(--muted);
        }
        .ap-error {
          margin: 12px 0 0;
          padding: 10px 14px;
          border-radius: 10px;
          background: #fef3f2;
          color: var(--red);
          font-size: 14px;
          line-height: 1.45;
        }

        /* Resumen de la idea */
        .ap-summary {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 14px 14px 14px 18px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
        }
        .ap-summary__body {
          flex: 1;
          min-width: 0;
        }
        .ap-summary__label {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ap-summary__text {
          margin: 0;
          font-size: 15px;
          line-height: 1.45;
          color: var(--ink);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          overflow-wrap: anywhere;
        }
        .ap-summary__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .ap-summary__chips span {
          padding: 3px 10px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid var(--line);
          font-size: 12px;
          color: var(--body);
        }

        /* Botones secundarios */
        .ap-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 46px;
          padding: 0 16px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s, background 0.15s;
        }
        .ap-btn .ap-ic {
          width: 17px;
          height: 17px;
          color: var(--muted);
        }
        .ap-btn:hover:not(:disabled) {
          border-color: var(--line-h);
          background: var(--soft);
        }
        .ap-btn.is-on {
          border-color: var(--ink);
        }
        .ap-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ap-btn--ghost {
          background: transparent;
        }
        .ap-summary .ap-btn {
          height: 40px;
          background: #fff;
        }
        .ap-btn--primary {
          border-color: var(--blue);
          background: var(--blue);
          color: #fff;
        }
        .ap-btn--primary:hover:not(:disabled) {
          border-color: var(--blue-h);
          background: var(--blue-h);
        }

        /* Resultados */
        .ap-results-anchor {
          scroll-margin-top: 16px;
          outline: none;
        }
        .ap-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }
        .ap-mode__btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .ap-results {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          gap: 28px;
          margin-top: 24px;
          animation: apIn 0.3s ease both;
        }
        .ap-stage {
          position: relative;
          aspect-ratio: 1 / 1;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: var(--soft);
          overflow: hidden;
        }
        .ap-stage img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #fff;
          animation: apFade 0.35s ease both;
        }
        .ap-stage__wait,
        .ap-stage__veil {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 24px;
          text-align: center;
        }
        .ap-stage__wait {
          background: linear-gradient(110deg, #f7f8fa 30%, #eef0f4 50%, #f7f8fa 70%);
          background-size: 220% 100%;
          animation: apShimmer 1.6s linear infinite;
        }
        .ap-stage__veil {
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(2px);
        }
        .ap-stage__wait p,
        .ap-stage__veil p {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-spinner {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 3px solid rgba(35, 71, 214, 0.18);
          border-top-color: var(--blue);
          animation: apSpin 0.8s linear infinite;
        }
        .ap-spinner--light {
          width: 18px;
          height: 18px;
          border-width: 2px;
          border-color: rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
        }
        .ap-side {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }
        .ap-progress p {
          margin: 0 0 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-progress__bar {
          height: 6px;
          border-radius: 999px;
          background: var(--tint);
          overflow: hidden;
        }
        .ap-progress__bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--blue);
          transition: width 0.6s ease;
        }
        .ap-picked__style {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ap-picked__concept {
          margin: 4px 0 0;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .ap-thumbs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .ap-thumb {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          padding: 0;
          border: 0;
          background: none;
          text-align: left;
          cursor: pointer;
        }
        .ap-thumb:disabled {
          cursor: default;
        }
        .ap-thumb__img {
          position: relative;
          display: grid;
          place-items: center;
          aspect-ratio: 1 / 1;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ap-thumb__img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          animation: apFade 0.35s ease both;
        }
        .ap-thumb:not(:disabled):hover .ap-thumb__img {
          border-color: var(--line-h);
        }
        .ap-thumb.is-on .ap-thumb__img {
          border-color: var(--blue);
          box-shadow: 0 0 0 2px var(--blue);
        }
        .ap-thumb.is-failed .ap-thumb__img {
          background: var(--soft);
        }
        .ap-thumb em {
          font-style: normal;
          font-size: 12px;
          color: var(--faint);
        }
        .ap-thumb__check {
          position: absolute;
          right: 6px;
          top: 6px;
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--blue);
          color: #fff;
        }
        .ap-thumb__check .ap-ic {
          width: 14px;
          height: 14px;
        }
        .ap-thumb__label {
          font-size: 12px;
          font-weight: 500;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ap-thumb.is-on .ap-thumb__label {
          color: var(--ink);
          font-weight: 600;
        }
        .ap-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, #f4f5f8 30%, #e9ecf1 50%, #f4f5f8 70%);
          background-size: 220% 100%;
          animation: apShimmer 1.6s linear infinite;
        }
        .ap-actions .ap-cta {
          margin-top: 0;
        }
        .ap-actions__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        .ap-adjust {
          margin-top: 0;
        }
        .ap-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }
        .ap-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 34px;
          padding: 0 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: var(--body);
          cursor: pointer;
        }
        .ap-chip .ap-ic {
          width: 15px;
          height: 15px;
        }
        .ap-chip:hover:not(:disabled) {
          border-color: var(--line-h);
        }
        .ap-chip.is-on {
          border-color: var(--blue);
          background: var(--blue-soft);
          color: var(--blue);
          font-weight: 600;
        }

        /* Celular */
        @media (max-width: 760px) {
          .ap-studio,
          .is-embedded .ap-studio {
            padding: 22px 16px 24px;
          }
          .ap-results {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }
          .ap-swatches {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .ap-styles {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .ap-summary {
            flex-direction: column;
            gap: 10px;
          }
          .ap-summary .ap-btn {
            align-self: stretch;
          }
        }
        @media (max-width: 420px) {
          .ap-actions__row {
            grid-template-columns: 1fr;
          }
          .ap-hint {
            flex-wrap: wrap;
          }
          .ap-hint p {
            flex-basis: calc(100% - 40px);
          }
        }

        @keyframes apIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes apFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes apShimmer {
          to {
            background-position: -220% 0;
          }
        }
        @keyframes apSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ap-shell *,
          .ap-shell *::before,
          .ap-shell *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
      <StudioInner />
    </Suspense>
  );
}
