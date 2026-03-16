import Link from "next/link";

import { CreateProjectForm } from "@/components/create-project-form";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ProjectStatusPoller } from "@/components/project-status-poller";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured, listProjects } from "@/lib/data";
import { getProjectStatusLabel } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getProjectLink(projectId: string, status: string) {
  if (status === "ready" || status === "rendered" || status === "rendering") {
    return `/projects/${projectId}/edit`;
  }

  if (status === "generating") {
    return `/projects/${projectId}/waiting`;
  }

  return `/projects/${projectId}`;
}

function getProjectCardBorderColor(status: string) {
  if (status === "draft") {
    return "#d47b00";
  }

  if (status === "ready") {
    return "#187301";
  }

  if (status === "generating") {
    return "#8a011a";
  }

  return null;
}

export default async function HomePage() {
  const locale = await getServerLocale();
  const configured = isSupabaseConfigured();
  const projects = configured ? await listProjects() : [];
  const generatingProjectIds = projects
    .filter((project) => project.status === "generating")
    .map((project) => project.id);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-6 py-8 md:px-10">
      <ProjectStatusPoller projectIds={generatingProjectIds} />
      <section className="grid gap-6 border border-[var(--line-strong)] p-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {APP_NAME}
          </p>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl leading-none tracking-[-0.06em] md:text-6xl">
              {locale === "en"
                ? "Turn batches of photos into motion clips, then assemble them directly on a video timeline."
                : "把相片批量轉成動態影像，再直接排進影片時間線。"}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              {locale === "en"
                ? "Built for GitHub and Vercel deployment with project-based media management and automatic generation status updates."
                : "這個版本為 GitHub + Vercel 部署而設計，使用專案資料與媒體檔案管理，並會自動更新生成進度。"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 border border-[var(--line)] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                DB
              </div>
              <div className="mt-2 text-lg">Supabase</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Render
              </div>
              <div className="mt-2 text-lg">ffmpeg.wasm</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Deploy
              </div>
              <div className="mt-2 text-lg">Vercel</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Create
            </p>
            <h2 className="text-2xl tracking-tight">
              {locale === "en" ? "Create project" : "新增專案"}
            </h2>
          </div>
          <CreateProjectForm locale={locale} />
        </div>

        <div className="grid gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Projects
              </p>
              <h2 className="text-2xl tracking-tight">
                {locale === "en" ? "Projects" : "現有專案"}
              </h2>
            </div>
            <div className="text-sm text-[var(--muted)]">
              {projects.length} {locale === "en" ? "projects" : "個專案"}
            </div>
          </div>

          {!configured ? (
            <div className="grid min-h-56 place-items-center border border-dashed border-[var(--line)] p-6 text-center text-sm leading-7 text-[var(--muted)]">
              {locale === "en"
                ? "Supabase is not configured yet. Fill in `.env.local`, then run `supabase/schema.sql` and create the storage buckets."
                : "尚未設定 Supabase。先填入 `.env.local`，再執行 `supabase/schema.sql` 建表與建立 storage buckets。"}
            </div>
          ) : projects.length === 0 ? (
            <div className="grid min-h-56 place-items-center border border-dashed border-[var(--line)] p-6 text-center text-sm leading-7 text-[var(--muted)]">
              {locale === "en"
                ? "No projects yet. Start by creating the first one above."
                : "目前還沒有專案，先在上方建立第一個。"}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => {
                const borderColor = getProjectCardBorderColor(project.status);

                return (
                  <article
                    key={project.id}
                    className="grid gap-6 border border-[var(--line)] p-5 transition hover:border-[var(--text)]"
                    style={
                      borderColor
                        ? {
                            borderColor,
                            borderWidth: 3,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        href={getProjectLink(project.id, project.status)}
                        className="space-y-2"
                      >
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                          {getProjectStatusLabel(project.status, locale)}
                        </p>
                        <h3 className="text-2xl tracking-tight">{project.name}</h3>
                      </Link>
                      <div className="text-right text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {project.completedCount}/{project.assetCount}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
                      <div>{locale === "en" ? "Created" : "建立時間"}</div>
                      <div className="text-right text-[var(--text)]">
                        {formatDate(project.createdAt, locale)}
                      </div>
                      <div>{locale === "en" ? "Updated" : "更新時間"}</div>
                      <div className="text-right text-[var(--text)]">
                        {formatDate(project.updatedAt, locale)}
                      </div>
                    </div>
                    <div className="flex justify-between gap-3">
                      <Link
                        href={getProjectLink(project.id, project.status)}
                        className="inline-flex h-10 items-center justify-center border border-[var(--line)] px-4 text-xs uppercase tracking-[0.2em] transition hover:border-[var(--text)]"
                      >
                        {locale === "en" ? "Open project" : "開啟專案"}
                      </Link>
                      <DeleteProjectButton projectId={project.id} compact locale={locale} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
