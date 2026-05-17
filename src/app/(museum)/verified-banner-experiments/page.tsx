import { BannerGallery } from "@/components/ui/BannerGallery";
import files from "./files.json";

export default function Page() {
  return (
    <BannerGallery
      title="Verified banner experiments"
      basePath="/verified-banner-experiments"
      files={files}
    />
  );
}
