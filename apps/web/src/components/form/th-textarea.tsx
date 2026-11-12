"use client";

import { Textarea, TextAreaProps } from "@heroui/react";
import { useFormContext } from "react-hook-form";

interface IProps extends TextAreaProps {
  name: string;
}

const THTextarea: React.FC<IProps> = ({ name, ...props }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const errorMessage = errors[name]?.message as string | undefined;

  // Registration goes last, exactly as in `THInput`. HeroUI's Textarea does not
  // pass its `onChange` prop down to the `<textarea>` it renders: it listens
  // through React Aria's `useTextField` and chains only that handler. So a
  // caller's own `onChange` (which is what `register` supplies) silently wins
  // whenever it is spread after, and react-hook-form never sees a keystroke.
  return (
    <Textarea
      errorMessage={errorMessage || ""}
      isInvalid={!!errors[name]}
      {...props}
      {...register(name)}
    />
  );
};

export default THTextarea;
