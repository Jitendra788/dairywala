import { SubscriptionsAdmin } from "@/components/admin/subscriptions-admin";

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function SubscriptionsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  return <SubscriptionsAdmin tab={tab || "plans"} />;
}
