'use strict';

let pythonWorker=null,pythonDeadline;
const stopPython=document.createElement('button');stopPython.id='stopPython';stopPython.textContent='停止';stopPython.disabled=true;$('run').before(stopPython);
const inputDetails=document.createElement('details');inputDetails.className='python-input';
const inputSummary=document.createElement('summary');inputSummary.textContent='标准输入（代码使用 input() 时，提前填写，每行一次输入）';
const standardInput=document.createElement('textarea');standardInput.id='pythonStdin';standardInput.setAttribute('aria-label','Python 标准输入');standardInput.rows=3;
inputDetails.append(inputSummary,standardInput);document.querySelector('.runbar').before(inputDetails);
function finishPython(message){clearTimeout(pythonDeadline);if(pythonWorker)pythonWorker.terminate();pythonWorker=null;busy=false;stopPython.disabled=true;runState();$('connection').textContent='● 浏览器 Python · 无需连接';if(message)$('output').textContent+='\n'+message;}
stopPython.onclick=()=>finishPython('[已停止运行]');
$('connection').textContent='● 浏览器 Python · 无需连接';
$('output').textContent='选择 .py 文件后直接运行。首次运行需联网下载 Python；不使用本机 venv。';
$('run').onclick=()=>{
  if(busy)return;
  busy=true;runState();stopPython.disabled=false;$('output').textContent='';
  try{
    pythonWorker=new Worker('./python-worker.js');
    pythonDeadline=setTimeout(()=>finishPython('[加载超时，请检查网络后重试]'),120000);
    pythonWorker.onmessage=({data})=>{
      if(data.type==='output'){$('output').textContent+=data.text;$('output').scrollTop=$('output').scrollHeight;}
      else if(data.type==='status')$('connection').textContent=data.text;
      else if(data.type==='executing'){clearTimeout(pythonDeadline);$('connection').textContent='● 正在浏览器中运行';pythonDeadline=setTimeout(()=>finishPython('[运行超过 30 秒，已停止]'),30000);}
      else if(data.type==='done')finishPython(data.truncated?'[运行完成，输出已截断至 200000 字符]':'[运行完成]');
      else if(data.type==='error')finishPython(data.text);
    };
    pythonWorker.onerror=event=>{event.preventDefault();finishPython('浏览器 Python 加载失败：'+event.message+'。请检查网络或浏览器设置后重试。');};
    pythonWorker.postMessage({code:$('editor').value,stdin:standardInput.value});
  }catch(error){finishPython('无法启动浏览器 Python：'+error.message);}
};
runState();
