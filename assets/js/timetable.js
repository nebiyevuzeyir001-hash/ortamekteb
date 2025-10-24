// /assets/js/timetable.js
(() => {
  const el = document.getElementById('timetable-app');
  if (!el) return;

  el.innerHTML = `
    <div class="grid gap-4 md:grid-cols-5">
      <aside class="md:col-span-2 space-y-4">
        <div class="rounded-xl border border-white/10 p-4">
          <h2 class="font-semibold mb-3">Resurslar</h2>
          <div class="grid grid-cols-2 gap-2">
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Siniflər</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Müəllimlər</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Fənlər</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Kabinetlər</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Məhdudiyyətlər</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Parametrlər</button>
          </div>
        </div>

        <div class="rounded-xl border border-white/10 p-4">
          <h2 class="font-semibold mb-3">Əməliyyatlar</h2>
          <div class="flex flex-wrap gap-2">
            <button class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Avtomatik yerləşdir</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Əl ilə düzəliş</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Yadda saxla (JSON)</button>
            <button class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">PDF-ə eksport</button>
          </div>
        </div>
      </aside>

      <section class="md:col-span-3 rounded-xl border border-white/10 p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold">Cədvəl kanvası</h2>
          <div class="flex items-center gap-2 text-sm text-white/60">
            <span>Həftə:</span>
            <select class="bg-transparent border border-white/10 rounded-lg px-2 py-1">
              <option>B.e — Cümə</option>
              <option>B.e — Şənbə</option>
            </select>
          </div>
        </div>
        <div class="overflow-auto rounded-lg border border-white/10">
          <table class="min-w-full text-sm">
            <thead class="bg-white/5">
              <tr>
                <th class="px-3 py-2 text-left">Saat</th>
                <th class="px-3 py-2 text-left">B.e</th>
                <th class="px-3 py-2 text-left">Ç.a</th>
                <th class="px-3 py-2 text-left">Ç.</th>
                <th class="px-3 py-2 text-left">C.a</th>
                <th class="px-3 py-2 text-left">C.</th>
                <th class="px-3 py-2 text-left">Ş.</th>
              </tr>
            </thead>
            <tbody id="tt-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // Demo üçün 7x6 boş hüceyrə
  const body = el.querySelector('#tt-body');
  for (let r = 1; r <= 7; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 7; c++) {
      const td = document.createElement(c === 0 ? 'th' : 'td');
      td.className = "px-3 py-2 border-t border-white/10 align-top text-left";
      td.textContent = c === 0 ? `${r}-ci saat` : "—";
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
})();
