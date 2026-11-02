import httpStatus from "http-status";
import { Types } from "mongoose";
import { escapeRegex, parseSearchTerms } from "../../builder";
import { AppError } from "../../errors";
import type { TPaginationMeta } from "../../utils/sendResponse";
import Category from "../category/category.model";
import User from "../user/user.model";
import { LIVE_ARTICLE } from "./blog.constant";
import { IBlog } from "./blog.interface";
import Blog from "./blog.model";

/**
 * The order the feed is served in, and the only place it is decided.
 *
 * The web app asks for a page and shows it; it never re-sorts. That matters
 * because paging is by offset: every request has to compute the same order, or
 * a card appears twice as the reader scrolls or goes missing between pages.
 * That is why no sort here depends on the exact second it ran, and why each one
 * ends on `_id`.
 *
 * Two orders exist:
 *
 * - **Personalized**, for a signed-in reader with at least one interest that is
 *   still a live category. Articles in those categories come first and the rest
 *   follow, each group in the engagement order below, so the reader's topics
 *   lead without the feed running short.
 * - **Engagement**, for everyone else: a blend of votes, comments, views and
 *   how recently the article went live.
 */

/**
 * The weight of each signal.
 *
 * A vote or a comment costs a reader something and a view costs nothing, so
 * they count for much more. `recency` is added per day since publication over
 * the window below, which is how a new piece reaches the top without the feed
 * turning into a date list. The numbers are a starting point, stated here so
 * they can be changed in one place.
 */
