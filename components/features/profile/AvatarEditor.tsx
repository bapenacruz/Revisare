"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarCropModal } from "./AvatarCropModal";
import { Pencil } from "lucide-react";
import { useAvatar } from "@/components/providers/AvatarProvider";

interface Props {
  initial: string;
  initialAvatarUrl: string | null;
}

export function AvatarEditor({ initial, initialAvatarUrl }: Props) {
  const [avatarUrl, setLocalAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [open, setOpen] = useState(false);
  const { setAvatarUrl } = useAvatar();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative group focus:outline-none"
        aria-label="Edit profile picture"
      >
        <Avatar initial={initial} src={avatarUrl} size="xl" />
        {/* Pencil overlay */}
        <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <Pencil
            size={20}
            className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
          />
        </span>
      </button>

      {open && (
        <AvatarCropModal
          onClose={() => setOpen(false)}
          onSaved={(url) => {
            setLocalAvatarUrl(url);
            setAvatarUrl(url);
          }}
        />
      )}
    </>
  );
}
