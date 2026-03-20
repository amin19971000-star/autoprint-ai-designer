"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";

type DesignMode = "sticker" | "playera";
type StudioTab = "free" | "event";

type ChipId =
  | "circular"
  | "iconico"
  | "compacto"
  | "vintage"
  | "street"
  | "premium"
  | "colores_vivos"
  | "alto_contraste"
  | "minimal"
  | "divertido"
  | "feroz"
  | "elegante"
  | "composicion_frontal"
  | "impacto_visual"
  | "estilo_pecho"
  | "streetwear"
  | "tonos_oscuros";

type ChipDef = {
  id: ChipId;
  label: string;
  helper: string;
};

type ChipGroup = {
  id: string;
  title: string;
  subtitle: string;
  chips: ChipDef[];
};

type ColorOptionId =
  | "rojo"
  | "azul"
  | "rosa"
  | "morado"
  | "verde"
  | "negro"
  | "dorado"
  | "plateado"
  | "pastel"
  | "multicolor";

type ColorOption = {
  id: ColorOptionId;
  label: string;
};

const MAX_ACTIVE_CHIPS = 3;
const MAX_EVENT_COLORS = 2;

const COLOR_OPTIONS: ColorOption[] = [
  { id: "rojo", label: "Rojo" },
  { id: "azul", label: "Azul" },
  { id: "rosa", label: "Rosa" },
  { id: "morado", label: "Morado" },
  { id: "verde", label: "Verde" },
  { id: "negro", label: "Negro" },
  { id: "dorado", label: "Dorado" },
  { id: "plateado", label: "Plateado" },
  { id: "pastel", label: "Pastel" },
  { id: "multicolor", label: "Multicolor" },
];

const EVENT_OPTIONS = [
  "Cumpleaños",
  "Bautizo",
  "Baby shower",
  "Primera comunión",
  "Fiesta temática",
  "Otro",
];

const STICKER_CHIP_GROUPS: ChipGroup[] = [
  {
    id: "shape",
    title: "Forma del diseño",
    subtitle: "Esto ayuda a definir cómo se acomoda y cómo se leerá tu sticker.",
    chips: [
      { id: "circular", label: "Circular", helper: "Fuerza una composición redonda tipo badge." },
      { id: "iconico", label: "Icónico", helper: "Busca una silueta más memorable y reconocible." },
      { id: "compacto", label: "Compacto", helper: "Aprieta la composición para que se sienta más sticker." },
      { id: "alto_contraste", label: "Alto contraste", helper: "Mejora legibilidad y punch visual." },
      { id: "minimal", label: "Minimal", helper: "Reduce ruido y elementos innecesarios." },
    ],
  },
  {
    id: "style",
    title: "Estilo y personalidad",
    subtitle: "Esto define el look, la energía y el acabado visual.",
    chips: [
      { id: "vintage", label: "Vintage", helper: "Le da una dirección retro más trabajada." },
      { id: "street", label: "Street", helper: "Empuja una energía más urbana y gráfica." },
      { id: "premium", label: "Premium", helper: "Sube el acabado visual y la sensación premium." },
      { id: "colores_vivos", label: "Colores vivos", helper: "Empuja una paleta más saturada y comercial." },
      { id: "divertido", label: "Divertido", helper: "Hace la propuesta más juguetona o carismática." },
      { id: "feroz", label: "Feroz", helper: "Le mete más agresividad y fuerza." },
      { id: "elegante", label: "Elegante", helper: "Refina formas, postura y lenguaje visual." },
    ],
  },
];

const PLAYERA_CHIP_GROUPS: ChipGroup[] = [
  {
    id: "layout",
    title: "Acomodo en la playera",
    subtitle: "Esto ayuda a definir cómo lucirá mejor el diseño sobre la prenda.",
    chips: [
      { id: "composicion_frontal", label: "Composición frontal", helper: "Piensa el arte como gráfico frontal usable en playera." },
      { id: "impacto_visual", label: "Impacto visual", helper: "Empuja una propuesta más fuerte y llamativa." },
      { id: "estilo_pecho", label: "Estilo pecho", helper: "Composición más compacta para colocación tipo pecho." },
      { id: "alto_contraste", label: "Alto contraste", helper: "Aumenta punch y lectura sobre prenda." },
      { id: "minimal", label: "Minimal", helper: "Reduce ruido y carga visual." },
    ],
  },
  {
    id: "style",
    title: "Estilo y personalidad",
    subtitle: "Esto define el look, el ambiente y la presencia del diseño.",
    chips: [
      { id: "streetwear", label: "Streetwear", helper: "Dirección más moda urbana / graphic tee." },
      { id: "vintage", label: "Vintage", helper: "Retro trabajado con lógica de prenda." },
      { id: "premium", label: "Premium", helper: "Empuja una lectura más refinada y vendible." },
      { id: "tonos_oscuros", label: "Tonos oscuros", helper: "Paleta más profunda y con más peso visual." },
      { id: "divertido", label: "Divertido", helper: "Hace la dirección más amigable o juguetona." },
      { id: "feroz", label: "Feroz", helper: "Le mete más intensidad y presencia al arte." },
      { id: "elegante", label: "Elegante", helper: "Más refinado y sofisticado." },
    ],
  },
];

