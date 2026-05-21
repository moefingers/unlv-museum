import { ContainerLeafPage } from "@/components/ui/ContainerLeafPage";

/** Reimagined tier of a js-exercises leaf. All routing logic in the primitive. */
export default function Page(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <ContainerLeafPage
      containerId="js-exercises"
      tier="reimagined"
      {...props}
    />
  );
}
