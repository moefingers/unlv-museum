import { redirect } from "next/navigation";
import ApiClient from "../ApiClient";
import { APIS_ENHANCED } from "../api-data";

export default async function ApiClientEnhancedPage({
  searchParams,
}: {
  searchParams: Promise<{ api?: string }>;
}) {
  const { api } = await searchParams;
  if (APIS_ENHANCED.length === 0) {
    // No Enhanced surfaces have shipped yet — fall back to Original so visitors
    // who follow an old /api-client/reimagined link don't land on an empty pane.
    redirect("/api-client");
  }
  const known = APIS_ENHANCED.some((a) => a.id === api);
  if (!known) redirect(`/api-client/enhanced?api=${APIS_ENHANCED[0]!.id}`);
  return <ApiClient tier="enhanced" />;
}
