'use strict';
const library = document.querySelector('aside');
const layout = document.querySelector('.layout');
let folders = [], activeFolder = '', closedFolders = new Set();
try { folders = JSON.parse(localStorage.getItem('bloghub.folders.v1') || '[]'); if (!Array.isArray(folders)) folders=[]; folders=folders.filter(p=>typeof p==='string'&&validFolder(p)); } catch { folders=[]; }
function validFolder(path) { return path.length<=200 && path.split('/').every(p=>p.trim()===p && p.length>0 && p!=='.' && p!=='..' && !/[\\:*?"<>|\x00-\x1f]/.test(p)); }
function folderOf(name) { const i=name.lastIndexOf('/'); return i<0?'':name.slice(0,i); }
function folderPaths() { const paths=new Set(folders); for(const f of files) { const parts=folderOf(f.name).split('/').filter(Boolean); for(let i=1;i<=parts.length;i++)paths.add(parts.slice(0,i).join('/')); } return [...paths].sort((a,b)=>a.localeCompare(b,'zh-CN')); }
function saveFolders() { try {localStorage.setItem('bloghub.folders.v1',JSON.stringify(folders));}catch{notice('文件夹保存失败：浏览器存储不可用');} }
const title=library.querySelector('h2');
const heading=document.createElement('div'); heading.className='library-heading'; title.before(heading); heading.append(title);
const toggle=document.createElement('button');toggle.id='toggleLibrary';toggle.setAttribute('aria-controls','libraryBody');heading.append(toggle);
const body=document.createElement('div');body.id='libraryBody';for(const child of [...library.children])if(child!==heading)body.append(child);library.append(body);
function collapse(value) { layout.classList.toggle('library-collapsed',value);body.hidden=value;toggle.textContent=value?'›':'‹';toggle.setAttribute('aria-label',value?'展开文件库':'向左收起文件库');toggle.title=value?'展开文件库':'向左收起文件库';toggle.setAttribute('aria-expanded',String(!value));try{localStorage.setItem('bloghub.sidebar.collapsed',String(value));}catch{} }
toggle.onclick=()=>collapse(!body.hidden);
let initiallyCollapsed=false;try{initiallyCollapsed=localStorage.getItem('bloghub.sidebar.collapsed')==='true';}catch{}collapse(initiallyCollapsed);
const toolsRow=document.createElement('div');toolsRow.className='folder-tools';
const newFolder=document.createElement('button');newFolder.textContent='＋ 文件夹';newFolder.id='newFolder';
const locationLabel=document.createElement('span');locationLabel.id='folderLocation';toolsRow.append(newFolder,locationLabel);body.prepend(toolsRow);
const folderHint=document.createElement('p');folderHint.className='hint';folderHint.textContent='空文件夹保存在本机；文件保存到 GitHub 时同步对应目录。';body.append(folderHint);
const dialog=document.createElement('dialog');dialog.id='newItem';
const form=document.createElement('form');const dialogTitle=document.createElement('h2');const input=document.createElement('input');input.required=true;input.setAttribute('aria-label','名称');const error=document.createElement('p');error.setAttribute('role','status');const actions=document.createElement('div');actions.className='folder-tools';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=()=>dialog.close();const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='创建';actions.append(cancel,submit);form.append(dialogTitle,input,error,actions);dialog.append(form);document.body.append(dialog);
let creatingFolder=false;
function openCreate(folder) {creatingFolder=folder;dialogTitle.textContent=(folder?'新建文件夹':'新建文件')+' · '+(activeFolder||'根目录');input.value=folder?'':'未命名.md';error.textContent='';dialog.showModal();input.focus();input.select();}
newFolder.onclick=()=>openCreate(true);$('create').onclick=()=>openCreate(false);
form.onsubmit=e=>{e.preventDefault();const name=input.value.trim();const path=(activeFolder?activeFolder+'/':'')+name;if(!name||!validFolder(path)){error.textContent='名称不可包含非法符号、空路径或 ..';return;}if(creatingFolder){if(folderPaths().includes(path)||files.some(f=>f.name===path)){error.textContent='同名文件夹或文件已存在';return;}const parts=path.split('/');for(let i=1;i<=parts.length;i++){const p=parts.slice(0,i).join('/');if(!folders.includes(p))folders.push(p);closedFolders.delete(p);}saveFolders();activeFolder=path;list();}else{if(files.some(f=>f.name===path)||folderPaths().includes(path)){error.textContent='同名文件或文件夹已存在';return;}files.unshift({id:crypto.randomUUID(),name:path,content:'',updated:Date.now()});persist();select(files[0].id);}dialog.close();};
list=function(){
  const query=$('search').value.toLowerCase();const paths=folderPaths();const visible=files.filter(f=>(filter==='all'||(filter==='md'?ext(f.name)==='md':ext(f.name)!=='md'))&&(f.name+' '+f.content).toLowerCase().includes(query));
  $('files').replaceChildren();$('count').textContent=files.length;locationLabel.textContent=activeFolder||'根目录';locationLabel.title=locationLabel.textContent;
  const root=document.createElement('button');root.className='folder-row'+(!activeFolder?' active':'');root.textContent='⌂ 根目录';root.onclick=()=>{activeFolder='';list();};$('files').append(root);
  function renderLevel(parent,target){
    for(const path of paths.filter(p=>folderOf(p)===parent)){
      if(query&&!path.toLowerCase().includes(query)&&!visible.some(f=>f.name.startsWith(path+'/')))continue;
      const wrap=document.createElement('div');wrap.className='folder-branch';const row=document.createElement('div');row.className='folder-row'+(activeFolder===path?' active':'');
      const arrow=document.createElement('button');const opened=!!query||!closedFolders.has(path);arrow.textContent=opened?'▾':'▸';arrow.setAttribute('aria-label',(opened?'收起':'展开')+'文件夹 '+path);arrow.setAttribute('aria-expanded',String(opened));arrow.onclick=()=>{if(closedFolders.has(path))closedFolders.delete(path);else closedFolders.add(path);list();};
      const label=document.createElement('button');label.textContent='▱ '+path.split('/').pop();label.title=path;label.onclick=()=>{activeFolder=path;closedFolders.delete(path);list();};row.append(arrow,label);wrap.append(row);if(opened){const children=document.createElement('div');children.className='folder-children';renderLevel(path,children);if(!children.childElementCount){const empty=document.createElement('small');empty.className='empty-folder';empty.textContent='空文件夹';children.append(empty);}wrap.append(children);}target.append(wrap);
    }
    for(const f of visible.filter(f=>folderOf(f.name)===parent)){const b=document.createElement('button');b.className='file-card'+(f.id===current?' selected':'');const title=document.createElement('strong');title.textContent=(ext(f.name)==='md'?'▤  ':'⌘  ')+f.name.split('/').pop();const meta=document.createElement('small');meta.textContent=ext(f.name).toUpperCase()+' · '+new Date(f.updated).toLocaleDateString();b.title=f.name;b.append(title,meta);b.onclick=()=>{activeFolder=parent;select(f.id);};target.append(b);}
  }renderLevel('',$('files'));
};
// Import into the selected folder; preserve original import size checks.
const originalImport=$('file').onchange;
$('file').onchange=async e=>{const ids=new Set(files.map(f=>f.id));const destination=activeFolder;await originalImport(e);const added=files.find(f=>!ids.has(f.id));if(added&&destination){added.name=destination+'/'+added.name;persist();select(added.id);}};
list();
