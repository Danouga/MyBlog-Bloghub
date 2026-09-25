'use strict';
// Fixed runtime version; Python and dependencies execute inside this worker only.
const indexURL='https://cdn.jsdelivr.net/pyodide/v0.27.3/full/';
let runtime;
self.onmessage=async ({data})=>{
  let globals;
  let text='',sent=0;
  const flush=()=>{if(text){self.postMessage({type:'output',text});text='';}};
  const append=line=>{if(sent>=200000)return;const chunk=(line+'\n').slice(0,200000-sent);sent+=chunk.length;text+=chunk;};
  const ticker=setInterval(flush,60);
  try{
    if(!runtime){
      self.postMessage({type:'status',text:'首次加载浏览器 Python，请稍候…'});
      importScripts(indexURL+'pyodide.js');
      runtime=await loadPyodide({indexURL,stdout:append,stderr:append});
    }
    self.postMessage({type:'ready'});
    runtime.setStdout({batched:append});runtime.setStderr({batched:append});
    const lines=data.stdin===''?[]:data.stdin.split(/\r?\n/);let line=0;
    runtime.setStdin({stdin:()=>line<lines.length?lines[line++]:null});
    self.postMessage({type:'status',text:'检查代码依赖…'});
    await runtime.loadPackagesFromImports(data.code);
    self.postMessage({type:'executing'});
    globals=runtime.toPy({__name__:'__main__'});
    const result=await runtime.runPythonAsync(data.code,{globals});
    if(result&&typeof result.destroy==='function')result.destroy();
    flush();self.postMessage({type:'done',truncated:sent>=200000});
  }catch(error){flush();self.postMessage({type:'error',text:String(error.message||error),fatal:!runtime});}
  finally{clearInterval(ticker);if(globals)globals.destroy();}
};
