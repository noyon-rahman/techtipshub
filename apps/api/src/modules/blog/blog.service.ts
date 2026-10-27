import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { escapeRegex, parseSearchTerms, QueryBuilder } from "../../builder";
import { articleDeletedEmailMessage } from "../../emails";
import { AppError } from "../../errors";
import { sendEmail } from "../../utils";
import { adminLogService } from "../admin/admin-log.service";
import Category from "../category/category.model";
import { IComment } from "../comment/comment.interface";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import User from "../user/user.model";
import { recordView, recomputeTotalViews } from "../view/view.service";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import { LIVE_ARTICLE, blogSearchableFields } from "./blog.constant";
import { IBlog } from "./blog.interface";
import Blog from "./blog.model";
import { generateUniqueSlug, toSlug } from "./blog.utils";

/**
 * `onBehalfOf` is set by the admin route only, and only after the admin has
 * confirmed the choice. It is a separate argument rather than a body field so
 * the member route can never carry one: `POST /blogs` passes nothing and the
 * article is the caller's own, as it always was.
 *
 * A published article bumps the category and author counters now. A draft
 * waits until it is published, which is what `publish` does later.
 */
const create = async (
  userData: JwtPayload,
  payload: IBlog,
  onBehalfOf?: { authorId?: string; publish: boolean },
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const category = await Category.findById(payload.category);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  let author = user;

  if (onBehalfOf?.authorId) {
    const chosen = await User.findOne({
      _id: onBehalfOf.authorId,
      isDeleted: { $ne: true },
    });

    if (!chosen) {
      throw new AppError(httpStatus.NOT_FOUND, "Author not found");
    }

    author = chosen;
  }

  const publish = onBehalfOf ? onBehalfOf.publish : true;

  payload.author = author._id;
  payload.category = category._id;
  payload.status = publish ? "published" : "draft";
  payload.publishedAt = publish ? new Date() : undefined;

  // Set only when someone else is the author, so the record of who wrote it
  // survives a later change of byline.
  if (author._id.toString() !== user._id.toString()) {
    payload.createdBy = user._id;
  }

  payload.slug = await generateUniqueSlug(payload.title);

  const session = await Blog.startSession();

  try {
    session.startTransaction();

    const newBlog = await Blog.create([{ ...payload }], { session });
    if (newBlog.length < 0) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create blog");
    }

    if (publish) {
      const updatedCategory = await Category.findByIdAndUpdate(
        category._id,
        { $inc: { postCount: 1 } },
        { session, new: true },
      );
      if (!updatedCategory) {
        throw new AppError(httpStatus.BAD_REQUEST, "Failed to update category");
      }

      const updatedUser = await User.findByIdAndUpdate(
        author._id,
        { $inc: { totalPosts: 1 } },
        { session, new: true },
      );

      if (!updatedUser) {
        throw new AppError(httpStatus.BAD_REQUEST, "Failed to update User");
      }
    }

    await session.commitTransaction();
    await session.endSession();

    return (
      await newBlog[0].populate({
        path: "author",
        select: "fullName email username profilePicture",
      })
    ).populate({
      path: "category",
      select: "name description postCount",
    });
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

/**
 * Admin-only create: the admin picks whose byline it is and whether it goes
 * live now or waits as a draft for that author. Everyone else's create goes
 * through `create` with no choices.
 */
const createByAdmin = async (
  userData: JwtPayload,
  payload: IBlog & { userId?: string; publish?: boolean },
) => {
  if (!payload.userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Choose the member this article is for",
    );
  }

  const { userId, publish, ...fields } = payload;

  return create(userData, fields as IBlog, {
    authorId: userId,
    publish: publish === true,
  });
};

