import { redirect } from "next/navigation";
import ApiClient from "../ApiClient";
import { APIS_REIMAGINED } from "../api-data";

export default async function ApiClientReimaginedPage({
  searchParams,
}: {
  searchParams: Promise<{ api?: string }>;
}) {
  const { api } = await searchParams;
  const known = APIS_REIMAGINED.some((a) => a.id === api);
  if (!known) redirect(`/api-client/reimagined?api=${APIS_REIMAGINED[0]!.id}`);
  return <ApiClient tier="reimagined" />;
}