const MODE_COPY = {
  sticker: {
    freeTitle: "Dirige tu sticker como si estuvieras en un estudio",
    freeSubhelp:
      "Escribe tu idea y te mostraremos 3 propuestas con más intención, más estilo y mejor presencia visual para sticker.",
    eventTitle: "Diseña un sticker con nombre, tema y detalles importantes",
    eventSubhelp:
      "Cuando tu diseño lleva nombre, edad, frase o tipo de evento, este modo nos ayuda a respetar mejor cada detalle.",
    freePlaceholder:
      "Ejemplo: tigre feroz con corona, nombre Leo y un estilo premium muy icónico",
    promptLabel: "Describe tu diseño",
    promptNote:
      "Cuéntanos el personaje, nombre, colores, frase o detalles que te gustaría ver en tu sticker.",
    eventSectionTitle: "Cuéntanos los detalles importantes",
    eventSectionNote:
      "Entre más claro sea el nombre, la edad, el tema y los colores, mejor podremos construir tus propuestas.",
    chipsTitle: "Dale dirección a tu diseño",
    chipsSub:
      "Elige hasta 3 opciones para marcar el estilo y la personalidad que quieres ver en tus propuestas.",
    primaryCta: "Explorar propuestas",
    primarySub: "3 propuestas listas para sticker",
    loadingTitle: "Estamos creando tus 3 propuestas",
    loadingSub:
      "Interpretando tu idea y refinándola para que se vea más fuerte, más clara y mejor pensada como sticker.",
    resultsKicker: "Propuestas del estudio",
    resultsTitle: "Elige la propuesta que más te guste",
    resultsSub:
      "Revisa tus 3 opciones y selecciona la que mejor represente tu idea.",
    directionPanelTitle: "Dirección elegida",
    directionPanelSub:
      "Tomaremos tu idea y la refinaremos con estas indicaciones visuales.",
    priorityPanelTitle: "El estudio dará prioridad a esto",
    priorityPanelSub:
      "Estos datos tendrán más peso al momento de construir tus propuestas.",
    selectionReady: "Lista para usarse en tu sticker.",
    finalCta: "Usar este diseño en mi sticker",
    previewSelect: "Seleccionar este diseño para sticker",
  },
  playera: {
    freeTitle: "Dirige tu playera como si estuvieras en un estudio",
    freeSubhelp:
      "Escribe tu idea y te mostraremos 3 propuestas con más intención, más estilo y mejor presencia visual para playera.",
    eventTitle: "Diseña una playera con nombre, tema y detalles importantes",
    eventSubhelp:
      "Cuando tu diseño lleva nombre, edad, frase o tipo de evento, este modo nos ayuda a respetar mejor cada detalle.",
    freePlaceholder:
      "Ejemplo: samurái vintage para playera con un estilo premium y mucha presencia",
    promptLabel: "Describe tu diseño",
    promptNote:
      "Cuéntanos el personaje, nombre, colores, frase o detalles que te gustaría ver en tu playera.",
    eventSectionTitle: "Cuéntanos los detalles importantes",
    eventSectionNote:
      "Entre más claro sea el nombre, la edad, el tema y los colores, mejor podremos construir tus propuestas.",
    chipsTitle: "Dale dirección a tu diseño",
    chipsSub:
      "Elige hasta 3 opciones para marcar el estilo y la personalidad que quieres ver en tus propuestas.",
    primaryCta: "Explorar propuestas",
    primarySub: "3 propuestas listas para playera",
    loadingTitle: "Estamos creando tus 3 propuestas",
    loadingSub:
      "Interpretando tu idea y refinándola para que se vea con más fuerza y mejor presencia sobre la prenda.",
    resultsKicker: "Propuestas del estudio",
    resultsTitle: "Elige la propuesta que más te guste",
    resultsSub:
      "Revisa tus 3 opciones y selecciona la que mejor represente tu idea.",
    directionPanelTitle: "Dirección elegida",
    directionPanelSub:
      "Tomaremos tu idea y la refinaremos con estas indicaciones visuales.",
    priorityPanelTitle: "El estudio dará prioridad a esto",
    priorityPanelSub:
      "Estos datos tendrán más peso al momento de construir tus propuestas.",
    selectionReady: "Lista para usarse en tu playera.",
    finalCta: "Usar este diseño en mi playera",
    previewSelect: "Seleccionar este diseño para playera",
  },
} as const;

