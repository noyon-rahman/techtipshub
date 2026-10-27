"use client";

import { Button, ButtonProps, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface IProps extends ButtonProps {
  /**
   * Where to come back to once the reader has signed in, as a path without the
   * leading slash. Left out, it is the page they are on.
   */
  redirect?: string;
  buttonContent: ReactNode;
}

const AuthenticationModal = ({ redirect, buttonContent, ...props }: IProps) => {  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const pathname = usePathname();
  const backTo = redirect ?? pathname.replace(/^\//, "");
  return (
    <>
      <Button onPress={onOpen} {...props} >
        {buttonContent}
      </Button>
      <Modal size="md" isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Authentication Required
              </ModalHeader>
              <ModalBody>
                <p className="text-default-600">
                  You are not currently logged in. Please login first to
                  continue.
                </p>
                <div className="mb-4 mt-2 flex gap-2">
                  <Button
                    as={Link}
                    className="flex-1 font-semibold"
                    color="primary"
                    href={`/signup?redirect=${backTo}`}
                    radius="sm"
                  >
                    Sign up
                  </Button>

                  <Button
                    as={Link}
                    className="flex-1 border border-default-300 font-medium text-foreground hover:bg-default-100"
                    href={`/login?redirect=${backTo}`}
                    radius="sm"
                    variant="bordered"
                  >
                    Log in
                  </Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default AuthenticationModal;
