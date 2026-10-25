import type { JwtPayload } from "jsonwebtoken";
import type { TUserRole } from "../modules/user/user.interface";

/**
 * Values middleware hands to the handler behind it.
 *
 * Hono keeps these on the context rather than on the request object, so a
 * handler reads `c.get("user")` and the type follows from here instead of a
 * global declaration.
 */
export type TAppBindings = {
  Variables: {
    /** The signed-in reader. Not set on routes open to guests. */
    user: JwtPayload & { role: TUserRole };
    /** Body output of `validateRequest`, which has cleaned it. */
    validatedBody: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    /**
     * The object `withUploads` built from a multipart request. It is set
     * beside `validatedBody` because that middleware has already read the
     * form, so a later `validateRequest` would find nothing to parse; it
     * validates this object instead.
     */
    uploadedBody: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    /** Cookie output of `validateRequest`, when its schema reads them. */
    validatedCookies: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
};
