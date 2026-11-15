import { revalidatePath } from "next/cache";

export function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // In standalone scripts or tests outside Next request context, silently ignore
  }
}
