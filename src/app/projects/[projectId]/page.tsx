import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UploadPromptBoard } from "@/components/upload-prompt-board";
import { getProjectDetails } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = await getProjectDetails(projectId);

  if (!project) {
    notFound();
  }

  if (project.status === "generating") {
    redirect(`/projects/${projectId}/waiting`);
  }

  if (project.status === "ready" || project.status === "rendered" || project.status === "rendering") {
    redirect(`/projects/${projectId}/edit`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-6 py-8 md:px-10">
      <section className="grid gap-4 border border-[var(--line-strong)] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Project setup
            </p>
            <h1 className="text-4xl tracking-[-0.05em]">{project.name}</h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
          >
            返回首頁
          </Link>
        </div>
        <div className="grid gap-3 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)] md:grid-cols-3">
          <div>建立時間：<span className="text-[var(--text)]">{formatDate(project.createdAt)}</span></div>
          <div>現有相片：<span className="text-[var(--text)]">{project.assetCount}</span></div>
          <div>已完成動態：<span className="text-[var(--text)]">{project.completedCount}</span></div>
        </div>
      </section>

      <UploadPromptBoard projectId={projectId} initialAssets={project.assets} />
    </main>
  );
}