// get all blogs (for anyone to see title small part of description, category, views, upvote, downvote etc)
//
// The filter is written out rather than left to the model's find hook: this is
// the feed, and a deleted article or a draft must not reappear just because the
// page asked for one (`.find()` replaces the filter, so an empty one would drop
// the hook's).
const getAll = async (query: Record<string, unknown>) => {
  const blogQuery = new QueryBuilder(
    Blog.find({ ...LIVE_ARTICLE })
      .populate("author")
      .populate("category"),
    query,
  ).search(blogSearchableFields);

  await blogQuery.filter();

  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

/**
 * Article lifecycle in the admin table. Two columns decide it: `status` is
 * whether readers can see the piece (`draft` or `published`), and `isDeleted`
 * is whether it was removed. A trashed article sits in `/admin/blogs/trash`
 * until it is restored.
 */
const ADMIN_BLOG_STATUSES = ["published", "draft"] as const;
type TAdminBlogStatus = (typeof ADMIN_BLOG_STATUSES)[number];

// Fields the admin table may sort by. Anything else is a 400, so a typo cannot
// silently fall back to an unindexed sort.
const ADMIN_BLOG_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "title",
  "slug",
  "totalViews",
  "totalComments",
  "upVotes",
  "downVotes",
] as const;

/**
 * Admin article list: every article that is not in the trash, with the same
 * populated author/category shape the public list returns.
 */
const getAdminList = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() splices the query object into
  // the Mongo filter, so unvetted keys could carry operators.
  const parsed: Record<string, unknown> = {};

  if (typeof query.searchTerm === "string" && query.searchTerm.trim())
    parsed.searchTerm = query.searchTerm;
  if (typeof query.page === "string" && query.page) parsed.page = query.page;
  if (typeof query.limit === "string" && query.limit)
    parsed.limit = query.limit;

  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...ADMIN_BLOG_SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${ADMIN_BLOG_SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  }

  // The list holds everything that is not in the trash, published or draft;
  // deleted ones are the trash endpoint's job. `status` narrows it to one of
  // those, and anything else is a 400 rather than a silently empty table.
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (
    status &&
    !ADMIN_BLOG_STATUSES.includes(status.toLowerCase() as TAdminBlogStatus)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `status must be ${ADMIN_BLOG_STATUSES.join(" or ")}. Deleted articles are listed at /admin/blogs/trash`,
    );
  }

  // `category` takes the Mongo id, or a category name for convenience.
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  // Rows written before drafts existed carry no status and are published, so
  // "published" means "not a draft" rather than `status: "published"`.
  if (status) {
    filter.status = status.toLowerCase() === "draft" ? "draft" : { $ne: "draft" };
  }
  const category =
    typeof query.category === "string" ? query.category.trim() : "";
  if (category) {
    if (/^[a-f\d]{24}$/i.test(category)) {
      filter.category = new Types.ObjectId(category);
    } else {
      const foundCategory = await Category.findOne({
        name: {
          $regex: `^${escapeRegex(category)}$`,
          $options: "i",
        },
      }).select("_id");

      if (!foundCategory) {
        // No category carries that name, so no article can match it.
        return {
          result: [],
          meta: {
            page: Math.max(1, Math.trunc(Number(query.page)) || 1),
            limit: Math.max(1, Math.trunc(Number(query.limit)) || 10),
            total: 0,
            totalPages: 0,
          },
        };
      }

      filter.category = foundCategory._id;
    }
  }

  // `author` is a member id only: a name would be ambiguous and a slug must
  // not land on an ObjectId cast error.
  const rawAuthor = typeof query.author === "string" ? query.author.trim() : "";
  const author = /^[a-f\d]{24}$/i.test(rawAuthor) ? rawAuthor : "";
  if (rawAuthor && !author) {
    throw new AppError(httpStatus.BAD_REQUEST, "author must be a member id");
  }
  if (author) {
    filter.author = new Types.ObjectId(author);
  }

  // Title/slug live on the document; the author's name needs a lookup.
  // Matching ids for terms that hit a member keeps one query and one count.
  // Every term has to match (AND), on the article or on its author (OR).
  const searchTerms = parseSearchTerms(parsed.searchTerm);
  if (searchTerms.length > 0) {
    const authorFilters = await Promise.all(
      searchTerms.map((term) => {
        const escaped = escapeRegex(term);
        const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
        const match = { $regex: regex, $options: "i" };

        return User.find({
          isDeleted: { $ne: true },
          $or: [{ fullName: match }, { username: match }],
        })
          .select("_id")
          .limit(100);
      }),
    );

    filter.$and = searchTerms.map((term, index) => {
      const escaped = escapeRegex(term);
      const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
      const match = { $regex: regex, $options: "i" };

      const authorIds = authorFilters[index].map((member) => member._id);

      return {
        $or: [
          { title: match },
          { slug: match },
          ...(authorIds.length > 0 ? [{ author: { $in: authorIds } }] : []),
        ],
      };
    });

    // `searchTerm` is not a column; the conditions above replace it.
    delete parsed.searchTerm;
  }

  const blogQuery = new QueryBuilder(
    Blog.find(filter)
      // The admin table is where drafts are found again.
      .setOptions({ includeDrafts: true })
      .populate("author")
      .populate("category"),
    parsed,
  );

  if (parsed.sort) {
    blogQuery.sort();
  } else {
    blogQuery.sortBy("-createdAt,-_id");
  }

  blogQuery.paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

