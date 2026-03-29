import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el límite de 20 MB." },
        { status: 400, headers: corsHeaders }
      );
    }

    const mimeType = file.type;
    const ext = ALLOWED_TYPES[mimeType];

    if (!ext) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido." },
        { status: 400, headers: corsHeaders }
      );
    }

    const fileRef = `customer_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const originalName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();

    const pathname = `customer-files/${fileRef}_${originalName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });

    return NextResponse.json(
      {
        ok: true,
        fileRef,
        fileUrl: blob.url,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo subir el archivo." },
      { status: 500, headers: corsHeaders }
    );
  }
}