import env, { isEmailConfigured } from "./env";

/**
 * The validated environment, re-exported so callers never touch
 * `process.env`. Keys are the variable names themselves - no second naming
 * scheme to keep in sync.
 */
export { isEmailConfigured };
export default env;
