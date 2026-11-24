import { writeFile } from 'node:fs/promises';

const port = Number(process.env.STOCK_DESK_BROWSER_PORT || 9230);
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((candidate) => candidate.type === 'page');
if (!page) throw new Error('No browser page found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data.toString());
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    message.error ? handler.reject(message.error) : handler.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push('console.error');
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 900));
await evaluate(`document.querySelector('#start-game').click(); true`);
await new Promise((resolve) => setTimeout(resolve, 1200));
const initial = JSON.parse(await evaluate(`JSON.stringify({
  title: document.title,
  size: [innerWidth, innerHeight],
  bootHidden: document.querySelector('#boot').classList.contains('hidden'),
  stocks: document.querySelectorAll('.stock-row').length,
  tasks: document.querySelectorAll('.task-card').length,
  chart: document.querySelector('#price-chart').getBoundingClientRect().toJSON(),
  app: [...document.querySelectorAll('.app-window')].find((node) => !node.classList.contains('hidden'))?.id,
  overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight
})`));
await evaluate(`document.querySelector('[data-qty="500"]').click(); document.querySelector('#submit-order').click()`);
await evaluate(`document.querySelector('[data-app="station"]').click(); document.querySelector('#checkin-button').click()`);
const interaction = JSON.parse(await evaluate(`JSON.stringify({
  tokens: document.querySelector('#token-value').textContent,
  checkedIn: document.querySelector('#checkin-button').textContent,
  toastCount: document.querySelectorAll('.toast').length,
  totalAssets: document.querySelector('#total-assets').textContent
})`));
const stationShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('screenshots/station.png', Buffer.from(stationShot.data, 'base64'));
await evaluate(`document.querySelector('[data-app="work"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
const workShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('screenshots/work.png', Buffer.from(workShot.data, 'base64'));
await evaluate(`document.querySelector('[data-app="market"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 250));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('screenshots/market.png', Buffer.from(shot.data, 'base64'));
await evaluate(`document.querySelector('#settings-button').click()`);
const pausedAt = await evaluate(`document.querySelector('#game-time').textContent`);
await new Promise((resolve) => setTimeout(resolve, 700));
const settingsCheck = JSON.parse(await evaluate(`JSON.stringify({
  visible: !document.querySelector('#settings-overlay').classList.contains('hidden'),
  paused: document.querySelector('#game-time').textContent === ${JSON.stringify(pausedAt)},
  speed: document.querySelector('#speed-setting').value,
  autoSave: document.querySelector('#autosave-setting').checked
})`));
await evaluate(`localStorage.setItem('desk-trader:career-v1', JSON.stringify({version:1,nextDay:4,cash:87654.32,tokens:11,checkInStreak:3,positions:[{symbol:'CASH',shares:300,averageCost:31.2,lastPrice:34.5}],cumulativeCaught:2,bestAssets:106000,updatedAt:new Date().toISOString()})); location.reload(); true`);
await new Promise((resolve) => setTimeout(resolve, 700));
const saveCheck = JSON.parse(await evaluate(`JSON.stringify({
  button: document.querySelector('#start-game').textContent,
  copy: document.querySelector('#career-copy').textContent
})`));
await evaluate(`document.querySelector('#start-game').click(); document.querySelector('[data-app="station"]').click(); true`);
await new Promise((resolve) => setTimeout(resolve, 200));
const carryCheck = JSON.parse(await evaluate(`JSON.stringify({
  day: document.querySelector('#career-day').textContent,
  price: document.querySelectorAll('.stock-row')[4].querySelector('b').textContent,
  streakBefore: document.querySelector('#checkin-copy').textContent
})`));
await evaluate(`document.querySelector('#checkin-button').click(); true`);
carryCheck.streakAfter = await evaluate(`document.querySelector('#checkin-copy').textContent`);
await evaluate(`localStorage.removeItem('desk-trader:career-v1'); true`);
console.log(JSON.stringify({ initial, interaction, settingsCheck, saveCheck, carryCheck, errors, screenshots: ['screenshots/market.png', 'screenshots/station.png', 'screenshots/work.png'] }, null, 2));
socket.close();
