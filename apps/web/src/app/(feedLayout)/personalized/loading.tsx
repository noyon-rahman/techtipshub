import BlogCardSkeleton from "@/components/blog-card/skeleton";

const PersonalFeedLoading = () => {
  return (
    <div className="w-full space-y-6">
      <BlogCardSkeleton />
      <BlogCardSkeleton />
      <BlogCardSkeleton />
    </div>
  );
};

export default PersonalFeedLoading;