// get following users blogs
const getFollowingUsersBlogs = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const following = await Follower.find({ follower: user._id }).select(
    "following",
  );

  if (!following || following.length === 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "You are not following any users.",
    );
  }

  const followingUserIds = following.map((f) => f.following);

  const blogQuery = new QueryBuilder(
    Blog.find({
      author: { $in: followingUserIds },
      ...LIVE_ARTICLE,
    })
      .populate("author")
      .populate("category"),
    query,
  ).search(blogSearchableFields);

  await blogQuery.filter();

  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

// get current logged in user all blogs
const getLoggedInUserBlogs = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // The writer's own list, so it holds their drafts as well as what readers
  // can see. `includeDrafts` is the hook's permission to skip the draft filter.
  const blogQuery = new QueryBuilder(
    Blog.find({ author: user._id, isDeleted: { $ne: true } })
      .setOptions({ includeDrafts: true })
      .populate("author")
      .populate("category"),
    query,
  ).search(blogSearchableFields);

  await blogQuery.filter();

  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

const getBlogByProperty = async (key: string, value: string) => {
  let blog;

  if (key === "_id") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
    }
    // `findById` runs no query hook, so the two ways an article is not public
    // are written out here.
    blog = await Blog.findOne({ _id: value, ...LIVE_ARTICLE })
      .populate("author")
      .populate({
        path: "category",
        select: "name description postCount",
      });
  } else {
    blog = await Blog.findOne({ [key]: value })
      .populate("author")
      .populate({
        path: "category",
        select: "name description postCount",
      });
  }

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return blog;
};

