import { redirect } from "next/navigation";
import { firstLeafSlug } from "@/lib/project-route";

export default function Page() {
  redirect(`/html-fundamentals/${firstLeafSlug("html-fundamentals")}`);
}
