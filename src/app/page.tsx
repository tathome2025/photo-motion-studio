import Link from "next/link";

import { CreateProjectForm } from "@/components/create-project-form";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured, listProjects } from "@/lib/data";
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

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const projects = configured ? await listProjects() : [];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-6 py-8 md:px-10">
      <section className="grid gap-6 border border-[var(--line-strong)] p-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {APP_NAME}
          </p>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl leading-none tracking-[-0.06em] md:text-6xl">
              把相片批量轉成動態影像，再直接排進影片時間線。
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
              這個版本為 GitHub + Vercel 部署而設計，使用 Supabase 管理專案資料與媒體檔案，並預留 KlingAI API 生成與輪詢流程。
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

      <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <CreateProjectForm />

        <div className="grid gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Projects
              </p>
              <h2 className="text-2xl tracking-tight">現有專案</h2>
            </div>
            <div className="text-sm text-[var(--muted)]">{projects.length} projects</div>
          </div>

          {!configured ? (
            <div className="grid min-h-56 place-items-center border border-dashed border-[var(--line)] p-6 text-center text-sm leading-7 text-[var(--muted)]">
              尚未設定 Supabase。先填入 `.env.local`，再執行 `supabase/schema.sql` 建表與建立 storage buckets。
            </div>
          ) : projects.length === 0 ? (
            <div className="grid min-h-56 place-items-center border border-dashed border-[var(--line)] p-6 text-center text-sm leading-7 text-[var(--muted)]">
              目前還沒有專案，先在左側建立第一個。
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={getProjectLink(project.id, project.status)}
                  className="grid gap-6 border border-[var(--line)] p-5 transition hover:border-[var(--text)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                        {project.status}
                      </p>
                      <h3 className="text-2xl tracking-tight">{project.name}</h3>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {project.completedCount}/{project.assetCount}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
                    <div>建立時間</div>
                    <div className="text-right text-[var(--text)]">
                      {formatDate(project.createdAt)}
                    </div>
                    <div>更新時間</div>
                    <div className="text-right text-[var(--text)]">
                      {formatDate(project.updatedAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
