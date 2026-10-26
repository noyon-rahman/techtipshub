"use client";

import { useUser } from "@/context/user.provider";
import { button as buttonStyles } from "@heroui/react";
import { FiLogIn } from "react-icons/fi";
import NextLink from "next/link";
import NavarDropdown from "./navbar-dropdown";

/**
 * Who is using the site, in the header.
 *
 * Signed out, the bar offers one way in, and only one: "Sign in" opens the
 * login screen, which links on to signing up, so a phone is never asked to
 * choose between two buttons that both lead to an account. From `sm` the full
 * pair is shown, because there is room to say what each is for.
 */
const LoginLogoutSwitch = () => {
  const { user } = useUser();

  if (user) return <NavarDropdown />;

  return (
    <>
      <NextLink
        aria-label="Sign in"
        className={`${buttonStyles({
          radius: "full",
          variant: "bordered",
          size: "sm",
        })} font-medium duration-200 active:scale-95 sm:hidden`}
        href="/login"
      >
        <FiLogIn aria-hidden className="size-4" />
        <span className="ml-1.5">Sign in</span>
      </NextLink>

      <div className="hidden items-center gap-1 sm:flex">
        <NextLink
          className={`${buttonStyles({
            radius: "full",
            variant: "light",
            size: "sm",
          })} font-medium duration-200 hover:bg-default-100 active:scale-95`}
          href="/login"
        >
          Log in
        </NextLink>
        <NextLink
          className={`${buttonStyles({
            color: "primary",
            radius: "full",
            variant: "solid",
            size: "sm",
          })} font-medium duration-200 active:scale-95`}
          href="/signup"
        >
          Sign up
        </NextLink>
      </div>
    </>
  );
};

export default LoginLogoutSwitch;
