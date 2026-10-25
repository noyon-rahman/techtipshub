import httpStatus from "http-status";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { JsonWebTokenError } from "jsonwebtoken";
import { ZodError } from "zod";
import config from "../config";
import {
  AppError,
  handleMongooseCastError,
  handleMongooseDuplicateIdError,
  handleMongooseValidationError,
  handleZodError,
} from "../errors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import mongoose from "mongoose";
import type { TAppBindings } from "../interface/bindings";
import type { TErrorDetails } from "../utils/errorBody";
import errorBody from "../utils/errorBody";

/**
 * The one place a failure becomes a response.
 *
 * Every route answers `{ error: { message, code?, details? } }` with the HTTP
 * status that actually describes what happened, so a caller never has to read
 * a body to learn whether the request worked.
 *
 * A detail list is only attached when the failure is about specific fields
 * (validation, a duplicate key); a missing article or a bad token says it in
 * `message` and needs no list.
 */
const onError: ErrorHandler<TAppBindings> = (error, c) => {
  try {
    const failure = describe(error);

    if (failure.status >= 500 && config.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.error(error);
    }

    return c.json(
      errorBody({
        message: failure.message,
        code: failure.code,
        details: failure.details,
      }),
      failure.status as ContentfulStatusCode,
    );
  } catch {
    // A body that cannot be built (a circular detail, a broken getter) must
    // still answer, or the request would hang.
    return c.json(errorBody({ message: "Internal Server Error" }), 500);
  }
};

type TFailure = {
  status: number;
  message: string;
  code?: string;
  details?: TErrorDetails;
};

const describe = (error: unknown): TFailure => {
  if (error instanceof ZodError) {
    const simplified = handleZodError(error);

    return {
      status: simplified.statusCode,
      message: "The request did not pass validation.",
      code: "VALIDATION_ERROR",
      details: simplified.errorSources,
    };
  }

  const named = error as { name?: string; code?: string | number } | null;

  if (named?.name === "ValidationError") {
    const simplified = handleMongooseValidationError(
      error as mongoose.Error.ValidationError,
    );

    return {
      status: simplified.statusCode,
      message: simplified.message,
      code: "VALIDATION_ERROR",
      details: simplified.errorSources,
    };
  }

  if (named?.name === "CastError") {
    const simplified = handleMongooseCastError(
      error as mongoose.Error.CastError,
    );

    return {
      status: simplified?.statusCode ?? httpStatus.BAD_REQUEST,
      message: simplified?.message ?? "Invalid identifier",
      code: "INVALID_ID",
    };
  }

  if (named?.code === 11000) {
    const simplified = handleMongooseDuplicateIdError(
      error as Parameters<typeof handleMongooseDuplicateIdError>[0],
    );

    return {
      status: simplified.statusCode,
      message: simplified.message,
      code: "DUPLICATE_ENTRY",
      details: simplified.errorSources,
    };
  }

  if (error instanceof JsonWebTokenError) {
    return {
      status: httpStatus.UNAUTHORIZED,
      message:
        error.name === "TokenExpiredError"
          ? "Your session has expired. Sign in again."
          : "The token is not valid.",
      code: "UNAUTHORIZED",
    };
  }

  // Writes that keep two documents in step run in a Mongo transaction, so they
  // need a replica set. A deployment on a standalone server fails here rather
  // than halfway through, and the message says why.
  if (
    named?.name === "MongoServerError" &&
    /sessions are not supported|Transaction numbers/i.test(
      (error as Error)?.message ?? "",
    )
  ) {
    return {
      status: httpStatus.SERVICE_UNAVAILABLE,
      message:
        "This action needs a database that supports transactions, and the connected one does not.",
      code: "TRANSACTIONS_UNAVAILABLE",
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      message: error.message,
    };
  }

  if (error instanceof HTTPException) {
    return {
      status: error.status,
      message: error.message || "The request could not be completed.",
    };
  }

  if (error instanceof Error) {
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      message:
        config.NODE_ENV === "production"
          ? "Something went wrong."
          : error.message,
    };
  }

  return {
    status: httpStatus.INTERNAL_SERVER_ERROR,
    message: "Something went wrong.",
  };
};

/**
 * A request that matched no route. Mounted as `app.notFound`, so it answers in
 * the same shape as a handler that threw.
 */
export const notFound: NotFoundHandler<TAppBindings> = (c) =>
  c.json(errorBody({ message: "Not Found" }), httpStatus.NOT_FOUND);

export default onError;
