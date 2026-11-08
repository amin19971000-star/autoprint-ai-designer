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
    sub: "Cuéntanos tu idea como se la contarías a un diseñador. La IA entiende lo importante y te muestra 3 propuestas.",
    placeholder:
      "Ej.: Tengo una cafetería que se llama Café Luna y quiero stickers para regalar con cada pedido. Algo alegre, con una taza sonriente y una luna.",
    noun: "sticker",
  },
  playera: {
    title: "Crea el diseño de tu playera con IA",
    sub: "Cuéntanos tu idea como se la contarías a un diseñador. La IA entiende lo importante y te muestra 3 propuestas.",
    placeholder:
      "Ej.: Es para el cumpleaños de mi hija Ana, cumple 6 años y le encantan los gatos y las flores. Que diga su nombre y tenga colores pastel.",
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

function Icon({
  name,
}: {
  name: "text" | "palette" | "brush" | "spark" | "check" | "wand" | "edit" | "redo" | "x" | "image" | "shirt" | "sticker";
}) {
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
    image: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9.6l3.3-3.3 2.6 2.6 3.6-4.4L18 14V6zm2.5 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
    shirt: "M8.5 3 3 5.6 1.5 10.8l3.4 1.3L6 10.4V21h12V10.4l1.1 1.7 3.4-1.3L21 5.6 15.5 3c-.6 1.6-2 2.6-3.5 2.6S9.1 4.6 8.5 3z",
    sticker: "M5 3h9.6L21 9.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm9 1.8V8a2 2 0 0 0 2 2h3.2z",
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
  const [brief, setBrief] = useState<{ label: string; value: string }[]>([]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPresets, setAdjustPresets] = useState<string[]>([]);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<"design" | "product">("design");
  const [shirtColor, setShirtColor] = useState<ShirtColor>("blanca");
  const [photoFailed, setPhotoFailed] = useState<Partial<Record<ShirtColor, boolean>>>({});
  const [cutouts, setCutouts] = useState<Record<string, string>>({});

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

  // ---------- Recorte del fondo blanco (para ponerlo sobre la playera real) ----------
  useEffect(() => {
    if (mode !== "playera" || view !== "product") return;
    if (selectedIndex === null) return;
    const src = images[selectedIndex];
    if (!src || src === FAILED) return;
    const key = cutoutKey(src);
    if (cutouts[key]) return;
    let alive = true;
    cutoutWhiteBackground(src)
      .then((out) => {
        if (alive && out) setCutouts((cur) => ({ ...cur, [key]: out }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode, view, selectedIndex, images, cutouts]);

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
      setBrief([]);
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
          if (Array.isArray(msg.brief)) {
            setBrief(
              msg.brief
                .map((b: any) => ({ label: String(b?.label || ""), value: String(b?.value || "") }))
                .filter((b: { label: string; value: string }) => b.label && b.value)
                .slice(0, 4)
            );
          }
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

  const step = saved || adjustOpen || adjusting ? 3 : hasResults || loading ? 2 : 1;
  const busyDrawn = Math.max(readyCount - genOffset, 0);
  const busyTotal = images.length - genOffset || 3;
  const canvasIdle = !loading && !hasResults;

  return (
    <main className={`ap-shell ${dmSans.className} ${isEmbedded ? "is-embedded" : ""}`}>
      <div className={`page-wrap ap-studio is-${mode}`}>
        {/* ---------- Encabezado ---------- */}
        <header className="ap-head">
          <div className="ap-head__top">
            <p className="ap-eyebrow">AutoPrint · Estudio IA</p>
            <ol className="ap-stepper" aria-label="Pasos">
              {["Describe", "Elige", "Ajusta y usa"].map((name, i) => {
                const n = i + 1;
                const state = n < step ? "is-done" : n === step ? "is-now" : "";
                return (
                  <li key={name} className={state} aria-current={n === step ? "step" : undefined}>
                    <span className="ap-stepper__n">{n < step ? <Icon name="check" /> : n}</span>
                    <span className="ap-stepper__t">{name}</span>
                  </li>
                );
              })}
            </ol>
          </div>
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
                    setView("design");
                  }}
                >
                  {m === "sticker" ? "Sticker" : "Playera"}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="ap-grid">
          {/* ---------- Columna izquierda: la idea ---------- */}
          <div className="ap-left">
            {!composerOpen && (
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

            <section className={`ap-card ap-compose ${composerOpen ? "" : "is-collapsed"}`} aria-label="Tu idea">
              <div className="ap-card__head">
                <span className="ap-badge">1</span>
                <label htmlFor="ap-prompt" className="ap-card__title">
                  Cuéntanos qué necesitas
                </label>
              </div>
              <p className="ap-card__help">
                Escríbelo con tus palabras, como si se lo contaras a un diseñador. Entre más nos cuentes, mejor:
              </p>
              <ul className="ap-guide" aria-label="Qué conviene contar">
                <li>¿Para qué o para quién es?</li>
                <li>¿Qué debe aparecer?</li>
                <li>Nombre o frase</li>
                <li>Colores o estilo</li>
              </ul>

              <div className="ap-box">
                <textarea
                  id="ap-prompt"
                  ref={promptRef}
                  className="ap-box__input"
                  rows={4}
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
                    {exactText.trim()
                      ? `“${exactText.trim().slice(0, 14)}${exactText.trim().length > 14 ? "…" : ""}”`
                      : "Texto exacto"}
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
                  <span className="ap-box__count" aria-hidden="true">
                    {prompt.length}/500
                  </span>
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
                  <span className="ap-hint__ic">
                    <Icon name="wand" />
                  </span>
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
                {loading ? <span className="ap-spinner ap-spinner--light" aria-hidden="true" /> : <Icon name="spark" />}
                {loading ? "Creando propuestas…" : hasResults ? "Crear 3 propuestas nuevas" : "Crear 3 propuestas"}
              </button>
              <p className="ap-cta__note">3 propuestas con estilos distintos · luego ajustas la que elijas</p>
            </section>

            {brief.length > 0 && (
              <section className="ap-brief" aria-label="Así entendimos tu pedido">
                <p className="ap-brief__head">
                  <span className="ap-brief__ic">
                    <Icon name="spark" />
                  </span>
                  Así entendió la IA tu pedido
                </p>
                <dl className="ap-brief__list">
                  {brief.map((b) => (
                    <div key={b.label + b.value}>
                      <dt>{b.label}</dt>
                      <dd>{b.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="ap-brief__note">¿Algo no es así? Edita tu descripción y crea propuestas nuevas.</p>
              </section>
            )}
          </div>

          {/* ---------- Columna derecha: el lienzo ---------- */}
          <div className={`ap-right ${canvasIdle ? "is-idle" : ""}`}>
            <div ref={resultsRef} className="ap-results-anchor" tabIndex={-1} aria-label="Tus propuestas" />
            <p className="ap-sr" aria-live="polite">
              {liveText}
            </p>

            <div className={`ap-canvas ${canvasIdle ? "is-empty" : ""} ${view === "product" && selectedReady ? "is-product" : ""}`}>
              {/* Barra superior del lienzo */}
              <div className="ap-canvas__bar">
                {selectedReady && selectedLabel ? (
                  <p className="ap-canvas__tag">
                    <span>{selectedLabel.style}</span>
                    {selectedLabel.concept && <strong>{selectedLabel.concept}</strong>}
                  </p>
                ) : (
                  <p className="ap-canvas__tag ap-canvas__tag--muted">
                    <span>Vista previa</span>
                  </p>
                )}
                {selectedReady && (
                  <div className="ap-view" role="radiogroup" aria-label="Cómo verlo">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={view === "design"}
                      className={view === "design" ? "is-on" : ""}
                      onClick={() => setView("design")}
                    >
                      <Icon name="image" />
                      Diseño
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={view === "product"}
                      className={view === "product" ? "is-on" : ""}
                      onClick={() => setView("product")}
                    >
                      <Icon name={mode === "playera" ? "shirt" : "sticker"} />
                      {mode === "playera" ? "En playera" : "Como sticker"}
                    </button>
                  </div>
                )}
              </div>

              {/* Escena */}
              <div className="ap-scene">
                {selectedReady ? (
                  view === "product" ? (
                    mode === "playera" ? (
                      <ShirtMockup
                        color={shirtColor}
                        photoFailed={!!photoFailed[shirtColor]}
                        onPhotoError={() => setPhotoFailed((cur) => ({ ...cur, [shirtColor]: true }))}
                        design={selectedImage}
                        cutout={cutouts[cutoutKey(selectedImage)] || ""}
                      />
                    ) : (
                      <div className="ap-stk">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedImage} alt="Vista del diseño como sticker" />
                      </div>
                    )
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={selectedImage.slice(-40)}
                      className="ap-art"
                      src={selectedImage}
                      alt={selectedLabel ? `${selectedLabel.style} ${selectedLabel.concept}` : "Propuesta"}
                    />
                  )
                ) : (
                  <div className="ap-empty" aria-hidden={loading ? "true" : undefined}>
                    {mode === "playera" ? (
                      <div className="ap-tee ap-tee--ghost">
                        <TeeSvg />
                        <span className="ap-tee__area">Área de impresión</span>
                      </div>
                    ) : (
                      <div className="ap-stk-ghost">
                        <span>Tu sticker</span>
                      </div>
                    )}
                    {!loading && <p className="ap-empty__t">Tu diseño aparecerá aquí</p>}
                  </div>
                )}

                {loading && !selectedReady && (
                  <div className="ap-overlay">
                  <div className="ap-loadcard" role="presentation">
                    <span className="ap-ring" aria-hidden="true" />
                    <p className="ap-loadcard__title">Creando tus propuestas</p>
                    <ul className="ap-loadcard__steps">
                      <li className={genPhase === "thinking" ? "is-now" : "is-done"}>
                        <span>{genPhase === "thinking" ? <i className="ap-dot" /> : <Icon name="check" />}</span>
                        Entendiendo tu idea
                      </li>
                      <li className={genPhase === "drawing" ? "is-now" : ""}>
                        <span>{genPhase === "drawing" ? <i className="ap-dot" /> : <i className="ap-dot ap-dot--off" />}</span>
                        Dibujando {genPhase === "drawing" ? `· ${busyDrawn} de ${busyTotal}` : "3 propuestas"}
                      </li>
                    </ul>
                    <div className="ap-progress__bar">
                      <span style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  </div>
                )}

                {adjusting && (
                  <div className="ap-overlay ap-overlay--veil">
                    <div className="ap-veil">
                      <span className="ap-ring" aria-hidden="true" />
                      <p>Creando tu versión ajustada…</p>
                    </div>
                  </div>
                )}
              </div>

              {view === "product" && selectedReady && mode === "playera" && (
                <div className="ap-shirtcolors" role="radiogroup" aria-label="Color de playera">
                  {(Object.keys(SHIRTS) as ShirtColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={shirtColor === c}
                      aria-label={`Playera ${SHIRTS[c].label.toLowerCase()}`}
                      title={SHIRTS[c].label}
                      className={shirtColor === c ? "is-on" : ""}
                      onClick={() => setShirtColor(c)}
                    >
                      <i style={{ background: SHIRTS[c].swatch }} />
                    </button>
                  ))}
                </div>
              )}
              {view === "product" && selectedReady && <p className="ap-canvas__note">Vista aproximada</p>}
            </div>

            {/* Tira de propuestas */}
            {thumbSlots.length > 0 && (
              <div className="ap-strip">
                <p className="ap-strip__head">
                  Tus propuestas <span>{readyCount}</span>
                </p>
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
              </div>
            )}

            {error && hasResults && (
              <p className="ap-error" role="alert">
                {error}
              </p>
            )}

            {hasResults && !loading && (
              <div className="ap-actions">
                <button
                  type="button"
                  className={`ap-cta ${saved ? "is-saved" : ""}`}
                  disabled={!selectedReady || saving || saved || adjusting}
                  onClick={handleUseDesign}
                >
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
            )}

            {adjustOpen && !loading && (
              <div className="ap-panel ap-adjust">
                <div className="ap-card__head">
                  <span className="ap-badge">3</span>
                  <p className="ap-card__title">¿Qué le cambiamos?</p>
                </div>
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
                <div className="ap-adjust__row">
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
        </div>
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
          --shadow-sm: 0 1px 2px rgba(11, 18, 32, 0.05);
          --shadow-md: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 24px -12px rgba(11, 18, 32, 0.14);
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

        .ap-studio {
          position: relative;
          max-width: 1120px;
          margin: 0 auto;
          padding: 28px 32px 32px;
          background: #ffffff;
          border-radius: 20px;
          isolation: isolate;
        }
        /* Brillo sutil de marca detrás del encabezado */
        .ap-studio::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 220px;
          border-radius: 20px 20px 0 0;
          background: radial-gradient(60% 120% at 0% 0%, rgba(35, 71, 214, 0.07), transparent 60%),
            radial-gradient(40% 90% at 100% 0%, rgba(35, 71, 214, 0.04), transparent 70%);
          z-index: -1;
          pointer-events: none;
        }

        /* ---------- Encabezado ---------- */
        .ap-head {
          margin-bottom: 24px;
        }
        .is-embedded .ap-head__top {
          padding-right: 56px;
        }
        .ap-head__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }
        .ap-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
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
        .ap-stepper {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .ap-stepper li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--faint);
        }
        .ap-stepper li + li::before {
          content: "";
          width: 28px;
          height: 1.5px;
          margin-right: 2px;
          border-radius: 2px;
          background: var(--line);
        }
        .ap-stepper li.is-done + li::before,
        .ap-stepper li.is-done + li.is-now::before {
          background: var(--blue);
        }
        .ap-stepper__n {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid var(--line-h);
          background: #fff;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
        }
        .ap-stepper__n .ap-ic {
          width: 14px;
          height: 14px;
        }
        .ap-stepper li.is-now {
          color: var(--ink);
          font-weight: 600;
        }
        .ap-stepper li.is-now .ap-stepper__n {
          border-color: var(--blue);
          background: var(--blue);
          color: #fff;
          box-shadow: 0 0 0 4px rgba(35, 71, 214, 0.12);
        }
        .ap-stepper li.is-done {
          color: var(--body);
        }
        .ap-stepper li.is-done .ap-stepper__n {
          border-color: var(--blue);
          background: var(--blue-soft);
          color: var(--blue);
        }
        .ap-title {
          margin: 0;
          font-size: clamp(24px, 3.4vw, 34px);
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--ink);
        }
        .ap-sub {
          max-width: 720px;
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
        .ap-mode__btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* ---------- Rejilla del estudio ---------- */
        .ap-grid {
          display: grid;
          grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }
        .ap-left,
        .ap-right {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        /* ---------- Tarjeta de la idea ---------- */
        .ap-card {
          padding: 20px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #fff;
          box-shadow: var(--shadow-md);
        }
        .ap-card__head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .ap-badge {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          flex: 0 0 auto;
          border-radius: 8px;
          background: var(--blue-soft);
          color: var(--blue);
          font-size: 13px;
          font-weight: 700;
        }
        .ap-card__title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--ink);
        }
        .ap-box {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .ap-box:hover {
          border-color: var(--line-h);
        }
        .ap-box:focus-within {
          border-color: var(--blue);
          background: #fff;
          box-shadow: 0 0 0 4px rgba(35, 71, 214, 0.1);
        }
        .ap-box__input {
          display: block;
          width: 100%;
          min-height: 112px;
          padding: 14px 14px 6px;
          border: 0;
          outline: 0;
          resize: none;
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
          align-items: center;
          gap: 6px;
          padding: 8px 10px 10px;
        }
        .ap-box__count {
          margin-left: auto;
          font-size: 11px;
          color: var(--faint);
          font-variant-numeric: tabular-nums;
        }
        .ap-tool {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          max-width: 100%;
          padding: 0 11px;
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
          box-shadow: var(--shadow-sm);
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

        .ap-starters {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
        }
        .ap-starters__lead {
          margin-right: 2px;
          font-size: 12px;
          color: var(--muted);
        }
        .ap-starter {
          height: 30px;
          padding: 0 11px;
          border: 1px dashed var(--line-h);
          border-radius: 999px;
          background: #fff;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--body);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .ap-starter:hover {
          border-color: var(--blue);
          border-style: solid;
          color: var(--blue);
        }

        .ap-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 10px 8px 10px 10px;
          border: 1px solid #d9e1fb;
          border-radius: 12px;
          background: var(--blue-soft);
          color: var(--ink);
          animation: apIn 0.25s ease both;
        }
        .ap-hint__ic {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          flex: 0 0 auto;
          border-radius: 9px;
          background: #fff;
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
          padding: 0 12px;
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
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
        }
        .ap-hint__no:hover {
          background: rgba(11, 18, 32, 0.06);
        }

        .ap-panel {
          margin-top: 12px;
          padding: 14px;
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
          font-size: 12.5px;
          line-height: 1.45;
          color: var(--muted);
        }
        .ap-field {
          position: relative;
        }
        .ap-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border: 1px solid var(--line);
          border-radius: 11px;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .ap-swatch {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          height: 38px;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .ap-style {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          min-width: 0;
          padding: 9px 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
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
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-style__hint {
          font-size: 12px;
          color: var(--muted);
        }

        .ap-cta {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 52px;
          margin-top: 16px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(180deg, #2b50e0 0%, var(--blue) 100%);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 18px -8px rgba(35, 71, 214, 0.55);
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .ap-cta:hover:not(:disabled) {
          filter: brightness(0.94);
        }
        .ap-cta:active:not(:disabled) {
          transform: translateY(1px);
        }
        .ap-cta:disabled {
          background: #c9d1ee;
          box-shadow: none;
          cursor: not-allowed;
        }
        .ap-cta.is-saved:disabled {
          background: var(--green);
          cursor: default;
        }
        .ap-cta__note {
          margin: 10px 0 0;
          text-align: center;
          font-size: 12.5px;
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

        .ap-summary {
          display: none;
        }

        /* Guía para describir el pedido */
        .ap-card__help {
          margin: -6px 0 10px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--muted);
        }
        .ap-guide {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 0 0 12px;
          padding: 0;
          list-style: none;
        }
        .ap-guide li {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--tint);
          font-size: 12px;
          font-weight: 500;
          color: var(--body);
        }
        .ap-guide li::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
          opacity: 0.6;
        }

        /* Así entendió la IA tu pedido */
        .ap-brief {
          padding: 16px 18px;
          border: 1px solid #d9e1fb;
          border-radius: 16px;
          background: linear-gradient(180deg, #f5f7fe 0%, #ffffff 100%);
          animation: apIn 0.3s ease both;
        }
        .ap-brief__head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 700;
          color: var(--ink);
        }
        .ap-brief__ic {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--blue);
          color: #fff;
        }
        .ap-brief__ic .ap-ic {
          width: 15px;
          height: 15px;
        }
        .ap-brief__list {
          display: grid;
          gap: 8px;
          margin: 0;
        }
        .ap-brief__list div {
          display: grid;
          grid-template-columns: 78px minmax(0, 1fr);
          gap: 10px;
          align-items: baseline;
        }
        .ap-brief__list dt {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ap-brief__list dd {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          overflow-wrap: anywhere;
        }
        .ap-brief__note {
          margin: 12px 0 0;
          font-size: 12px;
          color: var(--muted);
        }

        /* Playera real (foto) */
        .ap-mock {
          position: relative;
          height: 100%;
          width: auto;
          max-width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          overflow: hidden;
          animation: apPop 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .ap-mock.is-svg {
          border-radius: 0;
          overflow: visible;
        }
        .ap-mock__photo,
        .ap-mock > svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ap-mock__area {
          position: absolute;
        }
        .ap-mock__print {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center top;
        }
        .ap-mock__wait {
          position: absolute;
          left: 50%;
          top: 30%;
          margin-left: -9px;
        }
        .ap-mock__print.is-multiply {
          mix-blend-mode: multiply;
          filter: brightness(1.05) contrast(1.06);
        }
        .ap-mock__shade {
          position: absolute;
          inset: 0;
          background-repeat: no-repeat;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          mask-size: contain;
          -webkit-mask-position: center top;
          mask-position: center top;
          mix-blend-mode: multiply;
          opacity: 0.85;
          pointer-events: none;
        }
        .ap-shirtcolors {
          position: absolute;
          left: 14px;
          bottom: 12px;
          z-index: 3;
          display: flex;
          gap: 6px;
          padding: 4px;
          border: 1px solid rgba(228, 231, 236, 0.9);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .ap-shirtcolors button {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }
        .ap-shirtcolors i {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          box-shadow: inset 0 0 0 1px rgba(11, 18, 32, 0.18);
        }
        .ap-shirtcolors button.is-on {
          box-shadow: 0 0 0 2px var(--blue);
        }

        /* ---------- Lienzo ---------- */
        .ap-right {
          position: relative;
        }
        .ap-results-anchor {
          position: absolute;
          top: 0;
          left: 0;
          width: 1px;
          height: 1px;
          scroll-margin-top: 16px;
          outline: none;
        }
        .ap-canvas {
          position: relative;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--line);
          border-radius: 20px;
          background-color: #f4f6f9;
          background-image: radial-gradient(#d6dbe3 1px, transparent 1.2px);
          background-size: 18px 18px;
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }
        .ap-canvas__bar {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          pointer-events: none;
        }
        .ap-canvas__bar > * {
          pointer-events: auto;
        }
        .ap-canvas__tag {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
          max-width: 60%;
          margin: 0;
          padding: 7px 12px;
          border: 1px solid rgba(228, 231, 236, 0.9);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: var(--shadow-sm);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ap-canvas__tag span {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ap-canvas__tag strong {
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-view {
          display: inline-flex;
          padding: 3px;
          border: 1px solid rgba(228, 231, 236, 0.9);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: var(--shadow-sm);
        }
        .ap-view button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
          white-space: nowrap;
        }
        .ap-view button .ap-ic {
          width: 15px;
          height: 15px;
        }
        .ap-view button.is-on {
          background: var(--ink);
          color: #fff;
        }
        .ap-scene {
          position: relative;
          display: grid;
          place-items: center;
          grid-template-rows: minmax(0, 1fr);
          grid-template-columns: minmax(0, 1fr);
          aspect-ratio: 4 / 3;
          min-height: 0;
          padding: 60px 32px 34px;
        }
        .ap-scene > * {
          min-height: 0;
        }
        .ap-art {
          display: block;
          height: 100%;
          width: auto;
          max-width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(11, 18, 32, 0.06), 0 24px 48px -24px rgba(11, 18, 32, 0.28);
          animation: apPop 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .ap-canvas__note {
          position: absolute;
          bottom: 12px;
          left: 0;
          right: 0;
          margin: 0;
          text-align: center;
          font-size: 11.5px;
          color: var(--muted);
        }

        /* Playera */
        .ap-tee {
          position: relative;
          height: 100%;
          width: auto;
          max-width: 100%;
          aspect-ratio: 600 / 640;
          animation: apPop 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .ap-tee svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .ap-tee__print {
          position: absolute;
          left: 32%;
          top: 21%;
          width: 36%;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          mix-blend-mode: multiply;
          filter: brightness(1.05) contrast(1.06);
        }
        .ap-tee--ghost {
          opacity: 0.75;
          animation: none;
        }
        .ap-tee__area {
          position: absolute;
          left: 32%;
          top: 21%;
          width: 36%;
          aspect-ratio: 1 / 1;
          display: grid;
          place-items: center;
          border: 1.5px dashed #aab3c2;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8b94a3;
          text-align: center;
          padding: 6px;
        }

        /* Sticker */
        .ap-stk {
          height: 88%;
          width: auto;
          aspect-ratio: 1 / 1;
          padding: 3.5%;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 2px 4px rgba(11, 18, 32, 0.08), 0 30px 50px -22px rgba(11, 18, 32, 0.35);
          transform: rotate(-4deg);
          animation: apStick 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .ap-stk img {
          display: block;
          width: 100%;
          height: 100%;
          aspect-ratio: 1 / 1;
          object-fit: contain;
          border-radius: 14px;
        }
        .ap-canvas.is-product {
          background-color: #e6ebf2;
          background-image: radial-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1.2px);
        }
        .is-playera .ap-canvas.is-product {
          background-color: #eef1f5;
        }
        .ap-stk-ghost {
          display: grid;
          place-items: center;
          height: 72%;
          width: auto;
          aspect-ratio: 1 / 1;
          border: 2px dashed #aab3c2;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.6);
          transform: rotate(-4deg);
        }
        .ap-stk-ghost span {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8b94a3;
        }
        .ap-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          height: 100%;
        }
        .ap-empty > .ap-tee,
        .ap-empty > .ap-stk-ghost {
          flex: 1 1 auto;
          height: auto;
          min-height: 0;
        }
        .ap-empty__t {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
        }

        /* Cargando */
        .ap-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          padding: 20px;
        }
        .ap-overlay--veil {
          background: rgba(244, 246, 249, 0.55);
        }
        .ap-loadcard,
        .ap-veil {
          width: min(100%, 320px);
          padding: 22px 22px 20px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 24px 48px -20px rgba(11, 18, 32, 0.3);
          text-align: center;
          animation: apIn 0.3s ease both;
        }
        .ap-veil p {
          margin: 12px 0 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .ap-ring {
          display: inline-block;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid rgba(35, 71, 214, 0.15);
          border-top-color: var(--blue);
          animation: apSpin 0.85s linear infinite;
        }
        .ap-loadcard__title {
          margin: 12px 0 14px;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .ap-loadcard__steps {
          display: grid;
          gap: 8px;
          margin: 0 0 16px;
          padding: 0;
          list-style: none;
          text-align: left;
        }
        .ap-loadcard__steps li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          color: var(--faint);
        }
        .ap-loadcard__steps li > span {
          display: grid;
          place-items: center;
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--tint);
          color: var(--green);
        }
        .ap-loadcard__steps li > span .ap-ic {
          width: 14px;
          height: 14px;
        }
        .ap-loadcard__steps li.is-now {
          color: var(--ink);
          font-weight: 600;
        }
        .ap-loadcard__steps li.is-done {
          color: var(--body);
        }
        .ap-loadcard__steps li.is-done > span {
          background: #e7f5ef;
        }
        .ap-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--blue);
          animation: apPulse 1s ease-in-out infinite;
        }
        .ap-dot--off {
          background: var(--line-h);
          animation: none;
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
        .ap-spinner {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(35, 71, 214, 0.18);
          border-top-color: var(--blue);
          animation: apSpin 0.8s linear infinite;
        }
        .ap-spinner--light {
          border-color: rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
        }

        /* ---------- Tira de propuestas ---------- */
        .ap-strip__head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
        }
        .ap-strip__head span {
          padding: 1px 8px;
          border-radius: 999px;
          background: var(--tint);
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }
        .ap-thumbs {
          display: grid;
          grid-template-columns: repeat(auto-fill, 80px);
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
          box-shadow: var(--shadow-sm);
          transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .ap-thumb__img img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          animation: apFade 0.35s ease both;
        }
        .ap-thumb:not(:disabled):hover .ap-thumb__img {
          border-color: var(--line-h);
          transform: translateY(-2px);
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
          box-shadow: 0 0 0 2px #fff;
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

        /* ---------- Acciones ---------- */
        .ap-actions {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
        }
        .ap-actions .ap-cta {
          margin-top: 0;
        }
        .ap-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 52px;
          padding: 0 14px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
          white-space: nowrap;
          box-shadow: var(--shadow-sm);
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
          box-shadow: none;
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
        .ap-adjust {
          margin-top: 0;
          background: #fff;
          box-shadow: var(--shadow-md);
        }
        .ap-adjust .ap-card__head {
          margin-bottom: 4px;
        }
        .ap-adjust__row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          margin-top: 12px;
        }
        .ap-adjust__row .ap-btn {
          height: 46px;
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

        /* ---------- Tableta y celular ---------- */
        @media (max-width: 900px) {
          .ap-studio {
            padding: 22px 16px 24px;
          }
          .ap-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }
          .ap-right.is-idle {
            display: none;
          }
          .ap-compose.is-collapsed {
            display: none;
          }
          .ap-summary {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 14px 14px 14px 16px;
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
          .ap-summary .ap-btn {
            height: 40px;
            background: #fff;
          }
        }
        @media (max-width: 640px) {
          .ap-head__top {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .ap-stepper li + li::before {
            width: 14px;
          }
          .ap-stepper__t {
            font-size: 12px;
          }
          .ap-card {
            padding: 16px;
          }
          .ap-scene {
            aspect-ratio: 1 / 1;
            padding: 56px 18px 28px;
          }
          .ap-canvas__tag {
            max-width: 52%;
          }
          .ap-view button {
            padding: 0 9px;
          }
          .ap-actions {
            grid-template-columns: 1fr 1fr;
          }
          .ap-actions .ap-cta {
            grid-column: 1 / -1;
          }
          .ap-btn {
            height: 48px;
            font-size: 13.5px;
          }
          .ap-summary {
            flex-direction: column;
            gap: 10px;
          }
          .ap-summary .ap-btn {
            align-self: stretch;
          }
          .ap-thumbs {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 400px) {
          .ap-canvas__tag strong {
            display: none;
          }
          .ap-hint {
            flex-wrap: wrap;
          }
          .ap-hint p {
            flex-basis: calc(100% - 44px);
          }
          .ap-adjust__row {
            grid-template-columns: 1fr;
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
        @keyframes apPop {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes apStick {
          from {
            opacity: 0;
            transform: rotate(-10deg) scale(0.9);
          }
          to {
            opacity: 1;
            transform: rotate(-4deg);
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
        @keyframes apPulse {
          50% {
            opacity: 0.35;
            transform: scale(0.8);
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

// ---------- Playeras reales para la vista previa ----------
// Fotos en la carpeta public del proyecto (misma foto, 5 colores). «print» = zona de impresión del pecho
// en % de la foto: x/y = esquina superior izquierda, w/h = ancho y alto máximos.
type ShirtColor = "blanca" | "negra" | "gris" | "marino" | "roja";
const SHIRT_PRINT = { x: 35.4, y: 20, w: 28.75, h: 35 };
const SHIRTS: Record<ShirtColor, { label: string; swatch: string; dark: boolean; photo: string }> = {
  blanca: { label: "Blanca", swatch: "#ffffff", dark: false, photo: "/mockup-playera-blanca.webp" },
  negra: { label: "Negra", swatch: "#1b1c20", dark: true, photo: "/mockup-playera-negra.webp" },
  gris: { label: "Gris jaspe", swatch: "#c9cbce", dark: false, photo: "/mockup-playera-gris.webp" },
  marino: { label: "Azul marino", swatch: "#1d2850", dark: true, photo: "/mockup-playera-marino.webp" },
  roja: { label: "Roja", swatch: "#cf222a", dark: true, photo: "/mockup-playera-roja.webp" },
};
const SHIRT_SHADE = "/mockup-playera-sombras.webp";
// Si la foto no carga, se usa la playera dibujada (mismas proporciones).
const SVG_PRINT = { x: 33.1, y: 21, w: 33.75, h: 36 };

function cutoutKey(src: string) {
  return `${src.length}:${src.slice(-48)}`;
}

// Quita el fondo blanco que toca las orillas (como un corte de sticker), suaviza el borde y recorta
// el espacio vacío alrededor, para que el diseño ocupe bien la zona de impresión.
// Los blancos que están DENTRO del diseño se conservan.
async function cutoutWhiteBackground(src: string): Promise<string> {
  if (typeof window === "undefined") return "";
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * scale));
  const H = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const isBg = (p: number) => {
    const i = p * 4;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mn = Math.min(r, g, b);
    const mx = Math.max(r, g, b);
    return mn >= 226 && mx - mn <= 24;
  };
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (!seen[p] && isBg(p)) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % W;
    if (x > 0) push(p - 1);
    if (x < W - 1) push(p + 1);
    if (p >= W) push(p - W);
    if (p < W * (H - 1)) push(p + W);
  }
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let p = 0; p < W * H; p++) {
    const x = p % W;
    if (seen[p]) {
      px[p * 4 + 3] = 0;
      continue;
    }
    const nearBg =
      (x > 0 && seen[p - 1]) || (x < W - 1 && seen[p + 1]) || (p >= W && seen[p - W]) || (p < W * (H - 1) && seen[p + W]);
    if (nearBg) {
      const i = p * 4;
      const mn = Math.min(px[i], px[i + 1], px[i + 2]);
      const whiteness = Math.max(0, Math.min(1, (mn - 170) / 85));
      px[i + 3] = Math.round(255 * (1 - whiteness * 0.8));
    }
    if (px[p * 4 + 3] > 24) {
      const y = (p - x) / W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (maxX < minX || maxY < minY) return canvas.toDataURL("image/png");
  // Recorta al contenido real (con un pequeño margen).
  const pad = Math.round(Math.max(W, H) * 0.01);
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(W, maxX + pad + 1) - cx;
  const ch = Math.min(H, maxY + pad + 1) - cy;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return out.toDataURL("image/png");
}

function ShirtMockup({
  color,
  photoFailed,
  onPhotoError,
  design,
  cutout,
}: {
  color: ShirtColor;
  photoFailed: boolean;
  onPhotoError: () => void;
  design: string;
  cutout: string;
}) {
  const shirt = SHIRTS[color];
  const usePhoto = !photoFailed;
  const box = usePhoto ? SHIRT_PRINT : SVG_PRINT;
  // Con el recorte el diseño se ve como impreso en cualquier color. Mientras se recorta, en blanca se usa «multiply».
  const printSrc = cutout || (color === "blanca" ? design : "");
  const pct = (v: number, size: number) => `${size >= 100 ? 0 : (v / (100 - size)) * 100}%`;
  return (
    <div className={`ap-mock ${usePhoto ? "" : "is-svg"}`}>
      {usePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={shirt.photo} className="ap-mock__photo" src={shirt.photo} alt="" onError={onPhotoError} />
      ) : (
        <TeeSvg dark={shirt.dark} />
      )}
      <div
        className="ap-mock__area"
        style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
      >
        {printSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={`ap-mock__print ${cutout ? "" : "is-multiply"}`}
              src={printSrc}
              alt={`Vista del diseño en playera ${shirt.label.toLowerCase()}`}
            />
            {/* Pliegues de la tela encima de la tinta (solo donde hay diseño). */}
            {usePhoto && cutout && (
              <div
                className="ap-mock__shade"
                style={{
                  backgroundImage: `url(${SHIRT_SHADE})`,
                  backgroundSize: `${(100 / box.w) * 100}% ${(100 / box.h) * 100}%`,
                  backgroundPosition: `${pct(box.x, box.w)} ${pct(box.y, box.h)}`,
                  WebkitMaskImage: `url(${cutout})`,
                  maskImage: `url(${cutout})`,
                }}
              />
            )}
          </>
        ) : (
          <span className="ap-spinner ap-mock__wait" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

// Playera dibujada (respaldo mientras no haya foto real).
function TeeSvg({ dark = false }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 600 640" aria-hidden="true">
      <defs>
        <linearGradient id="apTeeBody" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={dark ? "#0f1115" : "#e9ecf0"} />
          <stop offset="0.16" stopColor={dark ? "#1d2027" : "#ffffff"} />
          <stop offset="0.84" stopColor={dark ? "#1d2027" : "#ffffff"} />
          <stop offset="1" stopColor={dark ? "#0e1014" : "#e6e9ee"} />
        </linearGradient>
        <linearGradient id="apTeeFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0.05" />
        </linearGradient>
        <filter id="apTeeShadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#0b1220" floodOpacity="0.14" />
        </filter>
      </defs>
      <g filter="url(#apTeeShadow)">
        <path
          d="M206 52C236 41 258 35 268 34c14 30 50 30 64 0 10 1 32 7 62 18l126 52c20 8 32 24 38 44l28 102c3 12-4 22-16 26l-76 24c-10 3-20-2-23-12l-19-62v360c0 14-10 24-24 24H172c-14 0-24-10-24-24V226l-19 62c-3 10-13 15-23 12l-76-24c-12-4-19-14-16-26l28-102c6-20 18-36 38-44z"
          fill="url(#apTeeBody)"
          stroke={dark ? "#0b0c10" : "#d3d8df"}
          strokeWidth="2"
        />
        <path
          d="M206 52C236 41 258 35 268 34c14 30 50 30 64 0 10 1 32 7 62 18l126 52c20 8 32 24 38 44l28 102c3 12-4 22-16 26l-76 24c-10 3-20-2-23-12l-19-62v360c0 14-10 24-24 24H172c-14 0-24-10-24-24V226l-19 62c-3 10-13 15-23 12l-76-24c-12-4-19-14-16-26l28-102c6-20 18-36 38-44z"
          fill="url(#apTeeFade)"
        />
      </g>
      <path d="M262 36c12 40 64 40 76 0" fill="none" stroke={dark ? "#2a2e36" : "#dde1e7"} strokeWidth="9" strokeLinecap="round" />
      <path d="M148 226c-2-46 4-88 24-128" fill="none" stroke={dark ? "#2a2e36" : "#e1e4ea"} strokeWidth="2" />
      <path d="M452 226c2-46-4-88-24-128" fill="none" stroke={dark ? "#2a2e36" : "#e1e4ea"} strokeWidth="2" />
      <path d="M180 520c40 10 80 14 120 14" fill="none" stroke={dark ? "#262a31" : "#eceef2"} strokeWidth="3" strokeLinecap="round" />
      <path d="M330 470c30 8 60 10 90 6" fill="none" stroke={dark ? "#262a31" : "#eceef2"} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando…</div>}>
      <StudioInner />
    </Suspense>
  );
}
