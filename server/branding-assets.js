const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const specs = {
  og_image: { width: 1200, height: 630, maxBytes: 2 * 1024 * 1024 },
  favicon: { width: 128, height: 128, maxBytes: 256 * 1024 },
};

export function brandingAssetInput(value, key) {
  const spec = specs[key];
  if (!spec) throw new Error("Choose a valid branding asset.");
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    String(value || ""),
  );
  if (!match) throw new Error("Branding assets must be PNG images.");
  const data = Buffer.from(match[1], "base64");
  const validEncoding = data.toString("base64") === match[1];
  const isPng = data.length >= 24 && data.subarray(0, 8).equals(pngSignature);
  const width = isPng ? data.readUInt32BE(16) : 0;
  const height = isPng ? data.readUInt32BE(20) : 0;
  if (
    !validEncoding ||
    !isPng ||
    data.length > spec.maxBytes ||
    width !== spec.width ||
    height !== spec.height
  )
    throw new Error(
      key === "og_image"
        ? "The social image must be a valid 1200 × 630 PNG under 2 MB."
        : "The favicon must be a valid 128 × 128 PNG under 256 KB.",
    );
  return { mime: "image/png", data };
}
