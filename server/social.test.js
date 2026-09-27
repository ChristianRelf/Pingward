import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSocialHtml } from "./social.js";

const template = `<!doctype html><html><head>
<meta name="theme-color" content="#101d1c" />
<link rel="icon" href="/favicon" />
<title>Pingward</title></head><body></body></html>`;

test("renders crawler-readable branding and social image metadata", () => {
  const html = renderSocialHtml(template, {
    title: "RNL <Status> · Status",
    siteName: "Example & Co",
    description: 'Updates from "RNL"',
    pageUrl: "https://status.example.com/status/rnl",
    accentColor: "#3b82f6",
    faviconVersion: 123,
    ogImageUrl: "https://status.example.com/og-image.png?v=456",
  });
  assert.match(html, /<title>RNL &lt;Status&gt; · Status<\/title>/);
  assert.match(html, /property="og:site_name" content="Example &amp; Co"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(
    html,
    /property="og:image" content="https:\/\/status\.example\.com\/og-image\.png\?v=456"/,
  );
  assert.match(html, /<link rel="icon" href="\/favicon\?v=123" \/>/);
  assert.match(html, /name="theme-color" content="#3b82f6"/);
});

test("omits image metadata until an image has been generated", () => {
  const html = renderSocialHtml(template, {
    title: "Example status",
    siteName: "Example",
    description: "Service health",
    pageUrl: "https://status.example.com",
    accentColor: "#21ab75",
    faviconVersion: 0,
    ogImageUrl: "",
  });
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.doesNotMatch(html, /property="og:image"/);
});
