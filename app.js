'use strict';
const $ = id => document.getElementById(id);
const storageKey = 'bloghub.files.v1';
let files = [], current, filter = 'all', connected = false, busy = false;
const sample = () => [{id:crypto.randomUUID(),name:'欢迎来到 Bloghub.md',content:'# 你的代码与笔记空间\n\n这里延续 Bloghub 的深色与橙色设计。\n\n## 开始创作\n- 新建或导入 Markdown 与代码文件\n- 内容自动保存在当前浏览器\n- 使用下载按钮备份到电脑\n\n## 运行 Python\n启动本地服务，连接环境，然后打开 Python 文件运行。\n\n**保存不等于发布**：这里的文件不会自动同步到 GitHub。',updated:Date.now()},{id:crypto.randomUUID(),name:'hello.py',content:'import sys\n\nprint("Hello, Bloghub!")\nprint("Python:", sys.version)\nprint("解释器:", sys.executable)\n',updated:Date.now()}];
try { const raw=localStorage.getItem(storageKey); files=raw?JSON.parse(raw):sample(); if(!Array.isArray(files)||!files.every(f=>typeof f.id==='string'&&typeof f.name==='string'&&typeof f.content==='string'))throw Error(); } catch {files=sample(); setTimeout(()=>notice('本地数据无法读取，未覆盖原数据。请检查浏览器存储。'),0);}
function notice(message){$('notice').textContent=message;$('notice').style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').style.display='none',4000);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(files));$('saved').textContent='已保存到浏览器';return true;}catch{$('saved').textContent='保存失败';notice('浏览器存储不可用或已满，请立即下载备份');return false;}}
const ext = name => name.split('.').pop().toLowerCase();
function list(){const query=$('search').value.toLowerCase();$('files').replaceChildren();$('count').textContent=files.length;const visible=files.filter(f=>(filter==='all'||(filter==='md'?ext(f.name)==='md':ext(f.name)!=='md'))&&(f.name+' '+f.content).toLowerCase().includes(query));for(const f of visible){const b=document.createElement('button');b.className='file-card'+(f.id===current?' selected':'');const title=document.createElement('strong');title.textContent=(ext(f.name)==='md'?'▤  ':'⌘  ')+f.name;const meta=document.createElement('small');meta.textContent=ext(f.name).toUpperCase()+' · '+new Date(f.updated).toLocaleDateString();b.append(title,meta);b.onclick=()=>select(f.id);$('files').append(b);}if(!visible.length){const p=document.createElement('p');p.textContent='没有匹配的文件';$('files').append(p);}}
function select(id){current=id;const f=files.find(f=>f.id===id);$('name').value=f?.name||'';$('editor').value=f?.content||'';for(const key of ['name','editor','save','download','delete'])$(key).disabled=!f;$('language').textContent=f?ext(f.name).toUpperCase():'';$('saved').textContent='';render();list();runState();}
function update(){const f=files.find(f=>f.id===current);if(!f)return;f.name=$('name').value;f.content=$('editor').value;f.updated=Date.now();persist();$('language').textContent=ext(f.name).toUpperCase();list();render();runState();}
function render(){const target=$('preview');target.replaceChildren();const content=$('editor').value;if(ext($('name').value)!=='md'){const pre=document.createElement('pre');pre.textContent=content;target.append(pre);return;}let code=null;for(const line of content.split('\n')){if(line.startsWith('```')){if(code){code=null;}else{const pre=document.createElement('pre');code=document.createElement('code');pre.append(code);target.append(pre);}continue;}if(code){code.textContent+=line+'\n';continue;}const heading=line.match(/^(#{1,6})\s+(.*)/);const bullet=line.match(/^[-*]\s+(.*)/);const el=document.createElement(heading?'h'+heading[1].length:bullet?'div':'p');const text=heading?heading[2]:bullet?'• '+bullet[1]:line;const parts=text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);for(const part of parts){const kind=part.startsWith('**')?'strong':part.startsWith('`')?'code':null;if(kind){const child=document.createElement(kind);child.textContent=part.slice(kind==='strong'?2:1,kind==='strong'?-2:-1);el.append(child);}else el.append(document.createTextNode(part));}target.append(el);}}
function runState(){$('run').disabled=busy||ext($('name').value)!=='py';}
$('editor').oninput=update;$('name').oninput=update;$('save').onclick=()=>{update();};$('search').oninput=list;
$('editor').onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,a=t.selectionStart,b=t.selectionEnd;t.setRangeText('    ',a,b,'end');update();}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();update();}});
$('create').onclick=()=>{const name=prompt('文件名（例如 notes.md 或 main.py）','未命名.md');if(!name?.trim())return;const f={id:crypto.randomUUID(),name:name.trim(),content:'',updated:Date.now()};files.unshift(f);persist();select(f.id);$('editor').focus();};
$('delete').onclick=()=>{if(!confirm('从浏览器文件库删除此文件？此操作无法撤销，请先下载备份。'))return;files=files.filter(f=>f.id!==current);persist();select(files[0]?.id);};
$('download').onclick=()=>{const blob=new Blob([$('editor').value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=$('name').value||'untitled.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){notice('请选择不超过 2 MB 的文本文件');return;}try{const f={id:crypto.randomUUID(),name:file.name,content:await file.text(),updated:Date.now()};files.unshift(f);persist();select(f.id);}catch{notice('文件读取失败');}e.target.value='';};
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));list();};
for(const [id,preview] of [['editTab',false],['previewTab',true]])$(id).onclick=()=>{$('editor').hidden=preview;$('preview').hidden=!preview;$('editTab').classList.toggle('active',!preview);$('previewTab').classList.toggle('active',preview);render();};
$('home').onclick=()=>{filter='all';$('search').value='';document.querySelector('[data-filter="all"]').click();};$('settings').onclick=()=>$('config').showModal();$('clear').onclick=()=>$('output').textContent='';
async function api(path,body){const response=await fetch('http://127.0.0.1:8765'+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('token').value},body:JSON.stringify(body),signal:AbortSignal.timeout(70000)});const data=await response.json();if(!response.ok)throw Error(data.error||'本地服务错误');return data;}
$('connect').onclick=async()=>{try{await api('/environments',{});connected=true;$('configStatus').textContent='保存服务已连接。发布时 GitHub 仍会检查本机账号的仓库写入权限。';}catch(e){connected=false;$('configStatus').textContent='连接失败：'+e.message+'。请确认保存服务已启动、密钥正确。';}};
select(files[0]?.id);

