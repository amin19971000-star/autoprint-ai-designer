"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DesignMode = "sticker" | "playera";
type DesignSource = "none" | "upload" | "ai";

export default function HomePage() {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<DesignMode>("sticker");
  const [designSource, setDesignSource] = useState<DesignSource>("none");

  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEmbedded = searchParams.get("embed") === "1";
  const canGenerate = prompt.trim().length > 0 && !loading;

  useEffect(() => {
    const forcedMode = searchParams.get("mode");
    if (forcedMode === "sticker" || forcedMode === "playera") {
      setMode(forcedMode);
    }
  }, [searchParams]);

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

     const apiBase = isEmbedded ? "/apps/ppx-ai/api/generate" : "/api/generate";
    const res = await fetch(apiBase, {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: cleanPrompt,
          mode,
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
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSource(source: DesignSource) {
    setDesignSource(source);

    if (source !== "ai") {
      setImages([]);
      setLabels([]);
      setSelectedIndex(null);
      setPrompt("");
      setError("");
      setLoading(false);
    }
  }

  function handleContinueWithDesign() {
    if (selectedIndex === null) return;

    const payload = {
      type: "AUTOPRINT_AI_DESIGN_SELECTED",
      image: images[selectedIndex],
      label: selectedLabel || `Concepto ${selectedIndex + 1}`,
      prompt,
      mode,
    };

    if (isEmbedded && window.parent && window.parent !== window) {
      window.parent.postMessage(payload, "*");
      return;
    }

    const target = document.getElementById("config-area");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;
  const selectedLabel = selectedIndex !== null ? labels[selectedIndex] : null;

  return (
    <>
      <main className={`page-shell ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="page-wrap">
          <section className="hero-card">
            <div className="hero-top">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                AUTOPRINT AI STUDIO
              </div>

              {!isEmbedded ? <div className="test-chip">Modo de prueba</div> : null}
            </div>

            {!isEmbedded ? (
              <div className="hero-copy">
                <h1 className="hero-title">Generador IA para impresión</h1>
                <p className="hero-subtitle">
                  Primero define cómo quieres trabajar tu diseño. Después lo
                  llevamos a la configuración del pedido.
                </p>
              </div>
            ) : null}

            <section className="entry-card">
              <div className="entry-head">
                <div>
                  <div className="entry-title">¿Ya tienes tu diseño?</div>
                  <p className="entry-subtitle">
                    Elige si quieres subir tu arte o crear uno con IA antes de
                    configurar tu pedido.
                  </p>
                </div>
              </div>

              <div className="entry-grid">
                <button
                  type="button"
                  className={`entry-option ${
                    designSource === "upload" ? "is-active" : ""
                  }`}
                  onClick={() => handleSelectSource("upload")}
                >
                  <div className="entry-option__icon">↑</div>
                  <div className="entry-option__copy">
                    <div className="entry-option__title">Ya tengo mi diseño</div>
                    <div className="entry-option__text">
                      Continúa con tu flujo normal y sube tu archivo.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`entry-option ${
                    designSource === "ai" ? "is-active" : ""
                  }`}
                  onClick={() => handleSelectSource("ai")}
                >
                  <div className="entry-option__icon">✦</div>
                  <div className="entry-option__copy">
                    <div className="entry-option__title">Crear diseño con IA</div>
                    <div className="entry-option__text">
                      Genera 3 conceptos y elige tu favorito.
                    </div>
                  </div>
                </button>
              </div>

              {designSource === "upload" ? (
                <div className="upload-placeholder">
                  <div className="upload-placeholder__title">
                    Sigue con tu flujo normal
                  </div>
                  <div className="upload-placeholder__text">
                    Aquí Shopify/Globo seguirá manejando la subida de archivos en
                    la PDP real.
                  </div>
                </div>
              ) : null}
            </section>

            {designSource === "ai" ? (
              <section className="prompt-card">
                <div className="prompt-head">
                  <div>
                    <label className="prompt-label">Tipo de producto</label>
                    <p className="prompt-subhelp">
                      Temporalmente lo usamos para pruebas. Después se fijará
                      automáticamente según la página del producto.
                    </p>
                  </div>
                </div>

                <div className="mode-switch">
                  <button
                    type="button"
                    className={`mode-btn ${mode === "sticker" ? "is-active" : ""}`}
                    onClick={() => setMode("sticker")}
                  >
                    Sticker
                  </button>

                  <button
                    type="button"
                    className={`mode-btn ${mode === "playera" ? "is-active" : ""}`}
                    onClick={() => setMode("playera")}
                  >
                    Playera
                  </button>
                </div>

                <div className="prompt-head prompt-head--second">
                  <div>
                    <label htmlFor="prompt" className="prompt-label">
                      Describe tu diseño
                    </label>
                    <p className="prompt-subhelp">
                      Cuéntanos el concepto, estilo, colores, texto o mood que te
                      gustaría ver.
                    </p>
                  </div>
                </div>

                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === "sticker"
                      ? "Ejemplo: astronauta vaquero adorable con nombre Leo y estilo premium tipo sticker"
                      : "Ejemplo: astronauta vaquero vintage para playera, composición premium y look impactante"
                  }
                  rows={6}
                  className="prompt-textarea"
                />

                <div className="prompt-foot">
                  <div className="prompt-note">
                    La IA interpretará y mejorará tu idea internamente para crear
                    3 conceptos distintos.
                  </div>

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
                          {loading ? "Generando..." : "Enter AI Magic Lab"}
                        </span>
                        <span className="ai-generate-btn__sub">
                          {loading
                            ? "Creando 3 conceptos..."
                            : `Genera 3 concepts para ${
                                mode === "sticker" ? "stickers" : "playeras"
                              }`}
                        </span>
                      </span>
                    </span>
                  </button>
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
                        <div className="loading-title">
                          Generando 3 propuestas con IA
                        </div>
                        <div className="loading-subtitle">
                          Estamos construyendo tres conceptos distintos para{" "}
                          {mode === "sticker" ? "stickers" : "playeras"} con mejor
                          composición, estilo y enfoque comercial.
                        </div>
                      </div>
                    </div>

                    <div className="loading-steps">
                      <div className="loading-step">
                        <span className="loading-step__bullet" />
                        Interpretando tu idea
                      </div>
                      <div className="loading-step">
                        <span className="loading-step__bullet" />
                        Diseñando 3 rutas creativas
                      </div>
                      <div className="loading-step">
                        <span className="loading-step__bullet" />
                        Renderizando con FLUX
                      </div>
                    </div>
                  </div>
                ) : null}

                {error ? <div className="error-box">{error}</div> : null}
              </section>
            ) : null}
          </section>

          {designSource === "ai" && images.length > 0 ? (
            <section className="results-block">
              <div className="results-head">
                <div>
                  <h2 className="results-title">Elige tu diseño favorito</h2>
                  <p className="results-subtitle">
                    Te mostramos 3 conceptos distintos para que elijas el que
                    más te convenza.
                  </p>
                </div>

                <div className="results-status">
                  {selectedIndex !== null
                    ? "1 diseño seleccionado"
                    : "3 propuestas generadas"}
                </div>
              </div>

              <div className="results-grid results-grid--3">
                {images.map((image, index) => {
                  const isSelected = selectedIndex === index;
                  const label = labels[index] || `Concepto ${index + 1}`;

                  return (
                    <button
                      key={index}
                      type="button"
                      className={`design-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <div className="design-card__image-wrap">
                        <img
                          src={image}
                          alt={`Diseño generado ${index + 1}`}
                          className="design-card__image"
                        />

                        <div className="design-card__badge">Opción {index + 1}</div>

                        {isSelected ? (
                          <div className="design-card__check">✓</div>
                        ) : null}
                      </div>

                      <div className="design-card__body">
                        <div className="design-card__kicker">{label}</div>

                        <div className="design-card__title">
                          {isSelected ? "Diseño seleccionado" : "Haz clic para elegir"}
                        </div>

                        <div className="design-card__text">
                          {isSelected
                            ? "Esta propuesta quedó marcada como favorita."
                            : "Selecciona esta opción si es la que más te convence visualmente."}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedImage ? (
                <div className="selected-box">
                  <div className="selected-box__title">
                    Diseño listo para el siguiente paso
                  </div>
                  <div className="selected-box__text">
                    Elegiste: <b>{selectedLabel || "Concepto seleccionado"}</b>.
                    {isEmbedded
                      ? " Ahora lo mandaremos de regreso a tu pedido en Shopify."
                      : " Ahora llevaremos este diseño a la configuración del pedido."}
                  </div>

                  <button
                    type="button"
                    className="selected-box__btn"
                    onClick={handleContinueWithDesign}
                  >
                    Continuar con este diseño
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {!isEmbedded ? (
            <section className="config-block" id="config-area">
              <div className="config-block__head">
                <div>
                  <div className="config-block__kicker">Siguiente paso</div>
                  <h3 className="config-block__title">Configuración del pedido</h3>
                  <p className="config-block__text">
                    Aquí después conectaremos tamaño, cantidad, material, técnica
                    y el resto de la configuración real del producto.
                  </p>
                </div>
              </div>

              <div className="config-block__grid">
                <div className="config-mini-card">
                  <div className="config-mini-card__label">Diseño</div>
                  <div className="config-mini-card__value">
                    {selectedLabel
                      ? `Seleccionaste: ${selectedLabel}`
                      : "Aún no has elegido un diseño"}
                  </div>
                </div>

                <div className="config-mini-card">
                  <div className="config-mini-card__label">Producto</div>
                  <div className="config-mini-card__value">
                    {designSource === "ai"
                      ? mode === "sticker"
                        ? "Sticker"
                        : "Playera"
                      : "Pendiente"}
                  </div>
                </div>

                <div className="config-mini-card">
                  <div className="config-mini-card__label">Estado</div>
                  <div className="config-mini-card__value">
                    {selectedImage
                      ? "Listo para conectar al flujo del pedido"
                      : "Primero selecciona un diseño"}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(99, 102, 241, 0.08), transparent 26%),
            radial-gradient(circle at top right, rgba(0, 184, 169, 0.06), transparent 24%),
            linear-gradient(180deg, #f5f7fb 0%, #f3f5f9 100%);
          padding: 32px 16px 56px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .page-shell.is-embedded {
          min-height: auto;
          padding: 12px;
          background: transparent;
        }

        .page-wrap {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }

        .hero-card,
        .results-block,
        .config-block {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(17, 24, 39, 0.08);
          border-radius: 30px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
        }

        .hero-card {
          padding: 22px;
          display: grid;
          gap: 18px;
        }

        .is-embedded .hero-card {
          border-radius: 22px;
          padding: 14px;
          box-shadow: none;
        }

        .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: max-content;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0, 184, 169, 0.15);
          background: rgba(0, 184, 169, 0.06);
          color: #0f766e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .eyebrow-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #00b8a9;
          box-shadow: 0 0 0 6px rgba(0, 184, 169, 0.12);
        }

        .test-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.12);
          color: #4f46e5;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.03em;
        }

        .hero-copy {
          display: grid;
          gap: 8px;
        }

        .hero-title {
          margin: 0;
          font-size: clamp(34px, 5vw, 56px);
          line-height: 0.98;
          letter-spacing: -0.045em;
          font-weight: 1000;
          color: #0f172a;
        }

        .hero-subtitle {
          margin: 0;
          max-width: 780px;
          font-size: 18px;
          line-height: 1.55;
          color: #6b7280;
          font-weight: 750;
        }

        .entry-card,
        .prompt-card {
          border: 1px solid rgba(17, 24, 39, 0.07);
          border-radius: 26px;
          padding: 18px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
        }

        .is-embedded .entry-card,
        .is-embedded .prompt-card {
          border-radius: 20px;
          padding: 14px;
        }

        .entry-head,
        .prompt-head {
          margin-bottom: 12px;
        }

        .prompt-head--second {
          margin-top: 18px;
        }

        .entry-title,
        .prompt-label {
          display: inline-block;
          font-size: 15px;
          font-weight: 950;
          color: #111827;
          margin-bottom: 6px;
        }

        .entry-subtitle,
        .prompt-subhelp {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: #667085;
          font-weight: 700;
        }

        .entry-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .entry-option {
          appearance: none;
          border: 1px solid rgba(17, 24, 39, 0.1);
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border-radius: 22px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        .entry-option:hover {
          transform: translateY(-1px);
          border-color: rgba(99, 102, 241, 0.22);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.06);
        }

        .entry-option.is-active {
          border-color: rgba(79, 70, 229, 0.42);
          background: rgba(99, 102, 241, 0.07);
          box-shadow:
            0 0 0 4px rgba(99, 102, 241, 0.07),
            0 14px 24px rgba(79, 70, 229, 0.06);
        }

        .entry-option__icon {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.08);
          color: #4338ca;
          font-size: 18px;
          font-weight: 1000;
        }

        .entry-option__copy {
          display: grid;
          gap: 5px;
        }

        .entry-option__title {
          font-size: 15px;
          font-weight: 950;
          color: #111827;
        }

        .entry-option__text {
          font-size: 13px;
          line-height: 1.5;
          color: #667085;
          font-weight: 750;
        }

        .upload-placeholder {
          margin-top: 14px;
          border: 1px dashed rgba(99, 102, 241, 0.28);
          border-radius: 22px;
          padding: 18px;
          background: rgba(99, 102, 241, 0.04);
        }

        .upload-placeholder__title {
          font-size: 15px;
          font-weight: 950;
          color: #312e81;
          margin-bottom: 6px;
        }

        .upload-placeholder__text {
          font-size: 13px;
          line-height: 1.5;
          color: #4b5563;
          font-weight: 750;
        }

        .mode-switch {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .mode-btn {
          appearance: none;
          border: 1px solid rgba(17, 24, 39, 0.1);
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          color: #111827;
          border-radius: 18px;
          min-height: 54px;
          padding: 12px 14px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease,
            background 0.18s ease;
        }

        .mode-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(99, 102, 241, 0.24);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.06);
        }

        .mode-btn.is-active {
          border-color: rgba(79, 70, 229, 0.48);
          background: rgba(99, 102, 241, 0.08);
          color: #312e81;
          box-shadow:
            0 0 0 4px rgba(99, 102, 241, 0.08),
            0 12px 24px rgba(79, 70, 229, 0.08);
        }

        .prompt-textarea {
          width: 100%;
          resize: vertical;
          min-height: 170px;
          border: 1.5px solid #d7dde6;
          border-radius: 22px;
          padding: 18px 18px;
          font-size: 16px;
          line-height: 1.55;
          color: #111827;
          background: #ffffff;
          outline: none;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        .prompt-textarea:focus {
          border-color: rgba(79, 70, 229, 0.46);
          box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.09);
          background: #ffffff;
        }

        .prompt-foot {
          margin-top: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .prompt-note {
          font-size: 13px;
          font-weight: 800;
          color: #6b7280;
          line-height: 1.45;
          max-width: 620px;
        }

        .ai-generate-btn {
          position: relative;
          isolation: isolate;
          border: 0;
          background: transparent;
          padding: 0;
          min-width: 340px;
          height: 72px;
          border-radius: 24px;
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
          transform: translateY(-2px) scale(1.012);
          filter: saturate(1.08);
        }

        .ai-generate-btn__glow {
          position: absolute;
          inset: -10px;
          border-radius: 30px;
          background:
            radial-gradient(circle at 20% 50%, rgba(0, 184, 169, 0.22), transparent 34%),
            radial-gradient(circle at 80% 40%, rgba(59, 130, 246, 0.24), transparent 36%),
            radial-gradient(circle at 55% 60%, rgba(139, 92, 246, 0.22), transparent 42%);
          filter: blur(18px);
          opacity: 1;
          z-index: 0;
        }

        .ai-generate-btn__border {
          position: absolute;
          inset: 0;
          border-radius: 24px;
          background: linear-gradient(
            90deg,
            #00d4c5 0%,
            #38bdf8 22%,
            #8b5cf6 52%,
            #60a5fa 74%,
            #00d4c5 100%
          );
          background-size: 220% 100%;
          animation: borderFlow 4s linear infinite;
          z-index: 1;
        }

        .ai-generate-btn__bg {
          position: absolute;
          inset: 1.5px;
          border-radius: 22px;
          background:
            radial-gradient(circle at top left, rgba(255,255,255,.08), transparent 30%),
            linear-gradient(180deg, #0b1120 0%, #0a1020 48%, #070b16 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.08),
            0 18px 34px rgba(15, 23, 42, 0.34);
          z-index: 2;
        }

        .ai-generate-btn__shine {
          position: absolute;
          inset: 2px;
          border-radius: 22px;
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
            rgba(255,255,255,.18),
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
          gap: 14px;
          color: #ffffff;
          padding: 0 22px;
        }

        .ai-generate-btn__copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .ai-generate-btn__label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 1000;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .ai-generate-btn__sub {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,.7);
        }

        .ai-stars {
          position: relative;
          width: 34px;
          height: 24px;
          display: inline-block;
          flex-shrink: 0;
        }

        .ai-star {
          position: absolute;
          line-height: 1;
          animation: sparkleFloat 2s ease-in-out infinite;
        }

        .ai-star--big {
          font-size: 17px;
          left: 0;
          top: 3px;
          color: #ffffff;
          text-shadow:
            0 0 10px rgba(255,255,255,.52),
            0 0 22px rgba(56, 189, 248, .32);
          animation-delay: 0s;
        }

        .ai-star--mid {
          font-size: 11px;
          left: 14px;
          top: 0;
          color: #c4b5fd;
          text-shadow:
            0 0 10px rgba(196,181,253,.55),
            0 0 18px rgba(139,92,246,.26);
          animation-delay: 0.25s;
        }

        .ai-star--small {
          font-size: 10px;
          left: 22px;
          top: 12px;
          color: #99f6e4;
          text-shadow:
            0 0 10px rgba(153,246,228,.55),
            0 0 18px rgba(0,184,169,.26);
          animation-delay: 0.5s;
        }

        .ai-generate-btn.is-loading .ai-generate-btn__border {
          animation-duration: 1.3s;
        }

        .ai-generate-btn.is-loading .ai-generate-btn__shine::before {
          animation-duration: 1.2s;
        }

        .ai-generate-btn.is-loading .ai-star {
          animation-duration: 0.9s;
        }

        .loading-panel {
          margin-top: 18px;
          border: 1px solid rgba(17, 24, 39, 0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,249,252,.96));
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
        }

        .loading-top {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .loading-orbit {
          position: relative;
          width: 52px;
          height: 52px;
          min-width: 52px;
          border-radius: 999px;
          border: 1px solid rgba(99, 102, 241, 0.12);
          background: radial-gradient(circle at center, rgba(99, 102, 241, 0.06), rgba(255,255,255,.9));
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
          left: 21px;
          background: #38bdf8;
          box-shadow: 0 0 14px rgba(56,189,248,.45);
          animation-delay: 0s;
        }

        .loading-dot--2 {
          right: 7px;
          bottom: 11px;
          background: #8b5cf6;
          box-shadow: 0 0 14px rgba(139,92,246,.38);
          animation-delay: 0.2s;
        }

        .loading-dot--3 {
          left: 8px;
          bottom: 10px;
          background: #00b8a9;
          box-shadow: 0 0 14px rgba(0,184,169,.42);
          animation-delay: 0.4s;
        }

        .loading-copy {
          display: grid;
          gap: 4px;
        }

        .loading-title {
          font-size: 16px;
          font-weight: 950;
          color: #111827;
          line-height: 1.15;
        }

        .loading-subtitle {
          font-size: 13px;
          font-weight: 750;
          color: #6b7280;
          line-height: 1.5;
          max-width: 720px;
        }

        .loading-steps {
          margin-top: 16px;
          display: grid;
          gap: 10px;
        }

        .loading-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 850;
          color: #475569;
        }

        .loading-step__bullet {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: linear-gradient(180deg, #38bdf8, #8b5cf6);
          box-shadow: 0 0 12px rgba(99,102,241,.22);
          flex-shrink: 0;
          animation: pulseStep 1.4s ease-in-out infinite;
        }

        .error-box {
          margin-top: 16px;
          border: 1px solid rgba(239, 68, 68, 0.16);
          background: rgba(239, 68, 68, 0.06);
          color: #b91c1c;
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.45;
        }

        .results-block {
          padding: 22px;
        }

        .is-embedded .results-block {
          border-radius: 22px;
          padding: 14px;
          box-shadow: none;
        }

        .results-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .results-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 1000;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .results-subtitle {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
          font-weight: 700;
        }

        .results-status {
          font-size: 13px;
          font-weight: 900;
          color: #0f766e;
          border: 1px solid rgba(0, 184, 169, 0.18);
          background: rgba(0, 184, 169, 0.06);
          border-radius: 999px;
          padding: 8px 12px;
          white-space: nowrap;
        }

        .results-grid {
          display: grid;
          gap: 16px;
        }

        .results-grid--3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .design-card {
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: #fff;
          border-radius: 24px;
          overflow: hidden;
          padding: 12px;
          cursor: pointer;
          text-align: left;
          transition: 0.18s ease;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
        }

        .design-card:hover {
          transform: translateY(-2px);
          border-color: rgba(79, 70, 229, 0.18);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07);
        }

        .design-card.is-selected {
          border-color: #0ea5a4;
          box-shadow:
            0 0 0 5px rgba(14, 165, 164, 0.1),
            0 16px 34px rgba(15, 23, 42, 0.08);
        }

        .design-card__image-wrap {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 18px;
          overflow: hidden;
          background: #f3f4f6;
        }

        .design-card__image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .design-card__badge {
          position: absolute;
          top: 12px;
          left: 12px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          color: #0f766e;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 184, 169, 0.14);
          backdrop-filter: blur(8px);
        }

        .design-card__check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0ea5a4;
          color: #fff;
          font-size: 16px;
          font-weight: 1000;
          box-shadow: 0 10px 20px rgba(14, 165, 164, 0.28);
        }

        .design-card__body {
          padding: 14px 6px 6px;
        }

        .design-card__kicker {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #4f46e5;
          margin-bottom: 8px;
        }

        .design-card__title {
          font-size: 17px;
          font-weight: 950;
          color: #111827;
          line-height: 1.15;
        }

        .design-card__text {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.5;
          color: #6b7280;
        }

        .selected-box {
          margin-top: 16px;
          border: 1px solid rgba(0, 184, 169, 0.18);
          background: rgba(0, 184, 169, 0.05);
          border-radius: 20px;
          padding: 16px;
        }

        .selected-box__title {
          font-size: 15px;
          font-weight: 950;
          color: #0f766e;
          margin-bottom: 6px;
        }

        .selected-box__text {
          font-size: 14px;
          line-height: 1.55;
          color: #374151;
          font-weight: 800;
        }

        .selected-box__btn {
          margin-top: 14px;
          appearance: none;
          border: none;
          border-radius: 14px;
          background: linear-gradient(180deg, #111827, #0f172a);
          color: #fff;
          min-height: 46px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
        }

        .config-block {
          padding: 22px;
        }

        .config-block__head {
          margin-bottom: 16px;
        }

        .config-block__kicker {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #4f46e5;
          margin-bottom: 8px;
        }

        .config-block__title {
          margin: 0 0 8px;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 1000;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .config-block__text {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 750;
          max-width: 760px;
        }

        .config-block__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .config-mini-card {
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border-radius: 20px;
          padding: 16px;
        }

        .config-mini-card__label {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #0f766e;
          margin-bottom: 8px;
        }

        .config-mini-card__value {
          font-size: 14px;
          line-height: 1.5;
          color: #374151;
          font-weight: 800;
        }

        @keyframes sparkleFloat {
          0%,
          100% {
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
          0%,
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.22);
            opacity: 1;
          }
        }

        @keyframes pulseStep {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @media (max-width: 1100px) {
          .results-grid--3,
          .config-block__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .results-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 680px) {
          .page-shell {
            padding: 18px 12px 34px;
          }

          .page-shell.is-embedded {
            padding: 8px;
          }

          .hero-card,
          .results-block,
          .config-block {
            border-radius: 22px;
          }

          .hero-card,
          .results-block,
          .config-block {
            padding: 16px;
          }

          .entry-card,
          .prompt-card {
            padding: 14px;
            border-radius: 20px;
          }

          .hero-title {
            font-size: 34px;
          }

          .hero-subtitle {
            font-size: 15px;
          }

          .entry-grid,
          .mode-switch,
          .results-grid--3,
          .config-block__grid {
            grid-template-columns: 1fr;
          }

          .prompt-foot {
            align-items: stretch;
          }

          .ai-generate-btn {
            width: 100%;
            min-width: 0;
            height: 68px;
          }

          .ai-generate-btn__label {
            font-size: 17px;
          }

          .ai-generate-btn__sub {
            font-size: 10px;
          }

          .loading-top {
            align-items: flex-start;
          }

          .loading-subtitle {
            font-size: 12.5px;
          }

          .results-title,
          .config-block__title {
            font-size: 24px;
          }
        }
      `}</style>
    </>
  );
}