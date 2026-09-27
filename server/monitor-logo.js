import {
  DEFAULT_MONITOR_LOGO,
  MONITOR_LOGO_PRESETS,
} from "../shared/monitor-logos.js";

const presetIds = new Set(MONITOR_LOGO_PRESETS.map((preset) => preset.id));
const maxLogoBytes = 512 * 1024;

function decodeLogo(value) {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match)
    throw new Error("Upload a PNG, JPEG, or WebP image for the monitor logo.");
  const [, mime, encoded] = match;
  const data = Buffer.from(encoded, "base64");
  if (
    !data.length ||
    data.length > maxLogoBytes ||
    data.toString("base64") !== encoded
  )
    throw new Error("Monitor logos must be valid images smaller than 512 KB.");
  const png =
    mime === "image/png" &&
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const jpeg =
    mime === "image/jpeg" &&
    data.length >= 4 &&
    data.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  const webp =
    mime === "image/webp" &&
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp)
    throw new Error("The uploaded file does not match its image type.");
  return { mime, data };
}

export function monitorLogoInput(input, old = null) {
  const hasLogoFields = ["logo_mode", "logo_preset", "logo_image"].some((key) =>
    Object.hasOwn(input, key),
  );
  if (!hasLogoFields && old)
    return {
      preset: old.logo_preset || DEFAULT_MONITOR_LOGO,
      mime: old.logo_mime,
      data: old.logo_data,
      updatedAt: old.logo_updated_at,
    };

  const mode = input.logo_mode || (input.logo_image ? "upload" : "preset");
  if (!["preset", "upload"].includes(mode))
    throw new Error("Choose a preset or uploaded monitor logo.");
  const preset = input.logo_preset || old?.logo_preset || DEFAULT_MONITOR_LOGO;
  if (!presetIds.has(preset)) throw new Error("Choose a valid monitor logo.");

  if (mode === "preset")
    return { preset, mime: null, data: null, updatedAt: Date.now() };
  if (input.logo_image) {
    const { mime, data } = decodeLogo(input.logo_image);
    return { preset, mime, data, updatedAt: Date.now() };
  }
  if (old?.logo_data)
    return {
      preset,
      mime: old.logo_mime,
      data: old.logo_data,
      updatedAt: old.logo_updated_at,
    };
  throw new Error("Choose an image to upload for this monitor.");
}
