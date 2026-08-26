"use client";

/**
 * Patient documents: upload, list, download, delete. Bytes go straight from
 * the browser into the private `patient-documents` bucket — no server hop —
 * under Storage RLS that pins every object beneath the caller's uid folder
 * (migration 0009). The `documents` table row is the listable metadata.
 *
 * Object path: `<user_id>/<patient_id>/<uuid>-<sanitized-name>`. The first
 * segment is what the Storage policy checks, so a clinician can only ever
 * touch their own files.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { PatientDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";

const BUCKET = "patient-documents";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB — clinical PDFs/scans, not media

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Keep the extension; make the rest filesystem-safe for the object key. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function PatientDocuments({
  patientId,
  userId,
  documents,
}: {
  patientId: string;
  userId: string;
  documents: PatientDocument[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("File too large", "Documents must be 25 MB or smaller.");
      return;
    }

    setBusy(true);
    const path = `${userId}/${patientId}/${crypto.randomUUID()}-${safeName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      setBusy(false);
      toast.error("Upload failed", uploadError.message);
      return;
    }

    const { error: rowError } = await supabase.from("documents").insert({
      user_id: userId,
      patient_id: patientId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
    });

    setBusy(false);
    if (rowError) {
      // Metadata insert failed — don't leave an orphaned object behind.
      await supabase.storage.from(BUCKET).remove([path]);
      toast.error("Upload failed", rowError.message);
      return;
    }

    toast.success("Document uploaded", file.name);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function handleDownload(doc: PatientDocument) {
    setDownloading(doc.id);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    setDownloading(null);
    if (error || !data) {
      toast.error("Could not open document", error?.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(doc: PatientDocument) {
    setRemoving(doc.id);
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.storage_path]);
    if (storageError) {
      setRemoving(null);
      toast.error("Delete failed", storageError.message);
      return;
    }
    const { error: rowError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    setRemoving(null);
    if (rowError) {
      toast.error("Delete failed", rowError.message);
      return;
    }
    toast.success("Document removed", doc.file_name);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Documents
        </h2>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}
          Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center rounded-md border border-dashed border-border bg-card px-6 py-8 text-center transition-colors hover:border-foreground/25"
        >
          <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-foreground">
            <Upload className="size-5" />
          </div>
          <p className="font-medium">Add intake forms, referrals, or scans</p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDFs, images, or documents up to 25 MB. Encrypted at rest and
            visible only to you.
          </p>
        </button>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[formatBytes(doc.size_bytes), dateFmt.format(new Date(doc.created_at))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
                aria-label={`Download ${doc.file_name}`}
              >
                {downloading === doc.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(doc)}
                disabled={removing === doc.id}
                aria-label={`Delete ${doc.file_name}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {removing === doc.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Trash2 />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
