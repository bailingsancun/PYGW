/**
 * 实现功能：页面间「影人推移」微转场（方案 2）
 * 职责：旧页向反方向轻推淡出（90ms）→ 切路由 → 新页从前进方向推入淡入（130ms），
 *       正向用于「进入子页」，back 用于「子页返回」，方向自动反转。
 *
 * 为什么直接操作 DOM 而不是 <Transition>：
 *   页面组件是多根（ArtPageShell + ArtBottomNav），且底栏是 position: fixed，
 *   一旦给它祖先加 transform，fixed 会退化成相对定位、底栏会跳。
 *   所以转场只作用于 .art-page-shell（底栏在它外面），用类名驱动 CSS 动画。
 *
 * 与其它转场的关系：
 *   - 底部 tab 互切走 pageFlash（方案 1），不调用本模块；
 *   - 首页 → 地图走 playVeil（云海启幕），也不调用本模块。
 */
const LEAVE_MS = 90;
const ENTER_MS = 130;
/** 兜底：新页面迟迟没挂载时不要永远卡住 */
const WAIT_TIMEOUT_MS = 800;

let busy = false;

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * 等到 .art-page-shell 被换成另一个元素（路由切换完成）。
 * 用 MutationObserver 而不是轮询：新节点挂载后能赶在浏览器绘制前拿到，
 * 入场动画不会先闪一帧全亮。
 */
function waitForShellChange(oldShell) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (el) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(el);
    };
    const checkShell = () => {
      const current = document.querySelector('.art-page-shell');
      if (current && current !== oldShell) finish(current);
    };
    const observer = new MutationObserver(checkShell);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(() => finish(null), WAIT_TIMEOUT_MS);
    checkShell();
  });
}

/**
 * 播放一次页面推移并完成导航。
 * @param {'forward'|'back'} direction forward=进入子页，back=返回上一级
 * @param {() => any} navigate 通常就是 router.push / router.back
 */
export async function playPageSlide(direction, navigate) {
  // 上一段还没播完：不叠动画，直接把导航做掉
  if (busy) {
    if (typeof navigate === 'function') navigate();
    return;
  }

  busy = true;
  const dir = direction === 'back' ? 'back' : 'forward';
  const leaveCls = `page-leave-${dir}`;
  const enterCls = `page-enter-${dir}`;
  const oldShell = document.querySelector('.art-page-shell');

  // 1) 旧页推出
  if (oldShell) {
    oldShell.classList.add(leaveCls);
    await sleep(LEAVE_MS);
  }

  // 2) 切路由（旧页动画已 fill 到透明，不会闪出全亮的一帧）
  const nextShell = waitForShellChange(oldShell);
  const result = typeof navigate === 'function' ? navigate() : null;
  if (result && typeof result.then === 'function') {
    try {
      await result;
    } catch {
      /* 导航被取消（守卫拦截等）时继续收尾，不要卡住 busy */
    }
  }

  // 3) 新页推入
  const newShell = await nextShell;
  oldShell?.classList.remove(leaveCls);
  if (newShell && newShell !== oldShell) {
    void newShell.offsetWidth; // 强制一次样式计算，让动画从第一帧开始
    newShell.classList.add(enterCls);
    await sleep(ENTER_MS + 30);
    newShell.classList.remove(enterCls);
  }

  busy = false;
}
