// movies.js
import { state, DOM, showToast } from './main.js';

export async function loadMovies(page=1, query="", sort=state.currentSort, startsWithLetter="", status=state.currentStatus, formats=[]) {
    state.currentPage = page;
    state.currentQuery = query;
    state.currentSort = sort;
    state.currentStatus = status;
    state.currentFormats = formats || [];

    let url = `/api/search?page=${page}&sort=${sort}&status=${status}`;
        if (typeof state.pageSize !== 'undefined' && state.pageSize !== null) url += `&page_size=${encodeURIComponent(state.pageSize)}`;
    if(query) url += `&q=${encodeURIComponent(query)}`;
    if(startsWithLetter) url += `&starts_with=${encodeURIComponent(startsWithLetter)}`;
    if(formats && formats.length) url += `&formats=${encodeURIComponent(formats.join(","))}`;

    const res = await fetch(url);
    const data = await res.json();

    // Render posters
    DOM.posterGrid.innerHTML = "";
    data.movies.forEach(m => {
        const card = document.createElement("div");
        card.className = "poster-card";
        card.dataset.rowid = m.rowid;
        const versionRaw = (m.version || '').toString().trim();
        const isNonTheatrical = versionRaw && versionRaw.toLowerCase() !== 'theatrical';
        const shortVersion = (v=>{
            if(!v) return '';
            const s = v.toLowerCase();
            if(s.includes('director')) return 'Director\'s Cut';
            if(s.includes('extended')) return 'Extended Cut';
            if(s.includes('collector')) return 'Collector\'s Edition';
            if(s.includes('special')) return 'Special Edition';
            return v;
        })(versionRaw);
        // build TMDb search URL from title + year (opens search results page)
        const tmdbQuery = encodeURIComponent((m.title||"") + (m.year?` ${m.year}`:""));
        const tmdbSearchUrl = `https://www.themoviedb.org/search?query=${tmdbQuery}`;
        const tmdbId = m.tmdb_id || m.tmdbId || '';
        const tmdbUrl = tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : tmdbSearchUrl;
        card.innerHTML = `
            <label class="select-wrap"><input type="checkbox" class="select-checkbox" data-rowid="${m.rowid}"></label>
            ${m.status==="wanted"?`<span class="badge wanted">NEED</span>`:""}
            ${isNonTheatrical?`<span class="badge version" title="${shortVersion}">${shortVersion}</span>`:""}
            ${m.format?`<span class="badge format" title="${m.format}">${m.format}</span>`:""}
            ${m.poster_path?`<a class="tmdb-link" href="${tmdbUrl}" target="_blank" rel="noopener noreferrer"><img src="${m.poster_path}" loading="lazy"></a>`:""}
            <div class="poster-title">${m.title}</div>
            <button class="edit-btn"
                data-rowid="${m.rowid}"
                data-poster="${m.poster_path||''}"
                data-tmdb-id="${tmdbId}"
                data-title="${m.title}"
                data-year="${m.year||''}"
                data-format="${m.format}"
                data-status="${m.status}"
                data-version="${m.version||''}"
                data-country="${m.country||''}"
                data-language="${m.language||''}"
                data-region="${m.region||''}"
                data-disc_count="${m.disc_count||''}"
                data-notes="${m.notes||''}"
                title="Edit Metadata">
                <i class="fas fa-pen"></i>
            </button>
        `;
        DOM.posterGrid.appendChild(card);
    });

    // ensure checkboxes reflect current select-all state (if any)
    const selectAll = document.getElementById('select-all-checkbox');
    if (selectAll && selectAll.checked) {
        document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = true);
    }

    document.querySelector(".count strong").textContent = data.total;
 
    // Pagination
    DOM.paginationDiv.innerHTML = "";
    if(data.page>1){
        const prev = document.createElement("button");
        prev.textContent = "⬅ Prev";
        prev.onclick = () => loadMovies(data.page-1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        DOM.paginationDiv.appendChild(prev);
    }

    const label = document.createElement("span");
    label.textContent = ` Page ${data.page} of ${data.pages} `;
    DOM.paginationDiv.appendChild(label);

    if(data.page < data.pages){
        const next = document.createElement("button");
        next.textContent = "Next ➡";
        next.onclick = () => loadMovies(data.page+1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        DOM.paginationDiv.appendChild(next);
    }
}

// Collections UI: load and render collections grid
export async function loadCollections(){
    const grid = document.querySelector('.collections-grid');
    if(!grid) return;
    try{
        const res = await fetch('/api/collections');
        if(!res.ok) return;
        const cols = await res.json();
        grid.innerHTML = '';
        cols.forEach(c => {
            const card = document.createElement('div');
            card.className = 'collection-card';
            card.dataset.cid = c.id;
            card.innerHTML = `
                <div class="collection-header">
                    <strong>${c.name}</strong>
                    <span class="collection-count">(${c.count})</span>
                    <button class="toggle-collection" title="Toggle">▾</button>
                </div>
                <div class="collection-body hidden"></div>
            `;
            grid.appendChild(card);
        });
    }catch(e){ console.error('loadCollections error', e); }
}

// delegate click to expand collection
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.toggle-collection');
    if(!btn) return;
    const card = btn.closest('.collection-card');
    if(!card) return;
    const body = card.querySelector('.collection-body');
    const cid = card.dataset.cid;
    if(!body || !cid) return;
    if(body.classList.contains('hidden')){
        // fetch movies
        try{
            const res = await fetch(`/api/collection/${cid}/movies`);
            if(res.ok){
                const movies = await res.json();
                body.innerHTML = movies.map(m => `<div class="collection-movie"><img src="${m.poster_path||''}" alt="" loading="lazy"><div class="cm-title">${m.title}</div></div>`).join('');
            }
        }catch(err){ console.error(err); }
    }
    body.classList.toggle('hidden');
});

