"use client";

import { newsletterSignupSchema } from "@/schemas";
import { joinNewsletterAction } from "@/services/newsletter/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import Link from "next/link";
import { useId, useState } from "react";
import { FieldValues, FormProvider, useForm } from "react-hook-form";
import { BiCheckCircle, BiErrorCircle } from "react-icons/bi";

type TStatus = { type: "success" | "error"; message: string } | null;

interface IProps {
  /**
   * `stack` puts the fields one per row for a narrow column (the feed rail);
   * `inline` puts the name, address and button on one line where there is
   * room (the footer and the end of an article).
   */
  layout?: "stack" | "inline";
  /** A heading over the form. The rail and the article block carry one. */
  title?: string;
  /** One line under the heading, for what this list actually is. */
  description?: string;
  className?: string;
}

const fieldClass =
  "h-11 w-full rounded-[6px] border border-default-200 bg-background px-3 text-sm text-foreground transition-colors placeholder:text-default-600 hover:border-default-300 focus:border-default-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70";

const errorOf = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

/**
 * The newsletter signup.
 *
 * A first name and an address, and one plain line saying what happens next.
 * The line links to the privacy policy in place of a consent checkbox: the
 * consent is the act of pressing join, and a checkbox would only add a step
 * between a reader and a form that already says what it will do.
 *
 * The name is asked for because the roundup greets people by it; it is not
 * used for anything else, and the copy does not claim it is.
 */
const NewsletterSignup = ({
  layout = "inline",
  title,
  description,
  className = "",
}: IProps) => {
  const methods = useForm({
    resolver: zodResolver(newsletterSignupSchema),
    defaultValues: { name: "", email: "" },
  });
  const {
    register,
    reset,
    formState: { errors, isSubmitting },
  } = methods;
  const id = useId();
  const [status, setStatus] = useState<TStatus>(null);

  const onSubmit = methods.handleSubmit(async (values: FieldValues) => {
    setStatus(null);

    const result = await joinNewsletterAction({
      name: String(values.name ?? ""),
      email: String(values.email ?? ""),
    });

    if (result.success) reset();

    setStatus({
      type: result.success ? "success" : "error",
      message:
        result.message ||
        (result.success ? "You're on the list." : "Please try again."),
    });
  });

  const nameError = errorOf(errors.name?.message);
  const emailError = errorOf(errors.email?.message);
  const stacked = layout === "stack";

  return (
    <div className={className}>
      {title && (
        <h2
          id={`${id}-heading`}
          className="font-[family-name:var(--type-editorial)] text-lg font-semibold leading-tight tracking-[-0.01em]"
        >
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-default-600">
          {description}
        </p>
      )}

      <FormProvider {...methods}>
        <form
          onSubmit={onSubmit}
          noValidate
          aria-labelledby={title ? `${id}-heading` : undefined}
          aria-label={title ? undefined : "Subscribe to the newsletter"}
          className={title || description ? "mt-4" : ""}
        >
          <div
            className={`grid gap-2 ${stacked ? "" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"}`}
          >
            <div className="min-w-0">
              <label htmlFor={`${id}-name`} className="sr-only">
                First name
              </label>
              <input
                id={`${id}-name`}
                {...register("name")}
                type="text"
                autoComplete="given-name"
                placeholder="First name"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? `${id}-name-error` : undefined}
                className={fieldClass}
              />
              {nameError && (
                <p id={`${id}-name-error`} className="mt-1 text-xs text-danger">
                  {nameError}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor={`${id}-email`} className="sr-only">
                Email
              </label>
              <input
                id={`${id}-email`}
                {...register("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? `${id}-email-error` : undefined}
                className={fieldClass}
              />
              {emailError && (
                <p
                  id={`${id}-email-error`}
                  className="mt-1 text-xs text-danger"
                >
                  {emailError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              color="primary"
              radius="lg"
              isLoading={isSubmitting}
              isDisabled={isSubmitting}
              className="h-11 min-w-0 font-semibold"
            >
              {isSubmitting ? "Joining…" : "Join the list"}
            </Button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-default-600">
            We&apos;ll email you new articles. Unsubscribe any time.{" "}
            <Link
              href="/privacy"
              className="text-primary-accessible underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
            >
              Privacy
            </Link>
          </p>

          {status && (
            <p
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                status.type === "success"
                  ? "border-success/40 bg-success/10 text-foreground"
                  : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {status.type === "success" ? (
                <BiCheckCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <BiErrorCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              {status.message}
            </p>
          )}
        </form>
      </FormProvider>
    </div>
  );
};

export default NewsletterSignup;
