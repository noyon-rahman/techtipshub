"use client";

import { TUserGender } from "@/types";
import { Select, SelectItem, SelectProps } from "@heroui/select";
import { Controller, useFormContext } from "react-hook-form";

const GENDER_OPTIONS: TUserGender[] = ["Male", "Female", "Other"];

interface IProps extends Omit<
  SelectProps,
  "selectedKeys" | "onSelectionChange" | "children" | "label"
> {
  name: string;
  label?: string;
  id?: string;
  isDisabled?: boolean;
}

// Select reports a Set of keys instead of a value, so unwrap it to the single
// string the gender field stores.
export default function THGenderSelect({
  name,
  label,
  id,
  isDisabled,
  ...props
}: IProps) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Select
          {...props}
          id={id}
          label={label}
          isDisabled={isDisabled}
          variant="bordered"
          radius="lg"
          classNames={{ popoverContent: "border border-default-100" }}
          selectedKeys={field.value ? [field.value] : []}
          onSelectionChange={(keys) =>
            field.onChange(Array.from(keys as Set<string>)[0] ?? "")
          }
          isInvalid={!!fieldState.error}
          errorMessage={fieldState.error?.message}
        >
          {GENDER_OPTIONS.map((gender) => (
            <SelectItem key={gender} textValue={gender}>
              {gender}
            </SelectItem>
          ))}
        </Select>
      )}
    />
  );
}
