import httpStatus from "http-status";
import mongoose from "mongoose";
import { QueryBuilder } from "../../builder";
import AppError from "../../errors/AppError";
import { adminLogService } from "../admin/admin-log.service";
import NewsletterSubscriber from "./newsletter.model";
import {
  NEWSLETTER_SOURCES,
  NEWSLETTER_SUBSCRIBER_STATUSES,
  type TNewsletterSource,
  type TNewsletterSubscriberStatus,
} from "./newsletter.interface";
import { normalizeEmail } from "./newsletter.tokens";
import { subscriberService } from "./newsletter-subscriber.service";

/** Fields the list may be sorted by. Anything else is a 400. */
const SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "status",
  "source",
  "consentAt",
  "unsubscribedAt",
] as const;

/**
 * The list screen. Every query key is whitelisted before it reaches Mongo, for
 * the same reason the contact inbox does it: `QueryBuilder.filter()` splices
 * raw keys into the filter.
 */
const getAll = async (query: Record<string, unknown>) => {
  const parsed: Record<string, unknown> = {};

  if (typeof query.searchTerm === "string" && query.searchTerm.trim())
    parsed.searchTerm = query.searchTerm;
  if (typeof query.page === "string" && query.page) parsed.page = query.page;
  if (typeof query.limit === "string" && query.limit)
    parsed.limit = query.limit;
  if (typeof query.fields === "string" && query.fields)
    parsed.fields = query.fields;

  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  }

  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status && status !== "all") {
    if (
      !NEWSLETTER_SUBSCRIBER_STATUSES.includes(
        status as TNewsletterSubscriberStatus,
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Status must be one of ${NEWSLETTER_SUBSCRIBER_STATUSES.join(", ")}`,
      );
    }
    parsed.status = status;
  }

  const source = typeof query.source === "string" ? query.source.trim() : "";
  if (source && source !== "all") {
    if (!NEWSLETTER_SOURCES.includes(source as TNewsletterSource)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Source must be one of ${NEWSLETTER_SOURCES.join(", ")}`,
      );
    }
    parsed.source = source;
  }

  const listQuery = new QueryBuilder(
    NewsletterSubscriber.find({}),
    parsed,
  ).search(["name", "email"], ["status", "source"]);

  await listQuery.filter();

  if (!parsed.sort) listQuery.sortBy("-createdAt,-_id");
  else listQuery.sort();

  listQuery.paginate().fields();

  const [result, meta, counts] = await Promise.all([
    listQuery.modelQuery,
    listQuery.countTotal(),
    getCounts(),
  ]);

  return { result, meta, counts };
};

const getCounts = async () => {
  const grouped = await NewsletterSubscriber.aggregate<{
    _id: TNewsletterSubscriberStatus;
    count: number;
  }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

  const counts = {
    active: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    total: 0,
  };

  for (const row of grouped) {
    if (row._id in counts) counts[row._id] = row.count;
    counts.total += row.count;
  }

  return counts;
};

/**
 * Admin add. It is a deliberate override of the public form, not a back door
 * around the suppression rules: a bounced or complaining address is refused
 * here as well, because mailing it again is what damages the sending domain.
 */
const create = async (
  input: { name: string; email: string; sendWelcome: boolean },
  adminEmail?: string,
) => {
  const key = normalizeEmail(input.email);
  const existing = await NewsletterSubscriber.findOne({ emailKey: key });

  if (existing?.status === "active") {
    throw new AppError(
      httpStatus.CONFLICT,
      "That address is already on the list.",
    );
  }

  if (existing?.status === "bounced" || existing?.status === "complained") {
    throw new AppError(
      httpStatus.CONFLICT,
      "That address is suppressed. Mail to it is being refused.",
    );
  }

  const record =
    existing ??
    new NewsletterSubscriber({
      name: input.name.trim(),
      email: input.email.trim(),
      emailKey: key,
      consentAt: new Date(),
    });

  record.name = input.name.trim();
  record.email = input.email.trim();
  record.status = "active";
  record.source = "admin";
  record.consentAt = new Date();
  record.unsubscribedAt = null;
  await record.save();

  if (input.sendWelcome) {
    await subscriberService.sendWelcomeById(String(record._id));
  }
  await adminLogService.record({
    adminEmail,
    action: "newsletter.add",
    targetType: "newsletter",
    targetId: String(record._id),
    summary: `Added ${record.email} to the newsletter`,
  });

  return record;
};

/**
 * The CSV. Safe columns only: no internal ids and no tokens, so a downloaded
 * file cannot be used to act on someone's subscription.
 *
 * Values are quoted and an address that begins with `=`, `+`, `-` or `@` is
 * prefixed with an apostrophe: a spreadsheet reads those four as the start of
 * a formula, and a signup form is an open door for one.
 */
const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const toCsv = async () => {
  const rows = await NewsletterSubscriber.find({})
    .select("name email status source consentAt unsubscribedAt createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const header = [
    "Name",
    "Email",
    "Status",
    "Source",
    "Joined",
    "Unsubscribed",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.email,
        row.status,
        row.source,
        row.consentAt ? new Date(row.consentAt).toISOString() : "",
        row.unsubscribedAt ? new Date(row.unsubscribedAt).toISOString() : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // The BOM makes Excel read the file as UTF-8, so a name with an accent is
  // not mangled on a reader's machine.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
};

const getSingle = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid subscriber id");
  }

  const subscriber = await NewsletterSubscriber.findById(id);
  if (!subscriber) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscriber not found");
  }

  return subscriber;
};

export const subscriberAdminService = {
  getAll,
  getCounts,
  create,
  toCsv,
  getSingle,
};
