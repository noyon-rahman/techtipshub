"use client";

import PasswordInput from "@/components/form/password-input";
import THForm from "@/components/form/th-from";
import { useResetPassword } from "@/hooks/auth.hook";
import { newPasswordValidationSchema } from "@/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { FieldValues, SubmitHandler } from "react-hook-form";
import { FiCheckCircle } from "react-icons/fi";

const label = "mb-1 block tth-label-sm text-default-600";

type TokenState = "reading" | "ready" | "missing";

// The URL is an external store that never notifies us: these two readers only
// have to satisfy `useSyncExternalStore`, which calls them during render (so
// the token is known on the first paint) and again after hydration.
const subscribeToLocation = () => () => {};
const readToken = () => {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get(
    "token",
  );
  // Older emails used a query parameter; accept it once, then tidy the URL.
  const fromQuery = new URLSearchParams(window.location.search).get("token");
  return fromHash || fromQuery || null;
};

const readTokenOnServer = () => null;

/**
 * Collects the reset token from the URL fragment.
 *
 * The link looks like `/reset-password?email=…#token=…`. The fragment is
 * deliberately used for the secret: unlike the query string it is never sent to
 * a server, never appears in access logs, and is not passed in a Referer header
 * to third-party assets on the page.
 */
const useResetToken = () => {
  const token = useSyncExternalStore(
    subscribeToLocation,
    readToken,
    readTokenOnServer,
  );
  // Before hydration there is no location to read, so the first paint is a
  // skeleton rather than a false "this link is missing" message.
  const hydrated = useSyncExternalStore(
    subscribeToLocation,
    () => true,
    () => false,
  );

  if (!hydrated) return { token: null, state: "reading" as TokenState };
  return {
    token,
    state: (token ? "ready" : "missing") as TokenState,
  };
};

const ResetPasswordForm = () => {
  const { token, state } = useResetToken();
  const { mutate, isPending, data, reset } = useResetPassword();

  const errorMessage = data && !data.success ? data.message : undefined;

  // Only one kind of failure leaves the form usable: a password the rule will
  // take, sent down a link that turned out to be spent or expired. Every other
  // refusal names something the form cannot fix from here - the link, the
  // account, the server - so it replaces the form instead of sitting over it.
  const fieldMessage = !errorMessage
    ? undefined
    : data?.errorSources?.find(
        (source: { path: string | number }) => source.path === "newPassword",
      )?.message;

  const rejectedPassword =
    !!fieldMessage &&
    !!errorMessage &&
    fieldMessage === errorMessage;

  const terminal = !!errorMessage && !rejectedPassword;

  // The two refusals whose fix is a fresh email. Everything else that stops the
  // form points at the account or the server, where a new link would not help.
  const linkProblem = !!errorMessage && /reset link/i.test(errorMessage);

  const onSubmit: SubmitHandler<FieldValues> = (values) => {
    if (!token || terminal) return;
    mutate({ newPassword: values.newPassword, token });
  };

  // A legacy link puts the secret in the query string; move it to the fragment
  // once so clicking through the page cannot leak it to another host.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("token");
    if (!fromQuery) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}#token=${fromQuery}`,
    );
  }, []);

  if (state === "reading") {
    return (
      <div className="space-y-3" aria-busy>
        <div className="h-11 animate-pulse rounded-lg bg-default-100" />
        <div className="h-11 animate-pulse rounded-lg bg-default-100" />
        <div className="h-11 animate-pulse rounded-lg bg-default-100" />
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-5">
        <p className="font-medium text-warning-700 dark:text-warning">
          This page needs a reset link
        </p>
        <p className="mt-1 text-sm text-default-600">
          Open the link from the email we sent you, or request a fresh one and
          it will bring you straight back here.
        </p>
        <Button
          as={Link}
          href="/forget-password"
          radius="lg"
          color="primary"
          className="mt-4 font-semibold"
        >
          Request a new link
        </Button>
      </div>
    );
  }

  if (data?.success) {
    return (
      <div
        role="status"
        className="rounded-xl border border-success/30 bg-success/10 p-5"
      >
        <p className="flex items-center gap-2 font-medium text-success">
          <FiCheckCircle aria-hidden />
          Your password is updated
        </p>
        <p className="mt-1 text-sm text-default-600">
          For your security, every other session was signed out. Sign in with
          the new password to continue.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            as={Link}
            href="/login"
            radius="lg"
            color="primary"
            className="font-semibold"
          >
            Sign in
          </Button>
          <Button
            as={Link}
            className="border border-default-300 font-medium text-foreground hover:bg-default-100"
            href="/"
            radius="lg"
            variant="bordered"
          >
            Back to the feed
          </Button>
        </div>
      </div>
    );
  }

  // Every refusal reads the same way: what the API said, and the one action
  // that answers it. The API's sentence is the message, so it is not rewritten.
  if (terminal && errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/30 bg-danger/10 p-5"
      >
        <p className="font-medium text-danger">{errorMessage}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {linkProblem && (
            <Button
              as={Link}
              href="/forget-password"
              radius="lg"
              color="primary"
              className="font-semibold"
              onClick={() => reset()}
            >
              Request a new link
            </Button>
          )}
          <Button
            as={Link}
            href="/login"
            radius="lg"
            variant="bordered"
            className="border border-default-300 font-medium text-foreground hover:bg-default-100"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <THForm
      onSubmit={onSubmit}
      resolver={zodResolver(newPasswordValidationSchema)}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="newPassword" className={label}>
            New password
          </label>
          <PasswordInput
            name="newPassword"
            id="newPassword"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={label}>
            Confirm new password
          </label>
          <PasswordInput
            name="confirmPassword"
            id="confirmPassword"
            placeholder="Type it again"
            autoComplete="new-password"
          />
        </div>

        <p className="text-xs text-default-600">
          Use at least 8 characters. A passphrase you don’t use anywhere else is
          strongest.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {errorMessage}
          </div>
        )}

        <Button
          isLoading={isPending}
          type="submit"
          color="primary"
          radius="lg"
          className="w-full font-semibold"
        >
          {isPending ? "Updating…" : "Set new password"}
        </Button>
      </div>
    </THForm>
  );
};

export default ResetPasswordForm;
