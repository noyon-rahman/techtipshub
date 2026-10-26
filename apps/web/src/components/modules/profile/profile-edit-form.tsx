"use client";

import THForm from "@/components/form/th-from";
import THGenderSelect from "@/components/form/th-gender-select";
import THInput from "@/components/form/th-input";
import THTextarea from "@/components/form/th-textarea";
import ProfileEditFrame from "@/components/modules/profile/profile-edit-frame";
import ProfileCard from "@/components/modules/settings/profile-card";
import ProfileFormSection from "@/components/modules/profile/profile-form-section";
import { useUpdateProfile, useUpdateSocialLinks } from "@/hooks/user.hook";
import { IUser, TSocialPlatform } from "@/types";
import { FieldValues, SubmitHandler } from "react-hook-form";
import { useState } from "react";
import { FiEdit3 } from "react-icons/fi";
import { BsTwitterX } from "react-icons/bs";
import {
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
} from "react-icons/fa";

/** The networks the API stores, in the order they are asked for. */
const socialFields = [
  {
    key: "linkedin",
    platform: "Linkedin",
    label: "LinkedIn",
    hint: "linkedin.com/in/…",
    placeholder: "https://linkedin.com/in/username",
    icon: <FaLinkedin aria-hidden className="size-4" />,
  },
  {
    key: "github",
    platform: "Github",
    label: "GitHub",
    hint: "github.com/…",
    placeholder: "https://github.com/username",
    icon: <FaGithub aria-hidden className="size-4" />,
  },
  {
    key: "instagram",
    platform: "Instagram",
    label: "Instagram",
    hint: "instagram.com/…",
    placeholder: "https://instagram.com/username",
    icon: <FaInstagram aria-hidden className="size-4" />,
  },
  {
    key: "twitter",
    platform: "Twitter",
    label: "X / Twitter",
    hint: "x.com/…",
    placeholder: "https://x.com/username",
    icon: <BsTwitterX aria-hidden className="size-4" />,
  },
  {
    key: "facebook",
    platform: "Facebook",
    label: "Facebook",
    hint: "facebook.com/…",
    placeholder: "https://facebook.com/username",
    icon: <FaFacebook aria-hidden className="size-4" />,
  },
  {
    key: "youtube",
    platform: "Youtube",
    label: "YouTube",
    hint: "youtube.com/@…",
    placeholder: "https://youtube.com/@username",
    icon: <FaYoutube aria-hidden className="size-4" />,
  },
] as const;

const fieldLabel = "mb-1 block tth-label-sm text-default-600";
const MAX_BIO = 280;

/** The photo the preview should show: a newly picked one wins. */
const previewPicture = (
  selected: File | null,
  removed: boolean,
  saved?: string,
) => {
  if (selected || removed) return undefined;
  return saved;
};

