import { writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9230/json').then((response) => response.json());
const page = pages.find((candidate) => candidate.type === 'page' && candidate.url.startsWith('http://127.0.0.1:4180'));
if (!page) throw new Error('Game page not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 1;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data.toString());
  if (!message.id || !pending.has(message.id)) return;
  const handler = pending.get(message.id);
  pending.delete(message.id);
  message.error ? handler.reject(message.error) : handler.resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = id++;
  pending.set(callId, { resolve, reject });
  socket.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
await send('Runtime.enable');
await send('Page.enable');
await evaluate(`localStorage.setItem('desk-trader:settings-v1', JSON.stringify({version:1,speed:3,sound:false,vibration:false,autoSave:true})); localStorage.removeItem('desk-trader:career-v1'); location.reload(); true`);
await new Promise((resolve) => setTimeout(resolve, 700));
await evaluate(`document.querySelector('#start-game').click(); true`);
await new Promise((resolve) => setTimeout(resolve, 15_050));
const result = JSON.parse(await evaluate(`JSON.stringify({
  time: document.querySelector('#game-time').textContent,
  alertVisible: !document.querySelector('#boss-alert').classList.contains('hidden'),
  alertText: document.querySelector('#boss-alert section').innerText,
  panicUrgent: document.querySelector('#panic-button').classList.contains('urgent'),
  title: document.title
})`));
const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('screenshots/boss-alert.png', Buffer.from(screenshot.data, 'base64'));
await evaluate(`localStorage.removeItem('desk-trader:settings-v1'); true`);
console.log(JSON.stringify({ ...result, screenshot: 'screenshots/boss-alert.png' }, null, 2));
socket.close();
