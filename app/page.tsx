"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";

type DesignMode = "sticker" | "playera";

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

const STICKER_CHIPS: ChipDef[] = [
  { id: "circular", label: "Circular", helper: "Fuerza una composición redonda tipo badge." },
  { id: "iconico", label: "Icónico", helper: "Busca una silueta más memorable y reconocible." },
  { id: "compacto", label: "Compacto", helper: "Aprieta la composición para que se sienta más sticker." },
  { id: "vintage", label: "Vintage", helper: "Le da una dirección retro más trabajada." },
  { id: "street", label: "Street", helper: "Empuja una energía más urbana y gráfica." },
  { id: "premium", label: "Premium", helper: "Sube el acabado visual y la sensación premium." },
  { id: "colores_vivos", label: "Colores vivos", helper: "Empuja una paleta más saturada y comercial." },
  { id: "alto_contraste", label: "Alto contraste", helper: "Mejora legibilidad y punch visual." },
  { id: "minimal", label: "Minimal", helper: "Reduce ruido y elementos innecesarios." },
  { id: "divertido", label: "Divertido", helper: "Hace la propuesta más juguetona o carismática." },
  { id: "feroz", label: "Feroz", helper: "Le mete más agresividad y fuerza." },
  { id: "elegante", label: "Elegante", helper: "Refina formas, postura y lenguaje visual." },
];

const PLAYERA_CHIPS: ChipDef[] = [
  { id: "composicion_frontal", label: "Composición frontal", helper: "Piensa el arte como gráfico frontal usable en playera." },
  { id: "impacto_visual", label: "Impacto visual", helper: "Empuja una propuesta más fuerte y llamativa." },
  { id: "estilo_pecho", label: "Estilo pecho", helper: "Composición más compacta para colocación tipo pecho." },
  { id: "streetwear", label: "Streetwear", helper: "Dirección más moda urbana / graphic tee." },
  { id: "vintage", label: "Vintage", helper: "Retro trabajado con lógica de prenda." },
  { id: "premium", label: "Premium", helper: "Empuja una lectura más refinada y vendible." },
  { id: "alto_contraste", label: "Alto contraste", helper: "Aumenta punch y lectura sobre prenda." },
  { id: "tonos_oscuros", label: "Tonos oscuros", helper: "Paleta más profunda y con más peso visual." },
  { id: "minimal", label: "Minimal", helper: "Reduce ruido y carga visual." },
  { id: "divertido", label: "Divertido", helper: "Hace la dirección más amigable o juguetona." },
  { id: "feroz", label: "Feroz", helper: "Le mete más intensidad y presencia al arte." },
  { id: "elegante", label: "Elegante", helper: "Más refinado y sofisticado." },
];

