import type { TErrorSources } from "../interface/error";

/**
 * The shape of every error body.
 *
 * `message` is the sentence a person reads. `code` is a short, stable token
 * for code that has to branch on a failure (it is optional because many
 * failures are best described by their HTTP status alone). `details` lists
 * one entry per field that failed, which is what a form puts next to its
 * inputs.
 */
export type TErrorDetails = TErrorSources;

export type TErrorBody = {
  error: {
    message: string;
    code?: string;
    details?: TErrorDetails;
  };
};

type TErrorInput = {
  message: string;
  code?: string;
  details?: TErrorDetails;
};

const errorBody = ({ message, code, details }: TErrorInput): TErrorBody => {
  const error: TErrorBody["error"] = { message };

  if (code) error.code = code;
  if (details && details.length > 0) error.details = details;

  return { error };
};

export default errorBody;
