"use client";

import AdminActivityChart, {
  adminChartColours,
} from "@/components/modules/admin/kit/activity-chart";
import {
  dayRange,
  longDay,
  shortDay,
} from "@/components/modules/admin/kit/chart-format";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import StatTile, {
  type StatDelta,
} from "@/components/modules/admin/kit/stat-tile";
import { focusRing } from "@/components/modules/admin/kit/tau";
import SectionCard from "@/components/modules/admin/section-card";
import UserAvatar from "@/components/ui/user-avatar";
import { useAdminActivity, useAdminOverview } from "@/hooks/admin-overview";
import type {
  IAdminActivityPoint,
  IAdminChange,
  IAdminOverview,
  IAdminRecentItem,
} from "@/types";
import { Skeleton } from "@heroui/react";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  FiChevronRight,
  FiEye,
  FiMessageSquare,
  FiThumbsUp,
  FiUsers,
} from "react-icons/fi";
import {
  RiArrowRightLine,
  RiArticleLine,
  RiChat3Line,
  RiRefreshLine,
  RiUserAddLine,
} from "react-icons/ri";

/**
 * Screen job: answer "is the site healthy this week, and what does it need from
 * me before I leave?" That decision owns the hierarchy. The headline row gives
 * the week its scale, the activity chart gives the shape of the week, and the
 * rail holds the two lists an admin acts from: which articles are working, and
 * who is writing them.
 */

