import { ZodError } from "zod";
import { TErrorSources, TGenericErrorResponse } from "../interface/error";

const handleZodError = (error: ZodError): TGenericErrorResponse => {
  const errorSources: TErrorSources = error.issues.map((issue) => {
    // Zod 4 types issue.path as PropertyKey[] (may include symbol), while
    // TErrorSources only allows string | number.
    const path = issue.path as (string | number)[];
    return {
      // The path is relative to the part being validated (`json`, `query`, …),
      // which the route already named, so it is the field name the form needs.
      path: path.join("."),
      message: issue.message,
    };
  });

  const statusCode = 400;
  return {
    statusCode,
    message: "Validation Error",
    errorSources,
  };
};

export default handleZodError;
