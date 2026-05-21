import { redirect } from "next/navigation";
import { firstLeafSlug } from "@/lib/project-route";

/**
 * /js-exercises → redirect to the container's first leaf.
 * Default-leaf comes from the array order in PROJECTS — the
 * structurally-correct shape is to derive it from data rather than
 * hardcoding "web-game" here.
 */
export default function Page() {
  redirect(`/js-exercises/${firstLeafSlug("js-exercises")}`);
}
