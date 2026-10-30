import httpStatus from "http-status";
import mongoose from "mongoose";
import { escapeRegex, parseSearchTerms } from "../../builder";
import { AppError } from "../../errors";
import User from "../user/user.model";
import { adminLogService } from "../admin/admin-log.service";
import CategoryRequest, {
  TCategoryRequestStatus,
} from "./category-request.model";
import type { ICategory } from "./category.interface";
import { categoryService } from "./category.service";

type TRequestInput = {
  name?: string;
  description?: string;
};

type TDecisionInput = {
  status: "approved" | "declined";
  declineReason?: string;
};

/**
 * A member's own ask. `email` is read loosely because the token payload type
 * keeps it optional even though `auth` has proven a user is signed in.
 */
type TRequester = {
  email?: string;
};

// Two people may ask for the same name, so the id is what an admin acts on and
// a malformed one is a bad request rather than a driver error.
const findRequest = async (id: string) => {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid request id");
  }

  // The document itself, not a lean copy: the rest of this file reads and
  // rewrites it, and this model carries no find hook that could hide a state.
  const request = await CategoryRequest.findById(id);

  if (!request) {
    throw new AppError(httpStatus.NOT_FOUND, "Category request not found");
  }

  return request;
};

const requestCategory = async (payload: TRequestInput, user: TRequester) => {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
  }

  if (!user.email) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
  }

  const email = user.email.toLowerCase();
  const nameKey = name.toLowerCase();

  if (await categoryService.findByName(name)) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  // Asking twice is the member's own mistake and gets a clear answer. Another
  // member asking for the same name is fine, so the check names the asker.
  const mine = await CategoryRequest.findOne({
    requestedByEmail: email,
    nameKey,
    status: "pending",
  });
  if (mine) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already asked for this category",
    );
  }

  const member = await User.findOne({ email }).select("_id");
  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const request = await CategoryRequest.create({
    name,
    nameKey,
    description:
      typeof payload.description === "string" ? payload.description.trim() : "",
    status: "pending",
    requestedBy: member._id,
    requestedByEmail: email,
  });

  // No activity log line here: the log records what an admin did, and this is
  // a member waiting to hear back.
  return {
    _id: request._id,
    name: request.name,
    description: request.description,
    status: request.status,
    createdAt: request.createdAt,
  };
};

const getApprovedForMember = async (email?: string) => {
  if (!email) return [];

  const requests = await CategoryRequest.find({
    requestedByEmail: email.toLowerCase(),
    status: "approved",
  })
    .select("_id name status category")
    .sort({ createdAt: -1 })
    .lean();

  return requests;
};

// Lowercased names of the asks still waiting, for the composer to offer while a
// member writes a draft. Plain strings, since a name is what the writer types.
const pendingRequestNamesFor = async (email?: string) => {
  if (!email) return new Set<string>();

  const requests = await CategoryRequest.find({
    requestedByEmail: email.toLowerCase(),
    status: "pending",
  })
    .select("name")
    .lean();

  return new Set(requests.map((request) => request.name.trim().toLowerCase()));
};

// The pending request a writer means when they name a category instead of
// pointing at one, or null when they have not asked for that name.
const findPendingRequestFor = async (
  email: string | undefined,
  name: string,
) => {
  if (!email) return null;

  const nameKey = name.trim().toLowerCase();
  if (!nameKey) return null;

  return CategoryRequest.findOne({
    requestedByEmail: email.toLowerCase(),
    nameKey,
    status: "pending",
  });
};

const getRequestList = async (query: Record<string, unknown> = {}) => {
  const status = (query.status || "pending") as TCategoryRequestStatus;

  // Whitelisted and escaped: a term reaches Mongo as a regex body only, never
  // as the pattern it arrived as.
  const terms = parseSearchTerms(query.searchTerm);
  const search = terms.length
    ? {
        $and: terms.map((term) => {
          const escaped = escapeRegex(term);
          return {
            nameKey: {
              $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
            },
          };
        }),
      }
    : {};

  const rows = await CategoryRequest.find({ status, ...search })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  // Paging is opt-in, like the category table: a small queue comes back whole
  // and `total` stays the number of matching requests.
  const rawPage = Math.trunc(Number(query.page));
  const rawLimit = Math.trunc(Number(query.limit));
  const total = rows.length;

  if (!(rawPage > 0) && !(rawLimit > 0)) {
    return { result: rows, total };
  }

  const page = Math.max(1, rawPage || 1);
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 50;
  const start = (page - 1) * limit;

  return {
    result: rows.slice(start, start + limit),
    total,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const decideRequest = async (
  id: string,
  payload: TDecisionInput,
  adminEmail?: string,
) => {
  const request = await findRequest(id);

  if (request.status !== "pending") {
    throw new AppError(
      httpStatus.CONFLICT,
      "This request was already reviewed",
    );
  }

  const admin = adminEmail
    ? await User.findOne({ email: adminEmail }).select("_id")
    : null;

  let categoryId: mongoose.Types.ObjectId | null = null;

  if (payload.status === "approved") {
    // A concurrent approval or a manual create may have made the live category
    // already, in which case the request joins it instead of colliding.
    const existing = await categoryService.findByName(request.name);
    const category =
      existing ??
      (await categoryService.create(
        // The service reads only these two fields; the rest of ICategory is
        // filled in by the model.
        { name: request.name, description: request.description } as ICategory,
        adminEmail,
      ));

    categoryId =
      category._id instanceof mongoose.Types.ObjectId
        ? category._id
        : new mongoose.Types.ObjectId(String(category._id));
  }

  const updated = await CategoryRequest.findByIdAndUpdate(
    request._id,
    {
      status: payload.status,
      category: categoryId,
      // A reason for an approval is dropped: nothing was declined. An unset key
      // leaves the stored value untouched (mongoose drops undefined paths).
      ...(payload.status === "declined"
        ? { declineReason: payload.declineReason?.trim() }
        : {}),
      reviewedBy: admin?._id ?? null,
      reviewedByEmail: adminEmail?.toLowerCase(),
      reviewedAt: new Date(),
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, "Category request not found");
  }

  const approved = payload.status === "approved";

  await adminLogService.record({
    adminEmail,
    action: approved ? "category.request.approve" : "category.request.decline",
    targetType: "category_request",
    targetId: String(updated._id),
    summary: `${approved ? "Approved" : "Declined"} category request "${updated.name}"`,
  });

  return updated;
};

// Exported for the blog service; it is the one place that decides whether a
// name may stand in for a category on a draft.
export const categoryRequestService = {
  requestCategory,
  getApprovedForMember,
  getRequestList,
  decideRequest,
  pendingRequestNamesFor,
  findPendingRequestFor,
};