const MODE_CONTENT = {
  sticker: {
    modePill: "Sticker Studio",
    modeProof: "Compacto · Comercial · Listo para impresión",
    title: "Dirige tu sticker como si estuvieras en un estudio",
    subhelp:
      "Escribe tu idea base y luego afina la dirección visual. El estudio te devolverá 3 propuestas compactas, pensadas para funcionar mejor como sticker.",
    placeholder:
      "Ejemplo: tigre feroz con corona y nombre Leo, look premium, fuerte y muy icónico",
    chipTitle: "Dirección creativa sugerida",
    chipHelp:
      "Tócalos para orientar composición, energía, paleta y estilo. Sí influyen en la generación.",
    note:
      "Generaremos 3 rutas pensadas para verse fuertes, compactas y más vendibles como sticker.",
    generateLabel: "Explorar propuestas",
    generateSub: "3 rutas listas para sticker",
    loadingTitle: "Generando 3 rutas para sticker",
    loadingSub:
      "Interpretando tu idea como una propuesta más compacta, comercial y lista para impresión.",
    resultsKicker: "Propuestas del estudio",
    resultsTitle: "Explora tus 3 rutas para sticker",
    resultsSub:
      "Cada propuesta fue pensada para leerse mejor como arte comercial, no solo como imagen bonita.",
    directionPanelTitle: "Dirección aplicada",
    directionPanelSub:
      "El estudio tomará tu idea base y la refinará internamente con esta dirección.",
    selectionReady: "Lista para aplicarse a tu sticker.",
    primaryCta: "Usar este diseño en mi sticker",
    previewSelect: "Seleccionar este diseño para sticker",
  },
  playera: {
    modePill: "Playera Studio",
    modeProof: "Prenda · Jerarquía · Más presencia visual",
    title: "Construye una gráfica con más presencia para playera",
    subhelp:
      "Escribe tu idea base y afina la dirección visual. El estudio te devolverá 3 propuestas pensadas para verse potentes sobre prenda.",
    placeholder:
      "Ejemplo: samurái vintage para playera, composición frontal fuerte, look premium y mucha presencia",
    chipTitle: "Dirección creativa sugerida",
    chipHelp:
      "Úsalos para orientar composición, energía, paleta y estilo en prenda. Sí afectan cómo se arma la propuesta.",
    note:
      "Generaremos 3 rutas con más jerarquía, más presencia y mejor lectura sobre tela.",
    generateLabel: "Explorar propuestas",
    generateSub: "3 rutas listas para playera",
    loadingTitle: "Generando 3 rutas para playera",
    loadingSub:
      "Traduciendo tu idea a una gráfica con más impacto, jerarquía y mejor lectura sobre prenda.",
    resultsKicker: "Propuestas del estudio",
    resultsTitle: "Explora tus 3 rutas para playera",
    resultsSub:
      "Cada propuesta fue pensada como una graphic tee más usable y vendible, no solo como imagen generada.",
    directionPanelTitle: "Dirección aplicada",
    directionPanelSub:
      "El estudio tomará tu idea base y la refinará internamente con esta dirección.",
    selectionReady: "Lista para aplicarse a tu playera.",
    primaryCta: "Usar este diseño en mi playera",
    previewSelect: "Seleccionar este diseño para playera",
  },
} as const;