const RANGES = [
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type RangeDays = (typeof RANGES)[number]["days"];

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const format = (value?: number) =>
  isNumber(value) ? value.toLocaleString() : "Not reported";

const formatExact = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelative = (value?: string) => {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";

  const minutes = Math.round((Date.now() - time) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;

  const date = new Date(time);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
};

const normalizeRecentHref = (href?: string) => {
  if (!href) return undefined;
  return href.startsWith("/users/@") ? href.replace("/users/@", "/users/") : href;
};

/**
 * The API's `weekStat` already decides the trend type, so the tile keeps its
 * arrow instead of guessing from the sign (a zero-base week can report
 * "100.00%" after a dip).
 */
const deltaOf = (change?: IAdminChange): StatDelta | undefined => {
  if (!change || typeof change.change !== "string") return undefined;

  const label = change.change.trim();
  if (!label) return undefined;

  const trend =
    change.type === "increase"
      ? "up"
      : change.type === "decrease"
        ? "down"
        : "flat";

  // `weekStat` formats an increase as a bare number ("25.00%"), so the plus
  // sign is added here; it also keeps the arrow and the number agreeing.
  const signed = trend === "up" && !label.startsWith("+") ? `+${label}` : label;

  return { value: signed, trend };
};

const weekHint = (change?: IAdminChange) => {
  if (!change || !isNumber(change.value)) return "last 7 days not reported";
  return `${change.value.toLocaleString()} in the last 7 days`;
};

const count = (value: unknown) => {
  const raw = typeof value === "number" ? value : Number(value);
  return Number.isFinite(raw) ? raw : undefined;
};

const QuietLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <Link
    href={href}
    className={`inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-medium text-default-700 transition-colors hover:text-primary-accessible sm:min-h-8 ${focusRing}`}
  >
    {children}
    <FiChevronRight aria-hidden className="size-3.5" />
  </Link>
);

const RetryButton = ({
  onRetry,
  label = "Try again",
}: {
  onRetry: () => void;
  label?: string;
}) => (
  <button
    type="button"
    onClick={onRetry}
    className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border border-default-300 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`}
  >
    <RiRefreshLine aria-hidden className="size-4" />
    {label}
  </button>
);

const PanelSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3 px-4 py-4" aria-hidden>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-2.5 w-2/5 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-5" role="status">
    <span className="sr-only">Loading the dashboard</span>

    <div className="overflow-hidden rounded-xl border border-default/60 bg-content-1">
      <div className="grid grid-cols-2 divide-x divide-y divide-default/60 sm:grid-cols-4 sm:divide-y-0">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-default/60 bg-content-1 p-4 sm:p-5">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="mt-2 h-3 w-64 rounded" />
        <Skeleton className="mt-5 h-64 w-full rounded-md" />
      </div>
      <div className="rounded-xl border border-default/60 bg-content-1 p-4 sm:p-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-2 h-3 w-52 rounded" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>

    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={4} />
    </div>
  </div>
);

const ActivityBlock = ({
  points,
  days,
  onDaysChange,
  loading,
  failed,
  onRetry,
}: {
  points: IAdminActivityPoint[];
  days: RangeDays;
  onDaysChange: (days: RangeDays) => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) => {
  const rangeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onRangeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const current = RANGES.findIndex((option) => option.days === days);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (current + step + RANGES.length) % RANGES.length;
    onDaysChange(RANGES[next].days);
    rangeRefs.current[next]?.focus();
  };

  // Every row the API sends becomes one point. Labels are human ("3 Oct"),
  // and the tooltip title is the full date.
  const chartData = points.map((point) => ({
    key: point.date,
    label: shortDay(point.date),
    title: longDay(point.date),
    views: point.views ?? 0,
    comments: point.comments ?? 0,
  }));

  const totals = points.reduce(
    (sum, point) => ({
      views: sum.views + (point.views ?? 0),
      comments: sum.comments + (point.comments ?? 0),
    }),
    { views: 0, comments: 0 },
  );

  const hasSignal = totals.views + totals.comments > 0;
  const rangeText = dayRange(points[0]?.date, points.at(-1)?.date);

  return (
    <SectionCard
      className="h-full min-w-0"
      title="Reading and discussion, by day"
      description={`Views and comments recorded in the last ${days} days, day by day.`}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {!failed && !loading && points.length > 0 ? (
            <dl className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <dt className="text-default-600">Views</dt>
                <dd className="font-medium tabular-nums">
                  {totals.views.toLocaleString("en-GB")}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-default-600">Comments</dt>
                <dd className="font-medium tabular-nums">
                  {totals.comments.toLocaleString("en-GB")}
                </dd>
              </div>
            </dl>
          ) : null}

          <div
            role="group"
            aria-label="Activity range"
            onKeyDown={onRangeKeyDown}
            className="inline-flex items-center gap-0.5 rounded-md border border-default-200 bg-background p-0.5"
          >
            {RANGES.map((option, index) => {
              const selected = option.days === days;
              return (
                <button
                  key={option.days}
                  ref={(node) => {
                    rangeRefs.current[index] = node;
                  }}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onDaysChange(option.days)}
                  className={`inline-flex min-h-11 items-center rounded px-2.5 text-xs font-medium tabular-nums transition-colors sm:min-h-7 ${focusRing} ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-default-600 hover:bg-default-100 hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      }
      footer={
        !failed && !loading && points.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="tabular-nums">
              {rangeText}
              {hasSignal
                ? ""
                : ". No views or comments were recorded in this range."}
            </span>
            <Link
              href="/admin/analytics"
              className={`font-medium text-primary-accessible underline-offset-4 hover:underline ${focusRing}`}
            >
              Open full analytics
            </Link>
          </div>
        ) : undefined
      }
    >
      {failed ? (
        <EmptyState
          variant="inline"
          title="Activity could not be loaded"
          description="The activity endpoint did not answer. The rest of the dashboard is still usable; retry just this chart."
          action={<RetryButton onRetry={onRetry} label="Retry chart" />}
        />
      ) : loading ? (
        <>
          <span className="sr-only">Loading daily activity</span>
          <Skeleton className="h-64 w-full rounded-md" />
        </>
      ) : points.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No activity recorded yet"
          description="Views and comments appear here as readers arrive. Publish or share an article to start the series."
          action={
            <Link
              href="/admin/manage-blogs"
              className={`inline-flex min-h-11 items-center rounded-md border border-default-300 px-3.5 text-sm font-medium hover:bg-default-100 sm:min-h-9 ${focusRing}`}
            >
              Open articles
            </Link>
          }
        />
      ) : (
        <AdminActivityChart
          data={chartData}
          height={256}
          summary="Views and comments per day"
          showLegend
          series={[
            {
              key: "views",
              label: "Views",
              color: adminChartColours.primary,
            },
            {
              key: "comments",
              label: "Comments",
              color: adminChartColours.foreground,
            },
          ]}
        />
      )}
    </SectionCard>
  );
};

