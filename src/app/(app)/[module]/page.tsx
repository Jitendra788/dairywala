import { notFound } from "next/navigation";
import { ModuleWorkspace } from "@/components/module-workspace";
import { getModule, modules } from "@/lib/modules";

type PageProps = {
  params: Promise<{ module: string }>;
};

export function generateStaticParams() {
  return modules.map((mod) => ({ module: mod.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { module: slug } = await params;
  const mod = getModule(slug);
  return {
    title: mod ? `${mod.name} — Tony Dairy` : "Tony Dairy",
  };
}

export default async function ModulePage({ params }: PageProps) {
  const { module: slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();
  return <ModuleWorkspace module={mod} />;
}