// Prevent poster link navigation when in edit-mode (extra guard in addition to CSS)
document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('.tmdb-link');
    if (!link) return;
    if (DOM.posterGrid && DOM.posterGrid.classList.contains('edit-mode')) {
        e.preventDefault();
        e.stopPropagation();
    }
});

// Initialize bulk selection handlers (select-all, delete selected)
export function initBulkActions(){
    const selectAll = document.getElementById('select-all-checkbox');
    const deleteBtn = document.getElementById('delete-selected-btn');
    const toggleBtn = document.getElementById('toggle-edit-mode');
    const posterToolbar = document.querySelector('.poster-toolbar');
    const posterGridEl = DOM.posterGrid;
    if(!selectAll || !deleteBtn) return;

    function updateDeleteState(){
        const any = document.querySelectorAll('.select-checkbox:checked').length > 0;
        deleteBtn.disabled = !any;
        const applyBtnLocal = document.getElementById('apply-bulk-btn');
        if(applyBtnLocal) applyBtnLocal.disabled = !any;
        const collAddBtn = document.getElementById('bulk-add-collection-btn');
        if(collAddBtn) collAddBtn.disabled = !any;
    }

    selectAll.addEventListener('change', (e) => {
        const checked = !!e.target.checked;
        document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = checked);
        updateDeleteState();
    });

    // Edit mode toggle: show/hide checkboxes and toolbar controls
    if(toggleBtn && posterGridEl && posterToolbar){
        toggleBtn.addEventListener('click', () => {
            const entering = !posterGridEl.classList.contains('edit-mode');
            if(entering){
                posterGridEl.classList.add('edit-mode');
                posterToolbar.classList.add('editing');
                toggleBtn.textContent = 'Done';
                // disable delete until selection
                deleteBtn.disabled = true;
                selectAll.checked = false;
                const applyBtnLocal = document.getElementById('apply-bulk-btn');
                if(applyBtnLocal) applyBtnLocal.disabled = true;
                const collAddBtn = document.getElementById('bulk-add-collection-btn');
                if(collAddBtn) collAddBtn.disabled = true;
            } else {
                posterGridEl.classList.remove('edit-mode');
                posterToolbar.classList.remove('editing');
                toggleBtn.textContent = 'Edit';
                // clear selection when leaving edit mode
                selectAll.checked = false;
                document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = false);
                deleteBtn.disabled = true;
                const applyBtnLocal = document.getElementById('apply-bulk-btn');
                if(applyBtnLocal) applyBtnLocal.disabled = true;
                const collAddBtn = document.getElementById('bulk-add-collection-btn');
                if(collAddBtn) collAddBtn.disabled = true;
            }
        });
    }

    // delegate checkbox changes
    document.addEventListener('change', (e) => {
        if(e.target && e.target.classList && e.target.classList.contains('select-checkbox')){
            updateDeleteState();
            const all = document.querySelectorAll('.select-checkbox');
            if(all.length && Array.from(all).every(c => c.checked)) selectAll.checked = true;
            if(!e.target.checked) selectAll.checked = false;
        }
    });

    deleteBtn.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.select-checkbox:checked')).map(cb => cb.dataset.rowid).filter(Boolean);
        if(!selected.length) return;
        if(!confirm(`Delete ${selected.length} selected movies? This cannot be undone.`)) return;
        try{
            const res = await fetch('/delete_bulk', {
                method: 'POST',
                headers: {'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest'},
                body: JSON.stringify({rowids: selected})
            });
            if(res.ok){
                const j = await res.json();
                showToast('Deleted', `${j.deleted || selected.length} movie(s) removed` , '');
                await loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
                // reset select-all and disable button
                selectAll.checked = false; updateDeleteState();
            } else {
                showToast('Delete failed', 'Server error', '');
            }
        }catch(err){
            console.error('bulk delete error', err);
            showToast('Delete failed', 'Network error', '');
        }
    });

    // Bulk apply (status/format/version)
    const applyBtn = document.getElementById('apply-bulk-btn');
    if(applyBtn){
        applyBtn.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.select-checkbox:checked')).map(cb => cb.dataset.rowid).filter(Boolean);
            if(!selected.length){ showToast('No selection', 'Select movies first', ''); return; }
            // collect fields
            const status = document.getElementById('bulk-status-select')?.value || '';
            const format = document.getElementById('bulk-format-select')?.value || '';
            const version = document.getElementById('bulk-version-input')?.value.trim() || '';
            const fields = {};
            if(status) fields.status = status;
            if(format) fields.format = format;
            if(version) fields.version = version;
            if(Object.keys(fields).length === 0){ showToast('No changes', 'Choose a field to apply', ''); return; }
            if(!confirm(`Apply changes to ${selected.length} movie(s)?`)) return;
            // build human-readable summary for toast
            const changes = [];
            if(fields.status) changes.push(`Status → ${fields.status}`);
            if(fields.format) changes.push(`Format → ${fields.format}`);
            if(fields.version) changes.push(`Version → ${fields.version}`);
            const summary = changes.join('; ');
            try{
                const res = await fetch('/update_bulk', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest'},
                    body: JSON.stringify({rowids: selected, fields})
                });
                if(res.ok){
                    const j = await res.json();
                    showToast('Updated', `${j.updated || selected.length} movie(s) updated — ${summary}`, '');
                    await loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
                    // keep edit-mode but clear selections
                    document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = false);
                    if(document.getElementById('select-all-checkbox')) document.getElementById('select-all-checkbox').checked = false;
                    applyBtn.disabled = true;
                } else {
                    showToast('Update failed', 'Server error', '');
                }
            }catch(err){
                console.error('bulk update error', err);
                showToast('Update failed', 'Network error', '');
            }
        });
    }

    // Bulk add to collection
    const bulkAddBtn = document.getElementById('bulk-add-collection-btn');
    if(bulkAddBtn){
        bulkAddBtn.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.select-checkbox:checked')).map(cb => cb.dataset.rowid).filter(Boolean);
            if(!selected.length){ showToast('No selection', 'Select movies first', ''); return; }
            const collInput = document.getElementById('bulk-collection-input')?.value || '';
            if(!collInput.trim()){ showToast('No collection', 'Enter a collection name', ''); return; }
            const collNames = collInput.split(',').map(s=>s.trim()).filter(Boolean);
            if(collNames.length===0){ showToast('No collection', 'Enter a collection name', ''); return; }
            if(!confirm(`Add ${selected.length} movie(s) to collection(s): ${collNames.join(', ')} ?`)) return;
            try{
                const res = await fetch('/add_bulk_collections', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest'},
                    body: JSON.stringify({rowids: selected, collections: collNames})
                });
                if(res.ok){
                    const j = await res.json();
                    showToast('Collections updated', `${j.added || 0} associations added — ${collNames.join(', ')}`,'');
                    await loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
                    await loadCollections();
                    // clear selection and input
                    document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = false);
                    if(document.getElementById('select-all-checkbox')) document.getElementById('select-all-checkbox').checked = false;
                    bulkAddBtn.disabled = true;
                    document.getElementById('bulk-collection-input').value = '';
                } else {
                    showToast('Add failed', 'Server error', '');
                }
            }catch(err){
                console.error('bulk add collections error', err);
                showToast('Add failed', 'Network error', '');
            }
        });
    }
}

