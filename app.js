
const app = document.getElementById("app");
const celebration = document.getElementById("celebration");
let currentLesson = null;
let flashIndex = 0;
let flashFlipped = false;
let deferredInstallPrompt = null;

const stateKey = "admSimoneProgressV1";
const getState = () => JSON.parse(localStorage.getItem(stateKey) || "{}");
const saveState = s => localStorage.setItem(stateKey, JSON.stringify(s));

function setTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("admTheme", theme);
  document.querySelectorAll("[data-theme]").forEach(b=>b.classList.toggle("active",b.dataset.theme===theme));
  const meta = document.querySelector('meta[name="theme-color"]');
  meta.content = theme==="night" ? "#0e1420" : theme==="neon" ? "#05050a" : "#f5f7fb";
}
document.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
setTheme(localStorage.getItem("admTheme") || "day");

const installButtons = () => [document.getElementById("installBtn"), document.getElementById("installHeroBtn")].filter(Boolean);

function updateInstallButton(mode = "auto") {
  installButtons().forEach(btn => {
    if (mode === "installed") {
      btn.classList.add("hidden");
      btn.disabled = true;
      return;
    }
    btn.classList.remove("hidden", "secondaryState");
    btn.textContent = "📲 Instalar ADM";
    btn.disabled = false;
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallButton("available");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButton("installed");
});

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function installADM() {
  if (isStandalone()) {
    updateInstallButton("installed");
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (result && result.outcome === "accepted") updateInstallButton("installed");
    else updateInstallButton("auto");
    return;
  }
  alert("Para instalar o ADM: abra o menu do navegador e toque em 'Instalar aplicativo' ou 'Adicionar à tela inicial'. Depois o ADM aparecerá no celular com o ícone de chapéu de formando.");
}

function bindInstallButtons(){
  installButtons().forEach(btn => {
    if (!btn.dataset.installBound) {
      btn.addEventListener("click", installADM);
      btn.dataset.installBound = "1";
    }
  });
  updateInstallButton(isStandalone() ? "installed" : (deferredInstallPrompt ? "available" : "auto"));
}

bindInstallButtons();

document.getElementById("homeBtn").addEventListener("click", renderHome);

function renderHome(){
  currentLesson = null;
  const t = document.getElementById("homeTemplate").content.cloneNode(true);
  app.replaceChildren(t);
  bindInstallButtons();
  const grid = document.getElementById("lessonGrid");
  const progress = getState();
  Object.entries(window.LESSONS).forEach(([id,l])=>{
    const best = progress[id]?.bestScore;
    const fc = progress[id]?.flashSeen || 0;
    const b = document.createElement("button");
    b.className="lessonCard";
    b.innerHTML = `<span class="lessonNo">AULA ${String(id).padStart(2,"0")}</span>
      <h3>${l.title.replace(/^Aula \d+ — /,"")}</h3>
      <div class="stats">
        <span class="chip">30 questões</span><span class="chip">20 flashcards</span>
        ${best!=null?`<span class="chip">Melhor: ${best}%</span>`:""}
        ${fc?`<span class="chip">Flashcards: ${Math.min(fc,20)}/20</span>`:""}
      </div>`;
    b.addEventListener("click",()=>renderMode(id));
    grid.appendChild(b);
  });
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderMode(id){
  currentLesson=id;
  const l=window.LESSONS[id], st=getState()[id]||{};
  app.innerHTML=`<div class="modeWrap">
    <button class="backBtn" id="backHome">← Aulas</button>
    <div class="modeHead"><span class="eyebrow">AULA ${String(id).padStart(2,"0")}</span><h1>${l.title.replace(/^Aula \d+ — /,"")}</h1>
    <p>Escolha como deseja estudar agora.</p></div>
    <div class="modeGrid">
      <article class="modeCard"><div class="icon">📝</div><h2>Questões</h2><p>30 questões de múltipla escolha (A, B, C, D), com correção, nota e dicas nas respostas acertadas.</p>
      ${st.bestScore!=null?`<div class="chip" style="display:inline-block;margin-bottom:14px">Melhor nota: ${st.bestScore}%</div><br>`:""}
      <button class="primary" id="startQuiz">Iniciar questões</button></article>
      <article class="modeCard"><div class="icon">🧠</div><h2>Flashcards</h2><p>20 cartões de revisão. Toque no cartão para virar e conferir a resposta explicada.</p>
      <div class="chip" style="display:inline-block;margin-bottom:14px">Vistos: ${Math.min(st.flashSeen||0,20)}/20</div><br>
      <button class="primary" id="startFlash">Abrir flashcards</button></article>
    </div></div>`;
  document.getElementById("backHome").onclick=renderHome;
  document.getElementById("startQuiz").onclick=()=>renderQuiz(id);
  document.getElementById("startFlash").onclick=()=>renderFlash(id,0);
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderQuiz(id){
  currentLesson=id;
  const l=window.LESSONS[id];
  app.innerHTML=`<div class="quizWrap">
    <div class="quizTop"><button class="backBtn" id="backMode">← Aula</button><div class="progressOuter"><div class="progressInner" id="progressBar"></div></div><span class="progressText" id="progressText">0/30</span></div>
    <div class="modeHead"><span class="eyebrow">AULA ${String(id).padStart(2,"0")} • QUESTÕES</span><h1>Teste de conhecimentos</h1><p>Marque uma alternativa em cada questão. A nota mínima para aprovação é 80% (24 acertos).</p></div>
    <div id="resultBox"></div><div id="questions"></div>
    <div class="quizActions"><button class="secondary" id="clearQuiz">Limpar respostas</button><button class="primary" id="correctQuiz">Corrigir prova</button></div>
  </div>`;
  document.getElementById("backMode").onclick=()=>renderMode(id);
  const box=document.getElementById("questions");
  l.questions.forEach((q,idx)=>{
    const card=document.createElement("article");card.className="qCard";card.dataset.idx=idx;
    card.innerHTML=`<span class="qNum">QUESTÃO ${String(idx+1).padStart(2,"0")}</span><h3>${q.q}</h3>
      <div class="answers">${q.opts.map((o,j)=>`<label class="answer"><input type="radio" name="q${idx}" value="${j}"><span><b>${"ABCD"[j]}.</b> ${o}</span></label>`).join("")}</div>
      <div class="tipRow"><button class="secondary tipBtn" type="button">💡 Dicas</button><div class="tipText">${q.tip}</div></div>`;
    box.appendChild(card);
    if((idx+1)%5===0){
      const blockResult=document.createElement("div");
      blockResult.id=`blockResult${Math.floor(idx/5)}`;
      box.appendChild(blockResult);
    }
  });
  const showBlockResult=(questionIndex)=>{
    const block=Math.floor(questionIndex/5);
    const start=block*5;
    const end=start+5;
    const answered=[];
    for(let i=start;i<end;i++){
      const checked=document.querySelector(`input[name="q${i}"]:checked`);
      if(checked) answered.push({i,checked});
    }
    if(answered.length!==5)return;
    let hits=0;
    answered.forEach(({i,checked})=>{
      if(Number(checked.value)===l.questions[i].a)hits++;
    });
    const pct=Math.round(hits/5*100);
    const result=document.getElementById(`blockResult${block}`);
    result.innerHTML=`<section class="result"><div class="scoreCircle">${pct}%</div><div><h2>Resultado das questões ${start+1} a ${end}</h2><p>${hits} acerto${hits===1?"":"s"} de 5.</p></div></section>`;
    result.scrollIntoView({behavior:"smooth",block:"center"});
  };
  const updateProgress=()=>{
    let n=0;l.questions.forEach((_,i)=>{if(document.querySelector(`input[name="q${i}"]:checked`))n++});
    document.getElementById("progressBar").style.width=`${n/30*100}%`;
    document.getElementById("progressText").textContent=`${n}/30`;
  };
  box.addEventListener("change",e=>{
    updateProgress();
    const input=e.target.closest('input[type="radio"]');
    if(!input)return;
    const card=input.closest(".qCard");
    card?.classList.add("answered");
    showBlockResult(Number(card.dataset.idx));
  });
  box.addEventListener("click",e=>{
    const btn=e.target.closest(".tipBtn"); if(!btn)return;
    btn.nextElementSibling.classList.toggle("show");
  });
  document.getElementById("clearQuiz").onclick=()=>{renderQuiz(id)};
  document.getElementById("correctQuiz").onclick=()=>{
    const unanswered=l.questions.filter((_,i)=>!document.querySelector(`input[name="q${i}"]:checked`)).length;
    if(unanswered && !confirm(`Ainda existem ${unanswered} questão(ões) sem resposta. Corrigir mesmo assim?`))return;
    let hits=0;
    l.questions.forEach((q,i)=>{
      const card=document.querySelector(`.qCard[data-idx="${i}"]`);
      const checked=document.querySelector(`input[name="q${i}"]:checked`);
      card.querySelectorAll(".answer").forEach((lab,j)=>{
        lab.classList.toggle("correct",j===q.a);
        if(checked && Number(checked.value)===j && j!==q.a) lab.classList.add("wrong");
        lab.querySelector("input").disabled=true;
      });
      if(checked && Number(checked.value)===q.a){hits++;card.classList.add("correctCard")}
    });
    const pct=Math.round(hits/30*100);
    const passed=pct>=80;
    const result=document.getElementById("resultBox");
    result.innerHTML=`<section class="result"><div class="scoreCircle">${pct}%</div><div><h2>${passed?"Aprovada!":"Continue praticando"}</h2><p>${hits} acertos de 30. ${passed?"Você atingiu a meta de 80%.":"A meta é 24 acertos (80%). Revise e tente novamente."}</p></div></section>`;
    const s=getState();s[id]=s[id]||{};s[id].bestScore=Math.max(s[id].bestScore||0,pct);saveState(s);
    document.getElementById("correctQuiz").disabled=true;
    result.scrollIntoView({behavior:"smooth",block:"center"});
    if(passed) celebrate();
  };
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderFlash(id,index=0){
  currentLesson=id; flashIndex=index; flashFlipped=false;
  const cards=window.LESSONS[id].flashcards, c=cards[index];
  app.innerHTML=`<div class="flashWrap">
    <div class="quizTop"><button class="backBtn" id="backMode">← Aula</button><div class="progressOuter"><div class="progressInner" style="width:${(index+1)/20*100}%"></div></div><span class="progressText">${index+1}/20</span></div>
    <div class="modeHead"><span class="eyebrow">AULA ${String(id).padStart(2,"0")} • FLASHCARDS</span><h1>Revisão rápida</h1><p>Pense na resposta antes de virar o cartão.</p></div>
    <div class="flashStage"><div class="flashCard" id="flashCard" tabindex="0" role="button" aria-label="Virar flashcard">
      <div class="flashFace front"><span class="label">PERGUNTA</span><h2>${c.front}</h2><span class="flashHint">Toque para ver a resposta</span></div>
      <div class="flashFace back"><span class="label">RESPOSTA</span><p>${c.back}</p><span class="flashHint">Toque para voltar</span></div>
    </div></div>
    <div class="flashCount">Cartão ${index+1} de 20</div>
    <div class="flashControls"><button class="secondary" id="prevFlash" ${index===0?"disabled":""}>← Anterior</button><button class="primary" id="nextFlash">${index===19?"Concluir":"Próximo →"}</button></div>
  </div>`;
  const card=document.getElementById("flashCard");
  const flip=()=>{flashFlipped=!flashFlipped;card.classList.toggle("flipped",flashFlipped)};
  card.onclick=flip;card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();flip()}};
  document.getElementById("backMode").onclick=()=>renderMode(id);
  document.getElementById("prevFlash").onclick=()=>renderFlash(id,index-1);
  document.getElementById("nextFlash").onclick=()=>{
    const s=getState();s[id]=s[id]||{};s[id].flashSeen=Math.max(s[id].flashSeen||0,index+1);saveState(s);
    if(index===19){s[id].flashSeen=20;saveState(s);renderMode(id)} else renderFlash(id,index+1);
  };
  window.scrollTo({top:0,behavior:"smooth"});
}

function celebrate(){
  celebration.classList.remove("hidden");
  const canvas=document.getElementById("confettiCanvas"),ctx=canvas.getContext("2d");
  const resize=()=>{canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)};
  resize();
  const pieces=Array.from({length:180},()=>({
    x:Math.random()*innerWidth,y:-20-Math.random()*innerHeight*.35,w:5+Math.random()*7,h:8+Math.random()*10,
    vx:-2+Math.random()*4,vy:2+Math.random()*5,r:Math.random()*Math.PI,vr:-.18+Math.random()*.36,
    color:`hsl(${Math.random()*360} 90% 60%)`
  }));
  let raf, start=performance.now();
  function tick(t){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.vy+=.025;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();if(p.y>innerHeight+30){p.y=-20;p.x=Math.random()*innerWidth;p.vy=2+Math.random()*4}});
    if(t-start<5000)raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  setTimeout(()=>{cancelAnimationFrame(raf);celebration.classList.add("hidden");ctx.clearRect(0,0,canvas.width,canvas.height)},5000);
}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
renderHome();
