import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function dataUrlToBuffer(dataUrl: string) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!matches) {
    throw new Error("Formato de imagen inválido.");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  return { buffer, mimeType };
}

function getExtensionFromMime(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
        return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, label, prompt, mode } = body ?? {};

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "La imagen es obligatoria." },
        { status: 400 }
      );
    }

    const { buffer, mimeType } = dataUrlToBuffer(image);

    // Solo imágenes reales y de tamaño razonable (las del estudio pesan 1–3 MB).
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Formato de imagen no permitido." },
        { status: 400 }
      );
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen es demasiado grande." },
        { status: 400 }
      );
    }

    const ext = getExtensionFromMime(mimeType);

    const safeMode = mode === "playera" ? "playera" : "sticker";
    const safeLabel =
      typeof label === "string" && label.trim()
        ? label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : "concepto";

    const designRef = `ai_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const pathname = `selected-designs/${safeMode}/${designRef}_${safeLabel}.${ext}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });

    return NextResponse.json({
      ok: true,
      designRef,
      imageUrl: blob.url,
      pathname: blob.pathname,
      label: label || "Concepto seleccionado",
      prompt: prompt || "",
      mode: safeMode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo guardar el diseño." },
      { status: 500 }
    );
  }
}
