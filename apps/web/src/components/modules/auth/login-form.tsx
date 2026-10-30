"use client";

import THForm from "@/components/form/th-from";
import THInput from "@/components/form/th-input";
import PasswordInput from "@/components/form/password-input";
import { useUser } from "@/context/user.provider";
import { useUserLogin } from "@/hooks/auth.hook";
import { safeRedirectPath } from "@/lib/blog-routes";
import { googleFailureMessage } from "@/lib/google-auth";
import { signInValidationSchema } from "@/schemas";
import { TLogin } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { FieldValues, SubmitHandler } from "react-hook-form";

const label = "mb-1 block tth-label-sm text-default-600";

const LoginForm = () => {
  const searchParams = useSearchParams();

  const { setIsLoading: setUserLoading } = useUser();
  const {
    mutate: handleLogin,
    isPending,
    data,
    isError,
    error,
  } = useUserLogin();

  const onSubmit: SubmitHandler<FieldValues> = (values) => {
    handleLogin(values as TLogin);
    setUserLoading(true);
  };

  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (!isPending && data?.success) {
      setUserLoading(false);
      // Only same-site paths are followed, so a crafted `?redirect=` cannot
      // send a freshly signed-in member somewhere else.
      //
      // A full load, not `router.push`. The article they were sent back to was
      // rendered before they had a session, and a client-side navigation reuses
      // that document and asks the server who is reading only once hydrated -
      // seconds of the members prompt over an article they are now allowed to
      // read. Requesting it after the session exists means the header, the
      // article and its body are all correct on the first paint.
      window.location.replace(safeRedirectPath(redirect));
    }
  }, [isPending, data, redirect, setUserLoading]);

  // The API returns a message for wrong credentials; surface it rather than
  // leaving the form looking like nothing happened. A Google sign-in that did
  // not finish arrives as `?google=<reason>`, which this page turns into copy.
  const errorMessage =
    googleFailureMessage(
      searchParams.get("google"),
      searchParams.get("error"),
    ) ||
    (data && !data.success && data.message) ||
    (isError ? error?.message : undefined);

  return (
    <Suspense>
      <THForm
        onSubmit={onSubmit}
        resolver={zodResolver(signInValidationSchema)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className={label}>
              Email
            </label>
            <THInput
              variant="bordered"
              radius="lg"
              name="email"
              id="email"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label htmlFor="password" className={`${label} mb-0`}>
                Password
              </label>
              <Link
                href="/forget-password"
                className="text-xs font-medium text-primary-accessible underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              name="password"
              id="password"
              placeholder="Your password"
              autoComplete="current-password"
            />
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
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </THForm>
    </Suspense>
  );
};

const SuspendedLoginForm = () => (
  <Suspense fallback={<div className="h-64" />}>
    <LoginForm />
  </Suspense>
);

export default SuspendedLoginForm;
