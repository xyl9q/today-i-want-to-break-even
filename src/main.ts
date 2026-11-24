import { DeskTraderGame, formatGameTime, type DeskApp, type OrderSide, type StockSymbol } from './game.ts';
import { clearCareer, loadCareer, loadSettings, storeCareer, storeSettings, type CareerSave, type PlayerSettings } from './persistence.ts';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const money = (value: number): string => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
const toneClass = (value: number): string => value >= 0 ? 'up' : 'down';

let game = new DeskTraderGame();
let career: CareerSave | null = loadCareer(localStorage);
let settings: PlayerSettings = loadSettings(localStorage);
let side: OrderSide = 'buy';
let started = false;
let paused = false;
let lastFrame = performance.now();
let lastRender = 0;
let resultShown = false;
let lastBossState = game.state.bossState;
let lastBossCountdown: number | null = null;
let audioContext: AudioContext | null = null;

const boot = $('#boot');
const desktop = $('#desktop');
const stockList = $('#stock-list');
const orderPrice = $<HTMLInputElement>('#order-price');
const orderQuantity = $<HTMLInputElement>('#order-quantity');
const submitOrder = $<HTMLButtonElement>('#submit-order');
const chart = $<HTMLCanvasElement>('#price-chart');
const toastStack = $('#toast-stack');

function startGame(): void {
  game = new DeskTraderGame(Date.now() & 0xffffffff, career ? {
    day: career.nextDay,
    cash: career.cash,
    tokens: career.tokens,
    checkInStreak: career.checkInStreak,
    positions: career.positions,
  } : undefined);
  side = 'buy';
  started = true;
  paused = false;
  resultShown = false;
  lastBossState = 'away';
  lastBossCountdown = null;
  lastFrame = performance.now();
  boot.classList.add('hidden');
  desktop.classList.remove('hidden');
  $('#result-overlay').classList.add('hidden');
  orderPrice.value = game.getStock().price.toFixed(2);
  $('#career-day').textContent = `DAY ${game.state.day}`;
  $('#restart-button').textContent = `进入第 ${game.state.day + 1} 天`;
  switchApp('market');
  ensureAudio();
  render(true);
}

function refreshCareerSummary(): void {
  const startButton = $<HTMLButtonElement>('#start-game');
  if (career) {
    $('#career-copy').textContent = `职业存档 · 即将进入第 ${career.nextDay} 天 · 现金 ${money(career.cash)} · Token ${career.tokens}`;
    startButton.textContent = `继续第 ${career.nextDay} 天`;
    $('#save-summary').textContent = `第 ${career.nextDay} 天待开始 · ${money(career.cash)} · ${career.positions.filter((position) => position.shares > 0).length} 只持仓`;
    $('#save-time').textContent = `上次保存：${new Date(career.updatedAt).toLocaleString('zh-CN')}`;
  } else {
    $('#career-copy').textContent = '新职业存档 · 初始资金 ¥100,000';
    startButton.textContent = '坐到工位，开始第一天';
    $('#save-summary').textContent = '尚未建立存档';
    $('#save-time').textContent = '完成第一天后自动保存';
  }
}

function switchApp(app: DeskApp): void {
  game.switchApp(app);
  document.querySelectorAll('.app-window').forEach((element) => element.classList.add('hidden'));
  $(`#${app}-app`).classList.remove('hidden');
  document.querySelectorAll<HTMLButtonElement>('.dock-item').forEach((button) => button.classList.toggle('active', button.dataset.app === app));
}

