import { ContainerLeafPage } from "@/components/ui/ContainerLeafPage";

export default function Page(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <ContainerLeafPage
      containerId="react-exercises"
      tier="enhanced"
      {...props}
    />
  );
}
