"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import { useUpdateMemberProfile } from "@/hooks/admin-members";
import type { IUser } from "@/types";
import {
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  useDisclosure,
} from "@heroui/react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FiEdit3 } from "react-icons/fi";
import { toast } from "sonner";

const quietButton = `inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-default-200 px-3 text-sm font-medium transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`;

const primaryButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

const GENDERS = ["Male", "Female", "Other"] as const;

/** Limits the API applies to a profile photo. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const BIO_LIMIT = 280;

interface IProps {
  member: IUser;
  onSaved?: () => void;
}

/**
 * The admin-side profile editor.
 *
 * The body is multipart and the API validates the JSON strictly, so only the
 * keys it lists are sent, and optional ones only when they hold a value.
 */
const EditMemberProfile = ({ member, onSaved }: IProps) => {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const { mutate: saveProfile, isPending } = useUpdateMemberProfile();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [designation, setDesignation] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [formError, setFormError] = useState("");

  // Every open starts from the record on screen, never from the last edit.
  const open = () => {
    setFullName(member.fullName ?? "");
    setUsername(member.username ?? "");
    setDesignation(member.designation ?? "");
    setLocation(member.location ?? "");
    setPhone(member.phone ?? "");
    setBio(member.bio ?? "");
    setGender(member.gender ?? "");
    setDateOfBirth(member.dateOfBirth ? member.dateOfBirth.slice(0, 10) : "");
    setPhoto(null);
    setPhotoError("");
    setFormError("");
    onOpen();
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setPhoto(null);
      setPhotoError("");
      return;
    }

    if (!PHOTO_TYPES.includes(file.type)) {
      const message = "Choose a PNG, JPEG or WebP image.";
      setPhotoError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      const message = "The photo must be 5 MB or smaller.";
      setPhotoError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    setPhoto(file);
    setPhotoError("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = fullName.trim();
    if (!name) {
      setFormError("A full name is needed.");
      return;
    }

    setFormError("");

    const data: Record<string, string> = {
      fullName: name,
      designation,
      location,
      phone,
      bio,
    };

    if (username.trim()) data.username = username.trim();
    if (gender) data.gender = gender;
    if (dateOfBirth) data.dateOfBirth = dateOfBirth;

    const payload = new FormData();
    payload.append("data", JSON.stringify(data));
    if (photo) payload.append("image", photo);

    saveProfile(
      { id: member._id, payload },
      {
        onSuccess: () => {
          onClose();
          onSaved?.();
        },
      },
    );
  };

  return (
    <>
      <button type="button" onClick={open} className={quietButton}>
        <FiEdit3 aria-hidden className="size-4" />
        Edit profile
      </button>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        radius="lg"
        size="md"
        scrollBehavior="inside"
        isDismissable={!isPending}
        hideCloseButton={isPending}
      >
        <ModalContent>
          {(close) => (
            <form onSubmit={onSubmit} noValidate>
              <ModalHeader className="flex flex-col gap-1 pb-1 pt-5">
                <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  Edit profile
                </span>
                <span className="text-sm font-normal leading-relaxed text-default-600">
                  The name, username and bio appear on the public profile.
                  Every save is recorded in the admin log.
                </span>
              </ModalHeader>

              <ModalBody className="gap-4">
                <Input
                  label="Full name"
                  labelPlacement="outside"
                  placeholder="As it appears on the profile"
                  autoComplete="off"
                  isRequired
                  isDisabled={isPending}
                  isInvalid={!!formError}
                  errorMessage={formError}
                  value={fullName}
                  onValueChange={setFullName}
                />

                <Input
                  label="Username"
                  labelPlacement="outside"
                  placeholder="Lowercase, no spaces"
                  autoComplete="off"
                  maxLength={30}
                  isDisabled={isPending}
                  description="Used in the public profile address."
                  value={username}
                  onValueChange={setUsername}
                />

                <Input
                  label="Designation"
                  labelPlacement="outside"
                  placeholder="Role at work, for example frontend developer"
                  autoComplete="off"
                  isDisabled={isPending}
                  value={designation}
                  onValueChange={setDesignation}
                />

                <Input
                  label="Location"
                  labelPlacement="outside"
                  placeholder="City or country"
                  autoComplete="off"
                  isDisabled={isPending}
                  value={location}
                  onValueChange={setLocation}
                />

                <Input
                  label="Phone"
                  labelPlacement="outside"
                  placeholder="Contact number"
                  type="tel"
                  autoComplete="off"
                  isDisabled={isPending}
                  description="Not shown on the public profile."
                  value={phone}
                  onValueChange={setPhone}
                />

                <Textarea
                  label="Bio"
                  labelPlacement="outside"
                  placeholder="What they work on and what they write about"
                  minRows={3}
                  maxRows={6}
                  maxLength={BIO_LIMIT}
                  isDisabled={isPending}
                  description={`${bio.length} of ${BIO_LIMIT} characters`}
                  value={bio}
                  onValueChange={setBio}
                />

                <Select
                  label="Gender"
                  labelPlacement="outside"
                  placeholder="Not set"
                  isDisabled={isPending}
                  disallowEmptySelection={false}
                  selectedKeys={gender ? [gender] : []}
                  onSelectionChange={(keys) =>
                    setGender(String(Array.from(keys)[0] ?? ""))
                  }
                  description="Optional."
                >
                  {GENDERS.map((option) => (
                    <SelectItem key={option}>{option}</SelectItem>
                  ))}
                </Select>

                <Input
                  label="Date of birth"
                  labelPlacement="outside"
                  type="date"
                  isDisabled={isPending}
                  description="Not shown on the public profile."
                  value={dateOfBirth}
                  onValueChange={setDateOfBirth}
                />

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="member-profile-photo"
                    className="text-sm font-medium text-foreground"
                  >
                    New profile photo
                  </label>
                  <input
                    id="member-profile-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={isPending}
                    onChange={onPhotoChange}
                    className={`block w-full rounded-[6px] border border-default-200 px-3 py-2 text-sm file:mr-3 file:rounded-[6px] file:border-0 file:bg-default-100 file:px-2.5 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-default-200 disabled:opacity-50 ${focusRing}`}
                  />
                  <p
                    className={`text-xs leading-relaxed ${
                      photoError ? "text-danger" : "text-default-600"
                    }`}
                  >
                    {photoError ||
                      "PNG, JPEG or WebP up to 5 MB. Leave it empty to keep the current photo."}
                  </p>
                </div>
              </ModalBody>

              <ModalFooter>
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className={quietButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className={primaryButton}
                >
                  {isPending ? "Saving" : "Save changes"}
                </button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default EditMemberProfile;
