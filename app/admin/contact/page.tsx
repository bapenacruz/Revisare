export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { ContactMessagesTable } from "./ContactMessagesTable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Contact Messages" };

export default async function AdminContactPage() {
  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {messages.filter((m) => m.status === "unread").length} unread
        </p>
      </div>
      <ContactMessagesTable initialMessages={messages} />
    </div>
  );
}
