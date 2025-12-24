// edit_modal.js
import { DOM, state, showToast } from './main.js';
import { loadMovies } from './movies.js';

let _originalData = null;

export function initEditModal() {
    // --- Close modal ---
    DOM.editModal.querySelector(".edit-close").addEventListener("click", () => {
        DOM.editModal.classList.add("hidden");
    });

    DOM.editModal.addEventListener("click", e => {
        if (e.target === DOM.editModal) DOM.editModal.classList.add("hidden");
    });

    // --- Open modal on edit button click (delegation) ---
    DOM.posterGrid.addEventListener("click", e => {
        const btn = e.target.closest(".edit-btn");
        if (!btn) return;
        // populate form and capture original values for change detection
        DOM.editModal.querySelector("#edit-rowid").value = btn.dataset.rowid;
        DOM.editModal.querySelector("#edit-title").value = btn.dataset.title;
        DOM.editModal.querySelector("#edit-year").value = btn.dataset.year;
        DOM.editModal.querySelector("#edit-format").value = btn.dataset.format;
        DOM.editModal.querySelector("#edit-status").value = btn.dataset.status;
        DOM.editModal.querySelector("#edit-version").value = btn.dataset.version;
        DOM.editModal.querySelector("#edit-country").value = btn.dataset.country;
        DOM.editModal.querySelector("#edit-language").value = btn.dataset.language;
        DOM.editModal.querySelector("#edit-region").value = btn.dataset.region;
        DOM.editModal.querySelector("#edit-disc-count").value = btn.dataset.disc_count;
        DOM.editModal.querySelector("#edit-notes").value = btn.dataset.notes;
        DOM.editModal.querySelector("#edit-tmdb-id").value = btn.dataset.tmdbId || '';

        _originalData = {
            rowid: btn.dataset.rowid,
            title: btn.dataset.title || '',
            year: btn.dataset.year || '',
            format: btn.dataset.format || '',
            status: btn.dataset.status || '',
            version: btn.dataset.version || '',
            country: btn.dataset.country || '',
            language: btn.dataset.language || '',
            region: btn.dataset.region || '',
            disc_count: btn.dataset.disc_count || '',
            notes: btn.dataset.notes || '',
            poster: btn.dataset.poster || '',
            tmdb_id: btn.dataset.tmdbId || ''
        };

        DOM.editModal.classList.remove("hidden");

        // fetch current collections for this movie and populate comma-separated input
        (async ()=>{
            try{
                const res = await fetch(`/api/movie_collections/${btn.dataset.rowid}`);
                if(res.ok){
                    const names = await res.json();
                    const el = DOM.editModal.querySelector('#edit-collections');
                    if(el) el.value = names.join(', ');
                }
            }catch(e){/*ignore*/}
        })();
    });

    // --- Save changes ---
    DOM.editModal.querySelector("#edit-form").addEventListener("submit", async e => {
        e.preventDefault();
        const rowid = DOM.editModal.querySelector("#edit-rowid").value;
        const payload = {
            title: DOM.editModal.querySelector("#edit-title").value.trim(),
            year: DOM.editModal.querySelector("#edit-year").value.trim(),
            format: DOM.editModal.querySelector("#edit-format").value,
            status: DOM.editModal.querySelector("#edit-status").value,
            version: DOM.editModal.querySelector("#edit-version").value,
            country: DOM.editModal.querySelector("#edit-country").value.trim(),
            language: DOM.editModal.querySelector("#edit-language").value.trim(),
            region: DOM.editModal.querySelector("#edit-region").value.trim(),
            disc_count: DOM.editModal.querySelector("#edit-disc-count").value,
                notes: DOM.editModal.querySelector("#edit-notes").value.trim(),
                tmdb_id: DOM.editModal.querySelector("#edit-tmdb-id").value || null
        };
            // include collections (comma-separated) if present
            const collInput = DOM.editModal.querySelector('#edit-collections')?.value || '';
            if(collInput !== null){
                const collList = collInput.split(',').map(s => s.trim()).filter(Boolean);
                payload.collections = collList;
            }

        try {
            const res = await fetch(`/edit/${rowid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                DOM.editModal.classList.add("hidden");
                // determine changed fields for subtitle
                let changed = [];
                if(_originalData){
                    for(const k of Object.keys(payload)){
                        const a = String(payload[k]||'');
                        const b = String(_originalData[k]||'');
                        if(a !== b) changed.push(k);
                    }
                }
                const subtitle = changed.length ? `Edited: ${changed.join(', ')}` : 'Edited';
                showToast(payload.title || _originalData?.title || 'Movie', subtitle, _originalData?.poster || '');
                loadMovies(state.currentPage, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
            } else {
                alert("Failed to save changes.");
            }
        } catch (err) {
            console.error(err);
            alert("Error saving changes.");
        }
    });

    // --- Delete movie ---
    DOM.deleteBtn.addEventListener("click", async () => {
        const rowid = DOM.editModal.querySelector("#edit-rowid").value;
        if (!confirm("Are you sure you want to delete this movie?")) return;

        try {
            const res = await fetch(`/delete/${rowid}`, { method: "POST" });
            if (res.ok) {
                DOM.editModal.classList.add("hidden");
                // toast removal
                const title = _originalData?.title || 'Movie';
                showToast(title, 'Removed', _originalData?.poster || '');
                loadMovies(state.currentPage, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
            } else {
                alert("Failed to delete movie.");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting movie.");
        }
    });
}
 