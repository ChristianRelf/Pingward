import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { createServer as createNetServer } from "node:net";

function pngDataUrl(width, height) {
  const data = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(data);
  data.write("IHDR", 12, "ascii");
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return `data:image/png;base64,${data.toString("base64")}`;
}

const testDir = mkdtempSync(join(tmpdir(), "pingward-test-"));
process.env.DATA_DIR = testDir;
const { app } = await import("./index.js");
const { db } = await import("./db.js");

test("admin can set up an instance, monitor a URL, and publish a grouped status page", async (t) => {
  const target = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  let checkStatus = 200;
  const checkTarget = await new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(checkStatus);
      res.end(checkStatus === 200 ? "healthy" : "unavailable");
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
  const sentMail = [];
  const smtp = await new Promise((resolve) => {
    const server = createNetServer((socket) => {
      socket.write("220 localhost ESMTP test\r\n");
      let buffer = "";
      let inData = false;
      let message = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let end;
        while ((end = buffer.indexOf("\r\n")) !== -1) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (inData) {
            if (line === ".") {
              sentMail.push(message);
              message = "";
              inData = false;
              socket.write("250 Message accepted\r\n");
            } else message += `${line}\n`;
          } else if (line.startsWith("EHLO") || line.startsWith("HELO"))
            socket.write("250-localhost\r\n250 SIZE 1000000\r\n");
          else if (line.startsWith("DATA")) {
            inData = true;
            socket.write("354 End data with .\r\n");
          } else if (line.startsWith("QUIT")) {
            socket.write("221 Bye\r\n");
            socket.end();
          } else socket.write("250 OK\r\n");
        }
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
  t.after(() => {
    target.close();
    checkTarget.close();
    smtp.close();
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${target.address().port}`;
  const checkUrl = `http://127.0.0.1:${checkTarget.address().port}/health`;
  let cookie = "";
  async function request(path, method = "GET", body) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, body: await response.json() };
  }

  process.env.SETUP_TOKEN = "test-setup-token-value";
  assert.equal((await request("/public")).body.settings.theme, "dark");
  assert.equal((await request("/bootstrap")).body.needs_setup, true);
  assert.equal((await request("/bootstrap")).body.requires_setup_token, true);
  assert.equal(
    (
      await request("/setup", "POST", {
        email: "admin@example.com",
        password: "strong-password-123",
      })
    ).status,
    403,
  );
  const setup = await request("/setup", "POST", {
    email: "admin@example.com",
    password: "strong-password-123",
    setup_token: process.env.SETUP_TOKEN,
  });
  delete process.env.SETUP_TOKEN;
  assert.equal(setup.status, 201);
  assert.equal(
    (await request("/bootstrap")).body.admin.email,
    "admin@example.com",
  );
  assert.equal(
    (
      await request("/setup", "POST", {
        email: "other@example.com",
        password: "strong-password-123",
      })
    ).status,
    409,
  );

  const group = await request("/admin/groups", "POST", {
    name: "Core services",
    slug: "core-services",
    description: "Essential systems",
    website_url: "https://rnl.example.com",
    custom_domain: "status.example.com",
    display_mode: "inline",
  });
  assert.equal(group.status, 201);
  const groupId = group.body.id;
  assert.equal(
    (
      await request("/admin/groups", "POST", {
        name: "Unsafe link",
        slug: "unsafe-link",
        website_url: "javascript:alert(1)",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/admin/groups", "POST", {
        name: "Duplicate domain",
        slug: "duplicate-domain",
        custom_domain: "status.example.com",
      })
    ).status,
    409,
  );
  const pageGroup = await request("/admin/groups", "POST", {
    name: "Other services",
    slug: "other-services",
    display_mode: "page",
  });
  assert.equal(pageGroup.status, 201);
  assert.equal(
    (
      await request(`/admin/groups/${pageGroup.body.id}`, "PUT", {
        name: "Other services",
        slug: "other-services",
        display_mode: "inline",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/admin/groups/${pageGroup.body.id}`, "PUT", {
        name: "Other services",
        slug: "other-services",
        display_mode: "page",
      })
    ).status,
    200,
  );
  const monitor = await request("/admin/monitors", "POST", {
    name: "Website",
    type: "http",
    target: checkUrl,
    interval_seconds: 60,
    timeout_seconds: 10,
    expected_status: 200,
    active: true,
    group_ids: [groupId],
    logo_mode: "preset",
    logo_preset: "globe",
  });
  assert.equal(monitor.status, 201);
  const monitorId = monitor.body.id;
  const check = await request(`/admin/monitors/${monitorId}/check`, "POST");
  assert.ok(check.body.status === "up" || check.body.busy);
  if (check.body.busy) await new Promise((resolve) => setTimeout(resolve, 100));

  const event = await request("/admin/events", "POST", {
    title: "Welcome",
    body: "Monitoring is live.",
    kind: "info",
    group_id: groupId,
    published: true,
  });
  assert.equal(event.status, 201);
  const page = await request("/public?group=core-services");
  assert.equal(page.body.selected_group, groupId);
  assert.equal(page.body.monitors[0].name, "Website");
  assert.equal(page.body.monitors[0].status, "up");
  assert.equal(page.body.monitors[0].uptime, 100);
  assert.equal(page.body.events[0].title, "Welcome");
  assert.equal(page.body.monitors[0].logo_preset, "globe");
  assert.equal(page.body.monitors[0].has_logo, false);
  assert.equal(
    page.body.groups.find((item) => item.id === groupId).display_mode,
    "inline",
  );
  assert.equal(
    page.body.groups.find((item) => item.id === groupId).website_url,
    "https://rnl.example.com",
  );
  assert.equal(
    (await request("/public")).body.groups.find(
      (item) => item.id === pageGroup.body.id,
    ).display_mode,
    "page",
  );
  const domainPage = await new Promise((resolve, reject) => {
    httpRequest(
      `${base}/api/public`,
      { headers: { Host: "status.example.com" } },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve(JSON.parse(body)));
      },
    )
      .on("error", reject)
      .end();
  });
  assert.equal(domainPage.selected_group, groupId);
  assert.equal((await request("/public?group=missing")).status, 404);

  const logoUpdate = {
    name: "Website",
    type: "http",
    target: checkUrl,
    interval_seconds: 60,
    timeout_seconds: 10,
    expected_status: 200,
    active: true,
    group_ids: [groupId],
    logo_mode: "upload",
  };
  const badLogo = await request(`/admin/monitors/${monitorId}`, "PUT", {
    ...logoUpdate,
    logo_image: "data:image/svg+xml;base64,PHN2Zy8+",
  });
  assert.equal(badLogo.status, 400);
  const oversizedLogo = await request(`/admin/monitors/${monitorId}`, "PUT", {
    ...logoUpdate,
    logo_image: `data:image/png;base64,${Buffer.alloc(512 * 1024 + 1).toString("base64")}`,
  });
  assert.equal(oversizedLogo.status, 400);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQO9HzHwAE7AJyoSoi2AAAAABJRU5ErkJggg==",
    "base64",
  );
  assert.equal(
    (
      await request(`/admin/monitors/${monitorId}`, "PUT", {
        ...logoUpdate,
        logo_image: `data:image/png;base64,${png.toString("base64")}`,
      })
    ).status,
    200,
  );
  const logoResponse = await fetch(`${base}/api/monitor-logos/${monitorId}`);
  assert.equal(logoResponse.status, 200);
  assert.match(logoResponse.headers.get("content-type"), /^image\/png/);
  assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()), png);
  assert.equal((await request("/public")).body.monitors[0].has_logo, true);

  const settings = await request("/admin/settings", "PUT", {
    site_name: "Example Status",
    site_description: "Systems",
    theme: "dark",
    layout: "list",
    bar_style: "heatmap",
    accent_color: "#3b82f6",
    brand_icon: "shield",
    page_width: "wide",
    density: "compact",
    corner_style: "subtle",
    show_admin_link: "false",
    show_response_time: "false",
    footer_text: "Status from Example Inc.",
    public_url: "https://status.example.com",
    smtp_host: "127.0.0.1",
    smtp_port: String(smtp.address().port),
    smtp_user: "",
    smtp_from: "status@example.com",
    smtp_to: "team@example.com",
    smtp_secure: "false",
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.settings.accent_color, "#3b82f6");
  const branding = await request("/admin/branding-assets", "PUT", {
    og_image: pngDataUrl(1200, 630),
    favicon: pngDataUrl(128, 128),
  });
  assert.equal(branding.status, 200);
  assert.equal(branding.body.branding.has_og_image, true);
  assert.equal(
    (await fetch(`${base}/og-image.png`)).headers.get("content-type"),
    "image/png",
  );
  assert.equal(
    (await fetch(`${base}/favicon`)).headers.get("content-type"),
    "image/png",
  );
  assert.equal((await request("/admin/data")).body.branding.has_favicon, true);
  const publicSettings = (await request("/public")).body.settings;
  assert.equal(publicSettings.brand_icon, "shield");
  assert.equal(publicSettings.page_width, "wide");
  assert.equal(publicSettings.show_admin_link, "false");
  assert.equal(publicSettings.footer_text, "Status from Example Inc.");
  assert.equal(
    (
      await request("/admin/settings", "PUT", {
        ...settings.body.settings,
        accent_color: "blue",
      })
    ).status,
    400,
  );
  assert.equal((await request("/admin/smtp/test", "POST")).status, 200);
  checkStatus = 503;
  assert.equal(
    (await request(`/admin/monitors/${monitorId}/check`, "POST")).body.status,
    "down",
  );
  assert.equal(
    (await request("/public?group=core-services")).body.monitors[0].status,
    "down",
  );
  checkStatus = 200;
  assert.equal(
    (await request(`/admin/monitors/${monitorId}/check`, "POST")).body.status,
    "up",
  );
  for (let attempt = 0; attempt < 20 && sentMail.length < 3; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(sentMail.length, 3);
  assert.ok(sentMail.some((mail) => mail.includes("Test alert")));
  assert.ok(sentMail.some((mail) => mail.includes("DOWN")));
  assert.ok(sentMail.some((mail) => mail.includes("UP")));
  assert.equal(
    (
      await request(`/admin/monitors/${monitorId}`, "PUT", {
        name: "Website",
        type: "http",
        target: `${checkUrl}?updated=1`,
        interval_seconds: 60,
        timeout_seconds: 10,
        expected_status: 200,
        active: true,
        group_ids: [groupId],
      })
    ).status,
    200,
  );
  let editedMonitor;
  for (let attempt = 0; attempt < 20; attempt++) {
    editedMonitor = (await request("/public?group=core-services")).body
      .monitors[0];
    if (editedMonitor.status === "up") break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(editedMonitor.status, "up");
  assert.equal(editedMonitor.has_logo, true);
  assert.equal(
    (await fetch(`${base}/api/monitor-logos/${monitorId}`)).status,
    200,
  );
  assert.equal(
    editedMonitor.history.reduce((sum, day) => sum + day.total, 0),
    1,
  );
  assert.equal((await request("/public")).body.settings.bar_style, "heatmap");
  assert.equal(
    (await request("/admin/data")).body.monitors[0].group_ids[0],
    groupId,
  );

  assert.equal(
    (
      await request(`/admin/monitors/${monitorId}`, "PUT", {
        ...logoUpdate,
        target: `${checkUrl}?updated=1`,
        logo_mode: "preset",
        logo_preset: "database",
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(`${base}/api/monitor-logos/${monitorId}`)).status,
    404,
  );
  assert.equal(
    (await request("/public")).body.monitors[0].logo_preset,
    "database",
  );

  assert.equal(
    (await request(`/admin/monitors/${monitorId}`, "DELETE")).status,
    200,
  );
  assert.equal((await request("/public")).body.monitors.length, 0);
  assert.equal((await request("/logout", "POST")).status, 200);
  assert.equal((await request("/admin/data")).status, 401);
  assert.equal(
    (
      await request("/login", "POST", {
        email: "admin@example.com",
        password: "strong-password-123",
      })
    ).status,
    200,
  );
});
