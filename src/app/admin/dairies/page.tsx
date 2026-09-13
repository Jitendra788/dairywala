import { DairiesAdmin } from "@/components/admin/dairies-admin";

type Props = { searchParams: Promise<{ status?: string }> };

export default async function DairiesPage({ searchParams }: Props) {
  const { status } = await searchParams;
  return <DairiesAdmin status={status || "all"} />;
}
