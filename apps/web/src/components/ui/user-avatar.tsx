import { cn } from "@heroui/react";
import { Avatar } from "@heroui/avatar";
import type { AvatarProps } from "@heroui/avatar";

/**
 * A circle of someone's face, or their initial, with the site's one outline.
 *
 * HeroUI's `isBordered` is not a hairline: it paints a 2px ring in the colour
 * slot with a 2px gap, so the mixed call sites had three different looks
 * (amber on admins, amber on profile headers, none anywhere else). The outline
 * is an edge here, so it is a 1px neutral ring sitting on the edge itself: no
 * offset, no colour slot. DESIGN.md draws separation with hairlines, and an
 * amber ring would make every avatar an accent.
 */
export type UserAvatarProps = Omit<AvatarProps, "isBordered">;

const UserAvatar = ({ className, classNames, ...props }: UserAvatarProps) => (
  <Avatar
    {...props}
    radius="full"
    className={cn("ring-1 ring-default-400", className)}
    classNames={classNames}
  />
);

export default UserAvatar;
