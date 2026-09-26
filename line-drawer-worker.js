'use strict';

const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/';
let runtime = null;
let source = null;
const script = [
  'import json',
  'import sys',
  'sys.path.insert(0, "/home/pyodide")',
  'import numpy as np',
  'from PIL import Image',
  'import lineDrawer3',
  'with open("/home/pyodide/config.json", encoding="utf-8") as config_file:',
  '    config = json.load(config_file)',
  'count = config["lines"]',
  'angles = config["angles"]',
  'darkness = config["darkness"]',
  'if config["color"]:',
  '    rgb = lineDrawer3.load_image_rgb("/home/pyodide/input.png")',
  '    counts = lineDrawer3.alloc_line_counts(rgb, count)',
  '    channels = [lineDrawer3.draw_lines(rgb[:, :, channel].copy(), counts[channel], darkness, angles)[0] for channel in range(3)]',
  '    output = np.stack(channels, axis=-1)',
  'else:',
  '    gray = lineDrawer3.load_image("/home/pyodide/input.png", config["inverted"])',
  '    output, _ = lineDrawer3.draw_lines(gray, count, darkness, angles)',
  '    if config["inverted"]:',
  '        output = 255 - output',
  'Image.fromarray(output.astype(np.uint8)).save("/home/pyodide/output.png")'
].join('\n');

self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  try {
    if (!runtime) {
      self.postMessage({ type: 'status', text: '首次加载 Python 运行时…' });
      importScripts(indexURL + 'pyodide.js');
      runtime = await loadPyodide({ indexURL });
      self.postMessage({ type: 'status', text: '加载 NumPy 和 Pillow…' });
      await runtime.loadPackage(['numpy', 'pillow']);
    }
    if (!source) {
      const response = await fetch('projects/lineDrawer3.py');
      if (!response.ok) throw new Error('无法读取 lineDrawer3.py');
      source = await response.text();
      runtime.FS.mkdirTree('/home/pyodide');
      runtime.FS.writeFile('/home/pyodide/lineDrawer3.py', source);
    }
    runtime.FS.writeFile('/home/pyodide/input.png', new Uint8Array(data.image));
    runtime.FS.writeFile('/home/pyodide/config.json', JSON.stringify(data.options));
    self.postMessage({ type: 'status', text: '正在运行 lineDrawer3.py，请稍候…' });
    await runtime.runPythonAsync(script);
    const image = runtime.FS.readFile('/home/pyodide/output.png');
    self.postMessage({ type: 'done', image }, [image.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', text: String(error.message || error) });
  }
};
