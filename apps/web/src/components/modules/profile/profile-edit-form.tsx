"use client";

import THForm from "@/components/form/th-from";
import THGenderSelect from "@/components/form/th-gender-select";
import THInput from "@/components/form/th-input";
import THTextarea from "@/components/form/th-textarea";
import ProfileEditFrame from "@/components/modules/profile/profile-edit-frame";
import ProfileCard from "@/components/modules/settings/profile-card";
import ProfileFormSection from "@/components/modules/profile/profile-form-section";
import NewsletterSwitch from "@/components/modules/newsletter/newsletter-switch";
import InterestSettings from "@/components/modules/reader/interest-settings";
import TopicsSummary from "@/components/modules/profile/topics-summary";
import UsernameField from "@/components/modules/profile/username-field";
import { useUpdateProfile, useUpdateSocialLinks } from "@/hooks/user.hook";
import { IUser, TSocialPlatform } from "@/types";
import { FieldValues, SubmitHandler, useWatch } from "react-hook-form";
import { ReactNode, useEffect, useState } from "react";
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

/** The count sits under the bio so the limit is felt while typing, not after a failed save. */
const BioCharacterCount = ({ max }: { max: number }) => {
  const bio = useWatch({ name: "bio" });
  const count = typeof bio === "string" ? bio.length : 0;

  return (
    <span className="tabular-nums">
      A sentence or two reads best. {count} / {max} characters.
    </span>
  );
};

/** The photo the preview should show: a newly picked one wins. */
const previewPicture = (
  selected: File | null,
  removed: boolean,
  saved?: string,
) => {
  if (selected || removed) return undefined;
  return saved;
};

/**
 * A secondary action inside a settings row: bordered, 6px, clear of the
 * primary amber. Same in every row so the column of controls lines up.
 */
export const settingsButton =
  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[6px] border border-default-300 px-3 text-sm font-medium transition-colors hover:border-default-400 hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300";

/**
 * One setting line: what it is on the left, the control that changes it on the
 * right.
 *
 * The form's own settings and the ones on the profile must line up, so the row
 * is defined once here and reused rather than styled again where it appears.
 */
const SettingsRow = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
    <div className="min-w-0">
      <p className="tth-label">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-default-600">
        {description}
      </p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

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

    // The handle saves itself (`UsernameField`), so this request never carries
    // one, even if an old value is still in the form state.
    delete payload.username;

    // An untouched field is left out rather than sent empty: the API validates
    // whatever it receives, and "" is not a gender or a date.
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

  // The band's button opens the editor on the picker. It is called in the same
  // click, so the editor is already rendering when the frame below runs.
  const openTopics = () => {
    open();

    window.requestAnimationFrame(() =>
      document
        .getElementById("topics")
        ?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };

  // A link from elsewhere on the site (`/profile#topics`) names the
  // section it means. Opened on its own, the editor never shows that section,
  // so the fragment has to open the editor and land on it.
  //
  // The editor grows in this same render, so its card cannot be measured yet;
  // the scroll waits a frame and then goes smoothly, so it reads as travelling
  // to the section rather than as a jump down a page that just got taller.
  useEffect(() => {
    if (!window.location.hash) return;

    setActive(true);

    const target = () =>
      document
        .getElementById(decodeURIComponent(window.location.hash.slice(1)))
        ?.scrollIntoView({ block: "start", behavior: "smooth" });

    const frame = window.requestAnimationFrame(target);

    return () => window.cancelAnimationFrame(frame);
  }, []);

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
      // The settings that do not need the editor: who they are, what their feed
      // leads with, and the one email we send. They share one band and one
      // hairline between rows, so the page reads as a short list of settings
      // rather than a stack of bands with a stray rule above the first.
      <div
        className="mt-8 border-t border-default/60"
        aria-labelledby="account-settings"
      >
        <h2
          id="account-settings"
          className="mt-5 text-sm font-semibold tracking-tight"
        >
          Account
        </h2>

        <SettingsRow
          title="Profile details"
          description="Your name, photo, bio and links."
        >
          <button type="button" onClick={open} className={settingsButton}>
            <FiEdit3 aria-hidden className="size-4" />
            Edit profile
          </button>
        </SettingsRow>

        {/* What the feed leads with belongs on the profile, not behind the
            editor: a reader should be able to see their answer, and change it
            from the same place. */}
        <div className="border-t border-default/60">
          <TopicsSummary onEdit={openTopics} />
        </div>

        {/* The newsletter is a setting with one switch, not a field to edit. A
            member who wants to stop the email is looking for exactly this, and
            should not have to open a form to press it. */}
        <div
          id="newsletter-setting"
          className="scroll-mt-24 border-t border-default/60"
        >
          <NewsletterSwitch />
        </div>
      </div>
    );
  }

  return (
    <>
      <THForm onSubmit={onSubmit} defaultValues={defaultValues}>
        <ProfileEditFrame
          isOpen={active}
          isPending={isPending}
          filePending={Boolean(selectedImage) || photoRemoved}
          hint="Changes appear on your public profile and on your articles right away. The username saves on its own."
          onCancel={cancel}
        >
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
                <UsernameField username={username} disabled={isPending} />
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
                  <THGenderSelect
                    name="gender"
                    id="gender"
                    aria-label="Gender"
                  />
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
                    description={<BioCharacterCount max={MAX_BIO} />}
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

            <ProfileFormSection
              id="topics"
              title="Topics"
              description="What the feed puts first. Change them any time."
              className="scroll-mt-24"
            >
              <InterestSettings />
            </ProfileFormSection>
          </div>
        </ProfileEditFrame>
      </THForm>
    </>
  );
};

export default ProfileEditForm;
