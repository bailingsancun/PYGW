/**
 * 实现功能：AI 内容安全（输入过滤 / 提示注入拦截 / 输出复核 / 统一话术）
 * 职责：
 *   1) checkInput(text)：拦截提示注入、越狱与明确违规的输入，返回可解释的分类与礼貌话术；
 *   2) screenOutput(text)：对模型输出做轻量复核（控制字符、密钥/系统提示泄露、违规内容），
 *      命中即整段替换为安全提示，避免不安全内容被展示；
 *   3) SAFETY：供服务端与前端共用的免责声明与拒绝话术，保证无 LLM 时也有可控兜底。
 * 说明：红线只收录「明确有害」的多字组合，避免误伤皮影剧目/历史中的正常用词。
 */

const INJECTION = [
  /忽略(掉)?(以上|之前|前面|上面).{0,8}(指令|提示|规则|设定|要求)/,
  /无视.{0,6}(规则|指令|限制|设定)/,
  /(system|developer)\s*prompt/i,
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
  /jailbreak|越狱模式|开发者模式|dan\s*模式/i,
  /输出(你的)?(系统提示|初始指令|system\s*prompt)/i,
  /你现在(是|扮演).{0,10}(不受限|没有限制|无限制)/,
];

const HARMFUL = [
  /(制作|合成|配制|组装).{0,8}(炸弹|爆炸物|毒品|冰毒|枪支)/,
  /(自杀|自残).{0,6}(方法|教程|怎么|如何)/,
  /(儿童|未成年).{0,6}(色情|性行为)/,
  /(盗刷|复制).{0,6}(信用卡|银行卡)|(洗钱|跑分).{0,6}(教程|方法)/,
  /(入侵|攻击|黑掉|破解).{0,10}(网站|服务器|系统|账户).{0,6}(教程|方法|工具)/,
];

/** 输出侧的泄露防护：API 密钥、Authorization 头、系统提示原文 */
const LEAK = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /Authorization:\s*Bearer/i,
  /AI_API_KEY|DB_PASSWORD/,
];

export const SAFETY = {
  injection: '为了安全，我不能执行会改变系统设定的指令。我们还是回到皮影展馆吧——你想了解历史、流派，还是制作工艺？',
  harmful: '这个问题涉及不当内容，我不能协助。若你愿意，我可以介绍皮影戏的角色、唱腔或雕镂工艺。',
  tooLong: '问题太长了，麻烦精简到 800 字以内再问我，我好准确回到展馆资料里找答案。',
  output: '（该回答未通过内容安全复核，已隐藏。请换个问法，我会基于展馆资料重新回答。）',
  disclaimer: '内容由 AI 基于展馆资料生成，仅供参观参考；史实以展馆 curated 资料为准，并已做安全复核。',
};

const isBlank = (value) => String(value || '').trim() === '';

/**
 * 输入过滤：返回 {ok:true} 或 {ok:false, category, reason, reply}
 * category：injection | harmful | too_long
 */
export const checkInput = (raw) => {
  const text = String(raw || '').trim();
  if (isBlank(text)) return { ok: true };
  if (text.length > 800) {
    return { ok: false, category: 'too_long', reason: '问题过长', reply: SAFETY.tooLong };
  }
  for (const pattern of INJECTION) {
    if (pattern.test(text)) {
      return { ok: false, category: 'injection', reason: '疑似提示注入', reply: SAFETY.injection };
    }
  }
  for (const pattern of HARMFUL) {
    if (pattern.test(text)) {
      return { ok: false, category: 'harmful', reason: '涉及违规内容', reply: SAFETY.harmful };
    }
  }
  return { ok: true };
};

/** 去掉控制字符并限长，避免异常字符进入前端渲染 */
const clean = (text) => String(text || '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .slice(0, 6000);

/**
 * 输出复核：返回 {ok, text, flagged}
 * 命中违规或泄露时 text 替换为 SAFETY.output，前端据此隐藏不安全内容。
 */
export const screenOutput = (raw) => {
  const text = clean(raw);
  const flagged = [...HARMFUL, ...LEAK].some((pattern) => pattern.test(text));
  return { ok: !flagged, text: flagged ? SAFETY.output : text, flagged };
};
