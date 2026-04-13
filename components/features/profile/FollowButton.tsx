"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Clock, UserPlus, UserCheck } from "lucide-react";

type Status = "none" | "following" | "pending";

interface FollowButtonProps {
  username: string;
  initialFollowing: boolean;
  initialPending?: boolean;
}

export function FollowButton({ username, initialFollowing, initialPending }: FollowButtonProps) {
  const [status, setStatus] = useState<Status>(
    initialFollowing ? "following" : initialPending ? "pending" : "none"
  );
  const [transition, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      if (status === "following" || status === "pending") {
        // Unfollow or cancel request
        const res = await fetch(`/api/users/${username}/follow`, { method: "DELETE" });
        if (res.ok) setStatus("none");
      } else {
        const res = await fetch(`/api/users/${username}/follow`, { method: "POST" });
        if (res.ok) {
          const data = await res.json() as { following: boolean; pending: boolean };
          setStatus(data.following ? "following" : data.pending ? "pending" : "none");
        }
      }
    });
  };

  if (status === "following") {
    return (
      <Button variant="secondary" size="sm" onClick={toggle} disabled={transition}>
        <UserCheck size={14} />
        Following
      </Button>
    );
  }

  if (status === "pending") {
    return (
      <Button variant="ghost" size="sm" onClick={toggle} disabled={transition} title="Cancel follow request">
        <Clock size={14} />
        Requested
      </Button>
    );
  }

  return (
    <Button variant="primary" size="sm" onClick={toggle} disabled={transition}>
      <UserPlus size={14} />
      Follow
    </Button>
  );
}
