"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImagePlus, X, Loader2, AlertCircle, ZoomIn } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedMedia {
  id: string | null; // null for temp uploads (not yet persisted in DB)
  url: string;
  storageKey?: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface PendingItem {
  /** unique key for React list */
  key: string;
  /** local object URL for immediate preview */
  previewUrl: string;
  file: File;
  progress: number; // 0-100
  error: string | null;
}

interface MediaUploadProps {
  tradeId: string;
  /** Whether this trade belongs to a backtest or the live journal */
  type?: "backtest" | "journal";
  /** Pre-existing media (e.g. when editing a trade) */
  initialMedia?: UploadedMedia[];
  /** Called whenever the saved media list changes */
  onChange?: (media: UploadedMedia[]) => void;
  /** Called whenever a temp upload completes (tradeId="temp"), giving the parent storageKey+url */
  onTempUploaded?: (media: UploadedMedia[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_EXT_LABEL = "PNG · JPG · WebP · GIF";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return `Unsupported type "${file.type}". Allowed: ${ALLOWED_EXT_LABEL}.`;
  }
  if (file.size > MAX_BYTES) {
    return `File too large (${formatBytes(file.size)}). Maximum: 10 MB.`;
  }
  return null;
}

// ─── Thumbnail (saved image) ──────────────────────────────────────────────────

interface ThumbnailProps {
  media: UploadedMedia;
  onDeleteType: "backtest" | "journal";
  onDelete: (id: string) => void;
}

function SavedThumbnail({ media, onDeleteType, onDelete }: ThumbnailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirmDelete() {
    setIsPending(true);
    try {
      const res = await fetch(`/api/upload?mediaId=${media.id}&type=${onDeleteType}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      onDelete(media.id);
    } catch {
      // keep dialog open so user can retry
    } finally {
      setIsPending(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div
        className="group relative overflow-hidden rounded-lg"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "rgba(255,255,255,0.02)",
          aspectRatio: "16/10",
        }}
      >
        {/* Thumbnail image */}
        <img
          src={media.url}
          alt={media.filename ?? "Screenshot"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
            aria-label="View full size"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-red-500/30"
            style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}
            aria-label="Delete screenshot"
          >
            <X size={14} />
          </button>
        </div>

        {/* Filename tooltip */}
        {media.filename && (
          <div
            className="absolute bottom-0 left-0 right-0 truncate px-2 py-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
            style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "var(--text-secondary)" }}
          >
            {media.filename}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <img
            src={media.url}
            alt={media.filename ?? "Screenshot"}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            style={{ boxShadow: "0 8px 64px rgba(0,0,0,0.8)" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete screenshot?"
        description="This will permanently remove the image from storage. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ─── Pending thumbnail (uploading / error) ────────────────────────────────────

function PendingThumbnail({
  item,
  onDismiss,
}: {
  item: PendingItem;
  onDismiss: (key: string) => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        border: `1px solid ${item.error ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
        backgroundColor: "rgba(255,255,255,0.02)",
        aspectRatio: "16/10",
      }}
    >
      {/* Preview image */}
      <img
        src={item.previewUrl}
        alt="Uploading…"
        className="h-full w-full object-cover"
        style={{ opacity: item.error ? 0.3 : 0.6 }}
      />

      {/* Progress overlay */}
      {!item.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: "var(--accent-primary)" }}
          />
          <div
            className="h-1 w-3/4 overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${item.progress}%`,
                backgroundColor: "var(--accent-primary)",
              }}
            />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {item.error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2"
          style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
        >
          <AlertCircle size={16} color="#f87171" />
          <p className="text-center text-[10px] leading-tight" style={{ color: "#f87171" }}>
            {item.error}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(item.key)}
            className="text-[10px] underline"
            style={{ color: "var(--text-muted)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dismiss button (top-right) for errors */}
      {item.error && (
        <button
          type="button"
          onClick={() => onDismiss(item.key)}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#f87171" }}
          aria-label="Dismiss error"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MediaUpload({ tradeId, type = "backtest", initialMedia = [], onChange, onTempUploaded }: MediaUploadProps) {
  const [savedMedia, setSavedMedia] = useState<UploadedMedia[]>(initialMedia);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Notify parent of changes
  useEffect(() => {
    onChange?.(savedMedia);
  }, [savedMedia, onChange]);

  // ── Upload a single File ───────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      const key = `${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);

      if (validationError) {
        setPending((prev) => [
          ...prev,
          { key, previewUrl, file, progress: 0, error: validationError },
        ]);
        return;
      }

      // Add optimistic pending entry
      setPending((prev) => [
        ...prev,
        { key, previewUrl, file, progress: 0, error: null },
      ]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("tradeId", tradeId);
      formData.append("type", type);

      // Simulate early progress while the XHR is in flight
      let fakeProgress = 0;
      const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + 12, 85);
        setPending((prev) =>
          prev.map((p) => (p.key === key ? { ...p, progress: fakeProgress } : p))
        );
      }, 200);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        clearInterval(progressInterval);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        // Complete progress bar briefly before removing
        setPending((prev) =>
          prev.map((p) => (p.key === key ? { ...p, progress: 100 } : p))
        );

        const media = (await res.json()) as UploadedMedia;

        // Short delay so the 100% bar is visible
        await new Promise((r) => setTimeout(r, 350));

        setSavedMedia((prev) => {
          const next = [...prev, media];
          if (tradeId === "temp") onTempUploaded?.(next);
          return next;
        });
        setPending((prev) => prev.filter((p) => p.key !== key));
        URL.revokeObjectURL(previewUrl);
      } catch (err) {
        clearInterval(progressInterval);
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setPending((prev) =>
          prev.map((p) => (p.key === key ? { ...p, progress: 0, error: message } : p))
        );
      }
    },
    [tradeId, type, onTempUploaded]
  );

