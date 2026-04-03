import { notFound, redirect } from "next/navigation";

import { DeleteProjectButton } from "@/components/delete-project-button";
import { EditUploadPanel } from "@/components/edit-upload-panel";
import { TimelineEditor } from "@/components/timeline-editor";
import { getProjectDetails } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const { projectId } = await params;
  const locale = await getServerLocale();
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
              {locale === "en" ? "Edit suite" : "剪輯頁"}
            </p>
            <h1 className="text-4xl tracking-[-0.05em]">{project.name}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
              {locale === "en"
                ? "Completed motion clips are already placed on the timeline. Reorder clips first, then move to background theme selection."
                : "所有已完成的動態片段都已放進時間線。先完成排序，再進入背景主題選擇。"}
            </p>
          </div>
          <DeleteProjectButton projectId={projectId} locale={locale} />
        </div>
      </section>

      <EditUploadPanel
        projectId={projectId}
        currentAssetCount={project.assetCount}
        locale={locale}
      />

      <TimelineEditor
        projectId={projectId}
        initialAssets={project.assets}
        locale={locale}
      />
    </main>
  );
}
