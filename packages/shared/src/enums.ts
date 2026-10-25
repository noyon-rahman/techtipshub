/**
 * Values the API stores and the site has to agree on.
 *
 * Declared once here so a role, a status or a content type cannot drift
 * between the service that writes it and the interface that renders it.
 */

export const USER_ROLES = {
  ADMIN: "Admin",
  USER: "User",
} as const;

export type TUserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_STATUSES = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
} as const;

export type TUserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export type TUserGender = "Male" | "Female" | "Other";

export type TSocialPlatform =
  | "Facebook"
  | "Instagram"
  | "Linkedin"
  | "Twitter"
  | "Github"
  | "Youtube";

export type TSocialLink = {
  platform: TSocialPlatform;
  url: string;
};

/**
 * How an article body is stored. `contentType` is stored on the document, so
 * this list is the API's contract, not a preference of the renderer.
 */
export type TContentType = "html" | "markdown" | "text";