  // ── Process a FileList ─────────────────────────────────────────────────────

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((f) => uploadFile(f));
    },
    [uploadFile]
  );

  // ── Paste handler (Ctrl+V) ─────────────────────────────────────────────────

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && ALLOWED_MIME.includes(item.type)) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length > 0) processFiles(imageFiles);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [processFiles]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    // Only fire when leaving the drop zone entirely (not children)
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }

  // ── File input change ──────────────────────────────────────────────────────

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ""; // allow re-uploading same file
    }
  }

  // ── Delete saved media ─────────────────────────────────────────────────────

  function onDeleteSaved(id: string) {
    setSavedMedia((prev) => prev.filter((m) => m.id !== id));
  }

  function onDismissPending(key: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  const hasItems = savedMedia.length > 0 || pending.length > 0;
  const isUploading = pending.some((p) => !p.error);

  return (
    <div className="space-y-2">
      {/* ── Thumbnail grid ── */}
      {hasItems && (
        <div className="grid grid-cols-3 gap-2">
          {savedMedia.map((m) => (
            <SavedThumbnail key={m.id} media={m} onDeleteType={type} onDelete={onDeleteSaved} />
          ))}
          {pending.map((p) => (
            <PendingThumbnail key={p.key} item={p} onDismiss={onDismissPending} />
          ))}
        </div>
      )}

      {/* ── Drop zone ── */}
      <div
        ref={dropZoneRef}
        role="button"
        tabIndex={0}
        aria-label="Upload screenshots — drag and drop, paste from clipboard, or click to browse"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-4 py-5 text-center transition-all duration-200"
        style={{
          border: `1.5px dashed ${isDragOver ? "var(--accent-primary)" : "var(--border)"}`,
          backgroundColor: isDragOver
            ? "rgba(255,214,0,0.06)"
            : "rgba(255,255,255,0.01)",
          outline: "none",
        }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: isDragOver
              ? "rgba(255,214,0,0.15)"
              : "rgba(255,255,255,0.04)",
            color: isDragOver ? "var(--accent-primary)" : "var(--text-muted)",
            transition: "background-color 0.2s, color 0.2s",
          }}
        >
          {isUploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ImagePlus size={16} />
          )}
        </span>

        <div>
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {isDragOver
              ? "Drop to upload"
              : "Drag & drop, paste (Ctrl+V) or click to browse"}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {ALLOWED_EXT_LABEL} · Max 10 MB
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={onInputChange}
        aria-hidden="true"
      />
    </div>
  );
}
