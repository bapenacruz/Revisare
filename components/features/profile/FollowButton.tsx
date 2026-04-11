"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  username: string;
  initialFollowing: boolean;
}

export function FollowButton({ username, initialFollowing }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${username}/follow`, { method });
      if (res.ok) {
        const data = await res.json() as { following: boolean };
        setFollowing(data.following);
      }
    });
  };

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      onClick={toggle}
      disabled={pending}
    >
      {following ? (
        <>
          <UserCheck size={14} />
          Following
        </>
      ) : (
        <>
          <UserPlus size={14} />
          Follow
        </>
      )}
    </Button>
  );
}