function HomePageInner() {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<DesignMode>("sticker");
  const [prompt, setPrompt] = useState("");
  const [activeChips, setActiveChips] = useState<ChipId[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEmbedded = searchParams.get("embed") === "1";
  const modeContent = MODE_CONTENT[mode];
  const availableChips = mode === "sticker" ? STICKER_CHIPS : PLAYERA_CHIPS;

  const activeChipDefs = useMemo(
    () => availableChips.filter((chip) => activeChips.includes(chip.id)),
    [availableChips, activeChips]
  );

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;
  const selectedLabel = selectedIndex !== null ? labels[selectedIndex] : null;
  const canGenerate = prompt.trim().length > 0 && !loading;

  function postEmbedHeight() {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;

    const wrap = document.querySelector(".page-wrap");
    if (!wrap) return;

    const height = wrap.scrollHeight + 24;

    const win = window as typeof window & { __lastSentHeight?: number };

    if (
      typeof win.__lastSentHeight === "number" &&
      Math.abs(win.__lastSentHeight - height) < 5
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
    setError("");
  }, [mode]);

  useEffect(() => {
    if (!isEmbedded) return;

    const run = () => {
      window.requestAnimationFrame(() => {
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
  ]);

  useEffect(() => {
    if (previewIndex === null || typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [previewIndex]);

  function toggleChip(chipId: ChipId) {
    setError("");
    setActiveChips((current) =>
      current.includes(chipId)
        ? current.filter((item) => item !== chipId)
        : [...current, chipId]
    );
  }

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      setError("Escribe una idea para tu diseño.");
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
      }, 60);
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
          prompt: prompt.trim(),
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
        prompt: prompt.trim(),
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
              <div className="studio-brand-wrap">
                <div className="studio-brandmark" aria-label="AutoPrint AI Studio">
                  <span className="studio-brandmark__core">AUTOPRINT</span>
                  <span className="studio-brandmark__accent">AI STUDIO</span>
                </div>

                <div className="studio-mode-pill">{modeContent.modePill}</div>
              </div>

              <div className="studio-proof">{modeContent.modeProof}</div>
            </div>

            <div className="composer-head">
              <div>
                <h1 className="composer-title">{modeContent.title}</h1>
                <p className="composer-subhelp">{modeContent.subhelp}</p>
              </div>
            </div>

            <div className="brief-shell">
              <div className="brief-head">
                <div className="brief-label">Brief creativo</div>
                <div className="brief-note">
                  Idea base + dirección visual = mejor resultado
                </div>
              </div>

              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError("");
                }}
                placeholder={modeContent.placeholder}
                rows={4}
                className="prompt-textarea"
              />

              <div className="chips-zone">
                <div className="chips-head">
                  <div>
                    <div className="chips-title">{modeContent.chipTitle}</div>
                    <div className="chips-sub">{modeContent.chipHelp}</div>
                  </div>
                </div>

                <div className="chips-scroll-hint">Desliza para ver más estilos</div>

                <div className="chips-grid">
                  {availableChips.map((chip) => {
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

                {activeChipDefs.length > 0 ? (
                  <div className="direction-panel">
                    <div className="direction-panel__head">
                      <div className="direction-panel__kicker">
                        {modeContent.directionPanelTitle}
                      </div>
                      <p className="direction-panel__sub">
                        {modeContent.directionPanelSub}
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
                <p className="prompt-note">{modeContent.note}</p>

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
                        {loading ? "Generando..." : modeContent.generateLabel}
                      </span>
                      <span className="ai-generate-btn__sub">
                        {loading ? "3 propuestas en proceso" : modeContent.generateSub}
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
                    <div className="loading-title">{modeContent.loadingTitle}</div>
                    <div className="loading-subtitle">{modeContent.loadingSub}</div>
                  </div>
                </div>

                <div className="loading-steps">
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Interpretando tu idea base
                  </div>
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Aplicando dirección creativa
                  </div>
                  <div className="loading-step">
                    <span className="loading-step__bullet" />
                    Construyendo 3 rutas visuales
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
                  <div className="results-kicker">{modeContent.resultsKicker}</div>
                  <h2 className="results-title">{modeContent.resultsTitle}</h2>
                  <p className="results-sub">{modeContent.resultsSub}</p>
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
                            setPreviewIndex(index);
                          }}
                          aria-label={`Ver diseño ${index + 1} en grande`}
                        >
                          🔍
                        </button>

                        {isSelected ? <div className="design-card__check">✓</div> : null}
                      </div>

                      <div className="design-card__body">
                        <div className="design-card__title">
                          {isSelected
                            ? "Selección actual"
                            : `Ruta ${index + 1} del estudio`}
                        </div>
                        <div className="design-card__meta">
                          {isSelected
                            ? modeContent.selectionReady
                            : "Haz clic para elegir esta propuesta."}
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
                    {selectedLabel || "Elige una propuesta"}
                  </strong>
                  <span className="studio-actionbar__sub">
                    {selectedImage
                      ? modeContent.selectionReady
                      : "Toca una propuesta para continuar."}
                  </span>
                </div>

                <div className="studio-actionbar__actions">
                  <button
                    type="button"
                    className="studio-secondary-btn"
                    disabled={selectedIndex === null}
                    onClick={() => {
                      if (selectedIndex !== null) setPreviewIndex(selectedIndex);
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
                    {modeContent.primaryCta}
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
                      : modeContent.previewSelect}
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
            radial-gradient(circle at 12% 0%, rgba(124, 58, 237, 0.18), transparent 22%),
            radial-gradient(circle at 100% 10%, rgba(6, 182, 212, 0.14), transparent 22%),
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
            radial-gradient(circle at 12% 0%, rgba(124, 58, 237, 0.16), transparent 24%),
            radial-gradient(circle at 100% 10%, rgba(6, 182, 212, 0.12), transparent 24%),
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
            linear-gradient(180deg, rgba(18, 24, 40, 0.92), rgba(12, 17, 30, 0.94));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 22px;
          box-shadow:
            0 18px 44px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
          overflow: hidden;
        }

        .composer-card::before,
        .results-block::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 26%),
            radial-gradient(circle at top right, rgba(6, 182, 212, 0.06), transparent 24%);
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
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .studio-brand-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .studio-brandmark {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.1em;
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
          text-shadow: 0 0 22px rgba(124, 58, 237, 0.16);
        }

        .studio-mode-pill,
        .studio-proof {
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .studio-mode-pill {
          color: #e5e7eb;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(139, 92, 246, 0.22);
        }

        .studio-proof {
          color: #d5deed;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .composer-head {
          position: relative;
          z-index: 1;
          margin-bottom: 16px;
        }

        .composer-title {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 0.98;
          letter-spacing: -0.04em;
          font-weight: 1000;
          color: #f8fafc;
          max-width: 840px;
        }

        .composer-subhelp {
          margin: 0;
          font-size: 14px;
          line-height: 1.58;
          color: #b2bfd4;
          font-weight: 700;
          max-width: 780px;
        }

        .brief-shell {
          position: relative;
          z-index: 1;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(21, 28, 47, 0.9), rgba(15, 20, 34, 0.92));
          padding: 18px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .brief-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .brief-label {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #f1f5f9;
        }

        .brief-note {
          font-size: 12px;
          font-weight: 800;
          color: #91a0b6;
        }

        .prompt-textarea {
          width: 100%;
          resize: vertical;
          min-height: 132px;
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 16px 18px;
          font-size: 16px;
          line-height: 1.6;
          color: #f8fafc;
          background:
            linear-gradient(180deg, rgba(14, 19, 33, 0.92), rgba(18, 24, 40, 0.95));
          outline: none;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        .prompt-textarea::placeholder {
          color: #8f9fb8;
        }

        .prompt-textarea:focus {
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow:
            0 0 0 5px rgba(99, 102, 241, 0.12),
            0 0 26px rgba(124, 58, 237, 0.08);
        }

        .chips-zone {
          margin-top: 16px;
        }

        .chips-head {
          margin-bottom: 10px;
        }

        .chips-title {
          font-size: 13px;
          font-weight: 950;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .chips-sub {
          font-size: 13px;
          line-height: 1.45;
          color: #a8b6ca;
          font-weight: 700;
          max-width: 760px;
        }

        .chips-scroll-hint {
          display: none;
          margin-bottom: 10px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8495af;
        }

        .chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip-btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
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
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
          box-shadow:
            0 8px 18px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
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
          box-shadow:
            0 14px 24px rgba(88, 28, 135, 0.28),
            0 0 22px rgba(6, 182, 212, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
        }

        .chip-btn__text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .direction-panel {
          margin-top: 14px;
          border: 1px solid rgba(139, 92, 246, 0.14);
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.1), transparent 32%),
            linear-gradient(180deg, rgba(22, 28, 46, 0.92), rgba(16, 21, 36, 0.94));
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
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .prompt-note {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #aebed3;
          line-height: 1.5;
          max-width: 560px;
        }

        .ai-generate-btn {
          position: relative;
          isolation: isolate;
          border: 0;
          background: transparent;
          padding: 0;
          min-width: 282px;
          height: 62px;
          border-radius: 20px;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            opacity 0.18s ease,
            filter 0.18s ease;
          flex-shrink: 0;
          overflow: visible;
        }

        .ai-generate-btn:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .ai-generate-btn:not(:disabled):hover {
          transform: translateY(-2px) scale(1.01);
          filter: saturate(1.06);
        }

        .ai-generate-btn__glow {
          position: absolute;
          inset: -8px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 20% 50%, rgba(236, 72, 153, 0.2), transparent 34%),
            radial-gradient(circle at 80% 40%, rgba(6, 182, 212, 0.2), transparent 36%),
            radial-gradient(circle at 55% 60%, rgba(139, 92, 246, 0.2), transparent 42%);
          filter: blur(16px);
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
            radial-gradient(ellipse at center top, rgba(255, 255, 255, 0.16) 0%, transparent 45%),
            radial-gradient(circle at center bottom, rgba(139, 92, 246, 0.34) 0%, transparent 60%),
            linear-gradient(160deg, #1e1b4b 0%, #09090b 100%);
          box-shadow:
            inset 0 2px 2px rgba(255, 255, 255, 0.22),
            inset 0 -6px 16px rgba(0, 0, 0, 0.55),
            inset 0 0 10px rgba(139, 92, 246, 0.18),
            0 4px 10px rgba(0, 0, 0, 0.22);
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
            rgba(255, 255, 255, 0.18),
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
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.1), transparent 34%),
            radial-gradient(circle at bottom right, rgba(6, 182, 212, 0.08), transparent 30%),
            linear-gradient(180deg, rgba(23, 29, 48, 0.98), rgba(16, 21, 36, 0.98));
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
          background: radial-gradient(circle at center, rgba(99, 102, 241, 0.1), rgba(18, 24, 40, 0.92));
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
            linear-gradient(180deg, rgba(23, 29, 48, 0.96), rgba(16, 21, 36, 0.98));
          border-radius: 22px;
          overflow: hidden;
          padding: 8px;
          cursor: pointer;
          text-align: left;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
          box-shadow:
            0 12px 22px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .design-card:hover {
          transform: translateY(-2px);
          border-color: rgba(139, 92, 246, 0.22);
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.2);
        }

        .design-card.is-selected {
          border-color: rgba(34, 211, 238, 0.38);
          box-shadow:
            0 0 0 4px rgba(34, 211, 238, 0.08),
            0 18px 30px rgba(0, 0, 0, 0.22);
        }

        .design-card__image-wrap {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 16px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.1), transparent 26%),
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
          backdrop-filter: blur(8px);
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
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
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
          box-shadow: 0 10px 18px rgba(8, 145, 178, 0.22);
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
          backdrop-filter: blur(18px);
          border-radius: 22px;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
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
          box-shadow:
            0 12px 22px rgba(88, 28, 135, 0.22),
            0 0 18px rgba(6, 182, 212, 0.08);
        }

        .preview-modal {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(2, 6, 23, 0.74);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          backdrop-filter: blur(8px);
          min-height: 100dvh;
        }

        .preview-modal__dialog {
          width: min(920px, calc(100vw - 32px));
          max-width: 920px;
          height: min(84dvh, 760px);
          margin: 0 auto;
          background:
            linear-gradient(180deg, rgba(20, 26, 44, 0.98), rgba(14, 19, 32, 0.98));
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.24);
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
            radial-gradient(circle at top left, rgba(124, 58, 237, 0.1), transparent 24%),
            radial-gradient(circle at top right, rgba(6, 182, 212, 0.08), transparent 22%),
            linear-gradient(180deg, #1a2238, #151c2e);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 26px 28px 18px;
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
          box-shadow:
            0 12px 22px rgba(88, 28, 135, 0.22),
            0 0 18px rgba(6, 182, 212, 0.08);
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
        }

        @media (max-width: 760px) {
          .page-shell {
            padding: 14px;
          }

          .page-shell.is-embedded {
            padding: 12px;
          }

          .composer-card,
          .results-block {
            border-radius: 22px;
            padding: 14px;
          }

          .brief-shell {
            border-radius: 18px;
            padding: 14px;
          }

          .composer-title {
            font-size: 24px;
          }

          .composer-subhelp {
            font-size: 13px;
          }

          .prompt-textarea {
            min-height: 118px;
            border-radius: 16px;
          }

          .chips-scroll-hint {
            display: block;
          }

          .chips-grid {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 4px;
            margin-right: -4px;
            scrollbar-width: none;
            -ms-overflow-style: none;
            mask-image: linear-gradient(
              to right,
              transparent 0,
              black 14px,
              black calc(100% - 14px),
              transparent 100%
            );
            -webkit-mask-image: linear-gradient(
              to right,
              transparent 0,
              black 14px,
              black calc(100% - 14px),
              transparent 100%
            );
          }

          .chips-grid::-webkit-scrollbar {
            display: none;
          }

          .chip-btn {
            flex: 0 0 auto;
            min-height: 38px;
            padding: 0 13px;
            font-size: 12px;
          }

          .composer-foot {
            align-items: stretch;
          }

          .ai-generate-btn {
            width: 100%;
            min-width: 0;
            height: 56px;
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
            border-radius: 18px;
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
            padding: 12px;
            min-height: 100dvh;
          }

          .preview-modal__dialog {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
            height: min(74dvh, 620px);
            border-radius: 22px;
          }

          .preview-modal__image-wrap {
            padding: 20px 14px 14px;
          }

          .preview-modal__nav {
            width: 44px;
            height: 44px;
            font-size: 28px;
          }

          .preview-modal__nav--left {
            left: 10px;
          }

          .preview-modal__nav--right {
            right: 10px;
          }

          .preview-modal__close {
            width: 40px;
            height: 40px;
            top: 10px;
            right: 10px;
          }

          .preview-modal__foot {
            flex-direction: column;
            align-items: stretch;
            padding: 14px;
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