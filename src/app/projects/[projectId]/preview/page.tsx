import { notFound, redirect } from "next/navigation";

import { RenderPreviewPanel } from "@/components/render-preview-panel";
import { getProjectDetails } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { projectId } = await params;
  const locale = await getServerLocale();
  const project = await getProjectDetails(projectId);

  if (!project) {
    notFound();
  }

  if (!project.templateConfig) {
    redirect(`/projects/${projectId}/style`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-6 py-8 md:px-10">
      <RenderPreviewPanel
        projectId={projectId}
        projectName={project.name}
        assets={project.assets}
        templateConfig={project.templateConfig}
        locale={locale}
      />
    </main>
  );
}
