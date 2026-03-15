import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RegenerateBoard } from "@/components/regenerate-board";
import { getProjectDetails } from "@/lib/data";

export const dynamic = "force-dynamic";

interface RegeneratePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function RegeneratePage({ params }: RegeneratePageProps) {
  const { projectId } = await params;
  const project = await getProjectDetails(projectId);

  if (!project) {
    notFound();
  }

  if (project.completedCount === 0) {
    redirect(`/projects/${projectId}`);
  }

  if (project.status === "generating" && project.completedCount < project.assetCount) {
    redirect(`/projects/${projectId}/waiting`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-6 py-8 md:px-10">
      <section className="grid gap-3 border border-[var(--line-strong)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Regenerate suite
            </p>
            <h1 className="text-4xl tracking-[-0.05em]">{project.name}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
              在這裡一次過看到所有縮圖，再逐張勾選與設定重新生成動作。
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/edit`}
            className="inline-flex h-10 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
          >
            返回剪輯頁
          </Link>
        </div>
      </section>

      <RegenerateBoard projectId={projectId} initialAssets={project.assets} />
    </main>
  );
}
