export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";
import AIAssessmentTrigger from "@/components/admin/AIAssessmentTrigger";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const now = new Date();
  
  const [
    totalDebates,
    hiddenDebates,
    pendingFlags,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    recentActions,
  ] = await Promise.all([
    db.debate.count({ where: { isDeleted: false } }), // Exclude deleted, include hidden
    db.debate.count({ where: { isHidden: true, isDeleted: false } }), // Hidden but not deleted
    db.integrityFlag.count({ where: { status: "pending" } }),
    db.user.count({ 
      where: { 
        isDeleted: false, 
        role: { notIn: ["suspended", "banned"] } 
      } 
    }), // Active users only
    db.user.count({ 
      where: { 
        role: "suspended", 
        suspendedUntil: { gt: now },
        isDeleted: false 
      } 
    }), // Currently suspended only
    db.user.count({ where: { role: "banned", isDeleted: false } }), // Currently banned
    db.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const stats = [
    { label: "Total Debates", value: totalDebates, href: "/admin/debates" },
    { label: "Hidden Debates", value: hiddenDebates, href: "/admin/debates?status=hidden" },
    { label: "Pending Flags", value: pendingFlags, href: "/admin/flags", urgent: pendingFlags > 0 },
    { label: "Active Users", value: activeUsers, href: "/admin/users?status=active" },
    { label: "Suspended", value: suspendedUsers, href: "/admin/users?status=suspended" },
    { label: "Banned", value: bannedUsers, href: "/admin/users?status=banned" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-[--radius] border p-4 ${
              s.urgent ? "border-danger/50 bg-danger/5" : "border-border bg-surface"
            }`}
          >
            {s.href ? (
              <Link href={s.href} className="block hover:opacity-80 transition-opacity">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className={`text-xs mt-1 ${s.urgent ? "text-danger" : "text-foreground-muted"}`}>
                  {s.label}
                </p>
              </Link>
            ) : (
              <>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-foreground-muted mt-1">{s.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-[--radius] border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            {[
              { href: "/admin/flags", label: "Review pending integrity flags →" },
              { href: "/admin/users", label: "Manage users →" },
              { href: "/admin/debates", label: "Manage debates →" },
              { href: "/admin/categories", label: "Manage categories →" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="text-sm text-brand hover:underline"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        <AIAssessmentTrigger />

        <div className="rounded-[--radius] border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground mb-4">Recent Admin Actions</h2>
          {recentActions.length === 0 ? (
            <p className="text-sm text-foreground-muted">No actions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentActions.map((a) => (
                <li key={a.id} className="text-sm text-foreground-muted">
                  <span className="font-medium text-foreground">{a.action}</span>
                  {a.reason ? ` — ${a.reason.slice(0, 60)}` : ""}
                  <span className="text-xs text-foreground-subtle ml-2">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
