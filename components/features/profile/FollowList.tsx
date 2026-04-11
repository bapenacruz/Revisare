import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Users } from "lucide-react";

type FollowUser = {
  id: string;
  username: string;
  elo: number;
  country: string | null;
};

interface FollowListProps {
  users: FollowUser[];
  emptyMessage: string;
}

export function FollowList({ users, emptyMessage }: FollowListProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <Users size={32} className="opacity-20 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {users.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.username}`}
          className="flex items-center gap-3 py-3 px-1 hover:bg-surface-raised rounded-[--radius] transition-colors"
        >
          <Avatar initial={user.username[0].toUpperCase()} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
            {user.country && (
              <p className="text-xs text-foreground-subtle truncate">{user.country}</p>
            )}
          </div>
          <Badge variant="brand" size="sm">{user.elo}</Badge>
        </Link>
      ))}
    </div>
  );
}