function HomePageInner() {
  const searchParams = useSearchParams();
  const scrollRestoreRef = useRef(0);

  const [mode, setMode] = useState<DesignMode>("sticker");
  const [studioTab, setStudioTab] = useState<StudioTab>("free");

  const [prompt, setPrompt] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventNumber, setEventNumber] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventTheme, setEventTheme] = useState("");
  const [eventPhrase, setEventPhrase] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [eventColors, setEventColors] = useState<ColorOptionId[]>([]);
  const [eventCustomColors, setEventCustomColors] = useState("");
  const [colorMessage, setColorMessage] = useState("");

  const [activeChips, setActiveChips] = useState<ChipId[]>([]);
  const [chipMessage, setChipMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEmbedded = searchParams.get("embed") === "1";
  const copy = MODE_COPY[mode];
  const chipGroups = mode === "sticker" ? STICKER_CHIP_GROUPS : PLAYERA_CHIP_GROUPS;

  const allAvailableChips = useMemo(
    () => chipGroups.flatMap((group) => group.chips),
    [chipGroups]
  );

  const activeChipDefs = useMemo(
    () => allAvailableChips.filter((chip) => activeChips.includes(chip.id)),
    [allAvailableChips, activeChips]
  );

  const selectedColorDefs = useMemo(
    () => COLOR_OPTIONS.filter((color) => eventColors.includes(color.id)),
    [eventColors]
  );

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;
  const selectedLabel = selectedIndex !== null ? labels[selectedIndex] : null;

  const isEventReady =
    eventName.trim().length > 0 ||
    eventNumber.trim().length > 0 ||
    eventType.trim().length > 0 ||
    eventTheme.trim().length > 0 ||
    eventPhrase.trim().length > 0 ||
    eventDetails.trim().length > 0 ||
    eventColors.length > 0 ||
    eventCustomColors.trim().length > 0;

  const canGenerate =
    studioTab === "free"
      ? prompt.trim().length > 0 && !loading
      : isEventReady && !loading;

  function postEmbedHeight() {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;

    const wrap = document.querySelector(".page-wrap");
    if (!wrap) return;

    const height = wrap.scrollHeight + 24;
    const win = window as typeof window & { __lastSentHeight?: number };

    if (
      typeof win.__lastSentHeight === "number" &&
      Math.abs(win.__lastSentHeight - height) < 8
    ) {
      return;
    }

    win.__lastSentHeight = height;

    window.parent.postMessage(
      {
        type: "AUTOPRINT_AI_RESIZE",
        height,
      },
      "*"
    );
  }

  useEffect(() => {
    const forcedMode = searchParams.get("mode");

    if (forcedMode === "sticker") {
      setMode("sticker");
    } else if (forcedMode === "playera" || forcedMode === "shirt") {
      setMode("playera");
    }
  }, [searchParams]);

  useEffect(() => {
    setImages([]);
    setLabels([]);
    setSelectedIndex(null);
    setPreviewIndex(null);
    setActiveChips([]);
    setChipMessage("");
    setColorMessage("");
    setError("");
  }, [mode, studioTab]);

  useEffect(() => {
    if (!isEmbedded) return;

    let rafId = 0;
    const run = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        postEmbedHeight();
      });
    };

    run();

    const resizeObserver = new ResizeObserver(() => {
      run();
    });

    resizeObserver.observe(document.body);

    window.addEventListener("load", run);
    window.addEventListener("resize", run);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("load", run);
      window.removeEventListener("resize", run);
    };
  }, [
    isEmbedded,
    images.length,
    selectedIndex,
    previewIndex,
    loading,
    error,
    activeChips.length,
    prompt.length,
    chipMessage,
    studioTab,
    eventName,
    eventNumber,
    eventType,
    eventTheme,
    eventPhrase,
    eventDetails,
    eventColors.length,
    eventCustomColors,
    colorMessage,
  ]);

  useEffect(() => {
    if (previewIndex === null || typeof document === "undefined") return;

    const scrollEl = document.scrollingElement || document.documentElement;
    scrollRestoreRef.current = scrollEl.scrollTop || window.scrollY || 0;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    scrollEl.scrollTop = 0;
    window.scrollTo(0, 0);

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
      document.documentElement.style.overflow = previousHtmlOverflow;

      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollRestoreRef.current;
        window.scrollTo(0, scrollRestoreRef.current);
      });
    };
  }, [previewIndex]);

  function toggleChip(chipId: ChipId) {
    setError("");

    setActiveChips((current) => {
      if (current.includes(chipId)) {
        setChipMessage("");
        return current.filter((item) => item !== chipId);
      }

      if (current.length >= MAX_ACTIVE_CHIPS) {
        setChipMessage("Puedes elegir máximo 3 opciones.");
        return current;
      }

      setChipMessage("");
      return [...current, chipId];
    });
  }

  function toggleColor(colorId: ColorOptionId) {
    setError("");

    setEventColors((current) => {
      if (current.includes(colorId)) {
        setColorMessage("");
        return current.filter((item) => item !== colorId);
      }

      if (current.length >= MAX_EVENT_COLORS) {
        setColorMessage("Puedes elegir máximo 2 colores.");
        return current;
      }

      setColorMessage("");
      return [...current, colorId];
    });
  }

  function openPreview(index: number) {
    if (typeof window !== "undefined") {
      const scrollEl = document.scrollingElement || document.documentElement;
      scrollRestoreRef.current = scrollEl.scrollTop || window.scrollY || 0;
    }
    setPreviewIndex(index);
  }

  function buildFreePrompt() {
    return prompt.trim();
  }

  function buildEventPrompt() {
    const colorLabels = selectedColorDefs.map((item) => item.label);
    const allColorNotes = [...colorLabels];
    if (eventCustomColors.trim()) allColorNotes.push(eventCustomColors.trim());

    const pieces = [
      `Crear un diseño personalizado para ${mode === "sticker" ? "sticker" : "playera"}.`,
      eventType.trim() ? `Tipo de evento: ${eventType.trim()}.` : "",
      eventName.trim() ? `Nombre que debe respetarse: ${eventName.trim()}.` : "",
      eventNumber.trim()
        ? `Edad o número importante que debe aparecer o influir en el diseño: ${eventNumber.trim()}.`
        : "",
      eventTheme.trim()
        ? `Tema, personaje o idea principal: ${eventTheme.trim()}.`
        : "",
      allColorNotes.length
        ? `Colores que el cliente quiere ver: ${allColorNotes.join(", ")}.`
        : "",
      eventPhrase.trim()
        ? `Frase opcional que se puede integrar si encaja bien: ${eventPhrase.trim()}.`
        : "",
      eventDetails.trim()
        ? `Detalles extra del cliente: ${eventDetails.trim()}.`
        : "",
      `Priorizar con especial cuidado el nombre, el número, el tema y los colores seleccionados.`,
      mode === "sticker"
        ? "La propuesta debe sentirse pensada para sticker, con presencia visual clara y buena lectura."
        : "La propuesta debe sentirse pensada para playera, con buena presencia visual sobre la prenda.",
    ];

    return pieces.filter(Boolean).join(" ");
  }

  const generationPrompt =
    studioTab === "free" ? buildFreePrompt() : buildEventPrompt();

  const priorityItems = useMemo(() => {
    const items: { label: string; value: string }[] = [];

    if (eventName.trim()) items.push({ label: "Nombre", value: eventName.trim() });
    if (eventNumber.trim()) items.push({ label: "Edad/Número", value: eventNumber.trim() });
    if (eventType.trim()) items.push({ label: "Evento", value: eventType.trim() });
    if (eventTheme.trim()) items.push({ label: "Tema", value: eventTheme.trim() });

    const colorLabels = selectedColorDefs.map((item) => item.label);
    if (eventCustomColors.trim()) colorLabels.push(eventCustomColors.trim());
    if (colorLabels.length) items.push({ label: "Colores", value: colorLabels.join(", ") });

    if (eventPhrase.trim()) items.push({ label: "Frase", value: eventPhrase.trim() });

    return items;
  }, [
    eventName,
    eventNumber,
    eventType,
    eventTheme,
    selectedColorDefs,
    eventCustomColors,
    eventPhrase,
  ]);

  async function handleGenerate() {
    const cleanPrompt = generationPrompt.trim();

    if (studioTab === "free" && !cleanPrompt) {
      setError("Escribe una idea para tu diseño.");
      return;
    }

    if (studioTab === "event" && !isEventReady) {
      setError("Agrega al menos algunos datos importantes para tu diseño.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setImages([]);
      setLabels([]);
      setSelectedIndex(null);
      setPreviewIndex(null);

      const apiBase = isEmbedded
        ? "https://autoprint-ai-designer.vercel.app/api/generate"
        : "/api/generate";

      const res = await fetch(apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: cleanPrompt,
          mode,
          chips: activeChips,
          studioTab,
          eventData:
            studioTab === "event"
              ? {
                  name: eventName.trim(),
                  number: eventNumber.trim(),
                  eventType: eventType.trim(),
                  theme: eventTheme.trim(),
                  phrase: eventPhrase.trim(),
                  details: eventDetails.trim(),
                  colors: selectedColorDefs.map((item) => item.label),
                  customColors: eventCustomColors.trim(),
                }
              : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron generar las imágenes.");
      }

      const generatedImages = Array.isArray(data?.images) ? data.images : [];
      const generatedLabels = Array.isArray(data?.labels) ? data.labels : [];

      if (!generatedImages.length) {
        throw new Error("No se recibieron imágenes.");
      }

      setImages(generatedImages);
      setLabels(generatedLabels);

      setTimeout(() => {
        postEmbedHeight();
      }, 80);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueWithDesign() {
    if (selectedIndex === null) return;

    try {
      const image = images[selectedIndex];
      const label = selectedLabel || `Concepto ${selectedIndex + 1}`;

      const saveRes = await fetch("/api/save-selected-design", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
          label,
          prompt: generationPrompt.trim(),
          mode,
        }),
      });

      const saved = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saved?.error || "No se pudo guardar el diseño.");
      }

      const payload = {
        type: "AUTOPRINT_AI_DESIGN_SELECTED",
        imageUrl: saved.imageUrl,
        designRef: saved.designRef,
        label,
        prompt: generationPrompt.trim(),
        mode,
      };

      if (isEmbedded && window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar el diseño.");
    }
  }

  return (
    <>
      <main className={`page-shell ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="page-wrap">
          <section className="composer-card">
            <div className="studio-topbar">
              <div className="studio-brand-stack">
                <div className="studio-brandmark" aria-label="AutoPrint AI Studio">
                  <span className="studio-brandmark__core">AUTOPRINT</span>
                  <span className="studio-brandmark__accent">AI STUDIO</span>
                </div>
                <div className="studio-brand-curve" aria-hidden="true" />
              </div>
            </div>

            <div className="composer-head">
              <div>
                <h1 className="composer-title">
                  {studioTab === "free" ? copy.freeTitle : copy.eventTitle}
                </h1>
                <p className="composer-subhelp">
                  {studioTab === "free" ? copy.freeSubhelp : copy.eventSubhelp}
                </p>
              </div>
            </div>

            <div className="studio-tabs" role="tablist" aria-label="Tipo de creación">
              <button
                type="button"
                className={`studio-tab ${studioTab === "free" ? "is-active" : ""}`}
                onClick={() => setStudioTab("free")}
              >
                <span className="studio-tab__title">Idea libre</span>
                <span className="studio-tab__sub">
                  Para ideas rápidas como personajes, conceptos o estilos.
                </span>
              </button>

              <button
                type="button"
                className={`studio-tab ${studioTab === "event" ? "is-active" : ""}`}
                onClick={() => setStudioTab("event")}
              >
                <span className="studio-tab__title">Cumpleaños y eventos</span>
                <span className="studio-tab__sub">
                  Para diseños con nombre, edad, frase, tema o tipo de celebración.
                </span>
              </button>
            </div>

            <div className="brief-shell">
              {studioTab === "free" ? (
                <>
                  <div className="brief-head">
                    <div className="brief-label">{copy.promptLabel}</div>
                    <div className="brief-note">{copy.promptNote}</div>
                  </div>

                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder={copy.freePlaceholder}
                    rows={4}
                    className="prompt-textarea"
                  />
                </>
              ) : (
                <>
                  <div className="brief-head">
                    <div className="brief-label">{copy.eventSectionTitle}</div>
                    <div className="brief-note">{copy.eventSectionNote}</div>
                  </div>

                  <div className="event-grid">
                    <div className="field-block">
                      <label className="field-label" htmlFor="event-name">
                        Nombre
                      </label>
                      <input
                        id="event-name"
                        className="text-input"
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="Ejemplo: Ian"
                      />
                    </div>

                    <div className="field-block">
                      <label className="field-label" htmlFor="event-number">
                        Edad o número importante
                      </label>
                      <input
                        id="event-number"
                        className="text-input"
                        type="text"
                        value={eventNumber}
                        onChange={(e) => setEventNumber(e.target.value)}
                        placeholder="Ejemplo: 5"
                      />
                    </div>

                    <div className="field-block">
                      <label className="field-label" htmlFor="event-type">
                        Tipo de evento
                      </label>
                      <select
                        id="event-type"
                        className="select-input"
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                      >
                        <option value="">Selecciona una opción</option>
                        {EVENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-block">
                      <label className="field-label" htmlFor="event-theme">
                        Tema o personaje favorito
                      </label>
                      <input
                        id="event-theme"
                        className="text-input"
                        type="text"
                        value={eventTheme}
                        onChange={(e) => setEventTheme(e.target.value)}
                        placeholder="Ejemplo: Batman"
                      />
                    </div>
                  </div>

                  <div className="field-block field-block--full">
                    <label className="field-label">Colores que te gustaría ver</label>
                    <div className="field-helper">
                      Elige hasta 2. Esto ayuda mucho a dirigir mejor el resultado.
                    </div>

                    <div className="color-pills">
                      {COLOR_OPTIONS.map((color) => {
                        const isActive = eventColors.includes(color.id);

                        return (
                          <button
                            key={color.id}
                            type="button"
                            className={`color-pill ${isActive ? "is-active" : ""}`}
                            onClick={() => toggleColor(color.id)}
                          >
                            {color.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="chips-status-row chips-status-row--compact">
                      <div className="chips-status">
                        {eventColors.length}/{MAX_EVENT_COLORS} colores elegidos
                      </div>
                      {colorMessage ? (
                        <div className="chip-message">{colorMessage}</div>
                      ) : null}
                    </div>

                    <input
                      className="text-input text-input--top-space"
                      type="text"
                      value={eventCustomColors}
                      onChange={(e) => setEventCustomColors(e.target.value)}
                      placeholder="Otro color o combinación especial (opcional)"
                    />
                  </div>

                  <div className="event-grid event-grid--lower">
                    <div className="field-block">
                      <label className="field-label" htmlFor="event-phrase">
                        Frase opcional
                      </label>
                      <input
                        id="event-phrase"
                        className="text-input"
                        type="text"
                        value={eventPhrase}
                        onChange={(e) => setEventPhrase(e.target.value)}
                        placeholder="Ejemplo: Ian cumple 5"
                      />
                    </div>

                    <div className="field-block field-block--stretch">
                      <label className="field-label" htmlFor="event-details">
                        Detalles extra
                      </label>
                      <textarea
                        id="event-details"
                        className="small-textarea"
                        value={eventDetails}
                        onChange={(e) => setEventDetails(e.target.value)}
                        placeholder="Ejemplo: que se vea divertido, fuerte y con más presencia visual"
                        rows={4}
                      />
                    </div>
                  </div>

                  {priorityItems.length > 0 ? (
                    <div className="priority-panel">
                      <div className="priority-panel__head">
                        <div className="priority-panel__title">
                          {copy.priorityPanelTitle}
                        </div>
                        <div className="priority-panel__sub">
                          {copy.priorityPanelSub}
                        </div>
                      </div>

                      <div className="priority-panel__grid">
                        {priorityItems.map((item) => (
                          <div key={`${item.label}-${item.value}`} className="priority-item">
                            <span className="priority-item__label">{item.label}</span>
                            <span className="priority-item__value">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              <div className="chips-zone">
                <div className="chips-head">
                  <div className="chips-title">{copy.chipsTitle}</div>
                  <div className="chips-sub">{copy.chipsSub}</div>
                </div>

                <div className="chips-status-row">
                  <div className="chips-status">
                    {activeChips.length}/{MAX_ACTIVE_CHIPS} opciones elegidas
                  </div>
                  {chipMessage ? <div className="chip-message">{chipMessage}</div> : null}
                </div>

                <div className="chip-groups-grid">
                  {chipGroups.map((group) => (
                    <div key={group.id} className="chip-group-card">
                      <div className="chip-group-card__title">{group.title}</div>
                      <div className="chip-group-card__subtitle">{group.subtitle}</div>

                      <div className="chip-group-card__chips">
                        {group.chips.map((chip) => {
                          const isActive = activeChips.includes(chip.id);

                          return (
                            <button
                              key={chip.id}
                              type="button"
                              title={chip.helper}
                              className={`chip-btn ${isActive ? "is-active" : ""}`}
                              onClick={() => toggleChip(chip.id)}
                            >
                              <span className="chip-btn__text">{chip.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {activeChipDefs.length > 0 ? (
                  <div className="direction-panel">
                    <div className="direction-panel__head">
                      <div className="direction-panel__kicker">
                        {copy.directionPanelTitle}
                      </div>
                      <p className="direction-panel__sub">
                        {copy.directionPanelSub}
                      </p>
                    </div>

                    <div className="direction-panel__pills">
                      {activeChipDefs.map((chip) => (
                        <span key={chip.id} className="direction-pill">
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="composer-foot">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`ai-generate-btn ${loading ? "is-loading" : ""}`}
                >
                  <span className="ai-generate-btn__glow" />
                  <span className="ai-generate-btn__border" />
                  <span className="ai-generate-btn__bg" />
                  <span className="ai-generate-btn__shine" />

                  <span className="ai-generate-btn__content">
                    <span className="ai-stars" aria-hidden="true">
                      <span className="ai-star ai-star--big">✦</span>
                      <span className="ai-star ai-star--mid">✦</span>
                      <span className="ai-star ai-star--small">✦</span>
                    </span>

                    <span className="ai-generate-btn__copy">
                      <span className="ai-generate-btn__label">
                        {loading ? "Generando..." : copy.primaryCta}
                      </span>
                      <span className="ai-generate-btn__sub">
                        {loading ? "3 propuestas en proceso" : copy.primarySub}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-panel">
                <div className="loading-top">
                  <div className="loading-orbit">
                    <span className="loading-dot loading-dot--1" />
                    <span className="loading-dot loading-dot--2" />
                    <span className="loading-dot loading-dot--3" />
                  </div>

                  <div className="loading-copy">
                    <div className="loading-title">{copy.loadingTitle}</div>
                    <div className="loading-subtitle">{copy.loadingSub}</div>
                  </div>
                </div>

                <div className="loading-steps">
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Entendiendo tu idea
                  </div>
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Aplicando tu estilo elegido
                  </div>
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Preparando 3 propuestas para elegir
                  </div>
                </div>
              </div>
            ) : null}

            {error ? <div className="error-box">{error}</div> : null}
          </section>

          {images.length > 0 ? (
            <section className="results-block">
              <div className="results-head">
                <div>
                  <div className="results-kicker">{copy.resultsKicker}</div>
                  <h2 className="results-title">{copy.resultsTitle}</h2>
                  <p className="results-sub">{copy.resultsSub}</p>
                </div>
              </div>

              <div className="results-grid results-grid--3">
                {images.map((image, index) => {
                  const isSelected = selectedIndex === index;
                  const label = labels[index] || `Concepto ${index + 1}`;

                  return (
                    <div
                      key={index}
                      className={`design-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedIndex(index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedIndex(index);
                        }
                      }}
                    >
                      <div className="design-card__image-wrap">
                        <img
                          src={image}
                          alt={`Diseño generado ${index + 1}`}
                          className="design-card__image"
                        />

                        <div className="design-card__badge">{label}</div>

                        <button
                          type="button"
                          className="design-card__zoom"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(index);
                          }}
                          aria-label={`Ver diseño ${index + 1} en grande`}
                        >
                          🔍
                        </button>

                        {isSelected ? <div className="design-card__check">✓</div> : null}
                      </div>

                      <div className="design-card__body">
                        <div className="design-card__title">
                          {isSelected ? "Selección actual" : `Opción ${index + 1}`}
                        </div>
                        <div className="design-card__meta">
                          {isSelected
                            ? copy.selectionReady
                            : "Haz clic para elegir esta opción."}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="studio-actionbar">
                <div className="studio-actionbar__meta">
                  <span className="studio-actionbar__eyebrow">Selección final</span>
                  <strong className="studio-actionbar__title">
                    {selectedLabel || "Elige una opción"}
                  </strong>
                  <span className="studio-actionbar__sub">
                    {selectedImage
                      ? copy.selectionReady
                      : "Toca una opción para continuar."}
                  </span>
                </div>

                <div className="studio-actionbar__actions">
                  <button
                    type="button"
                    className="studio-secondary-btn"
                    disabled={selectedIndex === null}
                    onClick={() => {
                      if (selectedIndex !== null) openPreview(selectedIndex);
                    }}
                  >
                    Ver grande
                  </button>

                  <button
                    type="button"
                    className="studio-primary-btn"
                    disabled={selectedIndex === null}
                    onClick={handleContinueWithDesign}
                  >
                    {copy.finalCta}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      {previewIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div className="preview-modal" onClick={() => setPreviewIndex(null)}>
              <div
                className="preview-modal__dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="preview-modal__close"
                  onClick={() => setPreviewIndex(null)}
                >
                  ×
                </button>

                <button
                  type="button"
                  className="preview-modal__nav preview-modal__nav--left"
                  onClick={() =>
                    setPreviewIndex((previewIndex - 1 + images.length) % images.length)
                  }
                >
                  ‹
                </button>

                <div className="preview-modal__image-wrap">
                  <img
                    src={images[previewIndex]}
                    alt={`Vista previa ${previewIndex + 1}`}
                    className="preview-modal__image"
                  />
                </div>

                <button
                  type="button"
                  className="preview-modal__nav preview-modal__nav--right"
                  onClick={() => setPreviewIndex((previewIndex + 1) % images.length)}
                >
                  ›
                </button>

                <div className="preview-modal__foot">
                  <div className="preview-modal__meta">
                    {labels[previewIndex] || `Concepto ${previewIndex + 1}`}
                  </div>

                  <button
                    type="button"
                    className={`preview-modal__select ${
                      selectedIndex === previewIndex ? "is-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedIndex(previewIndex);
                      setPreviewIndex(null);
                    }}
                  >
                    {selectedIndex === previewIndex
                      ? "Diseño seleccionado"
                      : copy.previewSelect}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <style jsx>{`
        :global(html),
        :global(body) {
          margin: 0;
          background: #0b1020 !important;
          min-height: 100%;
          overflow-x: hidden;
        }

        .page-shell {
          min-height: 100vh;
          min-height: 100dvh;
          padding: 24px;
          background:
            radial-gradient(circle at 12% 0%, rgba(124, 58, 237, 0.16), transparent 22%),
            radial-gradient(circle at 100% 10%, rgba(6, 182, 212, 0.12), transparent 22%),
            linear-gradient(180deg, #0c1120 0%, #0d1424 46%, #0b1020 100%);
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .page-shell.is-embedded {
          min-height: 100vh;
          min-height: 100dvh;
          padding: 18px;
          background:
            radial-gradient(circle at 12% 0%, rgba(124, 58, 237, 0.14), transparent 24%),
            radial-gradient(circle at 100% 10%, rgba(6, 182, 212, 0.1), transparent 24%),
            linear-gradient(180deg, #0d1323 0%, #0e1527 55%, #0b1020 100%);
        }

        .page-wrap {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
          padding-bottom: 2px;
        }

        .is-embedded .page-wrap {
          max-width: none;
          gap: 16px;
        }

        .composer-card,
        .results-block {
          position: relative;
          background:
            linear-gradient(180deg, rgba(19, 25, 42, 0.92), rgba(14, 19, 33, 0.94));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 22px;
          box-shadow:
            0 14px 32px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          overflow: hidden;
        }

        .composer-card::before,
        .results-block::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.06), transparent 26%),
            radial-gradient(circle at top right, rgba(6, 182, 212, 0.05), transparent 24%);
        }

        .is-embedded .composer-card,
        .is-embedded .results-block {
          border-radius: 24px;
          padding: 18px;
        }

        .studio-topbar {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          margin-bottom: 18px;
          text-align: center;
        }

        .studio-brand-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .studio-brandmark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 1000;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .studio-brandmark__core {
          color: #ffffff;
        }

        .studio-brandmark__accent {
          background: linear-gradient(90deg, #8b5cf6 0%, #22d3ee 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 18px rgba(124, 58, 237, 0.14);
        }

        .studio-brand-curve {
          width: 220px;
          height: 16px;
          border-bottom: 1.5px solid rgba(139, 92, 246, 0.45);
          border-radius: 0 0 999px 999px;
          position: relative;
        }

        .studio-brand-curve::after {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -1.5px;
          width: 70px;
          height: 2px;
          background: linear-gradient(
            90deg,
            rgba(139,92,246,0),
            rgba(34,211,238,0.9),
            rgba(139,92,246,0)
          );
          border-radius: 999px;
        }

        .composer-head {
          position: relative;
          z-index: 1;
          margin-bottom: 16px;
          text-align: center;
        }

        .composer-title {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.04em;
          font-weight: 1000;
          color: #f8fafc;
          max-width: 760px;
          margin-left: auto;
          margin-right: auto;
        }

        .composer-subhelp {
          margin: 0 auto;
          font-size: 14px;
          line-height: 1.58;
          color: #b2bfd4;
          font-weight: 700;
          max-width: 760px;
        }

        .studio-tabs {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .studio-tab {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #f8fafc;
          border-radius: 18px;
          padding: 14px 14px 13px;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 6px;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .studio-tab:hover {
          transform: translateY(-1px);
          border-color: rgba(139, 92, 246, 0.18);
        }

        .studio-tab.is-active {
          border-color: rgba(34, 211, 238, 0.28);
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.1), transparent 36%),
            linear-gradient(180deg, rgba(23, 30, 50, 0.95), rgba(18, 24, 40, 0.98));
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
        }

        .studio-tab__title {
          font-size: 15px;
          font-weight: 950;
          color: #f8fafc;
        }

        .studio-tab__sub {
          font-size: 12px;
          line-height: 1.45;
          color: #aab8cc;
          font-weight: 700;
        }

        .brief-shell {
          position: relative;
          z-index: 1;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(23, 30, 50, 0.9), rgba(18, 24, 40, 0.92));
          padding: 18px;
        }

        .brief-head {
          display: grid;
          gap: 6px;
          margin-bottom: 14px;
        }

        .brief-label {
          font-size: 19px;
          font-weight: 950;
          color: #f8fafc;
          letter-spacing: -0.02em;
        }

        .brief-note {
          font-size: 13px;
          font-weight: 700;
          color: #a9b8cc;
          line-height: 1.5;
        }

        .prompt-textarea,
        .small-textarea,
        .text-input,
        .select-input {
          width: 100%;
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 14px 16px;
          font-size: 15px;
          line-height: 1.55;
          color: #f8fafc;
          background:
            linear-gradient(180deg, rgba(18, 24, 40, 0.94), rgba(21, 28, 47, 0.96));
          outline: none;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
          box-sizing: border-box;
        }

        .prompt-textarea {
          resize: vertical;
          min-height: 132px;
        }

        .small-textarea {
          resize: vertical;
          min-height: 112px;
        }

        .prompt-textarea::placeholder,
        .small-textarea::placeholder,
        .text-input::placeholder {
          color: #8f9fb8;
        }

        .prompt-textarea:focus,
        .small-textarea:focus,
        .text-input:focus,
        .select-input:focus {
          border-color: rgba(139, 92, 246, 0.36);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .event-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .event-grid--lower {
          margin-top: 14px;
          align-items: start;
        }

        .field-block {
          min-width: 0;
        }

        .field-block--full {
          margin-top: 14px;
        }

        .field-block--stretch {
          min-height: 100%;
        }

        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 900;
          color: #f8fafc;
          margin-bottom: 8px;
        }

        .field-helper {
          font-size: 12px;
          line-height: 1.45;
          color: #9fb1c8;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .text-input--top-space {
          margin-top: 10px;
        }

        .color-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .color-pill {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04));
          color: #f8fafc;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
          white-space: nowrap;
        }

        .color-pill:hover {
          transform: translateY(-1px);
          border-color: rgba(139, 92, 246, 0.2);
        }

        .color-pill.is-active {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(135deg, #7c3aed 0%, #8b5cf6 44%, #06b6d4 100%);
          box-shadow: 0 10px 18px rgba(88, 28, 135, 0.2);
        }

        .priority-panel {
          margin-top: 16px;
          border: 1px solid rgba(34, 211, 238, 0.16);
          background:
            radial-gradient(circle at top left, rgba(6, 182, 212, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(19, 28, 46, 0.94), rgba(16, 23, 38, 0.96));
          border-radius: 18px;
          padding: 14px;
        }

        .priority-panel__head {
          margin-bottom: 10px;
        }

        .priority-panel__title {
          font-size: 14px;
          font-weight: 950;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .priority-panel__sub {
          font-size: 12px;
          line-height: 1.45;
          color: #9fb1c8;
          font-weight: 700;
        }

        .priority-panel__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .priority-item {
          min-width: 0;
          border-radius: 14px;
          padding: 11px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: grid;
          gap: 3px;
        }

        .priority-item__label {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8fdcf0;
        }

        .priority-item__value {
          font-size: 13px;
          line-height: 1.45;
          color: #f8fafc;
          font-weight: 800;
          word-break: break-word;
        }

        .chips-zone {
          margin-top: 18px;
        }

        .chips-head {
          margin-bottom: 10px;
        }

        .chips-title {
          font-size: 18px;
          font-weight: 950;
          color: #f8fafc;
          margin-bottom: 4px;
          letter-spacing: -0.02em;
        }

        .chips-sub {
          font-size: 13px;
          line-height: 1.45;
          color: #a8b6ca;
          font-weight: 700;
          max-width: 760px;
        }

        .chips-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .chips-status-row--compact {
          margin-top: 10px;
          margin-bottom: 0;
        }

        .chips-status {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #dbe4f1;
        }

        .chip-message {
          font-size: 12px;
          font-weight: 800;
          color: #fbbf24;
        }

        .chip-groups-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          min-width: 0;
        }

        .chip-group-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          min-width: 0;
          width: 100%;
        }

        .chip-group-card__title {
          font-size: 14px;
          font-weight: 950;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .chip-group-card__subtitle {
          font-size: 12px;
          line-height: 1.45;
          color: #9eb0c8;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .chip-group-card__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-width: 0;
        }

        .chip-btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04));
          color: #f8fafc;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
          white-space: nowrap;
        }

        .chip-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(139, 92, 246, 0.2);
        }

        .chip-btn.is-active {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(135deg, #7c3aed 0%, #8b5cf6 44%, #06b6d4 100%);
          box-shadow: 0 10px 18px rgba(88, 28, 135, 0.22);
        }

        .chip-btn__text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .direction-panel {
          margin-top: 16px;
          border: 1px solid rgba(139, 92, 246, 0.14);
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 32%),
            linear-gradient(180deg, rgba(23, 30, 50, 0.92), rgba(18, 24, 40, 0.94));
          border-radius: 18px;
          padding: 14px;
        }

        .direction-panel__head {
          margin-bottom: 10px;
        }

        .direction-panel__kicker {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #8b5cf6;
          margin-bottom: 4px;
        }

        .direction-panel__sub {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: #b0bed2;
          font-weight: 700;
        }

        .direction-panel__pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .direction-pill {
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .composer-foot {
          margin-top: 18px;
          display: flex;
          justify-content: center;
        }

        .ai-generate-btn {
          position: relative;
          isolation: isolate;
          border: 0;
          background: transparent;
          padding: 0;
          min-width: 320px;
          height: 62px;
          border-radius: 20px;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            opacity 0.18s ease,
            filter 0.18s ease;
          overflow: visible;
        }

        .ai-generate-btn:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .ai-generate-btn:not(:disabled):hover {
          transform: translateY(-2px) scale(1.01);
          filter: saturate(1.04);
        }

        .ai-generate-btn__glow {
          position: absolute;
          inset: -6px;
          border-radius: 22px;
          background:
            radial-gradient(circle at 25% 50%, rgba(236, 72, 153, 0.14), transparent 34%),
            radial-gradient(circle at 80% 40%, rgba(6, 182, 212, 0.14), transparent 36%);
          filter: blur(12px);
          z-index: 0;
        }

        .ai-generate-btn__border {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          background: linear-gradient(
            90deg,
            #ec4899 0%,
            #8b5cf6 25%,
            #3b82f6 50%,
            #06b6d4 75%,
            #ec4899 100%
          );
          background-size: 220% 100%;
          animation: borderFlow 4s linear infinite;
          z-index: 1;
        }

        .ai-generate-btn__bg {
          position: absolute;
          inset: 2px;
          border-radius: 18px;
          background:
            radial-gradient(ellipse at center top, rgba(255, 255, 255, 0.14) 0%, transparent 45%),
            linear-gradient(160deg, #1e1b4b 0%, #09090b 100%);
          z-index: 2;
        }

        .ai-generate-btn__shine {
          position: absolute;
          inset: 2px;
          border-radius: 18px;
          overflow: hidden;
          z-index: 3;
        }

        .ai-generate-btn__shine::before {
          content: "";
          position: absolute;
          top: -20%;
          left: -32%;
          width: 34%;
          height: 140%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.16),
            transparent
          );
          transform: rotate(14deg);
          animation: shineSweep 3.2s ease-in-out infinite;
        }

        .ai-generate-btn__content {
          position: relative;
          z-index: 4;
          height: 100%;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #ffffff;
          padding: 0 18px;
        }

        .ai-generate-btn__copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .ai-generate-btn__label {
          font-size: 16px;
          font-weight: 1000;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .ai-generate-btn__sub {
          margin-top: 5px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,.72);
        }

        .ai-stars {
          position: relative;
          width: 30px;
          height: 22px;
          display: inline-block;
          flex-shrink: 0;
        }

        .ai-star {
          position: absolute;
          line-height: 1;
          animation: sparkleFloat 2s ease-in-out infinite;
        }

        .ai-star--big {
          font-size: 15px;
          left: 0;
          top: 3px;
          color: #ffffff;
        }

        .ai-star--mid {
          font-size: 10px;
          left: 12px;
          top: 0;
          color: #c4b5fd;
        }

        .ai-star--small {
          font-size: 9px;
          left: 20px;
          top: 11px;
          color: #99f6e4;
        }

        .loading-panel {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          border: 1px solid rgba(139, 92, 246, 0.14);
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 34%),
            radial-gradient(circle at bottom right, rgba(6, 182, 212, 0.06), transparent 30%),
            linear-gradient(180deg, rgba(23, 29, 48, 0.98), rgba(18, 24, 40, 0.98));
          border-radius: 18px;
          padding: 16px;
        }

        .loading-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .loading-orbit {
          position: relative;
          width: 48px;
          height: 48px;
          min-width: 48px;
          border-radius: 999px;
          border: 1px solid rgba(139, 92, 246, 0.14);
          background: radial-gradient(circle at center, rgba(99, 102, 241, 0.08), rgba(18, 24, 40, 0.92));
        }

        .loading-dot {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          animation: orbitPulse 1.5s ease-in-out infinite;
        }

        .loading-dot--1 {
          top: 6px;
          left: 19px;
          background: #38bdf8;
        }

        .loading-dot--2 {
          right: 7px;
          bottom: 10px;
          background: #8b5cf6;
        }

        .loading-dot--3 {
          left: 8px;
          bottom: 10px;
          background: #00b8a9;
        }

        .loading-copy {
          display: grid;
          gap: 4px;
        }

        .loading-title {
          font-size: 15px;
          font-weight: 950;
          color: #f8fafc;
          line-height: 1.15;
        }

        .loading-subtitle {
          font-size: 13px;
          font-weight: 750;
          color: #aebed3;
          line-height: 1.45;
        }

        .loading-steps {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }

        .loading-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 850;
          color: #d8e1ee;
        }

        .loading-step__bullet {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #38bdf8, #8b5cf6);
          flex-shrink: 0;
        }

        .error-box {
          position: relative;
          z-index: 1;
          margin-top: 14px;
          border: 1px solid rgba(239, 68, 68, 0.16);
          background: rgba(127, 29, 29, 0.22);
          color: #fecaca;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.45;
        }

        .results-head {
          position: relative;
          z-index: 1;
          margin-bottom: 14px;
        }

        .results-kicker {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #8b5cf6;
          margin-bottom: 8px;
        }

        .results-title {
          margin: 0 0 8px;
          font-size: 28px;
          line-height: 1;
          font-weight: 1000;
          color: #f8fafc;
          letter-spacing: -0.04em;
        }

        .results-sub {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #aab8cc;
          font-weight: 700;
          max-width: 760px;
        }

        .results-grid {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 14px;
        }

        .results-grid--3 {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .design-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(23, 29, 48, 0.96), rgba(18, 24, 40, 0.98));
          border-radius: 22px;
          overflow: hidden;
          padding: 8px;
          cursor: pointer;
          text-align: left;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.14);
        }

        .design-card:hover {
          transform: translateY(-2px);
          border-color: rgba(139, 92, 246, 0.2);
          box-shadow: 0 16px 26px rgba(0, 0, 0, 0.18);
        }

        .design-card.is-selected {
          border-color: rgba(34, 211, 238, 0.34);
          box-shadow:
            0 0 0 4px rgba(34, 211, 238, 0.08),
            0 16px 26px rgba(0, 0, 0, 0.2);
        }

        .design-card__image-wrap {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 16px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 24%),
            linear-gradient(180deg, #1b2439, #151c2e);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .design-card__image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          padding: 12px;
        }

        .design-card__badge {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 52px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
          color: #eef2ff;
          background: rgba(15, 23, 42, 0.66);
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .design-card__zoom {
          position: absolute;
          right: 10px;
          bottom: 10px;
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
        }

        .design-card__check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #22d3ee, #0891b2);
          color: #fff;
          font-size: 13px;
          font-weight: 1000;
          box-shadow: 0 8px 16px rgba(8, 145, 178, 0.18);
        }

        .design-card__body {
          padding: 12px 6px 4px;
        }

        .design-card__title {
          font-size: 14px;
          font-weight: 950;
          color: #f8fafc;
          line-height: 1.15;
        }

        .design-card__meta {
          margin-top: 5px;
          font-size: 12px;
          line-height: 1.45;
          color: #acbbcf;
          font-weight: 700;
        }

        .studio-actionbar {
          position: sticky;
          bottom: 0;
          z-index: 2;
          margin-top: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(20, 26, 44, 0.92), rgba(14, 19, 32, 0.94));
          border-radius: 22px;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          box-shadow: 0 14px 24px rgba(0, 0, 0, 0.16);
        }

        .studio-actionbar__meta {
          display: grid;
          gap: 3px;
        }

        .studio-actionbar__eyebrow {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8b5cf6;
        }

        .studio-actionbar__title {
          font-size: 16px;
          line-height: 1.15;
          color: #f8fafc;
        }

        .studio-actionbar__sub {
          font-size: 13px;
          line-height: 1.45;
          color: #aebed3;
          font-weight: 700;
        }

        .studio-actionbar__actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .studio-secondary-btn,
        .studio-primary-btn {
          appearance: none;
          border: none;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            opacity 0.18s ease,
            filter 0.18s ease;
          font: inherit;
        }

        .studio-secondary-btn:disabled,
        .studio-primary-btn:disabled {
          opacity: 0.54;
          cursor: not-allowed;
        }

        .studio-secondary-btn:not(:disabled):hover,
        .studio-primary-btn:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .studio-secondary-btn {
          min-height: 46px;
          padding: 0 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.07);
          color: #f8fafc;
          font-size: 14px;
          font-weight: 900;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .studio-primary-btn {
          min-height: 48px;
          padding: 0 18px;
          border-radius: 14px;
          background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 44%, #06b6d4 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          box-shadow: 0 10px 18px rgba(88, 28, 135, 0.18);
        }

        .preview-modal {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(2, 6, 23, 0.72);
          display: grid;
          place-items: center;
          padding: 14px;
          min-height: 100dvh;
        }

        .preview-modal__dialog {
          width: min(920px, calc(100vw - 28px));
          max-width: 920px;
          height: min(84dvh, 760px);
          margin: 0 auto;
          background:
            linear-gradient(180deg, rgba(20, 26, 44, 0.98), rgba(14, 19, 32, 0.98));
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 20px 46px rgba(0, 0, 0, 0.28);
          display: grid;
          grid-template-rows: 1fr auto;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .preview-modal__close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-size: 24px;
          font-weight: 700;
          cursor: pointer;
          z-index: 3;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .preview-modal__nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 50px;
          height: 50px;
          border: none;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.82);
          color: #f8fafc;
          font-size: 32px;
          font-weight: 500;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .preview-modal__nav--left {
          left: 16px;
        }

        .preview-modal__nav--right {
          right: 16px;
        }

        .preview-modal__image-wrap {
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 24%),
            radial-gradient(circle at top right, rgba(6, 182, 212, 0.06), transparent 22%),
            linear-gradient(180deg, #1a2238, #151c2e);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px 24px 14px;
          min-height: 0;
        }

        .preview-modal__image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }

        .preview-modal__foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .preview-modal__meta {
          font-size: 14px;
          font-weight: 900;
          color: #f8fafc;
        }

        .preview-modal__select {
          appearance: none;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 44%, #06b6d4 100%);
          color: #ffffff;
          min-height: 46px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 10px 18px rgba(88, 28, 135, 0.18);
        }

        .preview-modal__select.is-selected {
          background: linear-gradient(180deg, #22d3ee, #0891b2);
        }

        @keyframes sparkleFloat {
          0%, 100% {
            transform: scale(1) translateY(0);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.16) translateY(-1px);
            opacity: 1;
          }
        }

        @keyframes borderFlow {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 220% 50%;
          }
        }

        @keyframes shineSweep {
          0% {
            left: -32%;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          45% {
            left: 115%;
            opacity: 0.9;
          }
          100% {
            left: 115%;
            opacity: 0;
          }
        }

        @keyframes orbitPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.22);
            opacity: 1;
          }
        }

        @media (max-width: 900px) {
          .composer-title {
            font-size: 28px;
          }

          .results-title {
            font-size: 24px;
          }

          .chip-groups-grid,
          .priority-panel__grid,
          .event-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page-shell {
            padding: 14px;
          }

          .page-shell.is-embedded {
            padding: 12px;
            background: linear-gradient(180deg, #0d1323 0%, #0c1120 100%);
          }

          .composer-card,
          .results-block {
            border-radius: 22px;
            padding: 14px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
          }

          .composer-card::before,
          .results-block::before {
            background: none;
          }

          .studio-brandmark {
            font-size: 14px;
          }

          .studio-brand-curve {
            width: 180px;
          }

          .composer-title {
            font-size: 24px;
          }

          .composer-subhelp {
            font-size: 13px;
          }

          .studio-tabs {
            grid-template-columns: 1fr;
          }

          .brief-shell {
            border-radius: 18px;
            padding: 14px;
          }

          .brief-label {
            font-size: 17px;
          }

          .prompt-textarea {
            min-height: 118px;
            border-radius: 16px;
          }

          .small-textarea,
          .text-input,
          .select-input {
            border-radius: 16px;
          }

          .color-pills {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            padding-bottom: 4px;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .color-pills::-webkit-scrollbar {
            display: none;
          }

          .color-pill {
            flex: 0 0 auto;
          }

          .chip-groups-grid {
            grid-template-columns: 1fr;
          }

          .chip-group-card__chips {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x;
            padding-bottom: 4px;
            scrollbar-width: none;
            -ms-overflow-style: none;
            gap: 10px;
          }

          .chip-group-card__chips::-webkit-scrollbar {
            display: none;
          }

          .chip-btn {
            flex: 0 0 auto;
            min-height: 38px;
            padding: 0 13px;
            font-size: 12px;
            box-shadow: none;
          }

          .chip-btn.is-active {
            box-shadow: 0 8px 14px rgba(88, 28, 135, 0.16);
          }

          .composer-foot {
            align-items: stretch;
          }

          .ai-generate-btn {
            width: 100%;
            min-width: 0;
            height: 56px;
          }

          .ai-generate-btn__glow {
            display: none;
          }

          .ai-generate-btn__border {
            animation: none;
          }

          .ai-generate-btn__shine::before {
            animation: none;
            opacity: 0;
          }

          .ai-generate-btn__label {
            font-size: 15px;
          }

          .ai-generate-btn__sub {
            font-size: 9px;
          }

          .results-grid--3 {
            grid-template-columns: 1fr;
          }

          .studio-actionbar {
            position: static;
            border-radius: 18px;
            box-shadow: none;
          }

          .studio-actionbar__actions {
            width: 100%;
          }

          .studio-secondary-btn,
          .studio-primary-btn {
            flex: 1 1 auto;
            min-width: 0;
          }

          .preview-modal {
            padding: 10px;
          }

          .preview-modal__dialog {
            width: calc(100vw - 20px);
            max-width: calc(100vw - 20px);
            height: min(72dvh, 600px);
            border-radius: 20px;
          }

          .preview-modal__image-wrap {
            padding: 18px 12px 10px;
          }

          .preview-modal__nav {
            width: 42px;
            height: 42px;
            font-size: 26px;
          }

          .preview-modal__nav--left {
            left: 8px;
          }

          .preview-modal__nav--right {
            right: 8px;
          }

          .preview-modal__close {
            width: 38px;
            height: 38px;
            top: 8px;
            right: 8px;
          }

          .preview-modal__foot {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
          }

          .preview-modal__select {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Cargando...</div>}>
      <HomePageInner />
    </Suspense>
  );
}