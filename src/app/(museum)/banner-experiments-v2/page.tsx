import { BannerGallery } from "@/components/ui/BannerGallery";
import files from "./files.json";

export default function Page() {
  return (
    <BannerGallery
      title="Banner experiments v2 — stepwise light validation"
      basePath="/banner-experiments-v2"
      files={files}
    />
  );
}
