import assert from "node:assert/strict";
import { createAiServer } from "../server/src/ai-server.js";

const server = createAiServer(
  {},
  {
    AI_FORMAT: "chat",
    AI_MODEL: "",
    AI_BASE_URL: "",
    AI_API_KEY: "",
    AI_CHAT_RATE_LIMIT: 5,
    AI_RATE_LIMIT: 20,
    AI_TRUST_PROXY: "1",
    AI_GLOBAL_DAILY_LIMIT: 0,
  },
  { chunks: [], mode: "keyword" },
);
const originalNow = Date.now;
let now = originalNow();
Date.now = () => now;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/ai`;
  const post = async (path, ip = "192.0.2.1") => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: "{}",
    });
    const text = await response.text();
    return { status: response.status, text };
  };
  const paths = ["/ask", "/agent", "/vision", "/narrate", "/ask"];
  for (const path of paths)
    assert.notEqual((await post(path)).status, 429, path);
  const sixth = await post("/agent");
  assert.equal(sixth.status, 429);
  assert.match(sixth.text, /每分钟最多 5 次/);
  assert.notEqual(
    (await post("/piying")).status,
    429,
    "图片生成应使用独立于对话的现有总额度",
  );
  assert.notEqual((await post("/quiz")).status, 429, "出题不占对话额度");
  assert.notEqual(
    (await post("/ask", "192.0.2.2")).status,
    429,
    "不同 IP 独立计数",
  );
  now += 61000;
  assert.notEqual((await post("/ask")).status, 429, "60 秒窗口结束后恢复");
  console.log(
    "PASS: 5 次对话共享额度，第 6 次 HTTP 429；图片/出题独立；不同 IP 独立；60 秒后恢复。",
  );
} finally {
  Date.now = originalNow;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
