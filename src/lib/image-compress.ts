"use client";

/**
 * Compresses an image file client-side to WebP format with a target size under 100KB.
 */
export async function compressImageToWebP(
  file: File | Blob,
  maxDimension = 1280,
  targetMaxSizeBytes = 100 * 1024
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Scale down proportionally if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Unable to obtain 2D canvas context"));
        return;
      }

      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Binary search / iterative quality adjustment to stay < targetMaxSizeBytes
      let quality = 0.8;
      let blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, "image/webp", quality)
      );

      if (blob && blob.size > targetMaxSizeBytes) {
        quality = 0.6;
        blob = await new Promise((res) =>
          canvas.toBlob(res, "image/webp", quality)
        );
      }

      if (blob && blob.size > targetMaxSizeBytes) {
        quality = 0.45;
        blob = await new Promise((res) =>
          canvas.toBlob(res, "image/webp", quality)
        );
      }

      if (!blob) {
        reject(new Error("Failed to compress image to WebP"));
        return;
      }

      const compressedFileName =
        file instanceof File
          ? file.name.replace(/\.[^/.]+$/, "") + ".webp"
          : `id-photo-${Date.now()}.webp`;

      const compressedFile = new File([blob], compressedFileName, {
        type: "image/webp",
      });

      resolve(compressedFile);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}
