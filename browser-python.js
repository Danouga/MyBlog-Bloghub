'use strict';

let pythonWorker=null,pythonDeadline,pythonReady=false;
const stopPython=document.createElement('button');stopPython.id='stopPython';stopPython.textContent='停止';stopPython.disabled=true;$('run').before(stopPython);
const inputDetails=document.createElement('details');inputDetails.className='python-input';
const inputSummary=document.createElement('summary');inputSummary.textContent='标准输入（代码使用 input() 时，提前填写，每行一次输入）';
const standardInput=document.createElement('textarea');standardInput.id='pythonStdin';standardInput.setAttribute('aria-label','Python 标准输入');standardInput.rows=3;
inputDetails.append(inputSummary,standardInput);document.querySelector('.runbar').before(inputDetails);
function finishPython(message,reset=false){clearTimeout(pythonDeadline);if(reset){if(pythonWorker)pythonWorker.terminate();pythonWorker=null;pythonReady=false;}busy=false;stopPython.disabled=true;runState();$('connection').textContent=pythonReady?'● Python 已就绪 · 后续运行复用环境':'● 浏览器 Python · 无需连接';if(message)$('output').textContent+='\n'+message;}
stopPython.onclick=()=>finishPython('[已停止运行，下次将重新初始化]',true);
const resetPython=document.createElement('button');resetPython.textContent='重置环境';resetPython.title='释放 Python 内存、模块和虚拟文件，下次运行重新初始化';stopPython.before(resetPython);resetPython.onclick=()=>finishPython('[环境已重置]',true);
$('connection').textContent='● 浏览器 Python · 无需连接';
$('output').textContent='首次运行加载 Python，同一页面后续运行复用已加载的环境和依赖；每次运行的顶层变量独立。';
$('run').onclick=()=>{
  if(busy)return;
  busy=true;runState();stopPython.disabled=false;$('output').textContent='';
  try{
    if(!pythonWorker)pythonWorker=new Worker('./python-worker.js');
    pythonDeadline=setTimeout(()=>finishPython('[加载超时，请检查网络后重试]',true),120000);
    pythonWorker.onmessage=({data})=>{
      if(data.type==='output'){$('output').textContent+=data.text;$('output').scrollTop=$('output').scrollHeight;}
      else if(data.type==='ready')pythonReady=true;
      else if(data.type==='status')$('connection').textContent=data.text;
      else if(data.type==='executing'){clearTimeout(pythonDeadline);$('connection').textContent='● 正在浏览器中运行';pythonDeadline=setTimeout(()=>finishPython('[运行超过 30 秒，已停止]',true),30000);}
      else if(data.type==='done')finishPython(data.truncated?'[运行完成，输出已截断至 200000 字符]':'[运行完成]');
      else if(data.type==='error')finishPython(data.text,!!data.fatal);
    };
    pythonWorker.onerror=event=>{event.preventDefault();finishPython('浏览器 Python 加载失败：'+event.message+'。请检查网络或浏览器设置后重试。',true);};
    pythonWorker.postMessage({code:$('editor').value,stdin:standardInput.value});
  }catch(error){finishPython('无法启动浏览器 Python：'+error.message,true);}
};
runState();
