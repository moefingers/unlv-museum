import { redirect } from "next/navigation";
import ApiClient from "./ApiClient";
import { APIS_ORIGINAL } from "./api-data";

export default async function ApiClientOriginalPage({
  searchParams,
}: {
  searchParams: Promise<{ api?: string }>;
}) {
  const { api } = await searchParams;
  const known = APIS_ORIGINAL.some((a) => a.id === api);
  if (!known) redirect(`/api-client?api=${APIS_ORIGINAL[0]!.id}`);
  return <ApiClient tier="original" />;
}
