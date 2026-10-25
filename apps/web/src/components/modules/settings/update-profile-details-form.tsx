"use client";

import { manageBlogsPath } from "@/lib/blog-routes";


import THForm from "@/components/form/th-from";
import THGenderSelect from "@/components/form/th-gender-select";
import THInput from "@/components/form/th-input";
import THTextarea from "@/components/form/th-textarea";
import Loading from "@/components/loading";
import ProfileCard from "@/components/modules/settings/profile-card";
import SettingsSaveBar from "@/components/modules/settings/settings-save-bar";
import SettingsSection from "@/components/modules/settings/settings-section";
import { useUpdateProfile } from "@/hooks/user.hook";
import { IUser } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldValues, SubmitHandler } from "react-hook-form";
import { HiOutlineArrowRight } from "react-icons/hi2";

interface IProps extends Partial<IUser> {
  /** Total articles, shown in the photo card's context line. */
  articleCount?: number;
}

const fieldLabel =
  "mb-1 block tth-label-sm text-default-600";

const MAX_BIO = 280;

const UpdateProfileDetailsForm = ({
  fullName,
  username,
  designation,
  location,
  phone,
  bio,
  gender,
  dateOfBirth,
  profilePicture,
  articleCount,
}: IProps) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  // Only a save can clear the stored photo, so removing one is a pending edit.
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const router = useRouter();

  const onSubmit: SubmitHandler<FieldValues> = (values) => {
    const formData = new FormData();
    const payload = { ...values };

    // An untouched field is left out rather than sent empty: the API validates
    // whatever it receives, and "" is not a gender or a date.
    if (!payload.username) delete payload.username;
    if (!payload.gender) delete payload.gender;
    if (!payload.dateOfBirth) delete payload.dateOfBirth;
    // An empty profilePicture is the only signal the API clears a stored photo.
    if (photoRemoved && !selectedImage) payload.profilePicture = "";

    formData.append("data", JSON.stringify(payload));

    // The photo is part of the same save. Sending it only when one was picked
    // keeps the stored image untouched otherwise.
    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    updateProfile(formData, {
      onSuccess: (data) => {
        // Start a clean state only once the server accepted the change.
        if (data?.success) {
          setSelectedImage(null);
          setPhotoRemoved(false);
          // The avatar and the public-profile link come from the server, so
          // the saved photo and handle need a fresh render to show up.
          router.refresh();
        }
      },
    });
  };

  return (
    <>
      {isPending && <Loading />}
      <THForm
        onSubmit={onSubmit}
        defaultValues={{
          fullName,
          username,
          designation,
          location,
          phone,
          bio,
          gender,
          dateOfBirth: dateOfBirth ? dateOfBirth.slice(0, 10) : "",
        }}
      >
        <div className="space-y-6">
          <SettingsSection
            id="identity"
            title="Identity"
            description="How you look on your profile, articles and comments."
            action={
              username ? (
                <Link
                  href={`/profile/@${username}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-accessible underline-offset-4 hover:underline"
                >
                  View public profile
                  <HiOutlineArrowRight aria-hidden className="size-3.5" />
                </Link>
              ) : undefined
            }
          >
            <ProfileCard
              fullName={fullName}
              designation={designation}
              location={location}
              bio={bio}
              username={username}
              savedPicture={photoRemoved ? undefined : profilePicture}
              selectedImage={selectedImage}
              onSelectImage={setSelectedImage}
              onRemoveExisting={() => {
                setPhotoRemoved(true);
                setSelectedImage(null);
              }}
            />
            {typeof articleCount === "number" && articleCount > 0 && (
              <p className="mt-5 border-t border-default/60 pt-4 text-xs text-default-600">
                Your name and photo appear on{" "}
                <Link
                  href={manageBlogsPath}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {articleCount} published{" "}
                  {articleCount === 1 ? "article" : "articles"}
                </Link>
                .
              </p>
            )}
          </SettingsSection>

          <SettingsSection
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
          </SettingsSection>

          <SettingsSaveBar
            isPending={isPending}
            filePending={Boolean(selectedImage) || photoRemoved}
            hint="Changes appear on your public profile right away."
          >
            Save changes
          </SettingsSaveBar>
        </div>
      </THForm>
    </>
  );
};

export default UpdateProfileDetailsForm;