function render(force = false): void {
  if (!started) return;
  const state = game.state;
  $('#game-time').textContent = formatGameTime(state.time);
  $('#tray-time').textContent = formatGameTime(state.time);
  $('#market-phase').textContent = game.marketPhase();
  $('#work-value').textContent = `${Math.round(state.workProgress)}%`;
  $('#work-large').textContent = `${Math.round(state.workProgress)}%`;
  $('#work-bar').style.width = `${state.workProgress}%`;
  $('#risk-value').textContent = `${Math.round(state.suspicion)}%`;
  $('#risk-bar').style.width = `${state.suspicion}%`;

  renderBoss();
  renderStocks();
  renderQuote();
  renderPortfolio();
  renderTasks();
  renderStation();
  renderNews();
  renderToasts();

  const openDot = $('#drop-dot');
  openDot.classList.toggle('open', game.isDropOpen());
  const undone = state.tasks.filter((task) => !task.completed).length;
  $('#task-badge').textContent = String(undone);
  $('#task-badge').classList.toggle('hidden', undone === 0);

  if (force || document.activeElement !== orderPrice) orderPrice.value = game.getStock().price.toFixed(2);
  if (state.ended && !resultShown) showResult();
}

function renderBoss(): void {
  const indicator = $('#boss-indicator');
  indicator.className = `boss ${game.state.bossState}`;
  const copy = {
    away: ['老板：不在附近', '可以呼吸'],
    approaching: ['老板：正在靠近', '建议立即按空格'],
    checking: ['老板：就在身后', '保持镇定，别回头'],
  }[game.state.bossState];
  indicator.querySelector('b')!.textContent = copy[0];
  indicator.querySelector('small')!.textContent = copy[1];
  const alert = $('#boss-alert');
  const countdown = game.bossCountdown();
  const danger = game.state.bossState === 'approaching' || game.state.bossState === 'checking';
  alert.classList.toggle('hidden', !danger);
  $('#panic-button').classList.toggle('urgent', danger);
  if (countdown !== null) {
    alert.querySelector('strong')!.innerHTML = `老板还有 <b id="boss-countdown">${Math.ceil(countdown)}</b> 分钟到达`;
    alert.querySelector('span')!.textContent = '按空格立即切换到 IDE';
  } else if (game.state.bossState === 'checking') {
    alert.querySelector('strong')!.innerHTML = '老板就在你身后！';
    alert.querySelector('span')!.textContent = game.state.app === 'ide' || game.state.app === 'work' ? '保持镇定，继续敲代码' : '完了，他已经看见了';
  }
  if (game.state.bossState !== lastBossState) {
    if (game.state.bossState === 'approaching') triggerBossWarning();
    if (game.state.bossState === 'checking') playTone(118, .28, .13);
    if (game.state.bossState === 'away') document.title = '今天也想回本 · 工位炒股模拟器';
    lastBossState = game.state.bossState;
  }
  if (countdown !== null && Math.ceil(countdown) !== lastBossCountdown) {
    playFootstep();
    lastBossCountdown = Math.ceil(countdown);
  }
}

function ensureAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
}

