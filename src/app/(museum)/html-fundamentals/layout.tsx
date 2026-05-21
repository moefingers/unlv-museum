import { ContainerLayout } from "@/components/ui/ContainerLayout";

/** Persistent layout for /html-fundamentals/<slug>(/<tier>)?. See js-exercises/layout.tsx for the rationale. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ContainerLayout containerId="html-fundamentals">
      {children}
    </ContainerLayout>
  );
}
