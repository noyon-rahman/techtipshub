"use client";

import { Button } from "@heroui/react";
import { FcGoogle } from "react-icons/fc";

/**
 * Third-party sign-in. Rendered as a full-width labelled button so the option
 * is readable, not a cryptic icon tile.
 *
 * The link goes to this site's own relay, which sends the browser to the API
 * and on to Google. The session comes back as cookies, so nothing here has to
 * wait for a response.
 */
const SocialLogin = () => {
  return (
    <div>
      <div className="flex items-center gap-3 tth-label-sm text-default-600">
        <span className="h-px flex-1 bg-default/60" aria-hidden />
        or
        <span className="h-px flex-1 bg-default/60" aria-hidden />
      </div>

      <div className="mt-5">
        <Button
          as="a"
          href="/api/auth/google"
          fullWidth
          radius="lg"
          variant="bordered"
          className="border border-default-300 font-medium text-foreground hover:bg-default-100"
          startContent={<FcGoogle aria-hidden size={18} />}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
};

export default SocialLogin;