const WEIGHT = {
  upVotes: 4,
  comments: 5,
  views: 0.1,
  downVotes: 3,
  recency: 1.5,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after which an article gains nothing more from being recent. */
const RECENCY_DAYS = 45;

const PUBLISHED_AT = {
  $toDate: { $ifNull: ["$publishedAt", "$createdAt"] },
};

/**
 * The engagement score, as a Mongo expression.
 *
 * Every counter is read through `$ifNull` because an article written before a
 * counter existed has no value for it. `$$NOW` is used as it is: the score only
 * sets the order, and the time between two page requests is far too short to
 * reorder what it lands on. The sort falls through to `_id` for ties.
 */
const engagementScore = () => ({
  $add: [
    { $multiply: [{ $ifNull: ["$upVotes", 0] }, WEIGHT.upVotes] },
    { $multiply: [{ $ifNull: ["$totalComments", 0] }, WEIGHT.comments] },
    { $multiply: [{ $ifNull: ["$totalViews", 0] }, WEIGHT.views] },
    { $multiply: [{ $ifNull: ["$downVotes", 0] }, -WEIGHT.downVotes] },
    {
      $multiply: [
        WEIGHT.recency,
        {
          $max: [
            0,
            {
              $subtract: [
                RECENCY_DAYS,
                {
                  $divide: [{ $subtract: ["$$NOW", PUBLISHED_AT] }, DAY_MS],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const STABLE_TAIL = { _id: -1 } as const;

/**
 * What `sort` means on the feed:
 *
 * - `ranking` (the default): the engagement order, or the personalized one
 *   when the reader is known and has interests. This is what makes a page and
 *   its next page line up.
 * - `newest`: publication order, for the screens that genuinely mean it.
 *
 * Anything else is a 400 rather than a silent fallback.
 */
export const FEED_SORT = ["ranking", "newest"] as const;
export type TFeedSort = (typeof FEED_SORT)[number];

/** One page of the feed, with the reason its order has. */
export interface IFeedPage {
  result: IBlog[];
  meta: TPaginationMeta;
  reason: NonNullable<TPaginationMeta["reason"]>;
}

/**
 * One page of the feed.
 *
 * `interestIds` are the reader's saved interests, already resolved to ids that
 * name a live category. `inputFilter` is the reader's own narrowing (a category
 * page, a search term), applied before the score so paging stays inside it.
 */
export const readFeedPage = async ({
  interestIds = [],
  page = 1,
  limit = 10,
  sort = "ranking",
  inputFilter = {},
}: {
  interestIds?: string[];
  page?: number;
  limit?: number;
  sort?: TFeedSort;
  inputFilter?: Record<string, unknown>;
}): Promise<IFeedPage> => {
  const match = { ...LIVE_ARTICLE, ...inputFilter };
  const personalized = sort === "ranking" && interestIds.length > 0;
  const score = engagementScore();

  const sortSpec: Record<string, 1 | -1> =
    sort === "newest"
      ? { publishedAt: -1, createdAt: -1, ...STABLE_TAIL }
      : personalized
        ? { interestLead: -1, score: -1, ...STABLE_TAIL }
        : { score: -1, ...STABLE_TAIL };

  // Some interests name a category no live article is filed under. Those
  // articles are not on the page, so saying "because you follow it" would be
  // wrong: only the interests with a live article can be the reason.
  const matchedIds = personalized
    ? (
        await Blog.aggregate<{ _id: Types.ObjectId }>([
          {
            $match: {
              ...match,
              category: {
                $in: interestIds.map((id) => new Types.ObjectId(id)),
              },
            },
          },
          { $group: { _id: "$category" } },
        ])
      )
        // ObjectIds, not the strings `distinct` returns: `$in` against a string
        // never matches an ObjectId field inside an aggregation.
        .map((row) => row._id)
    : [];

  const lead = matchedIds.length ? { $in: ["$category", matchedIds] } : null;

  // The total is what a pager needs. `matched` is counted under the same filter
  // and before the skip, and decides whether this page may say it was
  // personalized, since the score order can fill a page past the interest
  // articles.
  const [total, matched] = await Promise.all([
    Blog.countDocuments(match),
    lead ? Blog.countDocuments({ ...match, $expr: lead }) : Promise.resolve(0),
  ]);

  const rows = await Blog.aggregate<IBlog>([
    { $match: match },
    // `1` for an article in one of the reader's topics, sorted first; the rest
    // follow in the engagement order. The name says which way it reads, because
    // a flag and a `-1` are easy to get the wrong way round.
    ...(personalized
      ? [{ $set: { interestLead: { $cond: [lead!, 1, 0] } } }]
      : []),
    { $set: { score } },
    { $sort: sortSpec },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    // The two computed keys are the order, not part of the article.
    { $unset: ["score", "interestLead"] },
    // The shapes `GET /blogs` sends, so the feed card reads the same fields
    // whichever order delivered it.
    {
      $lookup: {
        from: User.collection.name,
        localField: "author",
        foreignField: "_id",
        as: "@author",
      },
    },
    { $set: { author: { $ifNull: [{ $first: "$@author" }, "$author"] } } },
    { $unset: ["@author"] },
    {
      $lookup: {
        from: Category.collection.name,
        localField: "category",
        foreignField: "_id",
        as: "@category",
      },
    },
    { $set: { category: { $first: "$@category" } } },
    { $unset: ["@category"] },
  ]);

  return {
    result: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    // `personalized` only when a live interest actually put an article on this
    // page, so the reason line never claims an order the page does not have.
    reason: personalized && matched > 0 ? "personalized" : "engagement",
  };
};

/**
 * The following list: newest first, and no floor.
 *
 * A follow list is read in publication order, because what makes it different
 * from the main feed is that these are the writers the reader chose, not the
 * ones the score liked. Nobody followed is an empty page rather than an error:
 * a new member opens this tab, and a 404 is the wrong answer to "you have not
 * picked any writers yet".
 *
 * `authorIds` are the members the reader follows.
 */
export const readFollowingPage = async ({
  authorIds,
  page = 1,
  limit = 10,
  inputFilter = {},
}: {
  authorIds: Types.ObjectId[];
  page?: number;
  limit?: number;
  inputFilter?: Record<string, unknown>;
}): Promise<IFeedPage & { meta: TPaginationMeta & { following: number } }> => {
  if (authorIds.length === 0) {
    return {
      result: [],
      meta: { page, limit, total: 0, totalPages: 0, following: 0 },
      reason: "following",
    };
  }

  const match = { ...LIVE_ARTICLE, ...inputFilter, author: { $in: authorIds } };

  const [total, rows] = await Promise.all([
    Blog.countDocuments(match),
    Blog.aggregate<IBlog>([
      { $match: match },
      { $sort: { publishedAt: -1, createdAt: -1, ...STABLE_TAIL } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: User.collection.name,
          localField: "author",
          foreignField: "_id",
          as: "@author",
        },
      },
      { $set: { author: { $ifNull: [{ $first: "$@author" }, "$author"] } } },
      { $unset: ["@author"] },
      {
        $lookup: {
          from: Category.collection.name,
          localField: "category",
          foreignField: "_id",
          as: "@category",
        },
      },
      { $set: { category: { $first: "$@category" } } },
      { $unset: ["@category"] },
    ]),
  ]);

  return {
    result: rows,
    // `following` is how many writers are being read, which is what the tab
    // needs to tell "nobody followed" from "followed, nothing published yet".
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      following: authorIds.length,
    },
    reason: total > 0 ? "following" : "engagement",
  };
};

/** One page, one size, and the order. Only what the feed understands. */
export const parseFeedQuery = (query: Record<string, unknown>) => {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const rawLimit = Math.trunc(Number(query.limit));
  const limit = rawLimit > 0 ? Math.min(50, rawLimit) : 10;

  const rawSort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (rawSort && !FEED_SORT.includes(rawSort as TFeedSort)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `sort must be ${FEED_SORT.join(" or ")}`,
    );
  }

  return { page, limit, sort: (rawSort || "ranking") as TFeedSort };
};

/**
 * The reader's narrowing, as a Mongo filter.
 *
 * Hand-written rather than handed to `QueryBuilder.filter()`: that one splices
 * whatever keys the request carried into the filter, and a public feed must
 * not accept operators. The keys here are the three the site sends, and each
 * value is checked before it reaches Mongo.
 */
export const feedFilter = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};

  // `category` takes the id the site holds, or a category name as typed.
  const rawCategory =
    typeof query.category === "string" ? query.category.trim() : "";
  if (rawCategory) {
    if (/^[a-f\d]{24}$/i.test(rawCategory)) {
      filter.category = new Types.ObjectId(rawCategory);
    } else {
      const found = await Category.findOne({
        name: { $regex: `^${escapeRegex(rawCategory)}$`, $options: "i" },
      }).select("_id");

      // No category carries that name, so no article can match it.
      if (!found) return null;

      filter.category = found._id;
    }
  }

  // Title, slug, or the author's name: the same match `GET /blogs` searches.
  const terms = parseSearchTerms(query.searchTerm);
  if (terms.length > 0) {
    const authorFilters = await Promise.all(
      terms.map((term) =>
        User.find({
          isDeleted: { $ne: true },
          $or: [
            { fullName: { $regex: escapeRegex(term), $options: "i" } },
            { username: { $regex: escapeRegex(term), $options: "i" } },
          ],
        })
          .select("_id")
          .limit(100),
      ),
    );

    filter.$and = terms.map((term, index) => {
      const match = { $regex: escapeRegex(term), $options: "i" };
      const authorIds = authorFilters[index].map((member) => member._id);

      return {
        $or: [
          { title: match },
          { slug: match },
          ...(authorIds.length > 0 ? [{ author: { $in: authorIds } }] : []),
        ],
      };
    });
  }

  return filter;
};

/** Only an id names a category the reader can be interested in. */
export const interestIdsFrom = (ids: string[]) =>
  ids.filter((id) => /^[a-f\d]{24}$/i.test(id));
