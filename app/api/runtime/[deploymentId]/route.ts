export async function GET(request: Request, { params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(deploymentId)) return new Response("", { status: 404 });
  const origin = new URL(request.url).origin;
  const configUrl = JSON.stringify(`${origin}/api/runtime/${deploymentId}/config`);
  const cacheKey = JSON.stringify(`c24ai:cfg:${deploymentId}`);
  const script = `(function(){"use strict";
var _p=location.pathname;if(_p!=="/"&&_p!=="/index.html")return;
var KEY=${cacheKey},URL_=${configUrl},MAXAGE=86400000;
function drop(){try{localStorage.removeItem(KEY)}catch(_){}}
function read(){try{var raw=localStorage.getItem(KEY);if(!raw)return null;var p=JSON.parse(raw);
if(!p||typeof p.html!=="string"||typeof p.css!=="string"||!p.html||!p.css||typeof p.t!=="number"||Date.now()-p.t>MAXAGE){drop();return null}
return p}catch(_){drop();return null}}
function write(d){try{localStorage.setItem(KEY,JSON.stringify({v:d.activeVersionId,html:d.html,css:d.css,t:Date.now()}))}catch(_){}}
function apply(d){var root=null,style=null,original=null,moved=[];
try{
if(!d||typeof d.html!=="string"||typeof d.css!=="string")return false;
if(document.querySelector("[data-moire-runtime-active]"))return false;
var x=document.createElement("template");x.innerHTML=d.html;
root=x.content.querySelector("[data-moire-root]");if(!root)return false;
var slots=[].slice.call(root.querySelectorAll('[data-cafe24-slot="product-list"]'));
var modules=[].slice.call(document.querySelectorAll('[module^="product_listmain"],.xans-product-listmain'));
if(!slots.length||!modules.length)return false;
original=document.querySelector("#wrap");if(!original)return false;
style=document.createElement("style");style.id="c24ai-runtime-style";style.textContent=d.css;
slots.forEach(function(slot,i){var m=modules[i];if(!m)return;var parent=m.parentNode,next=m.nextSibling;moved.push([m,parent,next]);slot.replaceChildren(m)});
root.setAttribute("data-moire-runtime-active","true");
document.body.insertBefore(root,original);
document.head.appendChild(style);
original.setAttribute("data-moire-original-hidden","true");
original.style.display="none";
document.documentElement.dataset.c24ai="active";
return true
}catch(_){
try{moved.reverse().forEach(function(e){if(e[1])e[1].insertBefore(e[0],e[2])});
if(root&&root.parentNode)root.remove();
if(style&&style.parentNode)style.remove();
if(original){original.style.removeProperty("display");original.removeAttribute("data-moire-original-hidden")}
delete document.documentElement.dataset.c24ai}catch(_){}
return false}}
var settled=false;
function settle(){if(settled)return;settled=true;try{document.dispatchEvent(new Event("c24ai:settled"))}catch(_){}}
function fetchConfig(done,fail){try{
var c=new AbortController(),t=setTimeout(function(){c.abort()},1800);
fetch(URL_,{signal:c.signal,credentials:"omit"}).then(function(r){clearTimeout(t);if(!r.ok){drop();throw new Error("inactive")}return r.json()}).then(done).catch(function(){if(fail)fail()})
}catch(_){if(fail)fail()}}
try{
var cached=read();
if(cached&&apply(cached)){
settle();
fetchConfig(function(d){if(d&&typeof d.html==="string"&&typeof d.css==="string"&&d.activeVersionId!==cached.v)write(d)})
}else{
if(cached)drop();
fetchConfig(function(d){if(apply(d))write(d);settle()},settle)
}
}catch(_){settle()}
}());`;
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store, max-age=0", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
