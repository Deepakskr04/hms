"use server";

export interface UploadIdResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Serverless-safe handler for compressed Guest ID photos (WebP).
 * Generates a self-contained data URL (data:image/webp;base64,...)
 * stored directly in PostgreSQL (Guest.idFrontUrl / Guest.idBackUrl).
 * Performs zero disk writes, completely safe for Vercel Serverless & Neon DB.
 */
export async function uploadGuestIdImage(
  formData: FormData
): Promise<UploadIdResult> {
  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No image file provided." };
    }

    // Convert file to Base64 Data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || "image/webp";
    const base64Data = buffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    return {
      success: true,
      url: dataUri,
    };
  } catch (error) {
    console.error("Error processing guest ID image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
}