function playTone(frequency: number, duration: number, volume = .08): void {
  if (!settings.sound) return;
  ensureAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = frequency < 160 ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playFootstep(): void {
  playTone(82, .12, .09);
  window.setTimeout(() => playTone(65, .13, .075), 130);
}

function triggerBossWarning(): void {
  document.title = '⚠ 老板来了！按空格！';
  desktop.classList.remove('boss-danger');
  void desktop.offsetWidth;
  desktop.classList.add('boss-danger');
  window.setTimeout(() => desktop.classList.remove('boss-danger'), 500);
  playTone(230, .16, .11);
  window.setTimeout(() => playTone(170, .2, .12), 190);
  if (settings.vibration && navigator.vibrate) navigator.vibrate([120, 70, 120, 70, 220]);
}

function renderStocks(): void {
  stockList.replaceChildren(...game.state.stocks.map((stock) => {
    const change = (stock.price - stock.previousClose) / stock.previousClose;
    const button = document.createElement('button');
    button.className = `stock-row ${stock.symbol === game.state.selected ? 'active' : ''}`;
    button.innerHTML = `<div><strong>${stock.name}</strong><small>${stock.symbol}</small></div><div><b>${stock.price.toFixed(2)}</b><em class="${toneClass(change)}">${percent(change)}</em></div>`;
    button.addEventListener('click', () => {
      game.selectStock(stock.symbol);
      orderPrice.value = stock.price.toFixed(2);
      render(true);
    });
    return button;
  }));
  $('#ticker').textContent = game.state.stocks.map((stock) => {
    const change = (stock.price - stock.previousClose) / stock.previousClose;
    return `${stock.name} ${stock.price.toFixed(2)} ${percent(change)}`;
  }).join('　　');
}

function renderQuote(): void {
  const stock = game.getStock();
  const change = (stock.price - stock.previousClose) / stock.previousClose;
  $('#stock-symbol').textContent = stock.symbol;
  $('#stock-name').textContent = stock.name;
  $('#stock-sector').textContent = stock.sector;
  $('#stock-price').textContent = stock.price.toFixed(2);
  $('#stock-price').className = toneClass(change);
  $('#stock-change').textContent = `${percent(change)}　${(stock.price - stock.previousClose) >= 0 ? '+' : ''}${(stock.price - stock.previousClose).toFixed(2)}`;
  $('#stock-change').className = toneClass(change);
  $('#position-shares').textContent = String(stock.shares);
  $('#position-cost').textContent = stock.shares ? stock.averageCost.toFixed(2) : '--';
  submitOrder.textContent = `${side === 'buy' ? '买入' : '卖出'} ${stock.symbol}`;
  submitOrder.className = `trade-submit ${side}`;
  renderOrderBook(stock.price);
  drawChart(stock.history, stock.previousClose);
}

function renderOrderBook(price: number): void {
  const book = $('#order-book');
  const rows: HTMLElement[] = [];
  for (let level = 5; level >= 1; level -= 1) {
    const row = document.createElement('div');
    row.innerHTML = `<span class="down">卖${level}</span><b>${(price + level * .02).toFixed(2)}</b>`;
    rows.push(row);
  }
  for (let level = 1; level <= 5; level += 1) {
    const row = document.createElement('div');
    row.innerHTML = `<span class="up">买${level}</span><b>${Math.max(.01, price - level * .02).toFixed(2)}</b>`;
    rows.push(row);
  }
  book.replaceChildren(...rows);
}

function drawChart(history: number[], previousClose: number): void {
  const rect = chart.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  chart.width = Math.round(rect.width * ratio);
  chart.height = Math.round(rect.height * ratio);
  const context = chart.getContext('2d');
  if (!context) return;
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const all = [...history, previousClose];
  const min = Math.min(...all) * .998;
  const max = Math.max(...all) * 1.002;
  const range = Math.max(.01, max - min);
  const y = (value: number): number => height - ((value - min) / range) * (height - 16) - 8;

  context.setLineDash([4, 5]);
  context.strokeStyle = 'rgba(190, 202, 216, .28)';
  context.beginPath();
  context.moveTo(0, y(previousClose));
  context.lineTo(width, y(previousClose));
  context.stroke();
  context.setLineDash([]);

  if (history.length < 2) return;
  const lineColor = history.at(-1)! >= previousClose ? '#ff5f6d' : '#33d69f';
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, lineColor + '55');
  gradient.addColorStop(1, lineColor + '00');
  context.beginPath();
  history.forEach((value, index) => {
    const x = (index / Math.max(1, history.length - 1)) * width;
    if (index === 0) context.moveTo(x, y(value)); else context.lineTo(x, y(value));
  });
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  history.forEach((value, index) => {
    const x = (index / Math.max(1, history.length - 1)) * width;
    if (index === 0) context.moveTo(x, y(value)); else context.lineTo(x, y(value));
  });
  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  context.shadowColor = lineColor;
  context.shadowBlur = 9;
  context.stroke();
  context.shadowBlur = 0;

  const lastValue = history.at(-1)!;
  const lastY = y(lastValue);
  context.beginPath();
  context.arc(width - 3, lastY, 3.5, 0, Math.PI * 2);
  context.fillStyle = lineColor;
  context.shadowColor = lineColor;
  context.shadowBlur = 12;
  context.fill();
  context.shadowBlur = 0;
}

