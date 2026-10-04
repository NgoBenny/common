import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { participationProblem } from "../lib/restrictions";
import Link from "next/link";
export async function RestrictionNotice({ subName }: { subName?: string }) {
  const user = await getKindeServerSession().getUser();
  const problem = user ? await participationProblem(user.id, subName) : null;
  if (!problem) return null;
  return (
    <aside
      role="status"
      className="mx-auto my-4 max-w-[1100px] rounded-xl border bg-muted p-4 text-sm"
    >
      <p className="break-words">{problem}</p>
      <Link
        href="/contact"
        className="mt-2 inline-flex min-h-11 items-center text-primary underline"
      >
        Contact us about this restriction
      </Link>
    </aside>
  );
}
