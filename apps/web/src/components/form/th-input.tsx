"use client";

import { Input, InputProps } from "@heroui/react";
import { useFormContext } from "react-hook-form";

interface IProps extends InputProps {
  name: string;
}

const THInput: React.FC<IProps> = ({ name, ...props }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const errorMessage = errors[name]?.message as string | undefined;

  // Registration goes last: it carries the ref react-hook-form reads the value
  // through, so nothing a caller passes can drop it. Callers set `name` through
  // this prop, never again as a spread that could shadow the registration.
  return (
    <Input
      errorMessage={errorMessage || ""}
      isInvalid={!!errors[name]}
      {...props}
      {...register(name)}
    />
  );
};

export default THInput;