function renderPortfolio(): void {
  const total = game.totalAssets();
  const rate = game.returnRate();
  $('#total-assets').textContent = money(total);
  $('#total-return').textContent = `今日 ${percent(rate)}`;
  $('#total-return').className = toneClass(rate);
  $('#cash-value').textContent = `可用 ${money(game.state.cash)}`;

  const positions = $('#positions');
  const held = game.state.stocks.filter((stock) => stock.shares > 0);
  if (!held.length) {
    positions.className = 'positions empty';
    positions.textContent = '还没有持仓。谨慎是好事，也可能只是没想好买什么。';
  } else {
    positions.className = 'positions';
    positions.replaceChildren(...held.map((stock) => {
      const profit = (stock.price - stock.averageCost) * stock.shares;
      const rateForPosition = stock.averageCost ? (stock.price - stock.averageCost) / stock.averageCost : 0;
      const row = document.createElement('div');
      row.className = 'position-row';
      row.innerHTML = `<b>${stock.name}<small>${stock.symbol}</small></b><span>持仓<strong>${stock.shares}</strong></span><span>现价<strong>${stock.price.toFixed(2)}</strong></span><span>成本<strong>${stock.averageCost.toFixed(2)}</strong></span><span>盈亏<strong class="${toneClass(profit)}">${profit >= 0 ? '+' : ''}${profit.toFixed(2)}</strong></span><span>收益率<strong class="${toneClass(rateForPosition)}">${percent(rateForPosition)}</strong></span>`;
      return row;
    }));
  }

  const orders = $('#orders');
  if (!game.state.orders.length) {
    orders.className = 'orders empty';
    orders.textContent = '暂无未成交委托';
  } else {
    orders.className = 'orders';
    orders.replaceChildren(...game.state.orders.map((order) => {
      const row = document.createElement('div');
      row.className = 'order-row';
      row.innerHTML = `<span>${order.side === 'buy' ? '买入' : '卖出'} ${game.getStock(order.symbol).name}</span><b>${order.quantity} @ ${order.limitPrice.toFixed(2)}</b><button>撤单</button>`;
      row.querySelector('button')!.addEventListener('click', () => { game.cancelOrder(order.id); render(); });
      return row;
    }));
  }
}

function renderTasks(): void {
  $('#task-list').replaceChildren(...game.state.tasks.map((task) => {
    const card = document.createElement('article');
    card.className = `task-card ${task.completed ? 'done' : ''}`;
    const overdue = !task.completed && game.state.time > task.dueAt;
    card.innerHTML = `<div class="task-avatar">${task.sender.includes('机器人') ? '🤖' : task.sender.includes('经理') ? '🧑‍💼' : '👨‍💻'}</div><div><h3>${task.title}</h3><p>${task.detail}</p><small>${task.sender} · ${overdue ? '<span class="up">已逾期</span>' : `截止 ${formatGameTime(task.dueAt)}`}</small></div><button ${task.completed ? 'disabled' : ''}>${task.completed ? '已处理' : '花 3 分钟处理'}</button>`;
    card.querySelector('button')!.addEventListener('click', () => {
      if (game.completeTask(task.id)) game.advance(3);
      render();
    });
    return card;
  }));
}

function renderStation(): void {
  const state = game.state;
  $('#token-value').textContent = String(state.tokens);
  const checkinButton = $<HTMLButtonElement>('#checkin-button');
  checkinButton.textContent = state.checkedIn ? '今日已签到 ✓' : '立即签到';
  checkinButton.disabled = state.checkedIn;
  $('#checkin-copy').textContent = `连续签到：${state.checkInStreak} 天`;
  const dropOpen = game.isDropOpen();
  $('#drop-copy').textContent = state.claimUsed ? '今日补给已领取，明天再来。' : dropOpen ? '补给已经开放，库存正在减少！' : state.time < 700 ? '下一场：11:40 午间补给' : state.time < 825 ? '下一场：13:45 午后补给' : '今日补给窗口已结束';
  const claimButton = $<HTMLButtonElement>('#claim-button');
  claimButton.textContent = state.claimUsed ? '今日已领取' : dropOpen ? '立即抢领' : '蹲守补给';
  claimButton.disabled = state.claimUsed;

  const claimGame = $('#claim-game');
  claimGame.classList.toggle('hidden', !state.claimSequence.length);
  if (state.claimSequence.length) {
    $('#claim-timer').textContent = `剩余 ${Math.max(0, Math.ceil(state.claimDeadline - state.time))} 分钟`;
    const sequence = $('#claim-sequence');
    sequence.replaceChildren(...state.claimSequence.map((color, index) => {
      const dot = document.createElement('i');
      dot.className = `color-${color} ${index < state.claimProgress ? 'done' : ''}`;
      return dot;
    }));
  }
}

