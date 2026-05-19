/**
 * Post-auth landing pad. Used as a generic safe default when an auth flow
 * doesn't have a specific callbackURL to land on. The museum has no
 * per-tenant routing or per-org dashboards (zcanon does); here we just
 * verify the session and bounce to a trusted callback, or `/` otherwise.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isTrustedCallbackUrl } from "@/lib/callback-validation";

export default async function AuthRedirect({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) redirect("/");

  const { callbackURL } = await searchParams;
  if (callbackURL && isTrustedCallbackUrl(callbackURL)) {
    redirect(callbackURL);
  }
  redirect("/");
}
