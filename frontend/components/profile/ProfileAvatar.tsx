"use client";

/**
 * Profile avatar: shows a custom photo if the clinician uploaded one, otherwise
 * their chosen Rorschach inkblot. Controls let them upload/replace a photo,
 * remove it (falling back to the inkblot), or pick a different inkblot. All
 * writes go under RLS; photos live in the private `avatars` bucket.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageUp, Loader2, Shuffle, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { AVATARS, Avatar } from "@/lib/avatars";
import { Button } from "@/components/ui/button";

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
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  async function removeOldPhoto() {
    if (avatarPath) await supabase.storage.from(BUCKET).remove([avatarPath]);
  }

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Not an image", "Please choose a PNG, JPG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", "Photos must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
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
    if (inputRef.current) inputRef.current.value = "";
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
    <div>
      <div className="flex items-center gap-5">
        <div className="size-24 overflow-hidden rounded-3xl shadow-sm sm:size-28">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Profile"
              className="size-full object-cover"
            />
          ) : (
            <Avatar id={avatarId} className="size-full" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
            {photoUrl ? "Replace photo" : "Upload photo"}
          </Button>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPicker((p) => !p)}
              disabled={busy}
            >
              <Shuffle />
              Inkblot
            </Button>
            {photoUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemovePhoto}
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {picker && (
        <div className="mt-4 grid grid-cols-5 gap-2.5 sm:grid-cols-10">
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
                className={`relative aspect-square rounded-xl outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "opacity-85 hover:scale-105 hover:opacity-100"
                }`}
              >
                <Avatar id={a.id} className="size-full" />
                {selected && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
