// /assets/js/timetable.js
(() => {
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const log = (m,t='info')=>{
    const li=document.createElement('li');
    li.textContent=`[${new Date().toLocaleTimeString()}] ${m}`;
    li.className=t==='error'?'text-rose-300':t==='warn'?'text-amber-300':'text-white/70';
    $('#log').prepend(li);
  };
  const uid = () => Math.random().toString(36).slice(2,9);

  const DAY_NAMES = ["B.e","Ç.a","Ç.","C.a","C.","Ş."];

  const state = {
    days: 5, periods: 7,
    classes: [], teachers: [], subjects: [], rooms: [],
    limits: { teacherDayMax: 7, classDayMax: 7 },
    lessons: [],                 // {id, classId, subjectId, teacherId, roomId, count}
    grid: {}                     // key "day-period-classId" => lessonId
  };

  // ------- Table -------
  function buildTable(){
    const t = $('#tt-table'); t.innerHTML='';
    const thead=document.createElement('thead'); thead.className='bg-white/5';
    const hr=document.createElement('tr');
    hr.innerHTML = `<th class="px-3 py-2 text-left">Saat</th>` +
      Array.from({length: state.days},(_,d)=>`<th class="px-3 py-2 text-left">${DAY_NAMES[d]}</th>`).join('');
    thead.appendChild(hr);

    const tbody=document.createElement('tbody');
    for(let r=0;r<state.periods;r++){
      const tr=document.createElement('tr');
      tr.appendChild(cell('th', `${r+1}-ci saat`));
      for(let d=0; d<state.days; d++){
        const td=cell('td'); td.dataset.day=d; td.dataset.period=r;
        td.ondragover= e=>e.preventDefault();
        td.ondrop = handleDrop;
        renderCell(td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    t.appendChild(thead); t.appendChild(tbody);
  }
  function cell(tag,text=''){
    const el=document.createElement(tag);
    el.className='px-3 py-2 border-t border-white/10 align-top text-left min-w-[150px]';
    if(text) el.textContent=text; return el;
  }
  const key = (d,p,c)=>`${d}-${p}-${c}`;

  function renderCell(td){
    const d=+td.dataset.day, p=+td.dataset.period;
    td.innerHTML='';
    const entries = Object.entries(state.grid).filter(([k])=>k.startsWith(`${d}-${p}-`));
    if(!entries.length) return;
    const wrap=document.createElement('div'); wrap.className='space-y-2';
    for(const [k, lid] of entries){ wrap.appendChild(lessonCard(lid,k)); }
    td.appendChild(wrap);
  }
  function getClassFromKey(k){ return k.split('-')[2]; }

  function lessonCard(lessonId, k){
    const L = state.lessons.find(x=>x.id===lessonId); const div=document.createElement('div');
    if(!L) return div;
    const cls = state.classes.find(x=>x.id===getClassFromKey(k))?.name || 'Sinif?';
    const sub = state.subjects.find(x=>x.id===L.subjectId)?.name || 'Fənn?';
    const tch = state.teachers.find(x=>x.id===L.teacherId)?.name || 'Müəllim?';
    const room= state.rooms.find(x=>x.id===L.roomId)?.name || 'Kabinet?';
    div.className='rounded-lg bg-white/5 border border-white/10 p-2 cursor-move';
    div.draggable=true;
    div.ondragstart = e => e.dataTransfer.setData('text/plain', JSON.stringify({type:'move', key:k}));
    div.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="font-medium">${cls} — ${sub}</div>
          <div class="text-xs text-white/60">${tch} • ${room}</div>
        </div>
        <button class="text-rose-300 text-xs hover:underline" data-del="${k}">Sil</button>
      </div>`;
    div.querySelector('[data-del]').onclick=()=>{ delete state.grid[k]; rerender(); log('Slot silindi'); };
    return div;
  }

  // ------- Palette -------
  function buildPalette(){
    const a = $('#lesson-palette'); a.innerHTML='';
    for(const L of state.lessons){
      const cls = state.classes.find(x=>x.id===L.classId)?.name || 'Sinif?';
      const sub = state.subjects.find(x=>x.id===L.subjectId)?.name || 'Fənn?';
      const tch = state.teachers.find(x=>x.id===L.teacherId)?.name || 'Müəllim?';
      const room= state.rooms.find(x=>x.id===L.roomId)?.name || 'Kabinet?';
      const b=document.createElement('button');
      b.className='px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10';
      b.draggable=true;
      b.ondragstart=e=>e.dataTransfer.setData('text/plain', JSON.stringify({type:'new', lessonId:L.id}));
      b.innerHTML = `<div class="text-left">
        <div class="font-medium">${cls} — ${sub}</div>
        <div class="text-xs text-white/60">${tch} • ${room} × ${L.count}</div>
      </div>`;
      a.appendChild(b);
    }
  }

  // ------- DnD / conflicts -------
  function handleDrop(e){
    e.preventDefault();
    const td=e.currentTarget; const d=+td.dataset.day, p=+td.dataset.period;
    const payload=JSON.parse(e.dataTransfer.getData('text/plain')||'{}');

    if(payload.type==='new'){
      const L=state.lessons.find(x=>x.id===payload.lessonId); if(!L) return;
      const k = key(d,p,L.classId);
      if(conflict(d,p,L)){ log('Toqquşma: müəllim/sinif/kabinet eyni vaxtda.', 'error'); return; }
      state.grid[k]=L.id; rerender(); log('Dərs yerləşdirildi');
    }
    if(payload.type==='move'){
      const from=payload.key; const L=state.lessons.find(x=>x.id===state.grid[from]); if(!L) return;
      const to = key(d,p,getClassFromKey(from));
      if(conflict(d,p,L, from)){ log('Toqquşma: hərəkət mümkün deyil.', 'error'); return; }
      delete state.grid[from]; state.grid[to]=L.id; rerender(); log('Dərs köçürüldü');
    }
  }
  function conflict(d,p,L, ignoreKey){
    for(const [k,lid] of Object.entries(state.grid)){
      if(ignoreKey && k===ignoreKey) continue;
      const [dd,pp] = k.split('-'); if(+dd!==d || +pp!==p) continue;
      const R=state.lessons.find(x=>x.id===lid); if(!R) continue;
      if(R.classId===L.classId) return true;
      if(R.teacherId===L.teacherId) return true;
      if(R.roomId===L.roomId) return true;
    }
    return false;
  }

  // ------- Panels (sadə CRUD: prompt-lar) -------
  function openPanel(name){
    const box = $('#panel-content');
    const list = (arr, key)=>arr.map(x=>`<li class="flex items-center justify-between py-1"><span>${x.name}</span><button data-del="${x.id}" data-type="${key}" class="text-rose-300 text-xs">Sil</button></li>`).join('');
    const bindDeletes = ()=> $$('#panel-content [data-del]').forEach(btn=>{
      btn.onclick=()=>{ const id=btn.getAttribute('data-del'); const type=btn.getAttribute('data-type'); state[type]=state[type].filter(x=>x.id!==id); rerender(); openPanel(name); log(`${type} silindi`); };
    });

    if(name==='classes'){ box.innerHTML=uiBlock('Siniflər','add-class', list(state.classes,'classes')); $('#add-class').onclick=()=>addItem('classes','Sinif adı (məs: 7A)'); bindDeletes(); }
    if(name==='teachers'){ box.innerHTML=uiBlock('Müəllimlər','add-teacher', list(state.teachers,'teachers')); $('#add-teacher').onclick=()=>addItem('teachers','Müəllim adı'); bindDeletes(); }
    if(name==='subjects'){ box.innerHTML=uiBlock('Fənlər','add-subject', list(state.subjects,'subjects')); $('#add-subject').onclick=()=>addItem('subjects','Fənn adı'); bindDeletes(); }
    if(name==='rooms'){ box.innerHTML=uiBlock('Kabinetlər','add-room', list(state.rooms,'rooms')); $('#add-room').onclick=()=>addItem('rooms','Kabinet (məs: 203)'); bindDeletes(); }
    if(name==='limits'){ box.innerHTML=`<div class="space-y-2">
      <div class="flex items-center justify-between gap-3"><label class="text-sm">Müəllimin gündə maksimum dərsi</label><input id="limit-t" type="number" min="1" max="12" value="${state.limits.teacherDayMax}" class="w-20 bg-transparent border border-white/10 rounded px-2 py-1"></div>
      <div class="flex items-center justify-between gap-3"><label class="text-sm">Sinifin gündə maksimum dərsi</label><input id="limit-c" type="number" min="1" max="12" value="${state.limits.classDayMax}" class="w-20 bg-transparent border border-white/10 rounded px-2 py-1"></div>
      <button id="save-limits" class="px-3 py-2 rounded bg-white/5 hover:bg-white/10">Yadda saxla</button></div>`;
      $('#save-limits').onclick=()=>{ state.limits.teacherDayMax=+$('#limit-t').value||7; state.limits.classDayMax=+$('#limit-c').value||7; log('Məhdudiyyətlər yeniləndi'); };
    }
    if(name==='settings'){
      box.innerHTML=`<div class="space-y-2 text-sm">
        <p>Dərs kartları yaradın (sinif+fənn+müəllim+kabinet və say).</p>
        <button id="add-lesson" class="px-3 py-2 rounded bg-white/5 hover:bg-white/10">Yeni dərs kartı</button>
        <ul id="lesson-list" class="mt-2 space-y-2"></ul></div>`;
      const ul=$('#lesson-list');
      for(const L of state.lessons){
        const cls=nById(state.classes,L.classId), sub=nById(state.subjects,L.subjectId), tch=nById(state.teachers,L.teacherId), room=nById(state.rooms,L.roomId);
        const li=document.createElement('li');
        li.className='border border-white/10 rounded-lg p-2 flex items-center justify-between';
        li.innerHTML=`<div><div class="font-medium">${cls} — ${sub}</div><div class="text-xs text-white/60">${tch} • ${room} × ${L.count}</div></div><button data-remove="${L.id}" class="text-rose-300 text-xs">Sil</button>`;
        ul.appendChild(li);
      }
      $$('#panel-content [data-remove]').forEach(b=>b.onclick=()=>{ state.lessons=state.lessons.filter(x=>x.id!==b.getAttribute('data-remove')); buildPalette(); openPanel('settings'); log('Dərs kartı silindi'); });
      $('#add-lesson').onclick=()=>addLesson();
    }
  }
  function uiBlock(title, addId, itemsHtml){
    return `<div class="flex items-center justify-between"><h3 class="font-medium">${title}</h3><button id="${addId}" class="px-2 py-1 rounded bg-white/5">Yeni</button></div><ul class="mt-2">${itemsHtml||''}</ul>`;
  }
  function addItem(key, promptText){
    const v = prompt(promptText); if(!v) return; state[key].push({id:uid(), name:v}); rerender(); openPanel(key); log(`${key.slice(0,-1)} əlavə olundu`);
  }
  function nById(arr,id){ return arr.find(x=>x.id===id)?.name || '?'; }
  function pick(title, arr){
    const lab = `${title}:\n` + arr.map((x,i)=>`${i+1}. ${x.name}`).join('\n');
    const idx = +(prompt(lab,'1')||'0')-1; return (idx>=0 && idx<arr.length) ? arr[idx].id : null;
  }
  function addLesson(){
    if(!state.classes.length || !state.teachers.length || !state.subjects.length || !state.rooms.length){
      alert('Əvvəl sinif, müəllim, fənn və kabinet siyahılarını doldurun.'); return;
    }
    const classId=pick('Sinif seç',state.classes);    if(!classId) return;
    const subjectId=pick('Fənn seç',state.subjects);  if(!subjectId) return;
    const teacherId=pick('Müəllim seç',state.teachers);if(!teacherId) return;
    const roomId=pick('Kabinet seç',state.rooms);     if(!roomId) return;
    const count=+(prompt('Həftəlik dərs sayı','2')||'2');
    state.lessons.push({id:uid(), classId, subjectId, teacherId, roomId, count:Math.max(1,Math.min(12,count))});
    buildPalette(); openPanel('settings'); log('Dərs kartı əlavə olundu');
  }

  // ------- Auto place -------
  function countPlaced(lid){ return Object.values(state.grid).filter(x=>x===lid).length; }
  function autoPlace(){
    let placed=0;
    for(const L of state.lessons){
      let need = L.count - countPlaced(L.id);
      for(let d=0; d<state.days && need>0; d++){
        for(let p=0; p<state.periods && need>0; p++){
          if(!conflict(d,p,L)){
            const k=key(d,p,L.classId);
            if(!state.grid[k]){ state.grid[k]=L.id; placed++; need--; }
          }
        }
      }
    }
    rerender(); log(`Avtomatik yerləşdirildi: ${placed}`);
  }

  // ------- Controls -------
  function applyStructure(){
    state.days=+$('#week-mode').value||5;
    state.periods=+$('#period-count').value||7;
    buildTable(); rerender(); log('Struktur yeniləndi');
  }
  function saveJSON(){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); a.download='eduplan-timetable.json'; a.click(); }
  function loadJSON(file){
    const fr=new FileReader(); fr.onload=()=>{ try{ Object.assign(state, JSON.parse(fr.result)); buildTable(); rerender(); log('JSON yükləndi'); }catch{ alert('JSON oxunmadı'); } };
    fr.readAsText(file);
  }
  function printPDF(){ window.print(); }
  function clearAll(){ if(confirm('Bütün məlumatları silək?')){ Object.assign(state, {...state, classes:[],teachers:[],subjects:[],rooms:[],lessons:[],grid:{}}); rerender(); log('Hamısı silindi','warn'); } }
  function rerender(){ $$('#tt-table td').forEach(td=>renderCell(td)); buildPalette(); }

  // ------- Bindings -------
  $('#apply-structure').onclick = applyStructure;
  $('#btn-auto').onclick = autoPlace;
  $('#btn-save').onclick = saveJSON;
  $('#file-load').onchange = e => { const f=e.target.files?.[0]; if(f) loadJSON(f); };
  $('#btn-print').onclick = printPDF;
  $('#btn-clear').onclick = clearAll;
  $$('[data-panel]').forEach(b=> b.onclick = ()=>openPanel(b.getAttribute('data-panel')));

  // ------- First render + demo seed -------
  buildTable(); buildPalette(); openPanel('classes');
  if(state.classes.length===0){
    state.classes.push({id:uid(), name:'7A'},{id:uid(), name:'7B'});
    state.teachers.push({id:uid(), name:'Ayşən müəllimə'},{id:uid(), name:'Rəşad müəllim'});
    state.subjects.push({id:uid(), name:'Riyaziyyat'},{id:uid(), name:'İnformatika'});
    state.rooms.push({id:uid(), name:'201'},{id:uid(), name:'LAB-1'});
    state.lessons.push({id:uid(), classId:state.classes[0].id, subjectId:state.subjects[0].id, teacherId:state.teachers[0].id, roomId:state.rooms[0].id, count:3});
    state.lessons.push({id:uid(), classId:state.classes[1].id, subjectId:state.subjects[1].id, teacherId:state.teachers[1].id, roomId:state.rooms[1].id, count:2});
    buildPalette(); log('Demo məlumatı əlavə olundu');
  }
})();
