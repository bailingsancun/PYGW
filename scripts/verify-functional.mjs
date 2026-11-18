/** Browser regressions. Start the app first, then WEB_BASE=http://127.0.0.1:5173 npm run verify:functional.
 * AI responses are deterministic fixtures. Set PIYING_RESPONSE_FILE to replay a real provider response.
 * No paid model requests are made by this script.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
const BASE = (process.env.WEB_BASE || "http://127.0.0.1:5173").replace(
  /\/+$/,
  "",
);
const OUT = path.resolve(process.env.VERIFY_OUT || ".artifacts/functional");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
]
  .filter(Boolean)
  .find(fs.existsSync);
assert(CHROME, "Set CHROME_PATH to an installed Chrome/Edge/Chromium");
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const checks = [];
const errors = [];
let mockMode = "full";
let realResponse = null;
if (process.env.PIYING_RESPONSE_FILE)
  realResponse = JSON.parse(
    fs.readFileSync(process.env.PIYING_RESPONSE_FILE, "utf8"),
  );
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() =>
  Object.defineProperty(window, "showDirectoryPicker", {
    value: undefined,
    configurable: true,
  }),
);
page.on("pageerror", (e) => errors.push(e.message));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const check = async (name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail });
    console.log("PASS " + name);
  } catch (e) {
    checks.push({ name, pass: false, error: e.message });
    console.error("FAIL " + name + ": " + e.message);
  }
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
};
const go = async (route) => {
  for (let i = 0; ; i++) {
    try {
      await page.goto(BASE + route, {
        waitUntil: "networkidle2",
        timeout: 45000,
      });
      return;
    } catch (e) {
      if (i >= 2 || !/NETWORK_CHANGED|CONNECTION_RESET/.test(e.message))
        throw e;
    }
  }
};
const click = async (selector, text) => {
  for (const el of await page.$$(selector))
    if (await el.evaluate((e, t) => e.textContent.includes(t), text)) {
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await el.click();
      await pause(100);
      return;
    }
  throw Error("Missing " + text);
};
const hit = async (selector) =>
  page.$$eval(selector, (es) =>
    es.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        text: e.innerText,
        top: r.top,
        bottom: r.bottom,
        ownHit: e.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        ),
        inViewport: r.top >= 0 && r.bottom <= innerHeight,
      };
    }),
  );
let fixtures;
try {
  await page.goto("about:blank");
  fixtures = await page.evaluate(() => {
    const atlas = (missing = []) => {
      const c = document.createElement("canvas");
      c.width = c.height = 900;
      const x = c.getContext("2d");
      x.fillStyle = "#ff00ff";
      x.fillRect(0, 0, 900, 900);
      for (let i = 0; i < 9; i++) {
        if (missing.includes(i)) continue;
        const col = i % 3,
          row = Math.floor(i / 3);
        x.fillStyle = ["#b12824", "#19435c", "#d5a62d"][i % 3];
        if (i === 6) x.fillRect(col * 300 + 140, row * 300 + 140, 21, 21);
        else x.fillRect(col * 300 + 90, row * 300 + 60, 120, 180);
      }
      return c.toDataURL("image/png");
    };
    return {
      full: atlas(),
      partial: atlas([5]),
      empty: atlas([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    };
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().endsWith("/api/ai/piying")) {
      if (mockMode === "real" && realResponse) {
        req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(realResponse),
        });
        return;
      }
      const image = fixtures[mockMode] || fixtures.full;
      req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 200,
          data: {
            ok: true,
            mode: JSON.parse(req.postData() || "{}").mode,
            provider: "image",
            partsLayout: "grid-3x3-v1",
            images: [{ kind: "parts", dataUrl: image }],
            features: {},
            message: "fixture",
          },
        }),
      });
    } else if (
      process.env.VERIFY_API_TARGET &&
      new URL(req.url()).pathname.startsWith("/api/")
    ) {
      const target =
        process.env.VERIFY_API_TARGET.replace(/\/+$/, "") +
        new URL(req.url()).pathname +
        new URL(req.url()).search;
      fetch(target, {
        method: req.method(),
        headers: { "Content-Type": "application/json" },
        body: req.postData(),
      })
        .then(async (response) =>
          req.respond({
            status: response.status,
            contentType:
              response.headers.get("content-type") || "application/json",
            body: Buffer.from(await response.arrayBuffer()),
          }),
        )
        .catch(() => req.abort());
    } else req.continue();
  });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 390, height: 844, isMobile: true, hasTouch: true },
  ]) {
    await check(
      "换赏真实点击 " + viewport.width + "x" + viewport.height,
      async () => {
        await page.setViewport(viewport);
        await go("/display");
        await page.waitForSelector(".daily-title");
        await page.waitForFunction(
          () => !document.querySelector(".daily-loading"),
        );
        const controls = await hit(".daily-button");
        assert(
          controls[0].ownHit && controls[0].inViewport,
          JSON.stringify(controls),
        );
        const response = page.waitForResponse(
          (r) => r.url().includes("/daily-appreciations/random"),
          { timeout: 15000 },
        );
        await page.click(".daily-button");
        await response;
        await page.waitForFunction(
          () => !document.querySelector(".daily-loading"),
        );
        assert.equal(new URL(page.url()).pathname, "/display");
        await page.screenshot({
          path: path.join(OUT, "display-" + viewport.width + ".png"),
        });
        return controls;
      },
    );
  }
  await page.setViewport({
    width: 1440,
    height: 900,
    isMobile: false,
    hasTouch: false,
  });
  await go("/curtain");
  await page.waitForFunction(
    () =>
      document.querySelector(".hub") &&
      !document.querySelector(".hub-rig-loading"),
  );
  await check("桌面场景添加拖动缩放翻转删除", async () => {
    await page.click(".hub-add-scene");
    await page.waitForSelector(".scene-card");
    await page.click(".scene-card");
    await page.waitForFunction(
      () => document.querySelector(".scene-item img")?.naturalWidth > 0,
    );
    const controls = await hit(".scene-tools button");
    assert(
      controls.every((c) => c.ownHit && c.inViewport),
      JSON.stringify(controls),
    );
    const box = await page.$eval(".scene-item", (e) => {
      const r = e.getBoundingClientRect();
      return {
        x: r.x + r.width * 0.3,
        y: r.y + r.height * 0.5,
        left: e.style.left,
        top: e.style.top,
        width: e.style.width,
      };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y - 40, { steps: 10 });
    await page.mouse.up();
    await pause(150);
    assert.notEqual(
      await page.$eval(".scene-item", (e) => e.style.left),
      box.left,
    );
    await click(".scene-tools button", "放大");
    assert.notEqual(
      await page.$eval(".scene-item", (e) => e.style.width),
      box.width,
    );
    await click(".scene-tools button", "翻转");
    assert.match(
      await page.$eval(".scene-item img", (e) => e.style.transform),
      /-1/,
    );
    await page.click(".scene-tools .danger");
    await page.waitForFunction(() => !document.querySelector(".scene-item"));
    await page.screenshot({ path: path.join(OUT, "hub-desktop.png") });
    return controls;
  });
  for (const mode of [
    "full",
    "partial",
    "empty",
    ...(realResponse ? ["real"] : []),
  ]) {
    await check("图片分割装配 " + mode, async () => {
      mockMode = mode;
      await click(".hub-actions button", "AI图片转皮影");
      await page.waitForSelector(".ai-drop");
      await (
        await page.$(".ai-drop input")
      ).uploadFile(
        path.resolve("public/piying/characters/general/assets/portrait.png"),
      );
      await page.type("#ai-title", "回归角色");
      if (mode === "real") await click(".ai-modes button", "精致");
      await page.click(".ai-primary");
      await page.waitForSelector(".ai-result", { timeout: 30000 });
      const text = await page.$eval(".ai-result-info", (e) => e.innerText);
      if (mode === "empty") assert.match(text, /整体改用本地/);
      else if (mode === "partial")
        assert.match(text, /8 个 AI 部件，1 个部件由本地/);
      else if (mode === "full") assert.match(text, /9 个部件全部装配完成/);
      else assert.match(text, /9 个部件全部装配完成|已采用 [678] 个 AI 部件/);
      await page.screenshot({ path: path.join(OUT, "image-" + mode + ".png") });
      if (mode === "full" || mode === "real") {
        await click(".ai-primary", "采用这个形象");
        await page.waitForFunction(() => !document.querySelector(".ai-result"));
      } else await page.click(".ai-close");
      await pause(150);
      return text;
    });
  }
  await check("AI角色与当前选择路由切换后保留", async () => {
    const selected = await page.$eval(
      ".hub-actions-title",
      (e) => e.textContent,
    );
    await click(".nav-item", "展示");
    await page.waitForFunction(() => location.pathname === "/display");
    await click(".nav-item", "互动");
    await page.waitForFunction(() => location.pathname === "/interactive");
    await click(".mode-select button", "身入影幕");
    await page.waitForSelector(".hub-actions-title");
    await page.waitForFunction(
      () => !document.querySelector(".hub-rig-loading"),
    );
    assert.equal(
      await page.$eval(".hub-actions-title", (e) => e.textContent),
      selected,
    );
    await click(".hub-actions button", "切换本地皮影");
    await page.waitForSelector(".picker-card");
    const names = await page.$$eval(".picker-name", (es) =>
      es.map((e) => e.textContent),
    );
    assert(names.some((n) => n.includes("回归角色")));
    await page.click(".picker-close");
    return names;
  });
  await check("兼容目录导入无效文件错误提示", async () => {
    await click(".hub-actions button", "切换本地皮影");
    await page.waitForSelector(".picker-import");
    const chooser = page.waitForFileChooser();
    await page.click(".picker-import");
    await (await chooser).cancel();
    await page.evaluate(() => {
      const e = [...document.querySelectorAll("input[type=file]")].find(
          (e) => e.webkitdirectory,
        ),
        dt = new DataTransfer(),
        f = new File(["{}"], "manifest.json", { type: "application/json" });
      Object.defineProperty(f, "webkitRelativePath", {
        value: "demo/manifest.json",
      });
      dt.items.add(f);
      e.files = dt.files;
      e.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForSelector(".curtain-dialog");
    const text = await page.$eval(".curtain-dialog", (e) => e.innerText);
    assert.match(text, /不能作为|导入/);
    await page.click(".curtain-dialog button");
    return text;
  });
  await check("兼容目录导入合法角色及离页保留", async () => {
    const payload = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 80;
      c.height = 120;
      const x = c.getContext("2d");
      x.fillStyle = "#274e61";
      x.fillRect(10, 10, 60, 100);
      return c.toDataURL("image/png");
    });
    await page.evaluate((payload) => {
      const e = [...document.querySelectorAll("input[type=file]")].find(
        (e) => e.webkitdirectory,
      );
      const manifest = {
        schema: "piying-rig/1",
        name: "folder-regression",
        title: "目录回归人物",
        stage: { width: 900, height: 860 },
        parts: {
          torso: { src: "assets/torso.png", size: [80, 120] },
          head: { src: "assets/head.png", size: [80, 120] },
        },
        nodes: [
          {
            id: "torso",
            part: "torso",
            parent: null,
            pivot: [40, 118],
            attach: [450, 500],
            tip: [40, 8],
            z: 1,
            angle: 0,
          },
          {
            id: "head",
            part: "head",
            parent: "torso",
            pivot: [40, 118],
            attach: [40, 8],
            tip: [40, 8],
            z: 2,
            angle: 0,
          },
        ],
        poses: { rest: { angles: {} } },
      };
      const dt = new DataTransfer();
      for (const [name, content, type] of [
        ["manifest.json", JSON.stringify(manifest), "application/json"],
        [
          "assets/torso.png",
          Uint8Array.from(atob(payload.split(",")[1]), (c) => c.charCodeAt(0)),
          "image/png",
        ],
        [
          "assets/head.png",
          Uint8Array.from(atob(payload.split(",")[1]), (c) => c.charCodeAt(0)),
          "image/png",
        ],
      ]) {
        const f = new File([content], name.split("/").at(-1), { type });
        Object.defineProperty(f, "webkitRelativePath", {
          value: "demo/" + name,
        });
        dt.items.add(f);
      }
      e.files = dt.files;
      e.dispatchEvent(new Event("change", { bubbles: true }));
    }, payload);
    await page.waitForFunction(
      () =>
        document
          .querySelector(".hub-actions-title")
          ?.textContent.includes("目录回归人物"),
      { timeout: 15000 },
    );
    await click(".nav-item", "展示");
    await page.waitForFunction(() => location.pathname === "/display");
    await click(".nav-item", "互动");
    await page.waitForFunction(() => location.pathname === "/interactive");
    await click(".mode-select button", "身入影幕");
    await page.waitForFunction(() =>
      document
        .querySelector(".hub-actions-title")
        ?.textContent.includes("目录回归人物"),
    );
    return "合法目录成功装配并在离页返回后保留；无效目录有错误提示";
  });
  await check("手机场景操作条真实可点击", async () => {
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    });
    await go("/curtain");
    await page.waitForSelector(".hub-add-scene");
    await page.$eval(".hub-add-scene", (e) =>
      e.scrollIntoView({ block: "center" }),
    );
    await page.click(".hub-add-scene");
    await page.waitForSelector(".scene-card");
    await page.click(".scene-card");
    await page.waitForSelector(".scene-tools");
    const controls = await hit(".scene-tools button");
    assert(
      controls.every((c) => c.ownHit),
      JSON.stringify(controls),
    );
    await click(".scene-tools button", "翻转");
    assert.match(
      await page.$eval(".scene-item img", (e) => e.style.transform),
      /-1/,
    );
    return controls;
  });
  assert.deepEqual(errors, [], "Unhandled browser errors");
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
}
console.log(
  "Functional: " + checks.filter((c) => c.pass).length + "/" + checks.length,
);
if (checks.some((c) => !c.pass) || errors.length) process.exitCode = 1;