// Public repository notes with local draft protection. Credentials stay on the local service.
$('save').textContent='保存到 GitHub';
$('delete').textContent='移除本地副本';
document.querySelector('aside .hint').textContent='编辑自动存为本地草稿；保存到 GitHub 后所有人可见。移除本地副本不会删除仓库笔记。';
const refresh=document.createElement('button');refresh.textContent='刷新公开笔记';refresh.onclick=loadPublic;document.querySelector('aside').append(refresh);
let publishing=false;
async function loadPublic(){
  try{
    const response=await fetch('https://danouga.github.io/MyBlog-Bloghub/notes.json?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const notes=await response.json();
    if(!Array.isArray(notes))throw Error('目录格式错误');
    for(const note of notes){
      if(typeof note.name!=='string'||typeof note.content!=='string'||typeof note.sha!=='string')continue;
      const existing=files.find(f=>f.remoteName===note.name);
      if(existing){
        if(existing.content===existing.publishedContent&&existing.name===existing.remoteName){existing.content=note.content;existing.publishedContent=note.content;existing.sha=note.sha;}
      }else files.push({id:crypto.randomUUID(),name:note.name,content:note.content,remoteName:note.name,sha:note.sha,publishedContent:note.content,updated:Date.now()});
    }
    persist();select(current||files[0]?.id);notice('公开笔记已加载，本地草稿已保留');
  }catch(e){notice('公开笔记加载失败：'+e.message+'；本地草稿仍可使用');}
}
async function publish(){
  if(publishing)return;
  update();const f=files.find(f=>f.id===current);if(!f)return;
  if(!connected){notice('请先连接本地服务，再保存到 GitHub');$('config').showModal();return;}
  const snapshot={name:f.name,content:f.content,sha:f.remoteName===f.name?f.sha:undefined};
  publishing=true;$('save').disabled=true;$('save').textContent='正在提交…';
  try{const result=await api('/publish',snapshot);f.remoteName=snapshot.name;f.sha=result.sha;f.publishedContent=snapshot.content;persist();notice('已保存到公开仓库；网站部署完成后可见');}
  catch(e){notice(e.message+'（本地草稿保留）');}
  finally{publishing=false;$('save').disabled=!current;$('save').textContent='保存到 GitHub';}
}
$('save').onclick=publish;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();publish();}});
loadPublic();