// get a single blog by slug.
//
// Everyone gets the whole article, guests included. This endpoint is read by
// the website's build and by its per-request render of a signed-in reader, and
// the answer is cached and shared between them; a response that changed shape
// with the caller's token would put a locked copy in front of members (or a
// full copy in front of guests) depending on who happened to ask first.
// Whether the body is shown is therefore a rendering decision made by the
// website, which knows who is reading.
//
// A logged-in user still has the view recorded here, and gets the reconciled
// total back.
const getSingleBlog = async (
  userData: JwtPayload | undefined,
  slug: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const blog = await Blog.findOne({ slug })
      .populate({
        path: "author",
      })
      .populate({
        path: "category",
        select: "name description postCount",
      })
      .session(session);

    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Guest visitors get the article as stored. Nobody is signed in to record
    // a read for, so the counter is whatever the document already holds, but
    // the total is still recomputed from the view records so the number the
    // website shows does not drift from the one a member sees.
    if (!userData?.email) {
      const totalViews = await recomputeTotalViews(slug);
      const article = blog.toObject() as IBlog & { isLocked?: boolean };

      await session.commitTransaction();
      session.endSession();

      return {
        ...article,
        totalViews: totalViews ?? blog.totalViews,
        isLocked: false,
      };
    }

    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Record the view (once per reader, never for the author) and return the
    // reconciled total. This runs outside the read transaction so a concurrent
    // duplicate view can never abort the article fetch itself.
    const totalViews = await recordView(slug, { user: userData });

    await session.commitTransaction();
    session.endSession();

    return {
      ...blog.toObject(),
      totalViews: totalViews ?? blog.totalViews,
      isLocked: false,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// vote on blog
const voteOnBlog = async (
  userData: JwtPayload,
  blogId: string,
  voteType: "upvote" | "downvote",
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!["upvote", "downvote"].includes(voteType)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid vote type");
    }

    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const blog = await Blog.findById(blogId).session(session);
    if (!blog || blog.status === "draft") {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Ensure the user is not the author of the blog (skip author's votes if necessary)
    if (blog.author.equals(currentLoggedInUser._id)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Author cannot vote on their own blog",
      );
    }

    const existingVote = await Vote.findOne({
      // "post" is the stored DB field on votes, not the concept name.
      post: blog._id,
      user: currentLoggedInUser._id,
    }).session(session);

    if (existingVote) {
      if (existingVote.type === voteType) {
        await existingVote.deleteOne({ session });

        if (voteType === "upvote") {
          blog.upVotes -= 1;
        } else {
          blog.downVotes -= 1;
        }
      } else {
        existingVote.type = voteType;
        await existingVote.save({ session });

        if (voteType === "upvote") {
          blog.upVotes += 1;
          blog.downVotes -= 1;
        } else {
          blog.downVotes += 1;
          blog.upVotes -= 1;
        }
      }
    } else {
      await Vote.create(
        [
          {
            user: currentLoggedInUser._id,
            // "post" is the stored DB field on votes, not the concept name.
            post: blog._id,
            type: voteType,
          },
        ],
        { session },
      );

      if (voteType === "upvote") {
        blog.upVotes += 1;
      } else {
        blog.downVotes += 1;
      }
    }

    await blog.save({ session });

    await session.commitTransaction();
    session.endSession();

    return blog;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getVoteStatus = async (userData: JwtPayload, blogId: string) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const blog = await Blog.findById(blogId);
  if (!blog || blog.status === "draft") {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  const existingVote = await Vote.findOne({
    // "post" is the stored DB field on votes, not the concept name.
    post: blog._id,
    user: user._id,
  });

  if (!existingVote) {
    throw new AppError(httpStatus.NOT_FOUND, "Not Voted yet!");
  }

  return {
    status: "Voted",
    voteType: existingVote.type,
    blogId: blog._id,
    userId: user._id,
  };
};

// comment on blog with transaction
const commentOnBlog = async (
  userData: JwtPayload,
  blogId: string,
  payload: IComment,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const blog = await Blog.findById(blogId).session(session);
    if (!blog || blog.status === "draft") {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    const comment = await Comment.create(
      [
        {
          ...payload,
          user: currentLoggedInUser._id,
          // "post" is the stored DB field on comments, not the concept name.
          post: blog._id,
        },
      ],
      { session },
    );

    // Keep the stored counter equal to the number of visible comments rather
    // than incrementing blindly, so edits and removals can never drift it.
    // The count must join the transaction, or the new comment is not visible to
    // it and the counter is written back as zero.
    blog.totalComments = await Comment.countDocuments({
      // "post" is the stored DB field on comments, not the concept name.
      post: blog._id,
      isDeleted: { $ne: true },
    }).session(session);
    await blog.save({ session });

    await session.commitTransaction();
    session.endSession();

    return await Comment.findById(comment[0]._id)
      .populate({
        path: "user",
        select: "fullName email profilePicture",
      })
      .populate({
        // "post" is the stored DB field on comments, not the concept name.
        path: "post",
        select: "title category slug",
      });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// get all comments by blog id
const getAllCommentsByBlogId = async (
  blogId: string,
  query: Record<string, unknown>,
) => {
  const blog = await Blog.findById(blogId);
  if (!blog || blog.status === "draft") {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  // Only visible comments: a soft-deleted comment stays in the collection for
  // moderation history, but it must not appear in the list or the count.
  const commentQuery = new QueryBuilder(
    Comment.find({
      // "post" is the stored DB field on comments, not the concept name.
      post: blog._id,
      isDeleted: { $ne: true },
    })
      .populate("user")
      .populate({
        // "post" is the stored DB field on comments, not the concept name.
        path: "post",
      }),
    query,
  );

  await commentQuery.filter();

  commentQuery.sort().paginate().fields();

  const result = await commentQuery.modelQuery;
  const meta = await commentQuery.countTotal();

  return { result, meta };
};

// get all blogs by user id
const getAllBlogsByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // The author's real article count is the source of truth for a profile, so it
  // cannot lag behind like the stored `user.totalPosts` counter did. Deleted
  // and draft articles are not on the list, so they are not in its total.
  const visibleFilter = { author: user._id, ...LIVE_ARTICLE };
  const total = await Blog.countDocuments(visibleFilter);

  const blogQuery = new QueryBuilder(
    Blog.find(visibleFilter).populate("author").populate("category"),
    query,
  ).search(blogSearchableFields);

  await blogQuery.filter();

  // Newest first: the default sort only applies when the caller doesn't ask
  // for something else, and `createdAt` alone can tie within one millisecond.
  if (!query.sort) {
    blogQuery.sortBy("-createdAt,-_id");
  } else {
    blogQuery.sort();
  }

  blogQuery.paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();
  meta.total = total;

  return { result, meta };
};

// delete blog by admin using id
const deleteBlogByAdminUsingId = async (
  id: string,
  payload: Record<string, string>,
  adminEmail?: string,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const blog = await Blog.findById(id)
      .populate({ path: "author", select: "fullName email" })
      .session(session);
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    const author = await User.findByIdAndUpdate(blog?.author._id, {
      $inc: { totalPosts: -1 },
    }).session(session);

    if (!author) {
      throw new AppError(httpStatus.NOT_FOUND, "Author not found");
    }

    blog.isDeleted = true;
    await blog.save({ session });

    // delete associated comments, views, and votes
    // "post" is the stored DB field on these collections, not the concept name.
    await Comment.deleteMany({ post: blog._id }, { session });
    await View.deleteMany({ post: blog._id }, { session });
    await Vote.deleteMany({ post: blog._id }, { session });
    await Category.findByIdAndUpdate(
      blog.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    await session.commitTransaction();
    await session.endSession();

    await adminLogService.record({
      adminEmail,
      action: "article.delete",
      targetType: "blog",
      targetId: String(blog._id),
      summary: `Deleted article "${blog.title}"`,
      meta: { reason: payload.reason },
    });

    const mail = await articleDeletedEmailMessage({
      fullName: author.fullName,
      articleTitle: blog.title,
      reason: payload.reason,
    });

    await sendEmail({
      to: {
        name: author.fullName,
        address: author.email,
      },
      sender: "notifications",
      category: "article-deletion",
      ...mail,
    });

    // eslint-disable-next-line no-console
    console.log("Blog soft-deleted, email sent successfully.");
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// delete blog by user
const deleteBlogByUserUsingId = async (
  userData: JwtPayload,
  blogId: string,
) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const user = await User.findOneAndUpdate(
      { email: userData.email },
      { $inc: { totalPosts: -1 } },
    ).session(session);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const blog = await Blog.findOne({ _id: blogId, author: user._id }).session(
      session,
    );
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    blog.isDeleted = true;
    const result = await blog.save({ session });

    // delete associated comments, views, and votes
    // "post" is the stored DB field on these collections, not the concept name.
    await Comment.deleteMany({ post: blog._id }, { session });
    await View.deleteMany({ post: blog._id }, { session });
    await Vote.deleteMany({ post: blog._id }, { session });
    await Category.findByIdAndUpdate(
      blog.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    await session.commitTransaction();
    await session.endSession();

    // Send email notification to the author
    // const mail = await articleDeletedEmailMessage({
    //   fullName: user.fullName,
    //   articleTitle: blog.title,
    //   reason: "User deletion",
    // });
    // await sendEmail({
    //   to: {
    //     name: user.fullName,
    //     address: user.email,
    //   },
    //   sender: "notifications",
    //   category: "article-deletion",
    //   ...mail,
    // });

    return result;
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

// update blog by user using blog id
//
// The body is written as it arrives, so the two columns that decide who can
// see the article are held back here: a member cannot publish a draft, or take
// a published article down, by putting `status` in the request.
const updateBlogByUserUsingId = async (
  userData: JwtPayload,
  blogId: string,
  payload: IBlog,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const { status: _status, publishedAt: _publishedAt, ...fields } = payload;

  fields.slug = await generateUniqueSlug(fields.title, blogId);

  const blog = await Blog.findOneAndUpdate(
    { _id: blogId, author: user._id },
    { ...fields },
    { new: true, runValidators: true },
  );

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return blog;
};

/**
 * One article for the admin editor.
 *
 * Read through the admin route rather than the public slug route so opening
 * the editor does not record a view for the admin, and a deleted article is a
 * 404 like it is everywhere else until it is restored. Drafts are the admin
 * editor's own work, so they are read here too.
 */
const getAdminSingleBlog = async (blogId: string) => {
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
  }

  const blog = await Blog.findOne({ _id: blogId, isDeleted: { $ne: true } })
    .setOptions({ includeDrafts: true })
    .populate({
      path: "author",
      select: "fullName username profilePicture email",
    })
    .populate({
      path: "category",
      select: "name description postCount",
    });

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return blog;
};

const updateBlogByAdmin = async (
  blogId: string,
  payload: IBlog & { userId?: string },
  adminEmail?: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
  }

  // The find hook hides deleted articles, so a trashed one is a 404 here: it
  // has to be restored before it can be edited. Drafts are editable, so they
  // are read with the hook's permission.
  const existing = await Blog.findById(blogId)
    .setOptions({ includeDrafts: true })
    .select("author category status publishedAt");
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  // The panel may send `userId`, but the author is set at creation and never
  // rewritten, so it is dropped here.
  const { userId: _userId, ...fields } = payload;

  // Only these columns are editable, so nothing else in the body can be
  // written back.
  const changes: Partial<IBlog> = {};

  if (fields.title !== undefined) changes.title = fields.title;
  if (fields.contentType !== undefined)
    changes.contentType = fields.contentType;
  if (fields.content !== undefined) changes.content = fields.content;
  if (fields.coverImage !== undefined) changes.coverImage = fields.coverImage;
  if (fields.category !== undefined) changes.category = fields.category;
  if (fields.tags !== undefined) changes.tags = fields.tags;

  // An address the panel sends wins over the one derived from the title, so an
  // admin can retitle without moving the article, or move it deliberately.
  const slugProvided = fields.slug !== undefined;
  const explicitSlug = slugProvided ? toSlug(String(fields.slug)) : "";

  if (slugProvided) {
    if (explicitSlug.length < 3) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The address must be at least 3 characters",
      );
    }

    // Trashed articles still hold their slug against the unique index.
    const taken = await Blog.findOne({
      slug: explicitSlug,
      _id: { $ne: blogId },
    })
      .setOptions({ bypassMiddleware: true })
      .select("_id");

    if (taken) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "That address is already in use",
      );
    }

    changes.slug = explicitSlug;
  } else if (changes.title) {
    changes.slug = await generateUniqueSlug(changes.title, blogId);
  }

  const nextCategory = changes.category;
  const categoryChanged =
    nextCategory !== undefined &&
    String(nextCategory) !== String(existing.category);

  if (categoryChanged) {
    const category = await Category.findById(nextCategory);
    if (!category) {
      throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }
  }

  const updatedBlog = await Blog.findByIdAndUpdate(blogId, changes, {
    new: true,
    runValidators: true,
  });
  if (!updatedBlog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  if (categoryChanged) {
    // A draft was never counted in either category, so moving it moves nothing.
    if (existing.status !== "draft") {
      await Category.findByIdAndUpdate(existing.category, {
        $inc: { postCount: -1 },
      });
      await Category.findByIdAndUpdate(nextCategory, {
        $inc: { postCount: 1 },
      });
    }
  }

  await adminLogService.record({
    adminEmail,
    action: "article.update",
    targetType: "blog",
    targetId: String(updatedBlog._id),
    summary: `Updated article "${updatedBlog.title}"`,
  });

  return await updatedBlog.populate([
    { path: "author", select: "fullName username" },
    { path: "category", select: "name description postCount" },
  ]);
};

/**
 * Takes a draft live, under its author's byline.
 *
 * Publishing is the one transition that changes who can see the article, so it
 * also owns the first counters: the author's `totalPosts` and the category's
 * `postCount` were not touched while it was a draft. `publishedAt` is stamped
 * once and kept if the article is ever unpublished and published again.
 */
const publishBlog = async (blogId: string, adminEmail: string) => {
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
  }

  // Drafts are only reachable here with `includeDrafts`; trashed ones stay a
  // 404 until restored.
  const existing = await Blog.findOne({ _id: blogId, isDeleted: { $ne: true } })
    .setOptions({ includeDrafts: true })
    .select("author category status publishedAt");

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  if (existing.status !== "draft") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This article is already published",
    );
  }

  const published = await Blog.findOneAndUpdate(
    { _id: blogId, isDeleted: { $ne: true }, status: "draft" },
    {
      status: "published",
      publishedAt: existing.publishedAt ?? new Date(),
    },
    { new: true, runValidators: true },
  )
    .setOptions({ includeDrafts: true })
    .populate([
      { path: "author", select: "fullName username" },
      { path: "category", select: "name description postCount" },
    ]);

  // Lost the race with another publish; the article is live already, so the
  // counters have been moved by whoever won.
  if (!published) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This article is already published",
    );
  }

  await User.findByIdAndUpdate(existing.author, {
    $inc: { totalPosts: 1 },
  });
  await Category.findByIdAndUpdate(published.category, {
    $inc: { postCount: 1 },
  });

  await adminLogService.record({
    adminEmail,
    action: "article.publish",
    targetType: "blog",
    targetId: String(published._id),
    summary: `Published article "${published.title}"`,
  });

  return published;
};

