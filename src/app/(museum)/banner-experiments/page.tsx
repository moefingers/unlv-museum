import { BannerGallery } from "@/components/ui/BannerGallery";
import files from "./files.json";

export default function Page() {
  return (
    <BannerGallery
      title="Banner experiments"
      basePath="/banner-experiments"
      files={files}
    />
  );
}
