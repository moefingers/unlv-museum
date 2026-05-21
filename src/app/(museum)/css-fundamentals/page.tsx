import { redirect } from "next/navigation";
import { firstLeafSlug } from "@/lib/project-route";

export default function Page() {
  redirect(`/css-fundamentals/${firstLeafSlug("css-fundamentals")}`);
}
