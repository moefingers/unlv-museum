import { BannerGallery } from "@/components/ui/BannerGallery";
import files from "./files.json";

export default function Page() {
  return (
    <BannerGallery
      title="Banner experiments v3 — multi-sphere, per-bead L recompute"
      basePath="/banner-experiments-v3"
      files={files}
    />
  );
}
