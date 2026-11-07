const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const projectRoot=path.join(__dirname,'../..');
function make(){
 const els={};let now=1000,interval,download;
 class E {
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.hidden=false;this.attrs={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  set id(value){this._id=value;els[value]=this}get id(){return this._id}
  set textContent(value){this.text=value;this.children=[]}get textContent(){return this.text||''}
  replaceChildren(...nodes){this.children=nodes}append(...nodes){this.children.push(...nodes)}
  setAttribute(k,v){this.attrs[k]=v}addEventListener(k,f){this.listeners[k]=f}
  showModal(){this.open=true}close(){this.open=false}focus(){this.focused=true}
  querySelector(){return this.children[0]}click(){this.onclick?.()}
  getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}
 }
 const get=id=>els[id] ||= new E();const c={window:{scrollTo(){},addEventListener(){}},document:{body:{dataset:{examId:'pcpe-agente-2024-02-25'}},getElementById:get,createElement:t=>new E(t)},Date:class extends Date {constructor(...args){super(...(args.length?args:[now]))}static now(){return now}},setInterval:f=>{interval=f;return 1},clearInterval(){},setTimeout(){},confirm:()=>true,location:{reload(){}},URL:{createObjectURL:blob=>{download=blob;return 'blob:test'},revokeObjectURL(){}},Blob,console};
 vm.createContext(c);for(const f of ['exams/pcpe-agente-2024/definition.js','exams/pcpe-agente-2024/analysis.js','session-tracker.js','exam-report.js','pcpe.js'])vm.runInContext(fs.readFileSync(path.join(projectRoot,f),'utf8'),c);
 get('duration').value='270';get('start').click();
 return {get,c,advance:ms=>{now+=ms;interval()},report:async()=>{get('download').click();return await download.text()}};
}

module.exports={createSession:make};
