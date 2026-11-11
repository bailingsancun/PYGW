/**
 * 实现功能：AI 动态出题的解析、校验与 curated 兜底
 * 职责：
 *   1) parseQuiz(raw, max)：把模型返回的文本解析为结构化题目，逐题校验
 *      （4 个互不重复选项、答案 A-D、解析非空、题干/选项/解析限长），非法项直接丢弃，保证前端拿到的题一定可用；
 *   2) fallbackQuiz(count)：未配置 LLM / 生成失败 / 解析为空时的 curated 种子题，
 *      保证出题入口永不死端；
 *   3) 输出统一为与 shim 题库同构的字段（questionText/optionA..D/correctAnswer/explanation/type），
 *      前端 normalizeQuestion 无需区分来源。
 * 说明：种子题覆盖皮影通识与工艺常识，均为本展馆内容范围内的客观知识。
 */

const ANSWER_INDEX = ['A', 'B', 'C', 'D'];

// 字段限长：超限题目整条丢弃（回落 curated），避免模型/注入产出超长内容撑爆前端
const LIMITS = { question: 200, option: 60, explanation: 400, type: 24, id: 40 };

const stripControl = (text) => String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const normalizeAnswer = (value) => {
  const text = String(value ?? '').trim().toUpperCase();
  if (ANSWER_INDEX.includes(text)) return text;
  const num = Number(text);
  if (Number.isInteger(num) && num >= 0 && num <= 3) return ANSWER_INDEX[num];
  return '';
};

const stripFences = (text) => String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();

/** 取文本中第一个 '[' 到最后一个 ']' 的片段，容忍模型在 JSON 前后加说明文字 */
const extractArray = (text) => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  return start >= 0 && end > start ? text.slice(start, end + 1) : '';
};

const normalizeItem = (item, index) => {
  if (!item || typeof item !== 'object') return null;
  const questionText = stripControl(String(item.question || item.title || '')).trim();
  const rawOptions = Array.isArray(item.options)
    ? item.options
    : [item.optionA, item.optionB, item.optionC, item.optionD];
  const options = rawOptions.map((opt) => stripControl(String(opt ?? '')).trim()).slice(0, 4);
  const correctAnswer = normalizeAnswer(item.answer ?? item.correctAnswer ?? item.correct);
  const explanation = stripControl(String(item.explanation || item.analysis || '')).trim();
  const type = (stripControl(String(item.category || item.type || '')).trim() || 'general').slice(0, LIMITS.type);

  if (!questionText || questionText.length > LIMITS.question) return null;
  if (options.length !== 4 || options.some((opt) => !opt || opt.length > LIMITS.option)) return null;
  if (new Set(options).size !== 4) return null;
  if (!correctAnswer || !explanation || explanation.length > LIMITS.explanation) return null;

  return {
    id: stripControl(String(item.id ?? '')).trim().slice(0, LIMITS.id) || `ai-${index + 1}`,
    type,
    questionText,
    optionA: options[0],
    optionB: options[1],
    optionC: options[2],
    optionD: options[3],
    correctAnswer,
    explanation,
  };
};

/** 解析模型输出；返回 [] 表示不可用（调用方据此回落 curated） */
export const parseQuiz = (raw, max = 5) => {
  const text = stripFences(raw);
  const jsonText = extractArray(text) || text;
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < parsed.length && out.length < max; i += 1) {
    const question = normalizeItem(parsed[i], i);
    if (!question || seen.has(question.questionText)) continue;
    seen.add(question.questionText);
    out.push(question);
  }
  return out;
};