const getDeletedBlogs = async (rawQuery: Record<string, unknown>) => {
  const page = Math.max(1, Math.trunc(Number(rawQuery.page)) || 1);
  const rawLimit = Math.trunc(Number(rawQuery.limit));
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 10;

  // Whitelisted keys only: `searchTerm` here is expanded into a filter, and
  // nothing else from the query string reaches Mongo.
  const searchTerms = parseSearchTerms(rawQuery.searchTerm);
  const search = searchTerms.map((term) => {
    const escaped = escapeRegex(term);
    const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
    const match = { $regex: regex, $options: "i" };

    return { $or: [{ title: match }, { slug: match }] };
  });

  // The find hook hides deleted rows, so the trash view is the one place that
  // opts out of it and asks for them itself.
  const [result, total] = await Promise.all([
    Blog.find({
      isDeleted: true,
      ...(search.length ? { $and: search } : {}),
    })
      .setOptions({ bypassMiddleware: true })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-content -__v")
      .populate({ path: "author", select: "fullName username" })
      .populate({ path: "category", select: "name" })
      .lean(),
    Blog.countDocuments({
      isDeleted: true,
      ...(search.length ? { $and: search } : {}),
    }),
  ]);

  return {
    result,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const restoreBlog = async (blogId: string, adminEmail?: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // A malformed id is a bad request, not a server fault: the driver's own
    // ObjectId constructor throws a plain error that would surface as a 500.
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
    }

    // The find hook hides deleted rows, so confirm the raw state first.
    const raw = await Blog.collection.findOne({
      _id: new Types.ObjectId(blogId),
    });
    if (!raw) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    if (raw.isDeleted !== true) {
      throw new AppError(httpStatus.BAD_REQUEST, "Blog is not deleted");
    }

    const blog = await Blog.findByIdAndUpdate(
      blogId,
      { isDeleted: false },
      { session, new: true, runValidators: true },
    );
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // A draft comes back as a draft: it was never counted, so it must not
    // start counting now. Only a published article raised these numbers.
    if (raw.status !== "draft") {
      await User.findByIdAndUpdate(
        raw.author,
        { $inc: { totalPosts: 1 } },
        { session },
      );
      await Category.findByIdAndUpdate(
        raw.category,
        { $inc: { postCount: 1 } },
        { session },
      );
    }

    await session.commitTransaction();

    await adminLogService.record({
      adminEmail,
      action: "article.restore",
      targetType: "blog",
      targetId: String(blog._id),
      summary:
        raw.status === "draft"
          ? `Restored draft "${blog.title}"`
          : `Restored article "${blog.title}"`,
    });

    // Await this before the session ends. The document still points at the
    // transaction's session, and a populate left in flight is issued after
    // that session is closed, which Mongo rejects as an expired session.
    return await blog.populate({ path: "author", select: "fullName username" });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Erase a trashed article for good.
 *
 * Only a trashed article can be erased, so the author and category counters
 * were already decremented on the way in and are not touched here. Comments,
 * views and votes were purged with the soft delete; deleting them again keeps
 * any older leftovers from outliving the article.
 */
const deleteBlogPermanently = async (blogId: string, adminEmail?: string) => {
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
  }

  // The find hook hides trashed articles, so read the raw document.
  const raw = await Blog.collection.findOne({
    _id: new Types.ObjectId(blogId),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  if (raw.isDeleted !== true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Move the article to the trash before deleting it permanently",
    );
  }

  await Promise.all([
    Comment.deleteMany({ post: raw._id }),
    View.deleteMany({ post: raw._id }),
    Vote.deleteMany({ post: raw._id }),
  ]);

  await Blog.deleteOne({ _id: raw._id });

  await adminLogService.record({
    adminEmail,
    action: "article.delete_permanent",
    targetType: "blog",
    targetId: String(raw._id),
    summary: `Permanently deleted article "${raw.title}"`,
    meta: { slug: raw.slug },
  });

  return { _id: String(raw._id), title: raw.title, slug: raw.slug };
};

export const blogService = {
  create,
  createByAdmin,
  publishBlog,
  getAll,
  getLoggedInUserBlogs,
  getSingleBlog,
  getBlogByProperty,
  voteOnBlog,
  commentOnBlog,
  getAllCommentsByBlogId,
  getAllBlogsByUserId,
  getVoteStatus,
  getFollowingUsersBlogs,
  deleteBlogByAdminUsingId,
  deleteBlogByUserUsingId,
  updateBlogByUserUsingId,
  updateBlogByAdmin,
  getAdminSingleBlog,
  getAdminList,
  getDeletedBlogs,
  restoreBlog,
  deleteBlogPermanently,
};
