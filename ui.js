/* The Timeline — custom dropdown (replaces native <select>). Used by index.html and admin.html.
   UIDD.mount(el, {items:[[value,label,leadingHTML?,hint?]], value, onChange, label, search, placeholder, icon})
   el.value holds the current value; el.set(v) changes it without firing onChange. */
(function(){
const css=`
.dd{position:relative;display:inline-flex;min-width:0}
.dd.full{display:flex;width:100%}
.dd-b{display:flex;align-items:center;gap:10px;width:100%;height:46px;padding:0 14px;border-radius:2px;border:1px solid var(--line2,rgba(255,255,255,.14));background:var(--s1,#0f1118);color:var(--ink,#f5f2ed);font:600 15px var(--fb,system-ui);text-align:left;cursor:pointer;transition:border-color .2s,background .2s,box-shadow .2s}
.dd-b:hover{background:var(--s2,#151821)}
.dd-b[aria-expanded=true]{border-color:rgba(255,77,82,.7);box-shadow:0 0 0 4px rgba(226,35,42,.16)}
.dd-v{flex:1;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.dd-v>span{overflow:hidden;text-overflow:ellipsis}
.dd-c{width:16px;height:16px;flex:none;opacity:.6;transition:transform .25s}
.dd-b[aria-expanded=true] .dd-c{transform:rotate(180deg)}
.dd-ic{width:17px;height:17px;flex:none;opacity:.85}
.dd.pill .dd-b{height:40px;border-radius:2px;padding:0 14px;background:rgba(255,255,255,.03);font-size:14px}
.dd-p{position:fixed;z-index:120;min-width:220px;max-width:min(420px,calc(100vw - 16px));background:rgba(21,24,33,.98);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.14);border-radius:2px;box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4);padding:6px;display:flex;flex-direction:column;animation:ddIn .18s cubic-bezier(.2,.8,.2,1);outline:0;color:var(--ink,#f5f2ed);font-family:var(--fb,system-ui)}
@keyframes ddIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
.dd-p.up{animation-name:ddUp}@keyframes ddUp{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
.dd-s{height:42px;margin:2px 2px 6px;border-radius:2px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:inherit;padding:0 12px;font:500 15px var(--fb,system-ui);outline:0}
.dd-s:focus{border-color:rgba(255,77,82,.6)}
.dd-l{overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#2a2e3a transparent}
.dd-o{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:2px;cursor:pointer;font-size:15px;font-weight:600;min-height:42px}
.dd-o>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd-o small{color:var(--mut,#9aa0ad);font-weight:500;font-size:12px;white-space:nowrap}
.dd-o .ck{width:16px;height:16px;flex:none;opacity:0;color:#ff4d52}
.dd-o.sel .ck{opacity:1}
.dd-o.hi{background:rgba(255,255,255,.08)}
.dd-o.sel{color:#fff}
.dd-e{padding:14px;color:var(--mut,#9aa0ad);font-size:14px}
.dd-dot,.dd-o>.dd-dot,.dd-v>.dd-dot{width:10px;height:10px;border-radius:50%;flex:none;min-width:0}
@media (prefers-reduced-motion:reduce){.dd-p{animation:none}}`;
const st=document.createElement("style");st.textContent=css;document.head.append(st);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CHEV='<svg class="dd-c" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>';
const CK='<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-10"/></svg>';
let OPEN=null;
function close(focus){if(!OPEN)return;const o=OPEN;OPEN=null;o.p.remove();o.b.setAttribute("aria-expanded","false");if(focus)o.b.focus()}
document.addEventListener("pointerdown",e=>{if(OPEN&&!OPEN.p.contains(e.target)&&!OPEN.b.contains(e.target))close()},true);
window.addEventListener("resize",()=>close());
document.addEventListener("scroll",e=>{if(!OPEN||OPEN.p.contains(e.target))return;const r=OPEN.b.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)close();else OPEN.place()},true);
let uid=0;
function mount(el,o){if(typeof el==="string")el=document.getElementById(el);if(!el)return null;
 const items=o.items||[];el.value=o.value!==undefined?o.value:(items[0]&&items[0][0]);el.classList.add("dd");
 const id="dd"+(++uid);
 const curItem=()=>items.find(i=>String(i[0])===String(el.value))||items[0]||["",""];
 const render=()=>{const c=curItem();el.innerHTML=`<button type="button" class="dd-b" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}" aria-label="${esc(o.label||"")}: ${esc(c[1])}">${o.icon||""}<span class="dd-v">${c[2]||""}<span>${esc(c[1])}</span></span>${CHEV}</button>`;
  const b=el.firstChild;b.onclick=()=>OPEN&&OPEN.el===el?close(true):open();b.onkeydown=e=>{if(["ArrowDown","ArrowUp","Enter"," "].includes(e.key)){e.preventDefault();open()}}};
 el.set=v=>{el.value=v;render()};
 function open(){close();const b=el.firstChild;b.setAttribute("aria-expanded","true");
  const p=document.createElement("div");p.className="dd-p";p.id=id;p.tabIndex=-1;p.setAttribute("role","listbox");p.setAttribute("aria-label",o.label||"");
  p.innerHTML=(o.search?`<input class="dd-s" type="search" placeholder="${esc(o.placeholder||"Search")}" aria-label="${esc(o.placeholder||"Search")}" autocomplete="off">`:"")+`<div class="dd-l"></div>`;
  document.body.append(p);OPEN={p,b,el};
  let shown=items,hi=Math.max(0,items.findIndex(i=>String(i[0])===String(el.value))),ta="",taT;
  const list=p.querySelector(".dd-l");
  const draw=()=>{list.innerHTML=shown.length?shown.map((i,k)=>{const sel=String(i[0])===String(el.value);return`<div class="dd-o${k===hi?" hi":""}${sel?" sel":""}" role="option" id="${id}-${k}" aria-selected="${sel}" data-k="${k}">${i[2]||""}<span>${esc(i[1])}</span>${i[3]?`<small>${esc(i[3])}</small>`:""}${CK}</div>`}).join(""):`<div class="dd-e">—</div>`;
   p.setAttribute("aria-activedescendant",id+"-"+hi);const h=list.querySelector(".dd-o.hi");h&&h.scrollIntoView({block:"nearest"})};
  const pick=k=>{const i=shown[k];if(!i)return;const changed=String(i[0])!==String(el.value);el.value=i[0];close(true);render();el.firstChild.focus();if(changed&&o.onChange)o.onChange(i[0])};
  list.onclick=e=>{const d=e.target.closest(".dd-o");d&&pick(+d.dataset.k)};
  list.onmousemove=e=>{const d=e.target.closest(".dd-o");if(d&&+d.dataset.k!==hi){hi=+d.dataset.k;list.querySelectorAll(".dd-o").forEach((n,k)=>n.classList.toggle("hi",k===hi))}};
  const kd=e=>{const n=shown.length;if(e.key==="ArrowDown"){e.preventDefault();hi=Math.min(n-1,hi+1);draw()}else if(e.key==="ArrowUp"){e.preventDefault();hi=Math.max(0,hi-1);draw()}
   else if(e.key==="Home"){e.preventDefault();hi=0;draw()}else if(e.key==="End"){e.preventDefault();hi=n-1;draw()}else if(e.key==="Enter"){e.preventDefault();pick(hi)}
   else if(e.key==="Escape"){e.preventDefault();close(true)}else if(e.key==="Tab"){close()}
   else if(!o.search&&e.key.length===1){ta+=e.key.toLowerCase();clearTimeout(taT);taT=setTimeout(()=>ta="",600);const k=shown.findIndex(i=>String(i[1]).toLowerCase().startsWith(ta));if(k>=0){hi=k;draw()}}};
  p.addEventListener("keydown",kd);
  const s=p.querySelector(".dd-s");if(s)s.oninput=()=>{const q=s.value.trim().toLowerCase();shown=q?items.map(i=>[i,String(i[1]).toLowerCase()]).filter(([i,l])=>(l+" "+String(i[3]||"").toLowerCase()).includes(q)).sort((a,b)=>(a[1].startsWith(q)?0:/\b/.test(a[1])&&a[1].split(/[\s/]+/).some(w=>w.startsWith(q))?1:2)-(b[1].startsWith(q)?0:b[1].split(/[\s/]+/).some(w=>w.startsWith(q))?1:2)).map(x=>x[0]):items;hi=0;draw()};
  draw();
  const place=()=>{const r=b.getBoundingClientRect(),W=Math.max(r.width,o.minWidth||220);p.style.minWidth=W+"px";const pw=p.offsetWidth;
   let left=o.alignRight?r.right-pw:r.left;left=Math.max(8,Math.min(left,innerWidth-pw-8));p.style.left=left+"px";
   const below=innerHeight-r.bottom-12,above=r.top-12,up=below<260&&above>below;const mh=Math.min(420,up?above:below);
   list.style.maxHeight=(mh-(s?56:12))+"px";if(up){p.classList.add("up");p.style.top="";p.style.bottom=(innerHeight-r.top+6)+"px"}else{p.style.top=(r.bottom+6)+"px";p.style.bottom=""}};
  OPEN.place=place;place();(s||p).focus({preventScroll:true})}
 render();return el}
window.UIDD={mount,close,esc};
})();
