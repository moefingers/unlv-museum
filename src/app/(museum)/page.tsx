import { ViewTransition } from "react";
import { LandingView } from "@/components/ui/LandingView";

export default function Home() {
  // Naming the body `page-content` opts it into the keyframed fade+blur+slide
  // pair defined in globals.css. Without a name, the body uses the default
  // root crossfade, which is too fast (≈200ms) for navigations to feel
  // intentional. See CONTEXT/internal_docs/view-transitions.md (zcanon) and
  // CONTEXT/vendor_docs/nextjs-view-transitions.md for the pattern.
  return (
    <ViewTransition name="page-content">
      <LandingView />
    </ViewTransition>
  );
}