function renderNews(): void {
  const last = [...game.state.news].reverse().find((item) => item.fired);
  if (last) $('#news-copy').textContent = `${formatGameTime(last.time)} ${last.title}：${last.body}`;
  const radar = $('#radar-card');
  const next = game.nextNews();
  const active = game.state.radarUntil > game.state.time && next;
  radar.classList.toggle('hidden', !active);
  if (active && next) radar.textContent = `🔮 雷达预警 ${formatGameTime(next.time)}：${next.title} · ${next.symbol ? game.getStock(next.symbol).name : '全市场'}`;
}

function renderToasts(): void {
  for (const toast of game.drainToasts()) {
    const element = document.createElement('div');
    element.className = `toast ${toast.tone}`;
    element.textContent = toast.message;
    toastStack.prepend(element);
    window.setTimeout(() => element.remove(), 5200);
  }
  while (toastStack.children.length > 4) toastStack.lastElementChild?.remove();
}

function makeCareerSave(): CareerSave {
  const previousCaught = career && career.nextDay === game.state.day ? career.cumulativeCaught : career?.cumulativeCaught ?? 0;
  return {
    version: 1,
    nextDay: game.state.day + 1,
    cash: game.state.cash,
    tokens: game.state.tokens,
    checkInStreak: game.state.checkedIn ? game.state.checkInStreak : 0,
    positions: game.state.stocks.map((stock) => ({ symbol: stock.symbol, shares: stock.shares, averageCost: stock.averageCost, lastPrice: stock.price })),
    cumulativeCaught: previousCaught + game.state.caughtCount,
    bestAssets: Math.max(career?.bestAssets ?? 0, game.totalAssets()),
    updatedAt: new Date().toISOString(),
  };
}

function showResult(): void {
  resultShown = true;
  career = makeCareerSave();
  if (settings.autoSave) storeCareer(localStorage, career);
  refreshCareerSummary();
  const score = game.score();
  const rate = game.returnRate();
  const grade = score > 5000 ? 'S' : score > 2500 ? 'A' : score > 800 ? 'B' : score > -500 ? 'C' : 'D';
  $('#result-grade').textContent = grade;
  $('#result-title').textContent = game.state.suspicion >= 100 ? '账户没爆，身份先爆了' : rate >= 0 ? '今天竟然回本了' : '短线又做成了长线';
  $('#result-stats').innerHTML = `<div><span>第 ${game.state.day} 天收盘资产</span><b class="${toneClass(rate)}">${money(game.totalAssets())}</b></div><div><span>今日收益</span><b class="${toneClass(rate)}">${percent(rate)}</b></div><div><span>工作进度</span><b>${Math.round(game.state.workProgress)}%</b></div><div><span>Token / 被抓</span><b>${game.state.tokens} / ${game.state.caughtCount}</b></div>`;
  $('#result-copy').textContent = grade === 'S' ? '你同时战胜了市场、老板和公益站服务器。建议明天降低预期。' : grade === 'A' ? '账户和工作都还活着，这已经超过大多数工位交易员。' : grade === 'B' ? '没有大赚，也没被请去会议室。普通但珍贵的一天。' : grade === 'C' ? '钱可以再赚，日报可以补，唯独下班时间一去不返。' : '你成功证明：频繁操作确实能让时间过得更快。';
  $('#result-overlay').classList.remove('hidden');
}

