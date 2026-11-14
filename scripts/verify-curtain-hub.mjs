/**
 * 身入影幕 · 幕后四入口验收：
 *   1) 结束后皮影是否居中、是否呼吸摆动、点击显隐关节点；
 *   2) AI 图片转皮影（上传人物照 → 快速/精致 → 生成 → 采用 → 换上）；
 *   3) 人影动作同步（开摄像头 + 加载姿态模型，皮影不报错、保持呼吸）。
 * 用法：node scripts/verify-curtain-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

const OUT = path.resolve('.artifacts/screens');
fs.mkdirSync(OUT, { recursive: true });
const REPORT = { consoleErrors: [], pageErrors: [], checks: {}, screenshots: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') REPORT.consoleErrors.push(message.text().slice(0, 400));
  });
  page.on('pageerror', (error) => REPORT.pageErrors.push(String(error).slice(0, 400)));

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    REPORT.screenshots.push(file);
  };

  await page.goto('http://127.0.0.1:5173/curtain', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__CURTAIN__), { timeout: 60000 });
  await sleep(1500);
  await page.evaluate(() => window.__CURTAIN__.toHub());
  await sleep(2200);
  await shot('hub-01-center');

  REPORT.checks.center = await page.evaluate(() => {
    const hub = document.querySelector('.hub')?.getBoundingClientRect();
    const stageBox = document.querySelector('.hub-stage')?.getBoundingClientRect();
    const rigStage = document.querySelector('.hub-rig-mount .py-stage');
    const parts = [...document.querySelectorAll('.hub-rig-mount .py-part')];
    return {
      hub: hub ? { width: Math.round(hub.width), height: Math.round(hub.height) } : null,
      stageArea: stageBox ? { left: Math.round(stageBox.left), width: Math.round(stageBox.width), height: Math.round(stageBox.height) } : null,
      rig: rigStage ? { width: Math.round(rigStage.getBoundingClientRect().width) } : null,
      parts: parts.length,
      zoomLabel: document.querySelector('.hub-zoom span')?.textContent || '',
      addScene: Boolean(document.querySelector('.hub-add-scene')),
    };
  });

  // 呼吸摆动：连续两次采样同一部件的 transform，应该不同
  const breathe = await page.evaluate(async () => {
    const part = document.querySelector('.hub-rig-mount .py-part:nth-of-type(3)');
    if (!part) return null;
    const first = part.style.transform;
    await new Promise((resolve) => setTimeout(resolve, 260));
    const second = part.style.transform;
    return { changed: first !== second, first: first.slice(0, 40), second: second.slice(0, 40) };
  });
  REPORT.checks.breathe = breathe;

  // ---- 皮影缩放 ----
  const widthOf = () =>
    page.evaluate(() => Math.round(document.querySelector('.hub-rig-mount .py-stage')?.getBoundingClientRect().width || 0));
  const zoomBefore = await widthOf();
  await page.evaluate(() => {
    [...document.querySelectorAll('.hub-zoom button')].find((button) => button.textContent.includes('＋'))?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    [...document.querySelectorAll('.hub-zoom button')].find((button) => button.textContent.includes('＋'))?.click();
  });
  await sleep(500);
  const zoomAfter = await widthOf();
  REPORT.checks.zoom = {
    before: zoomBefore,
    after: zoomAfter,
    label: await page.evaluate(() => document.querySelector('.hub-zoom span')?.textContent || ''),
    parts: await page.evaluate(() => document.querySelectorAll('.hub-rig-mount .py-part').length),
  };
  await shot('hub-02-zoom');

  // ---- 添加组件（砌末） ----
  await page.click('.hub-add-scene');
  await page.waitForFunction(() => Boolean(document.querySelector('.scene-library')), { timeout: 12000 }).catch(() => {});
  await sleep(500);
  REPORT.checks.sceneLibrary = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.scene-library')),
    cards: document.querySelectorAll('.scene-card').length,
    labels: [...document.querySelectorAll('.scene-card span')].slice(0, 4).map((el) => el.textContent),
  }));
  await shot('hub-03-scene-library');

  await page.evaluate(() => document.querySelectorAll('.scene-card')[0]?.click());
  await sleep(800);
  REPORT.checks.sceneAdded = await page.evaluate(() => ({
    count: document.querySelectorAll('.scene-item').length,
    selected: document.querySelectorAll('.scene-item.selected').length,
    tools: Boolean(document.querySelector('.scene-tools')),
    label: document.querySelector('.scene-tools-name')?.textContent || '',
    libraryClosed: !document.querySelector('.scene-library'),
  }));
  await shot('hub-04-scene-added');

  // 拖动组件
  const sceneBox = await page.evaluate(() => {
    const el = document.querySelector('.scene-item');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: el.style.left, top: el.style.top };
  });
  if (sceneBox) {
    await page.mouse.move(sceneBox.x, sceneBox.y);
    await page.mouse.down();
    await page.mouse.move(sceneBox.x - 150, sceneBox.y - 70, { steps: 10 });
    await page.mouse.up();
    await sleep(400);
    REPORT.checks.sceneDrag = await page.evaluate((before) => {
      const el = document.querySelector('.scene-item');
      return {
        before: `${before.left} / ${before.top}`,
        after: el ? `${el.style.left} / ${el.style.top}` : null,
      };
    }, sceneBox);
    await shot('hub-05-scene-dragged');
  }

  await page.evaluate(() => document.querySelector('.scene-tools .danger')?.click());
  await sleep(400);
  REPORT.checks.sceneRemoved = await page.evaluate(() => document.querySelectorAll('.scene-item').length);

  // ---- 图层覆盖规则：指针选中过的组件要压在新添加的组件上面 ----
  const addByIndex = async (index) => {
    await page.evaluate(() => document.querySelector('.hub-add-scene')?.click());
    await sleep(400);
    await page.evaluate((i) => document.querySelectorAll('.scene-card')[i]?.click(), index);
    await sleep(500);
  };
  const sceneLabels = () =>
    page.evaluate(() => [...document.querySelectorAll('.scene-item img')].map((img) => img.alt));

  await addByIndex(0); // 城楼
  await addByIndex(2); // 松树
  const orderBefore = await sceneLabels();

  // 用指针点一下第一个（城楼），它应提到最上层
  const firstBox = await page.evaluate(() => {
    const el = document.querySelectorAll('.scene-item')[0];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  if (firstBox) {
    await page.mouse.click(firstBox.x, firstBox.y);
    await sleep(400);
  }
  const orderAfterPick = await sceneLabels();

  // 再添加一个云纹：应插在「刚选中的城楼」下面
  await addByIndex(5);
  const orderAfterAdd = await sceneLabels();

  REPORT.checks.layerOrder = {
    before: orderBefore,
    afterPick: orderAfterPick,
    afterAdd: orderAfterAdd,
    pickedStaysOnTop: orderAfterAdd[orderAfterAdd.length - 1] === orderBefore[0],
  };
  await shot('hub-06b-layer-order');

  // ---- 切换本地皮影：先出「已注册角色」窗口 ----
  await page.evaluate(() => {
    [...document.querySelectorAll('.hub-actions .art-button')].find((b) => b.textContent.includes('切换本地皮影'))?.click();
  });
  await page.waitForFunction(() => Boolean(document.querySelector('.picker')), { timeout: 15000 }).catch(() => {});
  await sleep(800);
  REPORT.checks.characterPicker = await page.evaluate(() => ({
    open: Boolean(document.querySelector('.picker')),
    cards: [...document.querySelectorAll('.picker-card')].map((card) => ({
      name: card.querySelector('.picker-name')?.textContent || '',
      kind: card.querySelector('.picker-meta')?.textContent || '',
      hasThumb: Boolean(card.querySelector('.picker-thumb img')),
      active: card.classList.contains('active'),
    })),
    importButton: document.querySelector('.picker-import')?.textContent?.trim() || '',
    hint: document.querySelector('.picker-hint')?.textContent?.trim() || '',
  }));
  await shot('hub-06-character-picker');

  // 选第二个角色（皮影武净），应立刻换上且窗口关闭
  await page.evaluate(() => document.querySelectorAll('.picker-card')[1]?.click());
  await sleep(2000);
  REPORT.checks.characterSwitched = await page.evaluate(() => ({
    character: window.__CURTAIN__.character,
    pickerOpen: Boolean(document.querySelector('.picker')),
    title: document.querySelector('.hub-actions-title')?.textContent || '',
    parts: document.querySelectorAll('.hub-rig-mount .py-part').length,
    weapon: Boolean(document.querySelector('.hub-rig-mount .py-part')),
  }));
  await shot('hub-07-warrior');

  // ---- AI 图片转皮影 ----
  await page.click('.hub-actions .act-row .art-button:nth-of-type(2)');
  await page.waitForFunction(() => Boolean(document.querySelector('.ai-panel')), { timeout: 20000 });
  await sleep(600);
  const photo = path.resolve('testdemo/piying-rig/characters/general/source/photo.jpg');
  const input = await page.$('.ai-drop input[type=file]');
  if (input && fs.existsSync(photo)) {
    await input.uploadFile(photo);
    await sleep(600);
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.ai-modes button')];
      buttons.find((button) => button.textContent.includes('精致'))?.click();
    });
    await shot('hub-02-ai-form');
    await page.click('.ai-panel .ai-primary');
    await page.waitForFunction(
      () => Boolean(document.querySelector('.ai-result')) || Boolean(document.querySelector('.ai-error')),
      { timeout: 60000 },
    );
    await sleep(1500);
    REPORT.checks.ai = await page.evaluate(() => ({
      result: Boolean(document.querySelector('.ai-result')),
      error: document.querySelector('.ai-error')?.textContent || '',
      title: document.querySelector('.ai-result-title')?.textContent || '',
      meta: document.querySelector('.ai-meta')?.textContent || '',
      facts: [...document.querySelectorAll('.ai-facts li')].map((li) => li.textContent),
      previewParts: document.querySelectorAll('.ai-preview .py-part').length,
      previewStage: Boolean(document.querySelector('.ai-preview .py-stage')),
      env: document.querySelector('.ai-env')?.textContent || '',
    }));
    await shot('hub-03-ai-result');

    if (REPORT.checks.ai.result) {
      await page.evaluate(() => {
        [...document.querySelectorAll('.ai-actions .ai-primary')].find((button) => button.textContent.includes('采用'))?.click();
      });
      await sleep(2600);
      REPORT.checks.afterAdopt = await page.evaluate(() => ({
        character: window.__CURTAIN__.character,
        title: document.querySelector('.hub-actions-title')?.textContent || '',
        parts: document.querySelectorAll('.hub-rig-mount .py-part').length,
        aiPanelOpen: Boolean(document.querySelector('.ai-panel')),
      }));
      await shot('hub-04-ai-adopted');
    }
  } else {
    REPORT.checks.ai = { skipped: '缺少测试照片或文件输入框' };
  }

  // ---- 人影动作同步 ----
  await page.evaluate(() => {
    [...document.querySelectorAll('.hub-actions .art-button')].find((button) => button.textContent.includes('人影动作同步'))?.click();
  });
  await page.waitForFunction(() => Boolean(document.querySelector('.curtain-sync')), { timeout: 20000 }).catch(() => {});
  await sleep(15000);
  REPORT.checks.sync = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.curtain-sync')),
    status: document.querySelector('.sync-status')?.textContent || '',
    vision: window.__CURTAIN__.vision,
    canvas: (() => {
      const canvas = document.querySelector('.sync-canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    })(),
  }));
  await shot('hub-05-sync');

  await page.evaluate(() => {
    [...document.querySelectorAll('.sync-close')][0]?.click();
  });
  await sleep(900);
  REPORT.checks.syncStopped = await page.evaluate(() => ({
    panel: Boolean(document.querySelector('.curtain-sync')),
    vision: window.__CURTAIN__.vision,
  }));
  await shot('hub-06-sync-stopped');

  // 移动端视口：检查幕后与 QTE 面板不破版
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(900);
  await shot('hub-07-mobile');

  // 移动端 AI 面板
  await page.evaluate(() => {
    [...document.querySelectorAll('.hub-actions .art-button')].find((button) => button.textContent.includes('AI 图片转皮影') || button.textContent.includes('AI图片转皮影'))?.click();
  });
  await page.waitForFunction(() => Boolean(document.querySelector('.ai-panel')), { timeout: 20000 }).catch(() => {});
  await sleep(700);
  REPORT.checks.mobileAi = await page.evaluate(() => {
    const panel = document.querySelector('.ai-panel');
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height), viewport: window.innerHeight };
  });
  await shot('hub-08-mobile-ai');
  await page.evaluate(() => document.querySelector('.ai-close')?.click());

  // 移动端 QTE 面板：重新加载页面后跳到第一处校准
  await page.goto('http://127.0.0.1:5173/curtain', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__CURTAIN__), { timeout: 60000 });
  await sleep(1600);
  await page.evaluate(() => window.__CURTAIN__.seekMusic(18.2));
  await page.waitForFunction(() => window.__CURTAIN__.phase === 'qte', { timeout: 20000 }).catch(() => {});
  await sleep(1700);
  REPORT.checks.mobileQte = await page.evaluate(() => {
    const hud = document.querySelector('.qte-hud');
    const camera = document.querySelector('.hud-camera, .hud-camera-btn');
    if (!hud) return null;
    const box = hud.getBoundingClientRect();
    const camBox = camera?.getBoundingClientRect();
    return {
      hud: { top: Math.round(box.top), bottom: Math.round(box.bottom), width: Math.round(box.width), placement: hud.className },
      camera: camBox ? { top: Math.round(camBox.top), bottom: Math.round(camBox.bottom) } : null,
      viewport: window.innerHeight,
    };
  });
  await shot('hub-09-mobile-qte');
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'curtain-hub-report.json'), JSON.stringify(REPORT, null, 2), 'utf8');
console.log(JSON.stringify(REPORT, null, 2));
