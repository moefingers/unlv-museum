import { redirect } from "next/navigation";

/**
 * Stale-link redirect: the old path-segment Enhanced route consolidated
 * into `?v=2` on the single /api-client route. The api-client is one
 * viewer above the tier system; `?v=` is the URL knob that selects
 * which API version's endpoint list to show.
 *
 * Forwards `?api=` along so visitors with a deep-linked bookmark land
 * on the right API.
 */
export default async function ApiClientEnhancedRedirect({
  searchParams,
}: {
  searchParams: Promise<{ api?: string }>;
}) {
  const { api } = await searchParams;
  const params = new URLSearchParams();
  params.set("v", "2");
  if (api) params.set("api", api);
  redirect(`/api-client?${params.toString()}`);
}