function openSettings(): void {
  paused = true;
  $<HTMLSelectElement>('#speed-setting').value = String(settings.speed);
  $<HTMLInputElement>('#sound-setting').checked = settings.sound;
  $<HTMLInputElement>('#vibration-setting').checked = settings.vibration;
  $<HTMLInputElement>('#autosave-setting').checked = settings.autoSave;
  refreshCareerSummary();
  $('#settings-overlay').classList.remove('hidden');
}

function closeSettings(save = true): void {
  if (save) {
    settings = {
      version: 1,
      speed: Number($<HTMLSelectElement>('#speed-setting').value) as PlayerSettings['speed'],
      sound: $<HTMLInputElement>('#sound-setting').checked,
      vibration: $<HTMLInputElement>('#vibration-setting').checked,
      autoSave: $<HTMLInputElement>('#autosave-setting').checked,
    };
    storeSettings(localStorage, settings);
  }
  $('#settings-overlay').classList.add('hidden');
  paused = false;
  lastFrame = performance.now();
}

$('#start-game').addEventListener('click', startGame);
$('#restart-button').addEventListener('click', startGame);
$('#settings-button').addEventListener('click', openSettings);
$('#settings-close').addEventListener('click', () => closeSettings(false));
$('#settings-done').addEventListener('click', () => closeSettings(true));
$('#clear-save').addEventListener('click', () => {
  if (!window.confirm('确定清除全部职业存档吗？现金、持仓、Token 和累计天数都会重置。')) return;
  clearCareer(localStorage);
  career = null;
  refreshCareerSummary();
  closeSettings(true);
  startGame();
});
$('#panic-button').addEventListener('click', () => { game.panic(); switchApp('ide'); render(); });
document.querySelectorAll<HTMLButtonElement>('.dock-item').forEach((button) => button.addEventListener('click', () => switchApp(button.dataset.app as DeskApp)));
document.querySelectorAll<HTMLButtonElement>('.trade-tabs button').forEach((button) => button.addEventListener('click', () => {
  side = button.dataset.side as OrderSide;
  document.querySelectorAll('.trade-tabs button').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  render();
}));
$('#price-minus').addEventListener('click', () => { orderPrice.value = Math.max(.01, Number(orderPrice.value) - .01).toFixed(2); });
$('#price-plus').addEventListener('click', () => { orderPrice.value = (Number(orderPrice.value) + .01).toFixed(2); });
document.querySelectorAll<HTMLButtonElement>('.quick-qty button').forEach((button) => button.addEventListener('click', () => {
  const stock = game.getStock();
  orderQuantity.value = button.dataset.qty === 'max'
    ? String(side === 'buy' ? Math.floor(game.state.cash / stock.price / 100) * 100 : stock.shares)
    : button.dataset.qty!;
}));
submitOrder.addEventListener('click', () => {
  game.placeOrder(side, Number(orderQuantity.value), Number(orderPrice.value));
  render();
});
$('#checkin-button').addEventListener('click', () => { game.checkIn(); render(); });
$('#claim-button').addEventListener('click', () => { game.startClaim(); render(); });
document.querySelectorAll<HTMLButtonElement>('.color-buttons button').forEach((button) => button.addEventListener('click', () => {
  game.submitClaimColor(Number(button.dataset.color));
  render();
}));
document.querySelectorAll<HTMLButtonElement>('[data-perk]').forEach((button) => button.addEventListener('click', () => {
  game.buyPerk(button.dataset.perk as 'radar' | 'coffee' | 'cancel');
  render();
}));
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
    event.preventDefault();
    game.panic();
    switchApp('ide');
    render();
  }
});
window.addEventListener('resize', () => render());

function frame(now: number): void {
  if (started && !paused && !game.state.ended) {
    const elapsed = Math.min(100, now - lastFrame);
    game.advance(elapsed * settings.speed / 1000);
    if (now - lastRender > 180) {
      render();
      lastRender = now;
    }
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}
refreshCareerSummary();
requestAnimationFrame(frame);
