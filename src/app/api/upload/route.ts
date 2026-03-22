import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// ─── R2 client (lazy-init so missing env only blows up at request time) ───────

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Cloudflare R2 environment variables.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getPublicUrl(storageKey: string): string {
  const publicDomain = process.env.R2_PUBLIC_URL;
  if (!publicDomain) throw new Error("Missing R2_PUBLIC_URL environment variable.");
  return `${publicDomain.replace(/\/$/, "")}/${storageKey}`;
}

/**
 * Sanitize an email address so it is safe to use as a filesystem/object-store
 * path segment. Replaces `@` with `_at_` and `.` with `_`.
 * Example: "john.doe@example.com" → "john_doe_at_example_com"
 */
function sanitizeEmail(email: string): string {
  return email.replace(/@/g, "_at_").replace(/\./g, "_");
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
// Body: multipart/form-data
//   file     — the image file (required)
//   tradeId  — trade id to attach the media to (required)
//   type     — "backtest" | "journal" (required)
//
// Storage key conventions:
//   backtest: <sanitized_email>/backtests/<backtestId>/<tradeId>_<timestamp>.png
//   journal:  <sanitized_email>/trades/<tradeId>_<timestamp>.png

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const userEmail = session.user.email;

  // 2. Parse multipart body
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const file = formData.get("file");
  const tradeId = formData.get("tradeId");
  const uploadType = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }
  if (typeof tradeId !== "string" || !tradeId) {
    return NextResponse.json({ error: "Missing tradeId field." }, { status: 400 });
  }
  if (uploadType !== "backtest" && uploadType !== "journal") {
    return NextResponse.json({ error: "Invalid type field. Must be 'backtest' or 'journal'." }, { status: 400 });
  }

  // 3. Validate MIME type
  const mimeType = file.type;
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF." },
      { status: 415 }
    );
  }

  // 4. Validate file size
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 413 });
  }

  // 5. Build storage key + verify ownership + persist in DB
  const safeEmail = sanitizeEmail(userEmail);
  const timestamp = Date.now();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json({ error: "R2 bucket not configured." }, { status: 500 });
  }

  if (uploadType === "backtest") {
    let storageKey: string;

    if (tradeId === "temp") {
      // Temporary upload — no trade exists yet. Upload to R2 under a temp path,
      // no DB row. The client stores the storageKey and passes it at form submit.
      storageKey = `${safeEmail}/backtests/temp/${timestamp}.png`;
    } else {
      // Verify the trade belongs to this user and fetch backtestId in one query
      const trade = await prisma.backtestTrade.findFirst({
        where: { id: tradeId, backtest: { userId } },
        select: { id: true, backtestId: true },
      });
      if (!trade) {
        return NextResponse.json({ error: "Trade not found." }, { status: 404 });
      }
      storageKey = `${safeEmail}/backtests/${trade.backtestId}/${tradeId}_${timestamp}.png`;
    }

    try {
      const r2 = getR2Client();
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.byteLength,
        })
      );
    } catch (err) {
      console.error("[upload] R2 PutObject failed:", err);
      return NextResponse.json({ error: "Upload to storage failed." }, { status: 502 });
    }

    const publicUrl = getPublicUrl(storageKey);

    if (tradeId === "temp") {
      // Return storageKey so the client can pass it to the server action at submit
      return NextResponse.json(
        { id: null, url: publicUrl, storageKey, filename: file.name || null, mimeType, sizeBytes: buffer.byteLength },
        { status: 201 }
      );
    }

    const media = await prisma.backtestTradeMedia.create({
      data: {
        tradeId,
        url: publicUrl,
        storageKey,
        filename: file.name || null,
        mimeType,
        sizeBytes: buffer.byteLength,
      },
      select: { id: true, url: true, storageKey: true, filename: true, mimeType: true, sizeBytes: true },
    });

    return NextResponse.json(media, { status: 201 });
  }

  // uploadType === "journal"
  let journalStorageKey: string;

  if (tradeId === "temp") {
    // Temporary upload — trade doesn't exist yet. Upload to R2, no DB row.
    journalStorageKey = `${safeEmail}/trades/temp/${timestamp}.png`;
  } else {
    // Verify the trade belongs to this user
    const liveTrade = await prisma.trade.findFirst({
      where: { id: tradeId, userId },
      select: { id: true },
    });
    if (!liveTrade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }
    journalStorageKey = `${safeEmail}/trades/${tradeId}_${timestamp}.png`;
  }

  // <sanitized_email>/trades/<tradeId>_<timestamp>.png
  const storageKey = journalStorageKey;

  try {
    const r2 = getR2Client();
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.byteLength,
      })
    );
  } catch (err) {
    console.error("[upload] R2 PutObject failed:", err);
    return NextResponse.json({ error: "Upload to storage failed." }, { status: 502 });
  }

  const publicUrl = getPublicUrl(storageKey);

  if (tradeId === "temp") {
    // No DB row — return storageKey for the client to pass at form submit
    return NextResponse.json(
      { id: null, url: publicUrl, storageKey, filename: file.name || null, mimeType, sizeBytes: buffer.byteLength },
      { status: 201 }
    );
  }

  const media = await prisma.screenshot.create({
    data: {
      tradeId,
      url: publicUrl,
      storageKey,
      filename: file.name || null,
      mimeType,
      sizeBytes: buffer.byteLength,
    },
    select: { id: true, url: true, storageKey: true, filename: true, mimeType: true, sizeBytes: true },
  });

  return NextResponse.json(media, { status: 201 });
}

// ─── DELETE /api/upload?mediaId=<id>&type=backtest|journal ───────────────────
// Deletes the DB record AND the R2 object.
// The R2 key is read from the DB record (storageKey field) — never reconstructed.

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse params from query
  const mediaId = req.nextUrl.searchParams.get("mediaId");
  const deleteType = req.nextUrl.searchParams.get("type") ?? "backtest";

  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId." }, { status: 400 });
  }
  if (deleteType !== "backtest" && deleteType !== "journal") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  const bucket = process.env.R2_BUCKET_NAME;

  if (deleteType === "backtest") {
    // 3. Load record + ownership check (via backtest → user)
    const media = await prisma.backtestTradeMedia.findFirst({
      where: { id: mediaId, trade: { backtest: { userId } } },
      select: { id: true, storageKey: true },
    });
    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    // 4. Delete from R2
    if (bucket) {
      try {
        const r2 = getR2Client();
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storageKey }));
      } catch (err) {
        console.error("[upload] R2 DeleteObject failed:", err);
      }
    }

    // 5. Delete DB record
    await prisma.backtestTradeMedia.delete({ where: { id: media.id } });
    return new NextResponse(null, { status: 204 });
  }

  // deleteType === "journal"
  const media = await prisma.screenshot.findFirst({
    where: { id: mediaId, trade: { userId } },
    select: { id: true, storageKey: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (bucket) {
    try {
      const r2 = getR2Client();
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storageKey ?? "" }));
    } catch (err) {
      console.error("[upload] R2 DeleteObject failed:", err);
    }
  }

  await prisma.screenshot.delete({ where: { id: media.id } });
  return new NextResponse(null, { status: 204 });
}