const ProfileEditForm = ({
  user,
  selectedImage,
  photoRemoved,
  onSelectImage,
  onRemoveExisting,
  onSaved,
}: {
  user: Partial<IUser>;
  selectedImage: File | null;
  photoRemoved: boolean;
  onSelectImage: (file: File | null) => void;
  /** `"discard"` puts the stored photo back without touching the server. */
  onRemoveExisting: (mode?: "discard") => void;
  onSaved: () => void;
}) => {
  const profileMutation = useUpdateProfile();
  const linksMutation = useUpdateSocialLinks();
  const isPending = profileMutation.isPending || linksMutation.isPending;

  const {
    fullName,
    username,
    designation,
    location,
    phone,
    bio,
    gender,
    dateOfBirth,
    profilePicture,
    socialLinks,
  } = user;

  const links = Array.isArray(socialLinks) ? socialLinks : [];
  const savedValue = (platform: TSocialPlatform) =>
    links.find((link) => link?.platform === platform)?.url || "";

  const savedCount = socialFields.filter((field) =>
    savedValue(field.platform),
  ).length;

  const [lastError, setLastError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const defaultValues = {
    fullName,
    username,
    designation,
    location,
    phone,
    bio,
    gender,
    dateOfBirth: dateOfBirth ? dateOfBirth.slice(0, 10) : "",
    ...Object.fromEntries(
      socialFields.map((field) => [field.key, savedValue(field.platform)]),
    ),
  };

  const onSubmit: SubmitHandler<FieldValues> = (values) => {
    const payload = { ...values };

    // The link fields are saved by their own request, not with the profile.
    for (const field of socialFields) delete payload[field.key];

    // An untouched field is left out rather than sent empty: the API validates
    // whatever it receives, and "" is not a gender or a date.
    if (!payload.username) delete payload.username;
    if (!payload.gender) delete payload.gender;
    if (!payload.dateOfBirth) delete payload.dateOfBirth;
    // An empty profilePicture is the only signal the API clears a stored photo.
    if (photoRemoved && !selectedImage) payload.profilePicture = "";

    const formData = new FormData();
    formData.append("data", JSON.stringify(payload));
    // The photo is part of the same save. Sending it only when one was picked
    // keeps the stored image untouched otherwise.
    if (selectedImage) formData.append("image", selectedImage);

    const updatedLinks = socialFields
      .map((field) => ({
        platform: field.platform as TSocialPlatform,
        // A pasted value often arrives with stray spaces; trim before saving.
        url: String(values[field.key] ?? "").trim(),
      }))
      .filter((link) => link.url);

    // One save, two endpoints: the photo and the details go together, and the
    // links follow. The editor stays open on a failure so the typed values are
    // not thrown away; a success closes it and refreshes the page behind.
    setLastError(null);
    profileMutation.mutate(formData, {
      onSuccess: (data) => {
        if (!data?.success) {
          setLastError(data?.message || "Your profile was not saved.");
          return;
        }

        linksMutation.mutate(
          { socialLinks: updatedLinks },
          {
            onSuccess: (linksData) => {
              if (!linksData?.success) {
                setLastError(
                  linksData?.message ||
                    "Your profile was saved, but the links were not.",
                );
                return;
              }
              // The server render behind this form is stale now; the page asks
              // for it again and closes the editor.
              onSaved();
            },
            onError: () => {
              setLastError(
                "Your profile was saved, but the links were not. Save again to retry them.",
              );
            },
            // A stale server render (a username change, say) must not survive
            // the save that caused it, even when the links request failed.
            onSettled: () => onSaved(),
          },
        );
      },
      onError: (error) => {
        setLastError(
          error?.message ||
            "Your profile was not saved. Check your connection and try again.",
        );
      },
    });
  };

  const open = () => {
    setLastError(null);
    setActive(true);
  };

  const cancel = () => {
    setLastError(null);
    setActive(false);
    // Drop the staged photo too: an abandoned edit must not leave a file
    // waiting to be uploaded by the next save.
    if (selectedImage) onSelectImage(null);
    if (photoRemoved) onRemoveExisting("discard");
  };

  if (!active) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-default/60 pt-5">
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
        >
          <FiEdit3 aria-hidden className="size-4" />
          Edit profile
        </button>
        <span className="text-xs text-default-600">
          Name, photo, bio and links — edited right here.
        </span>
      </div>
    );
  }

  return (
    <ProfileEditFrame
      isOpen={active}
      isPending={isPending}
      filePending={Boolean(selectedImage) || photoRemoved}
      hint="Changes appear on your public profile and on your articles right away."
      onCancel={cancel}
    >
      <THForm onSubmit={onSubmit} defaultValues={defaultValues}>
        <div className="space-y-6">
          {lastError && (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-foreground"
            >
              {lastError}
            </div>
          )}
          <ProfileFormSection
            id="identity"
            title="Identity"
            description="How you look on your profile, articles and comments."
          >
            <ProfileCard
              fullName={fullName}
              designation={designation}
              location={location}
              bio={bio}
              username={username}
              savedPicture={previewPicture(
                selectedImage,
                photoRemoved,
                profilePicture,
              )}
              selectedImage={selectedImage}
              onSelectImage={onSelectImage}
              onRemoveExisting={onRemoveExisting}
            />
          </ProfileFormSection>

          <ProfileFormSection
            id="details"
            title="Public details"
            description="What readers see on your profile. A few fields stay private to your account."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="fullName" className={fieldLabel}>
                  Full name
                </label>
                <THInput
                  name="fullName"
                  variant="bordered"
                  placeholder="Your name"
                  radius="lg"
                  id="fullName"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="username" className={fieldLabel}>
                  Username
                </label>
                <THInput
                  name="username"
                  variant="bordered"
                  placeholder="your-handle"
                  radius="lg"
                  id="username"
                  isRequired
                  maxLength={30}
                  autoComplete="username"
                  description="Your profile address: /profile/@your-handle"
                />
              </div>
              <div>
                <label htmlFor="designation" className={fieldLabel}>
                  Designation
                </label>
                <THInput
                  name="designation"
                  variant="bordered"
                  placeholder="e.g. Full-stack developer"
                  radius="lg"
                  id="designation"
                />
              </div>
              <div>
                <label htmlFor="location" className={fieldLabel}>
                  Location
                </label>
                <THInput
                  name="location"
                  variant="bordered"
                  placeholder="City, country"
                  radius="lg"
                  id="location"
                />
              </div>
              <div>
                <label htmlFor="gender" className={fieldLabel}>
                  Gender
                </label>
                <THGenderSelect name="gender" id="gender" aria-label="Gender" />
              </div>
              <div>
                <label htmlFor="dateOfBirth" className={fieldLabel}>
                  Date of birth
                </label>
                <THInput
                  name="dateOfBirth"
                  type="date"
                  variant="bordered"
                  radius="lg"
                  id="dateOfBirth"
                  description="Private. Never shown on your profile."
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="phone" className={fieldLabel}>
                  Phone
                </label>
                <THInput
                  name="phone"
                  variant="bordered"
                  placeholder="Never shown publicly"
                  radius="lg"
                  id="phone"
                  description="For account recovery only. Readers never see it."
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="bio">
                  Bio
                </label>
                <THTextarea
                  name="bio"
                  variant="bordered"
                  placeholder="A short introduction: what you work on, what you write about."
                  radius="lg"
                  id="bio"
                  maxLength={MAX_BIO}
                  description={`A sentence or two reads best. ${MAX_BIO} characters max.`}
                />
              </div>
            </div>
          </ProfileFormSection>

          <ProfileFormSection
            id="social-links"
            title="Social profiles"
            description="Linked from your profile header. Leave a field empty to drop that link."
            action={
              <span className="text-xs tabular-nums text-default-600">
                {savedCount} of {socialFields.length} linked
              </span>
            }
          >
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {socialFields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={field.key}
                    className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-default-600"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="text-default-600">
                        {field.icon}
                      </span>
                      {field.label}
                    </span>
                    <span className="font-normal text-default-600">
                      {field.hint}
                    </span>
                  </label>
                  <THInput
                    name={field.key}
                    variant="bordered"
                    placeholder={field.placeholder}
                    radius="lg"
                    id={field.key}
                    type="url"
                    classNames={{ inputWrapper: "h-10" }}
                  />
                </div>
              ))}
            </div>
          </ProfileFormSection>
        </div>
      </THForm>
    </ProfileEditFrame>
  );
};

export default ProfileEditForm;
