"use client";

/**
 * Profile avatar: shows a custom photo if the clinician uploaded one, otherwise
 * their chosen Rorschach inkblot. Tapping the picture opens a crop/zoom adjuster
 * (WhatsApp/Instagram style); choosing a new file routes through the same
 * adjuster before it's saved. Controls also let them pick a different inkblot or
 * remove the photo. All writes go under RLS; photos live in the private
 * `avatars` bucket.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImageUp, Loader2, Shuffle, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { AVATARS, Avatar } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { AvatarCropper } from "@/components/profile/AvatarCropper";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function ProfileAvatar({
  userId,
  avatarId,
  avatarPath,
  photoUrl,
}: {
  userId: string;
  avatarId: string | null;
  /** Raw storage path of the custom photo (for deletion), or null. */
  avatarPath: string | null;
  /** Signed URL to render the custom photo, or null. */
  photoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const objUrl = useRef<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Revoke any object URL still held when the component goes away.
  useEffect(
    () => () => {
      if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    },
    [],
  );

  function openCropper(url: string) {
    if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    objUrl.current = url;
    setCropSrc(url);
  }

  function closeCropper() {
    if (objUrl.current) {
      URL.revokeObjectURL(objUrl.current);
      objUrl.current = null;
    }
    setCropSrc(null);
  }

  async function removeOldPhoto() {
    if (avatarPath) await supabase.storage.from(BUCKET).remove([avatarPath]);
  }

  /** A newly-chosen file → validate, then hand it to the adjuster. */
  function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Not an image", "Please choose a PNG, JPG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", "Photos must be 5 MB or smaller.");
      return;
    }
    openCropper(URL.createObjectURL(file));
  }

  /** Tapping the picture: re-adjust the current photo, or pick one if none. */
  async function handleAvatarClick() {
    if (busy) return;
    if (!photoUrl) {
      inputRef.current?.click();
      return;
    }
    try {
      // Fetch to a blob so the cropper works on a same-origin URL (a
      // cross-origin <img> would taint the canvas on save).
      const res = await fetch(photoUrl);
      openCropper(URL.createObjectURL(await res.blob()));
    } catch {
      toast.error("Couldn't open the photo", "Try replacing it instead.");
    }
  }

  /** Persist the cropped square the adjuster produced. */
  async function uploadBlob(blob: Blob) {
    setBusy(true);
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      setBusy(false);
      toast.error("Upload failed", upErr.message);
      return;
    }
    const { error: rowErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      setBusy(false);
      toast.error("Upload failed", rowErr.message);
      return;
    }
    await removeOldPhoto();
    setBusy(false);
    closeCropper();
    toast.success("Profile photo updated");
    router.refresh();
  }

  async function handleRemovePhoto() {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error("Could not remove photo", error.message);
      return;
    }
    await removeOldPhoto();
    toast.success("Photo removed", "Back to your inkblot.");
    router.refresh();
  }

  async function chooseInkblot(id: string) {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_id: id, avatar_url: null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error("Could not update avatar", error.message);
      return;
    }
    await removeOldPhoto();
    setPicker(false);
    toast.success("Inkblot updated");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={busy}
          aria-label={photoUrl ? "Adjust profile photo" : "Add a profile photo"}
          className="group relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-sm border border-border/80 bg-muted/40 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Profile" className="size-full object-cover" />
          ) : (
            <Avatar id={avatarId} className="size-full" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-all duration-200 group-hover:bg-foreground/35 group-hover:opacity-100 group-focus-visible:bg-foreground/35 group-focus-visible:opacity-100">
            <Camera className="size-4 text-white" />
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs rounded-sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <ImageUp className="size-3" />}
            {photoUrl ? "Replace" : "Upload"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs rounded-sm"
            onClick={() => setPicker((p) => !p)}
            disabled={busy}
          >
            <Shuffle className="size-3" />
            Inkblot
          </Button>
          {photoUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRemovePhoto}
              disabled={busy}
            >
              <Trash2 className="size-3" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {picker && (
        <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {AVATARS.map((a) => {
            const selected = !photoUrl && a.id === avatarId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => chooseInkblot(a.id)}
                disabled={busy}
                aria-label={`Inkblot ${a.id}`}
                aria-pressed={selected}
                className={`relative size-10 shrink-0 rounded-sm border outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border/60 opacity-80 hover:opacity-100"
                }`}
              >
                <Avatar id={a.id} className="size-full" />
                {selected && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                    <Check className="size-2" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {cropSrc && (
        <AvatarCropper src={cropSrc} onCancel={closeCropper} onSave={uploadBlob} />
      )}
    </div>
  );
}
