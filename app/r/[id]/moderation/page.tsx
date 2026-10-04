import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/app/lib/db";
import { moderatedCommunityWhere } from "@/app/lib/moderation";
import { ModerationControls } from "@/app/components/ModerationControls";
import { isSiteModerator } from "@/app/lib/moderation";
import { resolveReport } from "@/app/actions";
import { ActionForm } from "@/app/components/ActionForm";
import { SubmitButton } from "@/app/components/SubmitButtons";
import Pagination from "@/app/components/Pagination";
import { pageNumber } from "@/app/lib/validation";
export default async function Moderation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getKindeServerSession().getUser();
  if (!user) redirect("/api/auth/login");
  const { id } = await params;
  const query = await searchParams;
  const community = await prisma.subreddit.findFirst({
    where: moderatedCommunityWhere(user.id, id),
    select: { id: true, removedAt: true },
  });
  if (!community || (community.removedAt && !isSiteModerator(user.id)))
    notFound();
  const where = {
    resolvedAt: null,
    OR: [{ Post: { subName: id } }, { Comment: { Post: { subName: id } } }],
  };
  const [count, reports] = await prisma.$transaction([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 20,
      skip: (pageNumber(query.page) - 1) * 20,
      select: {
        id: true,
        reason: true,
        postId: true,
        Post: { select: { title: true } },
        Comment: { select: { id: true, text: true, postId: true } },
      },
    }),
  ]);
  return (
    <main className="max-w-[800px] mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Moderation in r/{id}</h1>
      {community.removedAt && (
        <p>
          This community is removed from public browsing. Restore it in Site
          moderation.
        </p>
      )}
      {isSiteModerator(user.id) && (
        <Link href="/moderation" className="text-primary underline">
          Site moderation
        </Link>
      )}
      <Link href={`/r/${id}`} className="text-primary underline">
        Back to community
      </Link>
      {!reports.length && <p>No open reports.</p>}
      {reports.map((report) => (
        <article key={report.id} className="border rounded p-4 space-y-3">
          <Link
            href={`/post/${report.postId || report.Comment?.postId}${report.Comment ? `#comment-${report.Comment.id}` : ""}`}
            className="text-primary underline"
          >
            {report.Post?.title || "Reported comment"}
          </Link>
          {report.Comment && (
            <p className="whitespace-pre-wrap break-words">
              {report.Comment.text}
            </p>
          )}
          <p className="break-words">Reason: {report.reason}</p>
          <div className="flex gap-3">
            {["dismiss", "remove"].map((decision) => (
              <ActionForm
                key={decision}
                action={resolveReport}
                confirm={
                  decision === "remove"
                    ? "Remove this content from the community?"
                    : undefined
                }
              >
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="decision" value={decision} />
                <SubmitButton
                  text={
                    decision === "remove" ? "Remove content" : "Dismiss report"
                  }
                  size="sm"
                />
              </ActionForm>
            ))}
          </div>
        </article>
      ))}
      <Pagination totalPages={Math.ceil(count / 20)} />
      <ModerationControls
        scope={id}
        subredditId={community.id}
        page={pageNumber(query.page)}
      />
    </main>
  );
}