const QUIZ_SEED = [
  {
    type: 'general',
    questionText: '中国皮影戏的雏形，相传与哪位帝王思念爱妃、以皮刻人形灯下投影的故事有关？',
    optionA: '汉武帝',
    optionB: '唐玄宗',
    optionC: '宋徽宗',
    optionD: '明成祖',
    correctAnswer: 'A',
    explanation: '相传汉武帝思念李夫人，方士以兽皮刻成人形、在灯下投影以慰思念，被视为皮影戏的雏形。',
  },
  {
    type: 'general',
    questionText: '2011 年，中国皮影戏被联合国教科文组织列入哪一项名录？',
    optionA: '世界自然遗产',
    optionB: '人类非物质文化遗产代表作名录',
    optionC: '世界记忆名录',
    optionD: '世界地质公园',
    correctAnswer: 'B',
    explanation: '皮影戏是古老的表演艺术与手工技艺，属于“非物质”文化，2011 年入选人类非物质文化遗产代表作名录。',
  },
  {
    type: 'craft',
    questionText: '传统高品质皮影（尤其“驴皮影”）最常选用哪种兽皮制作？',
    optionA: '牛皮',
    optionB: '羊皮',
    optionC: '驴皮',
    optionD: '猪皮',
    correctAnswer: 'C',
    explanation: '驴皮透明度好、薄厚适中且柔韧性强，是制作高品质皮影的首选材料，故有“驴皮影”之称。',
  },
  {
    type: 'general',
    questionText: '皮影艺人把用来投影的白色幕布（影窗）称为什么？',
    optionA: '亮子',
    optionB: '台口',
    optionC: '帷幔',
    optionD: '宣纸',
    correctAnswer: 'A',
    explanation: '“亮子”是皮影行话，指那块透光的白色幕布，是皮影表演的成像界面。',
  },
  {
    type: 'general',
    questionText: '操作一个标准皮影人物，通常需要几根操纵杆（签子）？',
    optionA: '一根',
    optionB: '两根',
    optionC: '三根',
    optionD: '五根',
    correctAnswer: 'C',
    explanation: '标准配置为三根：主杆控制头身，两根手杆控制双手动作。',
  },
  {
    type: 'craft',
    questionText: '皮影雕刻中，保留线条实体、剔除多余空白，使脸部通透的技法称为？',
    optionA: '阳刻',
    optionB: '阴刻',
    optionC: '镂空',
    optionD: '浮雕',
    correctAnswer: 'A',
    explanation: '阳刻保留画线部分的实体、剔除空白，脸部通透感强；阴刻则相反。',
  },
  {
    type: 'general',
    questionText: '皮影角色行当中，俗称“花脸”、常以夸张脸谱表现性格的是？',
    optionA: '生角',
    optionB: '旦角',
    optionC: '净角',
    optionD: '丑角',
    correctAnswer: 'C',
    explanation: '净角俗称“花脸”，通过夸张脸谱表现人物的性格、气质或相貌特征。',
  },
  {
    type: 'general',
    questionText: '皮影戏的投影成像，主要利用了什么物理原理？',
    optionA: '光的折射',
    optionB: '光的反射',
    optionC: '光沿直线传播',
    optionD: '光的色散',
    correctAnswer: 'C',
    explanation: '光源照射不透明的皮影，在幕布上投下影子，利用的是光沿直线传播的原理。',
  },
  {
    type: 'craft',
    questionText: '皮影人物各关节通常用什么连接，才能既牢固又活动灵活？',
    optionA: '胶水粘合',
    optionB: '铁丝缠绕',
    optionC: '线绳缀结',
    optionD: '铆钉固定',
    correctAnswer: 'C',
    explanation: '传统工艺用结实的线绳“缀结”关节，既牢固又灵活，便于做出细腻动作。',
  },
  {
    type: 'general',
    questionText: '下列哪一项不是皮影戏的别称？',
    optionA: '影子戏',
    optionB: '灯影戏',
    optionC: '驴皮影',
    optionD: '木偶戏',
    correctAnswer: 'D',
    explanation: '木偶戏通过提线或布袋操作立体玩偶，与皮影的平面投影是两种不同的表演形式。',
  },
];

/** curated 兜底：无 LLM / 调用失败 / 解析为空时使用，保证随时有题可答 */
export const fallbackQuiz = (count = 5) => QUIZ_SEED
  .slice(0, Math.min(Math.max(1, count), QUIZ_SEED.length))
  .map((item, index) => ({ ...item, id: `seed-${index + 1}` }));