const TYPE_LABEL: Record<IAdminRecentItem["type"], string> = {
  blog: "Article published",
  member: "Member joined",
  comment: "Comment",
};

const TYPE_TINT: Record<IAdminRecentItem["type"], string> = {
  blog: "bg-primary/15 text-primary-accessible",
  member: "bg-success/15 text-success-700 dark:text-success",
  comment: "bg-default-200 text-default-700",
};

const TYPE_ICON: Record<IAdminRecentItem["type"], ReactNode> = {
  blog: <RiArticleLine aria-hidden className="size-3.5" />,
  member: <RiUserAddLine aria-hidden className="size-3.5" />,
  comment: <RiChat3Line aria-hidden className="size-3.5" />,
};

const RecentBlock = ({
  items,
  loading,
  failed,
  onRetry,
}: {
  items: IAdminRecentItem[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) => {
  const shown = items.slice(0, 6);

  return (
    <SectionCard
      flush
      title="Latest activity"
      description="The most recent articles, joins and comments."
      footer={<QuietLink href="/admin/activity-log">Full log</QuietLink>}
    >
      {failed ? (
        <div className="p-4">
          <EmptyState
            variant="inline"
            title="Activity could not be loaded"
            description="The dashboard data did not arrive. Try the request once more."
            action={<RetryButton onRetry={onRetry} />}
          />
        </div>
      ) : loading ? (
        <PanelSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <div className="p-4">
          <EmptyState
            variant="inline"
            title="Nothing has happened yet"
            description="Publishing an article or welcoming a member will show up here."
            action={
              <Link
                href="/admin/moderation"
                className={`inline-flex min-h-11 items-center rounded-md border border-default-300 px-3.5 text-sm font-medium hover:bg-default-100 sm:min-h-9 ${focusRing}`}
              >
                Open moderation
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-default/60">
          {shown.map((item) => {
            const actor = item.actor?.fullName || item.actor?.username;
            const label = TYPE_LABEL[item.type] ?? "Activity";
            const href = normalizeRecentHref(item.href);

            return (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-default-50/70 sm:px-5"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md ${
                    TYPE_TINT[item.type] ?? TYPE_TINT.comment
                  }`}
                >
                  {TYPE_ICON[item.type] ?? TYPE_ICON.comment}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="text-xs font-medium text-default-600">
                      {label}
                    </span>
                    {href ? (
                      <Link
                        href={href}
                        className={`min-w-0 truncate rounded-sm font-medium hover:text-primary-accessible ${focusRing}`}
                      >
                        {item.title || "Untitled"}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate font-medium">
                        {item.title || "Untitled"}
                      </span>
                    )}
                  </p>
                  {item.excerpt && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-default-600">
                      {item.excerpt}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-default-600">
                    {actor ? `${actor} · ` : ""}
                    <time
                      dateTime={item.createdAt}
                      title={formatExact(item.createdAt)}
                    >
                      {formatRelative(item.createdAt)}
                    </time>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
};

const TopArticlesList = ({
  articles,
  loading,
}: {
  articles: IAdminOverview["topArticles"];
  loading: boolean;
}) => {
  const rows = Array.isArray(articles) ? articles.slice(0, 5) : [];

  return (
    <SectionCard
      flush
      title="Most read articles"
      description="All-time top published pieces by view count."
      footer={
        <QuietLink href="/admin/analytics">All articles in analytics</QuietLink>
      }
    >
      {loading ? (
        <PanelSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            variant="inline"
            title="No article has a read yet"
            description="The five most read pieces appear here once readers open them."
          />
        </div>
      ) : (
        <ol className="divide-y divide-default/60">
          {rows.map((article, index) => (
            <li key={article._id}>
              <Link
                href={`/blogs/${article.slug}`}
                className={`group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-default-50 sm:px-5 ${focusRing}`}
              >
                <span
                  aria-hidden
                  className="w-4 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-default-600"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary-accessible">
                    {article.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-default-600">
                    {article.author?.fullName?.trim()
                      ? article.author.fullName
                      : "Author not recorded"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-default-700">
                  {format(article.totalViews)}
                  <span className="block text-default-600">views</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
};

const ContributorsList = ({
  contributors,
  loading,
}: {
  contributors: IAdminOverview["topContributors"];
  loading: boolean;
}) => {
  const rows = Array.isArray(contributors) ? contributors.slice(0, 5) : [];

  return (
    <SectionCard
      flush
      title="Top contributors, last 30 days"
      description="Writers ranked by articles published this month."
      footer={<QuietLink href="/admin/manage-users">All members</QuietLink>}
    >
      {loading ? (
        <PanelSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            variant="inline"
            title="No articles in the last 30 days"
            description="Writers appear here ranked by how many pieces they published this month."
          />
        </div>
      ) : (
        <ol className="divide-y divide-default/60">
          {rows.map((person, index) => {
            const name =
              person.fullName?.trim() ||
              (person.username ? `@${person.username}` : "Unknown member");

            return (
              <li key={person._id}>
                <Link
                  href={`/admin/manage-users/${person._id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-default-50 sm:px-5 ${focusRing}`}
                >
                  <span
                    aria-hidden
                    className="w-4 shrink-0 text-xs font-semibold tabular-nums text-default-600"
                  >
                    {index + 1}
                  </span>
                  <UserAvatar
                    src={person.profilePicture || undefined}
                    name={name.charAt(0).toUpperCase()}
                    className="size-7 shrink-0"
                    classNames={{ name: "text-xs" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-default-600">
                      {format(person.totalViews)} views
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-default-700">
                    {format(person.published)}
                    <span className="block text-default-600">
                      {person.published === 1 ? "article" : "articles"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
};

const HealthRow = ({
  href,
  label,
  value,
  question,
}: {
  href: string;
  label: string;
  value?: number;
  question: string;
}) => (
  <li>
    <Link
      href={href}
      className={`flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-default-50 sm:px-5 ${focusRing}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-default-600">
          {question}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums">
        {format(value)}
        <RiArrowRightLine aria-hidden className="size-3.5 text-default-500" />
      </span>
    </Link>
  </li>
);

const HealthBlock = ({
  pending,
  health,
  loading,
}: {
  pending: IAdminOverview["pending"];
  health: IAdminOverview["health"];
  loading: boolean;
}) => {
  const emptyCategories = count(health?.emptyCategories);
  const zeroViewArticles = count(health?.zeroViewArticles);

  const rows = [
    {
      key: "comments",
      href: "/admin/manage-comments",
      label: "New comments, last 7 days",
      question: "Read the discussion and remove what breaks the rules.",
      value: count(pending?.commentsLast7Days),
    },
    {
      key: "articles",
      href: "/admin/moderation",
      label: "Articles published, last 7 days",
      question: "Check the newest pieces while they are still fresh.",
      value: count(pending?.articlesLast7Days),
    },
    {
      key: "members",
      href: "/admin/manage-users",
      label: "Members joined, last 7 days",
      question: "Confirm the new accounts look real before they post.",
      value: count(pending?.newMembersLast7Days),
    },
    {
      key: "empty-categories",
      href: "/admin/categories",
      label: "Categories with no articles",
      question: "Merge or remove topics that have nothing in them.",
      value: emptyCategories,
    },
    {
      key: "zero-views",
      // The articles table cannot sort ascending, so the honest destination is
      // the whole list, where its "No reads" tab opens the zero-read rows.
      href: "/admin/manage-blogs",
      label: "Articles with no reads",
      question: "Older pieces nobody opened. Fix titles or retire them.",
      value: zeroViewArticles,
    },
  ];

  return (
    <SectionCard
      flush
      className="h-full"
      title="Worth a look"
      description="Counts from the overview, each linking to where you act on it."
    >
      {loading ? (
        <PanelSkeleton rows={4} />
      ) : (
        <ul className="divide-y divide-default/60">
          {rows.map((row) => (
            <HealthRow
              key={row.key}
              href={row.href}
              label={row.label}
              question={row.question}
              value={row.value}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default function AdminDashboard() {
  const [days, setDays] = useState<RangeDays>(30);

  const overviewQuery = useAdminOverview();
  const activityQuery = useAdminActivity(days);

  const overview = useMemo(() => {
    const payload = overviewQuery.data as
      { success?: boolean; data?: IAdminOverview } | undefined;
    if (!payload || payload.success === false) return undefined;
    return payload.data;
  }, [overviewQuery.data]);

  const activity = useMemo(() => {
    const payload = activityQuery.data as
      { success?: boolean; data?: IAdminActivityPoint[] } | undefined;
    if (!payload || payload.success === false) return undefined;
    return Array.isArray(payload.data) ? payload.data : undefined;
  }, [activityQuery.data]);

  const overviewFailed =
    overviewQuery.isError ||
    (overviewQuery.data !== undefined && overview === undefined);
  const overviewLoading = overviewQuery.isLoading && overview === undefined;

  if (overviewLoading) return <DashboardSkeleton />;

  if (overviewFailed || !overview) {
    const message = (overviewQuery.data as { message?: string } | undefined)
      ?.message;

    return (
      <EmptyState
        title="The dashboard could not load"
        description={
          message ||
          "The admin overview did not answer. Check that the API is running, then load it again."
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RetryButton
              onRetry={() => {
                void overviewQuery.refetch();
                void activityQuery.refetch();
              }}
              label="Load the dashboard"
            />
            <Link
              href="/admin/manage-blogs"
              className={`inline-flex min-h-11 items-center rounded-md px-3.5 text-sm font-medium text-default-700 transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`}
            >
              Go to articles instead
            </Link>
          </div>
        }
      />
    );
  }

  const today = overview.today;
  const week = overview.week;

  const headline = [
    {
      key: "views",
      label: "Views this week",
      value: format(week?.views?.value),
      hint: weekHint(week?.views),
      delta: deltaOf(week?.views),
      href: "/admin/analytics",
      icon: <FiEye className="size-4" />,
      accent: true,
    },
    {
      key: "comments",
      label: "Comments this week",
      value: format(week?.comments?.value),
      hint: weekHint(week?.comments),
      delta: deltaOf(week?.comments),
      href: "/admin/manage-comments",
      icon: <FiMessageSquare className="size-4" />,
    },
    {
      key: "members",
      label: "Members joined this week",
      value: format(week?.newMembers?.value),
      hint: weekHint(week?.newMembers),
      delta: deltaOf(week?.newMembers),
      href: "/admin/manage-users",
      icon: <FiUsers className="size-4" />,
    },
    {
      key: "upvotes",
      label: "Upvotes today",
      value: format(today?.upvotes),
      hint: isNumber(today?.views)
        ? `${format(today?.views)} views today`
        : "views today not reported",
      href: "/admin/analytics",
      icon: <FiThumbsUp className="size-4" />,
    },
  ];

  const points = activity ?? [];

  return (
    <div className="space-y-5">
      <section aria-label="This week">
        <div className="grid grid-cols-2 divide-x divide-y divide-default/60 overflow-hidden rounded-xl border border-default/60 bg-content-1 sm:grid-cols-4 sm:divide-y-0">
          {headline.map((metric, index) => (
            <div
              key={metric.key}
              className={`min-w-0 ${
                index >= 2 ? "border-t border-default/60 sm:border-t-0" : ""
              }`}
            >
              <StatTile
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
                delta={metric.delta}
                href={metric.href}
                icon={metric.icon}
                accent={metric.accent}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ActivityBlock
            points={points}
            days={days}
            onDaysChange={setDays}
            loading={activityQuery.isLoading}
            failed={activityQuery.isError}
            onRetry={() => void activityQuery.refetch()}
          />
        </div>

        <div className="min-w-0">
          <HealthBlock
            pending={overview.pending}
            health={overview.health}
            loading={false}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <RecentBlock
          items={Array.isArray(overview.recent) ? overview.recent : []}
          loading={false}
          failed={false}
          onRetry={() => void overviewQuery.refetch()}
        />
        <TopArticlesList articles={overview.topArticles} loading={false} />
        <ContributorsList
          contributors={overview.topContributors}
          loading={false}
        />
      </div>
    </div>
  );
}
