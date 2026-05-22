import { redirect } from "next/navigation";
import ApiClient from "./ApiClient";
import { APIS_ORIGINAL, APIS_ENHANCED } from "./api-data";

/**
 * The single api-client viewer. ONE route, ONE component, two URL-knob
 * states (`?v=1` default, `?v=2` Enhanced). The api-client itself is
 * tier-agnostic infrastructure that lives ABOVE the museum's tier
 * system — it just displays a different endpoint list per version.
 *
 * Why a single route (not /api-client + /api-client/v2 path segments):
 * the underlying client is conceptually ONE viewer in different states,
 * not two separate viewers. Path-segment routes would imply two
 * different things. React 19's `<ViewTransition>` (wrapping the
 * version-sensitive body inside ApiClient) fires the cross-fade on
 * `?v=` flips just as cleanly as it would on a route-segment swap,
 * since the boundary triggers on any React update of its wrapped
 * content — not specifically on Next route changes.
 *
 * The earlier /api-client/enhanced route exists at ./enhanced/page.tsx
 * as a stale-link redirect → ?v=2.
 */
export default async function ApiClientPage({
  searchParams,
}: {
  searchParams: Promise<{ api?: string; v?: string }>;
}) {
  const { api, v } = await searchParams;
  const tier = v === "2" ? "enhanced" : "original";
  const list = tier === "enhanced" ? APIS_ENHANCED : APIS_ORIGINAL;
  if (tier === "enhanced" && list.length === 0) {
    // No Enhanced surfaces yet — fall back to v1 so a stale `?v=2` link
    // doesn't land on an empty pane.
    redirect("/api-client");
  }
  const known = list.some((a) => a.id === api);
  if (!known) {
    const params = new URLSearchParams();
    params.set("api", list[0]!.id);
    if (tier === "enhanced") params.set("v", "2");
    redirect(`/api-client?${params.toString()}`);
  }
  return <ApiClient tier={tier} />;
}
