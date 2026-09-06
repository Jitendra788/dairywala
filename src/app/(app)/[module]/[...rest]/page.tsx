import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/lib/modules";

type PageProps = {
  params: Promise<{ module: string; rest: string[] }>;
};

export default async function PlannedScreenPage({ params }: PageProps) {
  const { module: slug, rest } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  const path = `/${slug}/${rest.join("/")}`;
  const screen = mod.screens.find(
    (s) => s.path === path || s.path.replaceAll("[id]", "demo") === path,
  );

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-card p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Planned screen
      </p>
      <h1 className="mt-2 font-display text-3xl">
        {screen?.name ?? rest.join(" / ")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {screen?.purpose ??
          "This screen is on the clone plan. The module workspace lists tables and work flow."}
      </p>
      <p className="mt-4 font-mono text-xs text-primary">{path}</p>
      <Link
        href={`/${slug}`}
        className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
      >
        Back to {mod.name}
      </Link>
    </div>
  );
}
