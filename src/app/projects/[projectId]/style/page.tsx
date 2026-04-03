import { notFound, redirect } from "next/navigation";

import { TemplateMusicSelector } from "@/components/template-music-selector";
import { getProjectDetails } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface StylePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function StylePage({ params }: StylePageProps) {
  const { projectId } = await params;
  const locale = await getServerLocale();
  const project = await getProjectDetails(projectId);

  if (!project) {
    notFound();
  }

  if (project.completedCount === 0) {
    redirect(`/projects/${projectId}/edit`);
  }

  if (project.status === "generating" && project.completedCount < project.assetCount) {
    redirect(`/projects/${projectId}/waiting`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-6 py-8 md:px-10">
      <TemplateMusicSelector
        projectId={projectId}
        assetCount={project.completedCount}
        initialTemplateConfig={project.templateConfig}
        locale={locale}
      />
    </main>
  );
}
