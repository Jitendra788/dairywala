import type { Settings } from "@/lib/types";

export const DEFAULT_DAIRY_LOGO = "/dairy-logo.png";

export function isProfileReady(settings: Settings) {
  return Boolean(settings.profileComplete && settings.dairyName.trim());
}

export function readImageAsLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Sirf image file chalegi."));
      return;
    }
    if (file.size > 4_000_000) {
      reject(new Error("Logo 4 MB se chhota hona chahiye."));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 384;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Logo padh nahi paye."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mime, 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Logo padh nahi paye."));
    };
    img.src = url;
  });
}
