"use client";

import type { IUser } from "@/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProfileEditForm from "./profile-edit-form";

/**
 * The signed-in member's profile page, with editing on it.
 *
 * The page renders this keyed by the profile's `updatedAt`, so a save (which
 * asks for a fresh server render) remounts every form field with the values the
 * API now holds - no second copy of the profile to keep in step.
 *
 * The staged photo lives here because the form can be closed without saving,
 * and an abandoned file must never ride along with a later save.
 */
const ProfileOwnPage = ({ user }: { user: Partial<IUser> }) => {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  // Only a save can clear the stored photo, so removing one is a pending edit.
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const saved = () => {
    setSelectedImage(null);
    setPhotoRemoved(false);
    // The header, the avatar and the details all come from the server render.
    router.refresh();
  };

  return (
    <ProfileEditForm
      user={user}
      selectedImage={selectedImage}
      photoRemoved={photoRemoved}
      onSelectImage={setSelectedImage}
      onRemoveExisting={(mode) => {
        if (mode === "discard") setPhotoRemoved(false);
        else setPhotoRemoved(true);
      }}
      onSaved={saved}
    />
  );
};

export default ProfileOwnPage;
