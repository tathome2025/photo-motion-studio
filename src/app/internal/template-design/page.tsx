import { STUDIO_TEMPLATE_PRESETS } from "@/lib/constants";

export const dynamic = "force-static";

export default function TemplateDesignPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-6 px-6 py-8 md:px-10">
      <section className="grid gap-3 border border-[var(--line-strong)] p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Internal</p>
        <h1 className="text-4xl tracking-[-0.05em]">Template Design</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          Internal template reference page. End users only choose one of these presets and do
          not edit template internals.
        </p>
      </section>

      <section className="grid gap-3">
        {STUDIO_TEMPLATE_PRESETS.map((template) => (
          <article key={template.key} className="grid gap-2 border border-[var(--line)] p-4">
            <h2 className="text-xl tracking-tight">{template.label}</h2>
            <p className="text-sm text-[var(--muted)]">{template.description}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              transition: {template.transitionKey} · theme: {template.themeKey} · frame:{" "}
              {template.frameStyleKey}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
