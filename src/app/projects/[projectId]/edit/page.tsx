import { notFound, redirect } from "next/navigation";

import { DeleteProjectButton } from "@/components/delete-project-button";
import { EditUploadPanel } from "@/components/edit-upload-panel";
import { TimelineEditor } from "@/components/timeline-editor";
import { getProjectDetails } from "@/lib/data";

export const dynamic = "force-dynamic";

interface EditPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function EditPage({ params }: EditPageProps) {
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
              Edit suite
            </p>
            <h1 className="text-4xl tracking-[-0.05em]">{project.name}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)]">
              所有已完成的動態片段都已放進時間線。你可以橫向排序，選擇大 preview 片段，再設定過場與版面風格。
            </p>
          </div>
          <DeleteProjectButton projectId={projectId} />
        </div>
      </section>

      <EditUploadPanel
        projectId={projectId}
        currentAssetCount={project.assetCount}
      />

      <TimelineEditor projectId={projectId} initialAssets={project.assets} />
    </main>
  );
}
