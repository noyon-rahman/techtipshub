"use client";

import THInput from "@/components/form/th-input";
import { InputProps } from "@heroui/react";
import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

interface IProps extends Omit<InputProps, "type" | "name"> {
  name: string;
}

/**
 * A password field with a show/hide button.
 *
 * The button is passed to the input as `endContent`, so it sits inside the
 * element that draws the border and is centred by that element's own flex row.
 * Nothing here measures pixels against a label: a hand-placed offset drifted
 * off the field whenever the label's height or the card width changed.
 *
 * `className` is the control's class, applied at least 44px tall. HeroUI sizes
 * the field with a fixed height, which would clip a 44px button, so the height
 * is reset here rather than left to the size the form picked.
 */
const PasswordInput = ({ name, className, classNames, ...props }: IProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <THInput
      {...props}
      name={name}
      type={visible ? "text" : "password"}
      radius="lg"
      variant="bordered"
      autoComplete="current-password"
      classNames={{
        ...classNames,
        inputWrapper: `h-auto min-h-11 ${classNames?.inputWrapper ?? ""}`,
        input: `pr-2 ${classNames?.input ?? ""}`,
      }}
      className={className}
      endContent={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="tth-password-toggle grid size-11 shrink-0 cursor-pointer place-items-center rounded-md text-default-600 transition-colors outline-solid outline-transparent hover:text-foreground"
        >
          {visible ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
        </button>
      }
    />
  );
};

export default PasswordInput;
