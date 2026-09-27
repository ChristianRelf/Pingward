const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export function renderSocialHtml(
  template,
  {
    title,
    siteName,
    description,
    pageUrl,
    accentColor,
    faviconVersion,
    ogImageUrl,
  },
) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const tags = [
    `<meta name="description" content="${safeDescription}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDescription}" />`,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
  ];
  if (ogImageUrl) {
    const safeImageUrl = escapeHtml(ogImageUrl);
    tags.push(
      `<meta property="og:image" content="${safeImageUrl}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${safeTitle}" />`,
      `<meta name="twitter:image" content="${safeImageUrl}" />`,
    );
  }
  return template
    .replace(/<title>.*?<\/title>/s, `<title>${safeTitle}</title>`)
    .replace(
      /<meta name="theme-color" content="[^"]*"\s*\/>/,
      `<meta name="theme-color" content="${escapeHtml(accentColor)}" />`,
    )
    .replace(
      /<link rel="icon"[^>]*>/,
      `<link rel="icon" href="/favicon?v=${Number(faviconVersion) || 0}" />`,
    )
    .replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}
