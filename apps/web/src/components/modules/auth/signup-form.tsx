"use client";

import THDatePicker from "@/components/form/th-date-picker";
import THForm from "@/components/form/th-from";
import THInput from "@/components/form/th-input";
import PasswordInput from "@/components/form/password-input";
import THSelect from "@/components/form/th-select";
import SignupAvatarPicker from "@/components/modules/auth/signup-avatar-picker";
import { useUserRegister } from "@/hooks/auth.hook";
import { safeRedirectPath } from "@/lib/blog-routes";
import { signUpValidationSchema } from "@/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { FieldValues, SubmitHandler } from "react-hook-form";

const options = [
  { key: "Male", label: "Male" },
  { key: "Female", label: "Female" },
  { key: "Other", label: "Other" },
];

const label = "mb-1 block tth-label-sm text-default-600";

const SignUpForm = () => {
  const router = useRouter();
  const {
    mutate: registerUser,
    isPending,
    data,
    isError,
    error,
  } = useUserRegister();

  const onSubmit: SubmitHandler<FieldValues> = (values) => {
    const formData = new FormData();
    const registerData = {
      fullName: values.fullName,
      username: values.username,
      email: values.email,
      password: values.password,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
    };

    formData.append("data", JSON.stringify(registerData));

    if (values.image?.length > 0) {
      formData.append("image", values.image[0]);
    }

    registerUser(formData);
  };

  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (!isPending && data?.success) {
      // Signing up signs nobody in, so this hands the reader to the login page
      // and carries the destination with them: someone who joined to finish an
      // article lands back on that article, not on the feed.
      const loginHref = redirect
        ? `/login?redirect=${encodeURIComponent(safeRedirectPath(redirect))}`
        : "/login";

      router.push(loginHref);
    }
  }, [isPending, data, router, redirect]);

  const errorMessage =
    (data && !data.success && data.message) ||
    (isError ? error?.message : undefined);

  return (
    <Suspense>
      <THForm
        onSubmit={onSubmit}
        resolver={zodResolver(signUpValidationSchema)}
        key={JSON.stringify("default_key")}
      >
        <div className="space-y-4">
          <SignupAvatarPicker />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className={label}>
                Full name
              </label>
              <THInput
                variant="bordered"
                radius="lg"
                name="fullName"
                id="fullName"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="username" className={label}>
                Username
              </label>
              <THInput
                variant="bordered"
                radius="lg"
                name="username"
                id="username"
                placeholder="e.g. noyon"
              />
            </div>

            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <THInput
                variant="bordered"
                radius="lg"
                name="email"
                id="email"
                type="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="password" className={label}>
                Password
              </label>
              <PasswordInput
                name="password"
                id="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className={label}>Gender</label>
              <THSelect
                radius="lg"
                size="md"
                variant="bordered"
                name="gender"
                options={options}
                placeholder="Select gender"
                aria-label="Gender"
              />
            </div>

            <div>
              <label className={label}>Date of birth</label>
              <THDatePicker
                variant="bordered"
                radius="lg"
                name="dateOfBirth"
                aria-label="Date of birth"
              />
            </div>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {errorMessage}
            </p>
          )}

          <Button
            isLoading={isPending}
            type="submit"
            color="primary"
            variant="solid"
            radius="lg"
            className="w-full font-semibold"
          >
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </div>
      </THForm>
    </Suspense>
  );
};

export default SignUpForm;
