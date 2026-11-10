const C=[{id:"new",name:"חדש"},{id:"progress",name:"בתהליך"},{id:"offer",name:"בהצעה"},{id:"deal",name:"מו״מ"},{id:"won",name:"לקוח"}],Ht=[["new","חדש"],["progress","בתהליך"],["offer","בהצעה"],["deal","מו״מ"],["won","לקוח"],["share","שתף"],["lost","לא מתאים"],["lost","לא מעונין"]],qt=["פנייה ראשונית","שיחת היכרות","הצעה","מו״מ","סגירה"],Ct={new:10,progress:30,offer:55,deal:75,won:100,lost:0},Y=r=>r==="lost"?"לא מתאים":C.find(f=>f.id===r).name,Vt=r=>["new","progress","offer","deal","won"].indexOf(r),q={facebook:{label:"facebook",form:"טופס פייסבוק"},google:{label:"google",form:"טופס גוגל"},tiktok:{label:"tiktok",form:"טופס טיקטוק"},instagram:{label:"instagram",form:"טופס אינסטגרם"},site:{label:"האתר",form:"טופס באתר"},whatsapp:{label:"whatsapp",form:"וואטסאפ"}},Zt=[["שירה דהן","s","facebook","קמפיין לידים כללי 2 - 27/7",0,"12:32",0,"new",{fresh:!0}],["עומר חדד","o","google","חיפוש גוגל - מותג",0,"10:05",1200,"new",{fresh:!0}],["יעל פרץ","y","site","דף נחיתה - מבצע אוקטובר",1,"19:19",0,"new"],["איתי גבאי","i","facebook","קמפיין לידים כללי 2 - 27/7",2,"13:19",2700,"progress",{hot:!0}],["ליאת רוזן","l","tiktok","קמפיין חורף 1 - 03/10",3,"20:27",2700,"progress",{stuck:!0}],["גיל סויסה","g","whatsapp","הפניה מלקוח",1,"09:12",900,"progress"],["הדר נחום","h","instagram","קמפיין חורף 1 - 03/10",4,"15:58",6200,"offer",{hot:!0}],["אביב קליין","a","facebook","קמפיין לידים כללי 2 - 27/7",5,"11:08",5702,"offer"],["מאיה טל","m","google","חיפוש גוגל - מותג",7,"16:40",4800,"deal"],["יונתן צור","y","site","דף נחיתה - מבצע אוקטובר",9,"09:56",2700,"won"],["נועה שמש","n","facebook","קמפיין לידים כללי 2 - 27/7",12,"18:42",2700,"won"]],ut=[["רוני מזרחי","r","facebook","קמפיין לידים כללי 2 - 27/7",2700],["תמר בן דוד","t","google","חיפוש גוגל - מותג",1200],["דניאל אזולאי","d","tiktok","קמפיין חורף 1 - 03/10",3500],["מיכל כהן","m","instagram","קמפיין חורף 1 - 03/10",4800],["אורי לוי","o","site","דף נחיתה - מבצע אוקטובר",900],["עדי וקנין","a","whatsapp","הפניה מלקוח",6200]],bt=["תל אביב","חיפה","ירושלים","ראשון לציון","באר שבע","נתניה","פתח תקווה","מודיעין"],gt=["הצעת מחיר מסודרת","לדבר עם נציג","פרטים על החבילות","פגישת היכרות"],_t=["כמה שיותר מהר","החודש","בחודש הבא","רק בודק כרגע"],ft=["מ","א","ש"],Bt=5e3,mt=16e3,Ot=4,Rt={search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',bell:'<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/>',clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',trend:'<path d="m4 16 5-5 4 4 7-7"/><path d="M15 8h5v5"/>',phone:'<path d="M5 4h3l1.5 4-2 1.2a10 10 0 0 0 7.3 7.3l1.2-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.5 20 4 13.5 3.5 5.6A1.5 1.5 0 0 1 5 4Z"/>',chat:'<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z"/>',mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',cal:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',trash:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',alert:'<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17.2v.1"/>',grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',table:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 10v9"/>',megaphone:'<path d="M4 10v4h3l7 4V6L7 10H4Z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',dots:'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',right:'<path d="M5 12h14M13 6l6 6-6 6"/>',left:'<path d="M19 12H5M11 6l-6 6 6 6"/>',check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',logout:'<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9"/>',info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',pulse:'<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',clipboard:'<rect x="5.5" y="5" width="13" height="15.5" rx="2"/><path d="M9 5V3.5h6V5M9 10h6M9 13.5h6M9 17h3.5"/>',pencil:'<path d="m15 5 4 4L9 19H5v-4L15 5Z"/>',user:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/>',pin:'<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',help:'<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5M12 16.5v.1"/>',briefcase:'<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5h6v2M3.5 12h17"/>',send:'<path d="m20 4-16 7 6 2 2 6 8-15Z"/>',sparkle:'<path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/>',deal:'<path d="M3.5 12.5 7 9l3 1.5 3-2 3.5 1.5 4 3.5"/><path d="m8 14 2.5 2.5M11 13l3 3M14 12l2.5 2.5"/>'},n=r=>`<svg viewBox="0 0 24 24" aria-hidden="true">${Rt[r]}</svg>`,vt={facebook:'<svg class="src src--facebook" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V9a1 1 0 0 1 1-1Z"/></svg>',google:'<svg class="src src--google" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12.2c0-.6-.1-1.1-.2-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2.1h2.7c1.6-1.5 2.5-3.6 2.5-6.2Z"/><path d="M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2.1c-.7.5-1.7.8-2.8.8-2.2 0-4-1.5-4.7-3.4H4.5v2.2A8.5 8.5 0 0 0 12 20.5Z" style="fill:#34a853"/><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.5a8.5 8.5 0 0 0 0 7.8l2.8-2.2Z" style="fill:#fbbc05"/><path d="M12 6.9c1.2 0 2.3.4 3.2 1.2l2.4-2.4A8.5 8.5 0 0 0 4.5 8.1l2.8 2.2C8 8.4 9.8 6.9 12 6.9Z" style="fill:#ea4335"/></svg>',tiktok:'<svg class="src src--tiktok" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.5c.4 2.2 1.8 3.6 4 3.9v3.2a7.3 7.3 0 0 1-4-1.3v6a5.3 5.3 0 1 1-5.3-5.3h.5v3.3a2.1 2.1 0 1 0 1.6 2V3.5h3.2Z"/></svg>',instagram:'<svg class="src src--instagram" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6"/></svg>',site:'<svg class="src src--site" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.5 5.2 3.5 8.5s-1.1 6.2-3.5 8.5c-2.4-2.3-3.5-5.2-3.5-8.5S9.6 5.8 12 3.5Z"/></svg>',whatsapp:'<svg class="src src--whatsapp" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.5 5.2 16A8.3 8.3 0 1 1 8.4 19Z"/><path d="M9 8.5c.2 2.9 2.6 5.7 6 6.5l1-1.6-1.8-1-1 .8c-1-.4-1.9-1.3-2.4-2.4l.8-1-1-1.8L9 8.5Z"/></svg>'},R=r=>`<bdi class="money" dir="ltr"><i>₪</i>${r.toLocaleString("en-US")}</bdi>`,$t=r=>`${r.toLocaleString("en-US")} ₪`,z=r=>String(r).padStart(2,"0"),Dt=(r,f)=>{const m=new Date(Date.now()-r*864e5);return`${z(m.getDate())}.${z(m.getMonth()+1)} · ${f}`},wt=()=>{const r=new Date;return`${z(r.getHours())}:${z(r.getMinutes())}`},Mt="cubic-bezier(0.2, 0.7, 0.1, 1)";function yt(r,f,m,V=new Map){const Z=new Map([...r.querySelectorAll(f)].map(g=>[g,g.getBoundingClientRect()]));V.forEach((g,w)=>Z.set(w,g)),m();for(const g of r.querySelectorAll(f)){const w=Z.get(g);if(!w||g.hidden)continue;const H=g.getBoundingClientRect(),x=w.left-H.left,k=w.top-H.top;Math.abs(x)+Math.abs(k)<.5||g.animate([{transform:`translate(${x}px, ${k}px)`},{transform:"none"}],{duration:620,easing:Mt})}}function It(r){const f=matchMedia("(prefers-reduced-motion: reduce)").matches;let m=0,V=0,Z=0,g=0,w="",H="all",x="board",k=!1,y=!1;const v=new Set,B=new Set;let d=null;const st=t=>{m++;const e=Dt(t.age,t.time);return{id:m,order:++V,when:e,city:bt[m%bt.length],phone:`+97250${"•".repeat(5)}${String(m*37%90+10)}`,email:`${t.initial}•••@gmail.com`,want:gt[m%gt.length],start:_t[m%_t.length],owner:ft[m%ft.length],hot:!1,stuck:!1,fresh:!1,next:"",history:[{t:e,text:"נשלחה הודעת פתיחה אוטומטית"},{t:e,text:`הליד נכנס מ־${q[t.src].label}`}],...t}},_=Zt.slice().reverse().map(([t,e,a,s,o,i,u,p,l={}])=>st({name:t,initial:e,src:a,campaign:s,age:o,time:i,value:u,stage:p,...l})),D=(t,e,a)=>`<div class="kpi kpi--${t}">
      <span class="kpi__icon">${n(e)}</span>
      <span class="kpi__label">${a}</span>
      <b class="kpi__value" data-kpi="${t}">0</b>
      <small class="kpi__sub" data-sub="${t}"></small>
      ${t==="rate"?'<span class="kpi__bars" aria-hidden="true">'+[5,7,9,8,6,5,6,5].map(s=>`<i style="--h:${s}"></i>`).join("")+"</span>":""}
      ${t==="worth"?'<svg class="kpi__area" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C 30 40, 40 22, 70 20 S 140 18, 200 18 V60 H0Z"/><path class="kpi__line" d="M0 40 C 30 40, 40 22, 70 20 S 140 18, 200 18"/></svg>':""}
    </div>`;r.innerHTML=`
    <div class="app__top">
      <img class="app__logo" src="/work/eriks-crm-logo.webp" alt="אריקס CRM" width="960" height="248" />
      <label class="app__quick">${n("search")}<input type="search" placeholder="חיפוש מהיר…" aria-label="חיפוש מהיר" /><kbd>K⌘</kbd></label>
      <span class="app__logout">${n("logout")}התנתק</span>
    </div>
    <div class="app__page">
      <div class="app__kpis">
        ${D("total","users","סה״כ לידים")}${D("progress","clock","בתהליך")}${D("rate","trophy","המרה")}${D("worth","trend","שווי")}
      </div>
      <div class="app__panel">
        <div class="app__tools">
          <label class="app__search">${n("search")}<input type="search" placeholder="חיפוש ליד…" aria-label="חיפוש ליד" /></label>
          <div class="seg" data-group="range">
            <button type="button" class="is-on" data-range="all">הכל</button>
            <button type="button" data-range="0">היום</button>
            <button type="button" data-range="7">7 ימים</button>
            <button type="button" data-range="30">30 יום</button>
          </div>
          <button class="app__btn app__filter" type="button" aria-pressed="false">${n("sliders")}סינון</button>
          <span class="app__spacer"></span>
          <div class="seg seg--view" data-group="view">
            <button type="button" class="is-on" data-view="board">${n("grid")}קנבן</button>
            <button type="button" data-view="table">${n("table")}טבלה</button>
            <button type="button" data-view="facebook">${n("megaphone")}פייסבוק</button>
          </div>
          <span class="app__count"></span>
        </div>
        <div class="app__subbar">
          <button class="app__btn app__select" type="button" aria-pressed="false">${n("check")}<span>בחירה מרובה</span></button>
          <button class="app__btn app__bulk" type="button" hidden>העברה לשלב הבא</button>
        </div>
        <div class="board">
          ${C.map((t,e)=>`<section class="col" data-stage="${t.id}">
              <header class="col__head">
                <p class="col__title"><i></i><b>${t.name}</b><span class="col__count">0</span></p>
                <div class="col__tools">
                  <button type="button" data-col="sort" aria-label="מיון לפי שווי">${n("sliders")}</button>
                  <button type="button" data-col="add" aria-label="ליד חדש ב${t.name}">${n("plus")}</button>
                  <button type="button" data-col="grip" aria-label="גרירת עמודה">${n("dots")}</button>
                  <button type="button" data-col="prev" aria-label="הזזת העמודה ימינה"${e===0?" disabled":""}>${n("right")}</button>
                  <button type="button" data-col="next" aria-label="הזזת העמודה שמאלה"${e===C.length-1?" disabled":""}>${n("left")}</button>
                </div>
              </header>
              <p class="col__sum"><span>שווי</span><span class="col__money"></span></p>
              <div class="col__cards" data-lenis-prevent></div>
            </section>`).join("")}
        </div>
        <div class="tbl" hidden data-lenis-prevent>
          <table>
            <thead><tr><th>ליד</th><th>סטטוס</th><th>מקור</th><th>קמפיין</th><th>נכנס</th><th>שווי</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    <button class="app__fab" type="button" aria-label="התראות">${n("bell")}<span class="app__badge" hidden></span></button>
    <aside class="drawer" aria-hidden="true"><div class="drawer__panel" role="dialog" aria-label="כרטיס ליד" data-lenis-prevent></div></aside>
    <p class="app__toast" role="status"></p>`;const c=t=>r.querySelector(t),A=c(".board"),nt=t=>c(`.col[data-stage="${t}"]`),xt=Object.fromEntries(C.map(t=>[t.id,nt(t.id).querySelector(".col__cards")])),rt=c(".tbl tbody"),I=c(".drawer"),F=c(".drawer__panel"),W=c(".app__toast"),G=c(".app__badge"),S=t=>{t.el.classList.toggle("is-fresh",t.fresh),t.el.classList.toggle("is-won",t.stage==="won"),t.el.classList.toggle("is-stuck",t.stuck),t.el.classList.toggle("is-selected",v.has(t.id)),t.el.innerHTML=`
      <div class="lead__top">
        <span class="lead__grip">${n("dots")}</span>
        <b class="lead__name">${t.name}</b>
        ${t.fresh?'<em class="lead__badge lead__badge--new"><i></i>חדש</em>':""}
        ${t.hot&&t.stage!=="won"?'<em class="lead__badge lead__badge--hot">חם</em>':""}
      </div>
      <p class="lead__campaign">${t.campaign}</p>
      <p class="lead__src">${vt[t.src]}<b>${q[t.src].label}</b><span>${t.when}</span></p>
      ${t.stuck?`<p class="lead__alert">${n("alert")}ליד תקוע</p>`:""}
      <div class="lead__foot">
        <span class="lead__value">${R(t.value)}</span>
        <span class="lead__acts">
          <span class="lead__owner" title="אחראי">${t.owner}</span>
          <button type="button" data-act="call" aria-label="התקשר ל${t.name}">${n("phone")}</button>
          <button type="button" data-act="whatsapp" aria-label="וואטסאפ ל${t.name}">${n("chat")}</button>
        </span>
      </div>`},ot=t=>{t.el=document.createElement("article"),t.el.className="lead",t.el.tabIndex=0,t.el.dataset.id=t.id,S(t)};_.forEach(ot);const N=t=>_.find(e=>e.id===Number(t.dataset.id)),lt=()=>_.filter(t=>t.stage!=="lost"),K=t=>{const e=w.trim();return!(e&&!`${t.name} ${q[t.src].label} ${t.campaign}`.includes(e)||H!=="all"&&t.age>Number(H)||k&&!t.hot||x==="facebook"&&t.src!=="facebook")},ct=new Map,U=(t,e,a)=>{const s=ct.get(t)??0;if(ct.set(t,e),f||s===e){t.innerHTML=a(e);return}const o=performance.now(),i=u=>{const p=Math.min(1,(u-o)/700),l=1-Math.pow(1-p,3);t.innerHTML=a(Math.round(s+(e-s)*l)),p<1&&requestAnimationFrame(i)};requestAnimationFrame(i)},kt=()=>{const t=lt(),e=t.length,a=t.filter(l=>["progress","offer","deal"].includes(l.stage)).length,s=t.filter(l=>l.stage==="won"),o=t.reduce((l,h)=>l+h.value,0),i=s.reduce((l,h)=>l+h.value,0),u=e?Math.round(s.length/e*100):0;U(c('[data-kpi="total"]'),e,String),U(c('[data-kpi="progress"]'),a,String),U(c('[data-kpi="rate"]'),u,l=>`${l}%`),U(c('[data-kpi="worth"]'),o,l=>R(l)),c('[data-sub="total"]').textContent=`${t.filter(l=>l.age<=30).length} חדשים החודש`,c('[data-sub="progress"]').textContent=`${e?Math.round(a/e*100):0}% מסך הכל`,c('[data-sub="rate"]').textContent=`${s.length} סגורים · ${_.filter(l=>l.stage==="lost").length} לא מתאימים`,c('[data-sub="worth"]').innerHTML=`<span class="kpi__closed">${$t(i)} נסגר</span>`;let p=0;for(const l of C){const h=_.filter(T=>T.stage===l.id&&K(T));p+=h.length;const $=nt(l.id);$.querySelector(".col__count").textContent=h.length,$.querySelector(".col__money").innerHTML=R(h.reduce((T,X)=>T+X.value,0)),$.querySelector('[data-col="sort"]').classList.toggle("is-on",B.has(l.id))}c(".app__count").innerHTML=`<b>${p}</b> / ${e}`},St=()=>{rt.innerHTML=lt().filter(K).sort((t,e)=>e.order-t.order).map(t=>`<tr data-id="${t.id}" tabindex="0">
          <td><b>${t.name}</b></td>
          <td><span class="pill pill--${t.stage}">${Y(t.stage)}</span></td>
          <td class="tbl__src">${vt[t.src]}${q[t.src].label}</td><td>${t.campaign}</td><td>${t.when}</td>
          <td>${R(t.value)}</td></tr>`).join("")},L=t=>{const e=()=>{for(const a of C){const s=_.filter(o=>o.stage===a.id).sort((o,i)=>B.has(a.id)?i.value-o.value:i.order-o.order);xt[a.id].append(...s.map(o=>o.el))}_.filter(a=>a.stage==="lost").forEach(a=>a.el.remove()),_.forEach(a=>a.el.hidden=!K(a)),kt(),St()};f||x==="table"?e():yt(A,".lead",e,t)};let it=0;const M=t=>{W.textContent=t,W.classList.add("is-shown"),clearTimeout(it),it=setTimeout(()=>W.classList.remove("is-shown"),2600)},O=(t,e)=>t.history.unshift({t:`היום · ${wt()}`,text:e}),j=(t,e,a)=>{if(t.stage!==e){if(t.stage=e,t.order=++V,t.fresh=!1,(e==="won"||e==="lost")&&(t.stuck=!1),O(t,`הסטטוס עודכן ל"${Y(e)}"`),S(t),L(a),e==="won")M(`עסקה נסגרה · ${$t(t.value)}`),f||t.el.animate([{boxShadow:"0 0 0 0 rgba(34,197,94,.5)"},{boxShadow:"0 0 0 14px rgba(34,197,94,0)"}],{duration:900});else if(e==="lost"){M(`${t.name} סומן כלא מתאים`),d===t&&Q();return}d===t&&P(t)}},Lt={call:{text:"שיחה יוצאת · 3 דק׳",toast:t=>`מתקשר ל${t.name}…`},whatsapp:{text:"נשלחה הודעת וואטסאפ",toast:()=>"הודעת וואטסאפ נשלחה"},mail:{text:"נשלחה הצעת מחיר במייל",toast:()=>"הצעת מחיר נשלחה במייל"},meet:{text:"נקבעה פגישה · מחר 10:00",toast:()=>"נקבעה פגישה · מחר 10:00"}},dt=(t,e)=>{const a=Lt[e];t.fresh=!1,t.stuck=!1,O(t,a.text),M(a.toast(t)),t.stage==="new"?j(t,"progress"):e==="mail"&&t.stage==="progress"?j(t,"offer"):(S(t),d===t&&P(t))},pt=(t="new",e=!0)=>{const[a,s,o,i,u]=ut[Z%ut.length];Z++;const p=st({name:a,initial:s,src:o,campaign:i,age:0,time:wt(),value:u,stage:t,fresh:t==="new"});_.push(p),ot(p),L(),e&&(g++,G.hidden=!1,G.textContent=g,M(`ליד חדש מ־${q[o].label} · נשלחה הודעת פתיחה אוטומטית`))};function P(t){const e=Vt(t.stage),a=(s,o,i,u,p=!1)=>`<div class="dr__field dr__field--${s}"><dt>${n(o)}${i}</dt><dd${p?' dir="ltr"':""}>${u}</dd></div>`;F.innerHTML=`
      <header class="dr__head">
        <span class="dr__av">${t.name[0]}</span>
        <span class="dr__who">
          <b>${t.name}</b>
          <small>${n("megaphone")}${t.campaign}</small>
          <em class="pill pill--${t.stage}">${Y(t.stage)}</em>
        </span>
        <span class="dr__head-btns">
          <button class="dr__icon dr__trash" type="button" data-status="lost" aria-label="מחיקת הליד">${n("trash")}</button>
          <button class="dr__icon dr__close" type="button" aria-label="סגירה">${n("close")}</button>
        </span>
      </header>
      <div class="dr__acts">
        <button type="button" class="dr__act dr__act--green" data-act="call">${n("phone")}התקשר</button>
        <button type="button" class="dr__act dr__act--green" data-act="whatsapp">${n("chat")}וואטסאפ</button>
        <button type="button" class="dr__act dr__act--blue" data-act="mail">${n("mail")}מייל</button>
        <button type="button" class="dr__act dr__act--blue" data-act="meet">${n("cal")}פגישה</button>
      </div>
      ${t.stuck?`<p class="dr__alert">${n("alert")}ליד תקוע — לא היה מגע זמן רב. תזכורת לטיפול.</p>`:""}
      <div class="dr__cols">
        <section class="dr__card">
          <h4>${n("info")}פרטי הליד<small>· כולל השאלות מטופס הלידים</small></h4>
          <div class="dr__form">
            <div class="dr__form-head">
              <span class="dr__form-icon">${n("clipboard")}</span>
              <span><b>פרטים מהטופס</b><small>${q[t.src].form}</small></span>
              <span class="dr__edit">${n("pencil")}עריכה</span>
            </div>
            <dl class="dr__fields">
              ${a("blue","user","שם מלא",t.name)}
              ${a("green","phone","טלפון",t.phone,!0)}
              ${a("blue","mail","אימייל",t.email,!0)}
              ${a("yellow","pin","עיר",t.city)}
              ${a("purple wide","help","מה הכי חשוב לך?",t.want)}
              ${a("purple wide","help","מתי תרצו להתחיל?",t.start)}
            </dl>
          </div>
        </section>
        <section class="dr__card">
          <h4>${n("pulse")}סטטוס נוכחי ותזכורות</h4>
          <div class="dr__pills">${Ht.map(([s,o])=>`<button type="button" data-status="${s}" class="${s===t.stage?"is-on":""}">${o}</button>`).join("")}</div>
          <p class="dr__label">${n("briefcase")}שלב בתהליך</p>
          <ol class="dr__steps">${qt.map((s,o)=>`<li class="${o===e?"is-now":o<e?"is-done":""}">${o+1}. ${s}</li>`).join("")}</ol>
          <form class="dr__next">
            <p class="dr__next-label">הצעד הבא ${n("left")}</p>
            <label class="dr__next-input">
              <input name="next" type="text" placeholder="לדוגמה: לחזור עם הצעת מחיר מעודכנת" value="${t.next}" />
              <button type="submit" aria-label="שמירת הצעד הבא">${n("send")}</button>
            </label>
            <p class="dr__remind">${n("cal")}תזכורת:<span>מחר, 10:00</span></p>
            <small class="dr__saved">${t.next?"התזכורת נשמרה":"אין תזכורת פתוחה"}</small>
          </form>
        </section>
      </div>
      <section class="dr__card">
        <h4>${n("sparkle")}מה קרה עם הליד?<small>· נשמר בהערות ובהיסטוריה</small></h4>
        <form class="dr__note"><input name="note" type="text" placeholder="למשל: שיחה של 10 דק׳, התעניין בחבילה המורחבת וביקש הצעת מחיר עד יום ג׳" /></form>
        <ol class="dr__history">${t.history.map(s=>`<li><span>${s.text}</span><small>${s.t}</small></li>`).join("")}</ol>
      </section>
      <section class="dr__card">
        <h4>${n("deal")}העסקה</h4>
        <dl class="dr__deal">
          <div><dt>שווי</dt><dd>${R(t.value)}</dd></div>
          <div><dt>סיכוי לסגירה</dt><dd>${Ct[t.stage]}%</dd></div>
          <div><dt>אחראי</dt><dd><span class="lead__owner">${t.owner}</span></dd></div>
        </dl>
      </section>`}const J=t=>{d=t,t.fresh&&(t.fresh=!1,S(t)),P(t),F.scrollTop=0,r.classList.add("has-drawer"),I.setAttribute("aria-hidden","false"),F.querySelector(".dr__close").focus({preventScroll:!0})};function Q(){if(!d)return;const t=d.el;d=null,r.classList.remove("has-drawer"),I.setAttribute("aria-hidden","true"),t.isConnected&&t.focus({preventScroll:!0})}I.addEventListener("click",t=>{if(!d)return;if(!t.target.closest(".drawer__panel")||t.target.closest(".dr__close"))return Q();const e=t.target.closest("[data-act]");if(e)return dt(d,e.dataset.act);const a=t.target.closest("[data-status]");if(a){if(a.dataset.status==="share")return M(`${d.name} שותף עם הצוות`);j(d,a.dataset.status)}}),I.addEventListener("submit",t=>{if(t.preventDefault(),!d)return;const a=t.target.querySelector("input").value.trim();a&&(t.target.matches(".dr__next")?(d.next=a,O(d,`הצעד הבא: ${a}`),M("הצעד הבא נשמר, תזכורת למחר ב־10:00")):(O(d,a),M("ההערה נשמרה")),d.stuck=!1,S(d),P(d))}),r.addEventListener("keydown",t=>{var a,s;t.key==="Escape"&&Q();const e=(s=(a=t.target).closest)==null?void 0:s.call(a,".lead, tr[data-id]");e&&(t.key==="Enter"||t.key===" ")&&t.target===e&&(t.preventDefault(),J(N(e)))});const Et=t=>{if(!y)return J(t);v.has(t.id)?v.delete(t.id):v.add(t.id),S(t),tt()},tt=()=>{const t=c(".app__select");t.setAttribute("aria-pressed",String(y)),t.querySelector("span").textContent=y?v.size?`${v.size} נבחרו`:"בחרו כרטיסים":"בחירה מרובה",c(".app__bulk").hidden=!y||!v.size,r.classList.toggle("is-selecting",y)};let E=null,b=null;const Tt=(t,e)=>{var a;return((a=document.elementFromPoint(t,e))==null?void 0:a.closest(".col"))||null};A.addEventListener("pointerdown",t=>{const e=t.target.closest(".lead");if(!e||t.button!==0)return;const a=t.target.closest("[data-act]"),s=N(e),o={x:t.clientX,y:t.clientY},i=e.getBoundingClientRect();let u=!1;const p=h=>{if(!u){if(h.pointerType==="touch"||a||y||Math.hypot(h.clientX-o.x,h.clientY-o.y)<6)return;u=!0,E=e.cloneNode(!0),E.classList.add("lead--ghost"),E.style.width=`${i.width}px`,r.append(E),e.classList.add("is-lifted"),r.classList.add("is-dragging")}E.style.translate=`${h.clientX-(o.x-i.left)}px ${h.clientY-(o.y-i.top)}px`;const $=Tt(h.clientX,h.clientY);$!==b&&(b==null||b.classList.remove("is-over"),b=$,b==null||b.classList.add("is-over"))},l=h=>{if(window.removeEventListener("pointermove",p),window.removeEventListener("pointerup",l),window.removeEventListener("pointercancel",l),!u){h.type==="pointerup"&&!a&&Et(s);return}const $=E.getBoundingClientRect();E.remove(),E=null,e.classList.remove("is-lifted"),r.classList.remove("is-dragging"),b==null||b.classList.remove("is-over");const T=b==null?void 0:b.dataset.stage;if(b=null,T&&T!==s.stage)j(s,T,new Map([[e,$]]));else if(!f){const X=e.getBoundingClientRect();e.animate([{transform:`translate(${$.left-X.left}px, ${$.top-X.top}px)`},{transform:"none"}],{duration:420,easing:Mt})}};window.addEventListener("pointermove",p),window.addEventListener("pointerup",l),window.addEventListener("pointercancel",l)}),A.addEventListener("click",t=>{const e=t.target.closest("[data-act]");if(e)return dt(N(e.closest(".lead")),e.dataset.act);const a=t.target.closest("[data-col]");if(!a||a.disabled)return;const s=a.closest(".col"),o=s.dataset.stage;if(a.dataset.col==="add"&&pt(o,o==="new"),a.dataset.col==="sort"&&(B.has(o)?B.delete(o):B.add(o),L()),a.dataset.col==="prev"||a.dataset.col==="next"){const i=a.dataset.col==="prev"?s.previousElementSibling:s.nextElementSibling;if(!i)return;yt(A,".col",()=>a.dataset.col==="prev"?i.before(s):i.after(s));const u=[...A.children];u.forEach((p,l)=>{p.querySelector('[data-col="prev"]').disabled=l===0,p.querySelector('[data-col="next"]').disabled=l===u.length-1})}}),rt.addEventListener("click",t=>{const e=t.target.closest("tr[data-id]");e&&J(N(e))});const At=t=>{w=t.target.value,r.querySelectorAll('input[type="search"]').forEach(e=>e!==t.target&&(e.value=w)),L()};if(r.querySelectorAll('input[type="search"]').forEach(t=>t.addEventListener("input",At)),r.querySelectorAll(".seg").forEach(t=>t.addEventListener("click",e=>{const a=e.target.closest("button");a&&(t.querySelectorAll("button").forEach(s=>s.classList.toggle("is-on",s===a)),a.dataset.view&&(x=a.dataset.view,A.hidden=x==="table",c(".tbl").hidden=x!=="table"),a.dataset.range&&(H=a.dataset.range),L())})),c(".app__filter").addEventListener("click",t=>{k=!k,t.currentTarget.setAttribute("aria-pressed",String(k)),t.currentTarget.lastChild.textContent=k?"רק חמים":"סינון",L()}),c(".app__select").addEventListener("click",()=>{if(y=!y,!y){const t=[...v];v.clear(),t.forEach(e=>S(_.find(a=>a.id===e)))}tt()}),c(".app__bulk").addEventListener("click",()=>{const t={new:"progress",progress:"offer",offer:"deal",deal:"won"},e=_.filter(a=>v.has(a.id)&&t[a.stage]);v.clear(),e.forEach(a=>{a.stage=t[a.stage],a.order=++V,a.fresh=!1,O(a,`הסטטוס עודכן ל"${Y(a.stage)}"`)}),_.forEach(S),L(),M(`${e.length} לידים הועברו לשלב הבא`),tt()}),c(".app__fab").addEventListener("click",()=>{g=0,G.hidden=!0;const t=_.filter(e=>e.fresh);t.forEach(e=>e.el.animate([{scale:1},{scale:1.04},{scale:1}],{duration:500})),t.length&&A.scrollTo({left:0,behavior:"smooth"}),M(t.length?`${t.length} לידים חדשים בעמודת "חדש"`:"אין התראות חדשות")}),L(),f)return;let et=0,at=0;const ht=t=>{clearTimeout(et),et=setTimeout(()=>{at>=Ot||(at++,pt(),ht(mt))},t)};new IntersectionObserver(([t])=>{t.isIntersecting?ht(at?mt:Bt):clearTimeout(et)},{threshold:.35}).observe(r)}export{It as initPortal};
