'use strict';

const byId = id => document.getElementById(id);
const form = byId('drawer-form');
const fileInput = byId('image-file');
const runButton = byId('run-project');
const cancelButton = byId('cancel-project');
const inputPreview = byId('input-preview');
const outputPreview = byId('output-preview');
const download = byId('download-result');
const status = byId('project-status');
let worker = null;
let inputUrl = null;
let outputUrl = null;
let runId = 0;
let busy = false;

function setStatus(message) { status.textContent = message; }
function setBusy(value) {
  busy = value;
  runButton.disabled = value;
  cancelButton.disabled = !value;
  fileInput.disabled = value;
}
function clearOutput() {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = null;
  outputPreview.hidden = true;
  outputPreview.removeAttribute('src');
  download.hidden = true;
  download.removeAttribute('href');
}
function finish(message, resetWorker = false) {
  if (resetWorker && worker) { worker.terminate(); worker = null; }
  setBusy(false);
  setStatus(message);
}
function validImage(file) {
  return file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 12 * 1024 * 1024;
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  inputUrl = null;
  inputPreview.hidden = true;
  inputPreview.removeAttribute('src');
  clearOutput();
  if (!file) { setStatus('请选择一张图片。'); return; }
  if (!validImage(file)) { setStatus('请选择不超过 12 MB 的 PNG、JPEG 或 WebP 图片。'); return; }
  inputUrl = URL.createObjectURL(file);
  inputPreview.src = inputUrl;
  inputPreview.hidden = false;
  setStatus('图片已准备好，可以开始生成。');
});

byId('color').addEventListener('change', event => {
  const inverted = byId('inverted');
  inverted.disabled = event.target.checked;
  if (event.target.checked) inverted.checked = false;
});

cancelButton.addEventListener('click', () => {
  runId += 1;
  finish('已停止。再次运行会重新加载 Python 环境。', true);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const file = fileInput.files[0];
  if (!validImage(file)) { setStatus('请先选择不超过 12 MB 的 PNG、JPEG 或 WebP 图片。'); return; }
  const options = {
    lines: Number(byId('line-count').value),
    angles: Number(byId('angle-count').value),
    darkness: Number(byId('darkness').value),
    maxSize: Number(byId('max-size').value),
    color: byId('color').checked,
    inverted: byId('inverted').checked
  };
  if (!Number.isInteger(options.lines) || options.lines < 20 || options.lines > 10000 ||
      !Number.isInteger(options.angles) || options.angles < 2 || options.angles > 40 ||
      !Number.isInteger(options.darkness) || options.darkness < 1 || options.darkness > 255 ||
      ![256, 512, 768, 1024].includes(options.maxSize)) {
    setStatus('请检查参数范围。');
    return;
  }
  const currentRun = ++runId;
  setBusy(true);
  clearOutput();
  setStatus('正在缩放图片…');
  try {
    const bitmap = await createImageBitmap(file);
    if (currentRun !== runId) { bitmap.close(); return; }
    if (bitmap.width < 2 || bitmap.height < 2) throw new Error('图片宽高至少需要 2 像素。');
    const scale = Math.min(1, options.maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(bitmap.width * scale));
    canvas.height = Math.max(2, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('图片转换失败。');
    const image = await blob.arrayBuffer();
    if (currentRun !== runId) return;
    if (!worker) worker = new Worker('line-drawer-worker.js');
    worker.onmessage = ({ data }) => {
      if (currentRun !== runId) return;
      if (data.type === 'status') setStatus(data.text);
      else if (data.type === 'done') {
        outputUrl = URL.createObjectURL(new Blob([data.image], { type: 'image/png' }));
        outputPreview.src = outputUrl;
        outputPreview.hidden = false;
        download.href = outputUrl;
        download.hidden = false;
        finish('生成完成，可以下载 PNG 图片。');
      } else if (data.type === 'error') finish('运行失败：' + data.text, true);
    };
    worker.onerror = error => {
      error.preventDefault();
      if (currentRun === runId) finish('浏览器 Python 加载失败，请检查网络后重试。', true);
    };
    worker.postMessage({ type: 'run', image, options }, [image]);
  } catch (error) {
    if (currentRun === runId) finish('无法处理图片：' + (error.message || error), true);
  }
});
