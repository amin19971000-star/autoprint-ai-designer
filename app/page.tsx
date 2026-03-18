"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DesignMode = "sticker" | "playera";

function HomePageInner() {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<DesignMode>("sticker");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEmbedded = searchParams.get("embed") === "1";
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
    if (forcedMode === "sticker" || forcedMode === "playera") {
      setMode(forcedMode);
    }
  }, [searchParams]);

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
  }, [isEmbedded, images.length, selectedIndex, previewIndex, loading, error]);

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
          prompt,
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
        prompt,
        mode,
      };

      if (isEmbedded && window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar el diseño.");
    }
  }

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;
  const selectedLabel = selectedIndex !== null ? labels[selectedIndex] : null;

  return (
    <>
      <main className={`page-shell ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="page-wrap">
          <section className="composer-card">
            <div className="composer-head">
              <div>
                <div className="composer-kicker">AutoPrint AI Studio</div>
                <h1 className="composer-title">Describe tu diseño</h1>
                <p className="composer-subhelp">
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
              rows={4}
              className="prompt-textarea"
            />

            <div className="composer-foot">
              <p className="prompt-note">
                Generaremos 3 propuestas distintas para ayudarte a elegir más rápido.
              </p>

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
                      {loading ? "Generando..." : "Crear con IA"}
                    </span>
                    <span className="ai-generate-btn__sub">
                      {loading
                        ? "3 propuestas en proceso"
                        : `3 propuestas para ${
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
                      Interpretando tu idea y construyendo rutas visuales.
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
                </div>
              </div>
            ) : null}

            {error ? <div className="error-box">{error}</div> : null}
          </section>

          {images.length > 0 ? (
            <section className="results-block">
              <div className="results-head">
                <h2 className="results-title">Elige tu diseño favorito</h2>
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
                          {isSelected ? "Diseño seleccionado" : "Haz clic para elegir"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedImage ? (
                <div className="selected-box">
                  <button
                    type="button"
                    className="selected-box__btn"
                    onClick={handleContinueWithDesign}
                  >
                    Usar este diseño
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {previewIndex !== null ? (
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
                  onClick={() =>
                    setPreviewIndex((previewIndex + 1) % images.length)
                  }
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
                      : "Seleccionar este diseño"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <style jsx>{`
        :global(html),
        :global(body) {
          background: transparent !important;
          overflow-x: hidden;
        }

        .page-shell {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .page-shell.is-embedded {
          min-height: auto;
          padding: 18px;
          background: #ffffff;
        }

        .page-wrap {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .is-embedded .page-wrap {
          max-width: none;
          gap: 16px;
        }

        .composer-card,
        .results-block {
          background: #ffffff;
          border: 1px solid rgba(17, 24, 39, 0.08);
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
        }

        .is-embedded .composer-card,
        .is-embedded .results-block {
          border-radius: 20px;
          padding: 18px;
          box-shadow: none;
        }

        .composer-head {
          margin-bottom: 14px;
        }

        .composer-kicker {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #4f46e5;
          margin-bottom: 8px;
        }

        .composer-title {
          margin: 0 0 8px;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 1000;
          color: #111827;
        }

        .composer-subhelp {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #667085;
          font-weight: 700;
          max-width: 720px;
        }

        .prompt-textarea {
          width: 100%;
          resize: vertical;
          min-height: 120px;
          border: 1.5px solid #d7dde6;
          border-radius: 18px;
          padding: 16px 18px;
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
        }

        .composer-foot {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .prompt-note {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #6b7280;
          line-height: 1.45;
          max-width: 520px;
        }

        .ai-generate-btn {
          position: relative;
          isolation: isolate;
          border: 0;
          background: transparent;
          padding: 0;
          min-width: 260px;
          height: 60px;
          border-radius: 18px;
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
            radial-gradient(circle at 20% 50%, rgba(236, 72, 153, 0.22), transparent 34%),
            radial-gradient(circle at 80% 40%, rgba(6, 182, 212, 0.22), transparent 36%),
            radial-gradient(circle at 55% 60%, rgba(139, 92, 246, 0.22), transparent 42%);
          filter: blur(16px);
          z-index: 0;
        }

        .ai-generate-btn__border {
          position: absolute;
          inset: 0;
          border-radius: 18px;
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
          border-radius: 16px;
          background:
            radial-gradient(ellipse at center top, rgba(255, 255, 255, 0.15) 0%, transparent 45%),
            radial-gradient(circle at center bottom, rgba(139, 92, 246, 0.35) 0%, transparent 60%),
            linear-gradient(160deg, #1e1b4b 0%, #09090b 100%);
          box-shadow:
            inset 0 2px 2px rgba(255, 255, 255, 0.25),
            inset 0 -6px 16px rgba(0, 0, 0, 0.6),
            inset 0 0 10px rgba(139, 92, 246, 0.2),
            0 4px 10px rgba(0, 0, 0, 0.25);
          z-index: 2;
        }

        .ai-generate-btn__shine {
          position: absolute;
          inset: 2px;
          border-radius: 16px;
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
          margin-top: 16px;
          border: 1px solid rgba(99, 102, 241, 0.14);
          background:
            radial-gradient(circle at top left, rgba(79, 70, 229, 0.10), transparent 34%),
            radial-gradient(circle at bottom right, rgba(0, 184, 169, 0.10), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,247,252,.98));
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
          color: #111827;
          line-height: 1.15;
        }

        .loading-subtitle {
          font-size: 13px;
          font-weight: 750;
          color: #6b7280;
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
          color: #475569;
        }

        .loading-step__bullet {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #38bdf8, #8b5cf6);
          flex-shrink: 0;
        }

        .error-box {
          margin-top: 14px;
          border: 1px solid rgba(239, 68, 68, 0.16);
          background: rgba(239, 68, 68, 0.06);
          color: #b91c1c;
          border-radius: 14px;
          padding: 13px 14px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.45;
        }

        .results-block {
          padding: 20px;
        }

        .results-head {
          margin-bottom: 14px;
        }

        .results-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 1000;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .results-grid {
          display: grid;
          gap: 14px;
        }

        .results-grid--3 {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .design-card {
          border: 1px solid rgba(17, 24, 39, 0.08);
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          padding: 8px;
          cursor: pointer;
          text-align: left;
          transition: 0.18s ease;
        }

        .design-card:hover {
          transform: translateY(-2px);
          border-color: rgba(79, 70, 229, 0.18);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07);
        }

        .design-card.is-selected {
          border-color: #0ea5a4;
          box-shadow:
            0 0 0 4px rgba(14, 165, 164, 0.1),
            0 16px 34px rgba(15, 23, 42, 0.08);
        }

        .design-card__image-wrap {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          overflow: hidden;
          background: #f3f4f6;
        }

        .design-card__image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
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
          color: #4f46e5;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 184, 169, 0.14);
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
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(17, 24, 39, 0.08);
          color: #111827;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
        }

        .design-card__check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0ea5a4;
          color: #fff;
          font-size: 13px;
          font-weight: 1000;
        }

        .design-card__body {
          padding: 10px 4px 2px;
        }

        .design-card__title {
          font-size: 13px;
          font-weight: 950;
          color: #111827;
          line-height: 1.15;
        }

        .selected-box {
          margin-top: 18px;
        }

        .selected-box__btn {
          width: 100%;
          appearance: none;
          border: none;
          border-radius: 14px;
          background: linear-gradient(180deg, #111827, #0f172a);
          color: #fff;
          min-height: 50px;
          padding: 0 16px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
        }

        .preview-modal {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .preview-modal__dialog {
          width: min(920px, 100%);
          max-height: 90vh;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
          display: grid;
        }

        .preview-modal__close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.08);
          color: #111827;
          font-size: 24px;
          font-weight: 700;
          cursor: pointer;
          z-index: 2;
        }

        .preview-modal__nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 52px;
          height: 52px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: #111827;
          font-size: 34px;
          font-weight: 500;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
          z-index: 2;
        }

        .preview-modal__nav--left {
          left: 18px;
        }

        .preview-modal__nav--right {
          right: 18px;
        }

        .preview-modal__image-wrap {
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          min-height: 420px;
        }

        .preview-modal__image {
          max-width: 100%;
          max-height: 68vh;
          object-fit: contain;
          display: block;
        }

        .preview-modal__foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px 20px;
          border-top: 1px solid rgba(17, 24, 39, 0.06);
        }

        .preview-modal__meta {
          font-size: 14px;
          font-weight: 900;
          color: #111827;
        }

        .preview-modal__select {
          appearance: none;
          border: none;
          border-radius: 14px;
          background: linear-gradient(180deg, #111827, #0f172a);
          color: #ffffff;
          min-height: 46px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
        }

        .preview-modal__select.is-selected {
          background: linear-gradient(180deg, #0ea5a4, #0f766e);
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

        @media (max-width: 760px) {
          .page-shell {
            padding: 14px;
          }

          .page-shell.is-embedded {
            padding: 12px;
          }

          .composer-card,
          .results-block {
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
            min-height: 110px;
            border-radius: 16px;
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

          .preview-modal__dialog {
            width: 100%;
            max-height: 92vh;
          }

          .preview-modal__foot {
            flex-direction: column;
            align-items: stretch;
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