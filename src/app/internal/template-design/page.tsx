import { TemplateDesignEditor } from "@/components/template-design-editor";
import { listStudioTemplatePresets } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TemplateDesignPage() {
  const templates = await listStudioTemplatePresets();

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-6 px-6 py-8 md:px-10">
      <section className="grid gap-3 border border-[var(--line-strong)] p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Internal</p>
        <h1 className="text-4xl tracking-[-0.05em]">Template Design</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          Internal visual editor. You can tune Theme, Frame, and Transition in a live stage
          preview before saving each template.
        </p>
      </section>

      <TemplateDesignEditor initialTemplates={templates} />
    </main>
  );
}
