'use strict';

const page = document.body.dataset.page;
const noteUrl = name => 'note.html?name=' + encodeURIComponent(name);
const fileType = name => name.split('.').pop().toLowerCase();
const noteTitle = name => name.split('/').pop().replace(/\.[^.]+$/, '');
const sourceText = value => Array.isArray(value) ? value.join('') : String(value || '');
const make = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value != null) element.textContent = value;
  return element;
};

async function loadNotes() {
  const response = await fetch('notes.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取笔记目录');
  const notes = await response.json();
  if (!Array.isArray(notes)) throw new Error('笔记目录格式错误');
  return notes.filter(note => note && typeof note.name === 'string' && typeof note.content === 'string');
}

function summary(note) {
  let content = note.content;
  if (fileType(note.name) === 'ipynb') {
    try {
      const notebook = JSON.parse(content);
      content = (notebook.cells || []).filter(cell => cell.cell_type === 'markdown').map(cell => sourceText(cell.source)).join(' ');
    } catch { content = ''; }
  }
  return content.replace(/[#*>`_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || '点击查看完整内容';
}

function showHome(notes) {
  const list = document.getElementById('notes');
  const status = document.getElementById('summary');
  const search = document.getElementById('search');
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = notes.filter(note => (note.name + ' ' + summary(note)).toLocaleLowerCase().includes(query));
    list.replaceChildren();
    status.textContent = '共 ' + visible.length + ' 篇笔记';
    for (const note of visible) {
      const card = make('a', 'note-card');
      card.href = noteUrl(note.name);
      card.append(make('h2', '', noteTitle(note.name)));
      card.append(make('p', 'note-excerpt', summary(note)));
      const meta = make('div', 'note-meta');
      meta.append(make('span', '', fileType(note.name).toUpperCase() + (note.name.includes('/') ? ' · ' + note.name.slice(0, note.name.lastIndexOf('/')) : '')));
      meta.append(make('span', 'view-link', '查看 →'));
      card.append(meta);
      list.append(card);
    }
    if (!visible.length) list.append(make('p', 'empty-state', query ? '没有找到匹配的笔记。' : '还没有已发布的笔记。'));
  }
  search.addEventListener('input', render);
  render();
}

function addInline(target, text) {
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    target.append(document.createTextNode(text.slice(start, match.index)));
    if (match[2]) target.append(make('strong', '', match[2]));
    else if (match[3]) target.append(make('code', '', match[3]));
    else {
      const link = make('a', '', match[4]);
      link.href = match[5];
      link.rel = 'noopener noreferrer';
      target.append(link);
    }
    start = match.index + match[0].length;
  }
  target.append(document.createTextNode(text.slice(start)));
}

function renderMarkdown(target, markdown) {
  let code = null;
  let list = null;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('```')) {
      if (code) { code = null; continue; }
      const pre = make('pre');
      code = make('code');
      pre.append(code);
      target.append(pre);
      list = null;
      continue;
    }
    if (code) { code.textContent += line + '\n'; continue; }
    if (!line.trim()) { list = null; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      list = null;
      const element = make('h' + heading[1].length);
      addInline(element, heading[2]);
      target.append(element);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      if (!list) { list = make('ul'); target.append(list); }
      const item = make('li');
      addInline(item, bullet[1]);
      list.append(item);
      continue;
    }
    list = null;
    const paragraph = make('p');
    addInline(paragraph, line);
    target.append(paragraph);
  }
}

function renderNotebook(target, content) {
  let notebook;
  try { notebook = JSON.parse(content); }
  catch { target.append(make('p', '', 'Notebook 内容无法解析。')); return; }
  for (const cell of notebook.cells || []) {
    const section = make('section', 'notebook-cell');
    if (cell.cell_type === 'markdown') renderMarkdown(section, sourceText(cell.source));
    else if (cell.cell_type === 'code') {
      const pre = make('pre');
      pre.append(make('code', '', sourceText(cell.source)));
      section.append(pre);
      for (const output of cell.outputs || []) {
        const data = output.data || {};
        const text = sourceText(output.text || data['text/plain']);
        if (text) section.append(make('pre', 'notebook-output', text));
        if (data['image/png']) {
          const image = make('img');
          image.src = 'data:image/png;base64,' + sourceText(data['image/png']);
          image.alt = 'Notebook 输出图片';
          image.style.maxWidth = '100%';
          section.append(image);
        }
      }
    }
    if (section.childNodes.length) target.append(section);
  }
}

function showNote(notes) {
  const name = new URLSearchParams(location.search).get('name');
  const title = document.getElementById('note-title');
  const content = document.getElementById('note-content');
  const note = notes.find(item => item.name === name);
  if (!note) {
    title.textContent = '找不到这篇笔记';
    content.append(make('p', '', '它可能已被移动或删除，请返回列表选择。'));
    return;
  }
  title.textContent = noteTitle(note.name);
  document.title = noteTitle(note.name) + ' · Bloghub';
  document.getElementById('note-type').textContent = fileType(note.name).toUpperCase() + ' · ' + note.name;
  if (fileType(note.name) === 'ipynb') renderNotebook(content, note.content);
  else if (fileType(note.name) === 'md') renderMarkdown(content, note.content);
  else {
    const pre = make('pre');
    pre.append(make('code', '', note.content));
    content.append(pre);
  }
}

loadNotes().then(notes => {
  if (page === 'home') showHome(notes);
  else showNote(notes);
}).catch(error => {
  if (page === 'home') {
    document.getElementById('summary').textContent = '笔记加载失败';
    document.getElementById('notes').append(make('p', 'empty-state', error.message));
  } else {
    document.getElementById('note-title').textContent = '笔记加载失败';
    document.getElementById('note-content').append(make('p', '', error.message));
  }
});
