import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WaitingRoom } from "@/components/waiting-room";
import { getProjectDetails } from "@/lib/data";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface WaitingPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function WaitingPage({ params }: WaitingPageProps) {
  const { projectId } = await params;
  const locale = await getServerLocale();
  const project = await getProjectDetails(projectId);

  if (!project) {
    notFound();
  }

  if (project.status === "ready" || project.completedCount === project.assetCount) {
    redirect(`/projects/${projectId}/edit`);
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-8 px-6 py-8 md:px-10">
      <section className="flex items-end justify-between border border-[var(--line-strong)] p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {locale === "en" ? "Generation queue" : "生成佇列"}
          </p>
          <h1 className="text-4xl tracking-[-0.05em]">{project.name}</h1>
        </div>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 text-sm uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
        >
          {locale === "en" ? "Back home" : "回到首頁"}
        </Link>
      </section>

      <WaitingRoom
        projectId={projectId}
        initialTotal={project.assetCount}
        initialCompleted={project.completedCount}
        locale={locale}
      />
    </main>
  );
}
