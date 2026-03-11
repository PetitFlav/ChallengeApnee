export async function fileToDataUrl(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;

  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}
