// main.js
import { debounce } from './helpers.js';
export const state = {
    currentPage: 1,
    currentQuery: "",
    currentSort: localStorage.getItem("movieSort") || "alpha",
    currentStatus: localStorage.getItem("movieStatus") || "owned",
    currentLetter: localStorage.getItem("movieLetter") || ""
};

// pageSize may be set from settings (null = server default)
state.pageSize = parseInt(localStorage.getItem('moviePageSize')) || null;

// currentFormats holds an array of selected format filters
state.currentFormats = JSON.parse(localStorage.getItem("movieFormats") || "[]");

// DOM elements
export const DOM = {
    posterGrid: document.querySelector(".poster-grid"),
    paginationDiv: document.querySelector(".pagination"),
    searchInput: document.getElementById("search"),
    sortAlphaBtn: document.getElementById("sort-alpha"),
    sortRecentBtn: document.getElementById("sort-recent"),
    alphaButtons: document.querySelectorAll(".alpha-btn"),
    ownedBtn: document.getElementById("filter-owned"),
    wantedBtn: document.getElementById("filter-wanted"),
    addForm: document.querySelector(".add-form"),
    addFormatSelect: document.querySelector(".add-form select[name='format']"),
    themeLink: document.getElementById("theme-css"),
    skinSelect: document.getElementById("skin-select"),
    sortBtn: document.getElementById("sort-btn"),
    sortDropdown: document.getElementById("sort-dropdown"),
    sortOptions: document.querySelectorAll(".sort-option"),
    toggleAdvancedBtn: document.getElementById("toggle-advanced"),
    advancedFieldsDiv: document.getElementById("advanced-fields"),
    filterBtn: document.getElementById("filter-btn"),
    filterDropdown: document.getElementById("filter-dropdown"),
    filterFormatInputs: document.querySelectorAll(".filter-format input[type='checkbox']"),
    filterStatusInputs: document.querySelectorAll(".filter-status input[type='checkbox']"),
    editModal: document.getElementById("edit-modal"),
    identifyModal: document.getElementById("identify-modal"),
    identifyTitleDisplay: document.getElementById("identify-title-display"),
    identifyResults: document.getElementById("identify-results"),
    deleteBtn: document.getElementById("delete-btn"),
    identifyBtn: document.getElementById("identify-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsDropdown: document.getElementById("settings-dropdown"),
    toggleTitlesCheckbox: document.getElementById("toggle-titles"),
    toggleVersionBadges: document.getElementById("toggle-version-badges"),
    toggleFormatBadges: document.getElementById("toggle-format-badges"),
    posterSizeSlider: document.getElementById("poster-size")
    ,
    // new settings checkbox (hide edit buttons unless hover)
    toggleHideEditUntilHover: document.getElementById("toggle-hide-edit-until-hover"),
    pageSizeSelect: document.getElementById('page-size-select'),
    toastContainer: document.getElementById("toast-container")
};

// Helper functions (shared debounce imported from helpers.js)

// Simple HTML-escape helper
function _escapeHtml(s){
    return String(s||"").replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Toast notification: title, subtitle, posterUrl
export function showToast(title, subtitle = "", poster = "", duration = 4000){
    const container = DOM.toastContainer;
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-img">${poster?`<img src="${_escapeHtml(poster)}" alt="poster">`:`<div class="toast-placeholder"></div>`}</div>
        <div class="toast-body"><div class="toast-title">${_escapeHtml(title)}</div><div class="toast-sub">${_escapeHtml(subtitle)}</div></div>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;
    container.appendChild(toast);
    // entrance
    requestAnimationFrame(()=> toast.classList.add('show'));

    const remove = ()=>{ toast.classList.remove('show'); setTimeout(()=>{ try{ toast.remove(); }catch{} }, 220); };
    toast.querySelector('.toast-close').addEventListener('click', (e)=>{ e.stopPropagation(); remove(); });
    toast.addEventListener('click', remove);
    setTimeout(remove, duration);
}

// Initialize page
export function initPage() {
    // Restore saved format
    const savedFormat = localStorage.getItem("movieFormat");
    if(savedFormat) DOM.addFormatSelect.value = savedFormat;

    // Restore saved skin
    const savedSkin = localStorage.getItem("movieSkin");
    if(savedSkin) DOM.skinSelect.value = savedSkin;
    // Apply theme class to body so theme CSS can be specific
    const applyThemeClass = (name) => {
        document.body.classList.remove("theme-dark", "theme-light", "theme-classic");
        if(name === "dark") document.body.classList.add("theme-dark");
        else if(name === "light") document.body.classList.add("theme-light");
        else if(name === "classic") document.body.classList.add("theme-classic");
    };
    applyThemeClass(savedSkin);
    // Ensure the theme stylesheet is set immediately to avoid FOUC
    if (savedSkin && DOM.themeLink) {
        if (savedSkin === 'dark') DOM.themeLink.href = '/static/css/dark.css';
        else if (savedSkin === 'light') DOM.themeLink.href = '/static/css/light.css';
        else if (savedSkin === 'classic') DOM.themeLink.href = '/static/css/classic.css';
    }
    if (DOM.skinSelect) DOM.skinSelect.dispatchEvent(new Event("change"));

    // Restore poster title setting
    const showPosterTitles = localStorage.getItem("showPosterTitles") === "true";
    if (DOM.toggleTitlesCheckbox) {
        DOM.toggleTitlesCheckbox.checked = showPosterTitles;
        document.body.classList.toggle("show-poster-titles", showPosterTitles);
    }

    // Restore version/format badge visibility (default: shown)
    const showVersion = localStorage.getItem('showVersionBadge');
    const showFormat = localStorage.getItem('showFormatBadge');
    const versionVisible = showVersion === null ? true : (showVersion === 'true');
    const formatVisible = showFormat === null ? true : (showFormat === 'true');
    if (DOM.toggleVersionBadges) {
        DOM.toggleVersionBadges.checked = versionVisible;
        document.body.classList.toggle('hide-version-badges', !versionVisible);
    }
    if (DOM.toggleFormatBadges) {
        DOM.toggleFormatBadges.checked = formatVisible;
        document.body.classList.toggle('hide-format-badges', !formatVisible);
    }

    // Restore hide-edit-buttons-unless-hover setting (default: off)
    const hideEdit = localStorage.getItem('hideEditUnlessHover');
    const hideEditVisible = hideEdit === 'true';
    if (DOM.toggleHideEditUntilHover) {
        DOM.toggleHideEditUntilHover.checked = hideEditVisible;
        document.body.classList.toggle('hide-edit-unless-hover', hideEditVisible);
    }

    // Page size select (persisted) — null means use server default
    if (DOM.pageSizeSelect) {
        const saved = localStorage.getItem('moviePageSize');
        if (saved) {
            DOM.pageSizeSelect.value = saved;
            state.pageSize = parseInt(saved) || null;
        }
        DOM.pageSizeSelect.addEventListener('change', (e) => {
            const v = e.target.value;
            if (!v || v === '') {
                localStorage.removeItem('moviePageSize');
                state.pageSize = null;
            } else {
                const n = parseInt(v);
                if (!isNaN(n) && n > 0) {
                    localStorage.setItem('moviePageSize', String(n));
                    state.pageSize = n;
                }
            }
            // reload first page with new size
            try { import('./movies.js').then(m=>m.loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats)); } catch(e){}
        });
    }

    // Restore search query
    const savedSearch = localStorage.getItem('movieSearch') || '';
    if (DOM.searchInput && savedSearch) {
        DOM.searchInput.value = savedSearch;
        state.currentQuery = savedSearch;
    }

    // Restore poster size
    const savedPosterSize = localStorage.getItem("posterSize") || 180;
    document.documentElement.style.setProperty("--poster-width", `${savedPosterSize}px`);
    if(DOM.posterSizeSlider) DOM.posterSizeSlider.value = savedPosterSize;

    // Advanced options toggle
    if (DOM.toggleAdvancedBtn && DOM.advancedFieldsDiv) {
        const wasVisible = localStorage.getItem("advancedFieldsVisible") === "true";
        DOM.advancedFieldsDiv.style.display = wasVisible ? "flex" : "none";
        DOM.toggleAdvancedBtn.addEventListener("click", () => {
            const currentlyVisible = DOM.advancedFieldsDiv.style.display !== "none";
            DOM.advancedFieldsDiv.style.display = currentlyVisible ? "none" : "flex";
            localStorage.setItem("advancedFieldsVisible", (!currentlyVisible).toString());
        });
    }

    // Restore add-form inputs
    if (DOM.addForm) {
        try {
            const saved = JSON.parse(localStorage.getItem('movieAddForm') || '{}');
            for (const [k, v] of Object.entries(saved)) {
                const el = DOM.addForm.querySelector(`[name="${k}"]`);
                if (!el) continue;
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v;
                else el.value = v;
            }
        } catch (e) { /* ignore parse errors */ }

        // Save add-form changes to localStorage
        const saveAddForm = () => {
            const data = {};
            Array.from(DOM.addForm.elements).forEach(el => {
                if (!el.name) return;
                if (el.type === 'button' || el.type === 'submit') return;
                if (el.type === 'checkbox' || el.type === 'radio') data[el.name] = el.checked;
                else data[el.name] = el.value;
            });
            localStorage.setItem('movieAddForm', JSON.stringify(data));
        };
        DOM.addForm.addEventListener('input', saveAddForm);
        DOM.addForm.addEventListener('change', saveAddForm);
    }

    // Restore filters state (formats + status)
    if (DOM.filterFormatInputs) {
        const saved = state.currentFormats || [];
        DOM.filterFormatInputs.forEach(i => { i.checked = saved.includes(i.value); });
    }
    if (DOM.filterStatusInputs) {
        const savedStatus = localStorage.getItem("movieStatus");
        if (savedStatus) {
            DOM.filterStatusInputs.forEach(i => { i.checked = (i.value === savedStatus); });
        } else {
            // default: both checked
            DOM.filterStatusInputs.forEach(i => { i.checked = true; });
        }
    }

    // Sort & Filter dropdown toggles
    if (DOM.sortBtn && DOM.sortDropdown) {
        DOM.sortBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            DOM.sortDropdown.classList.toggle("hidden");
            if(DOM.filterDropdown) DOM.filterDropdown.classList.add("hidden");
        });
        document.addEventListener("click", () => DOM.sortDropdown.classList.add("hidden"));
    }

    if (DOM.filterBtn && DOM.filterDropdown) {
        DOM.filterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            DOM.filterDropdown.classList.toggle("hidden");
            if(DOM.sortDropdown) DOM.sortDropdown.classList.add("hidden");
        });
        document.addEventListener("click", () => DOM.filterDropdown.classList.add("hidden"));
    }

    // Intercept add-form submission to show a toast and refresh dynamically
    if (DOM.addForm) {
        DOM.addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = DOM.addForm;
            const formData = new FormData(form);
            // try AJAX add; if server expects regular post and redirects, fall back
            try {
                const res = await fetch(form.action || '/add', {
                    method: form.method || 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (res.ok) {
                    // server returns JSON when X-Requested-With is set
                    let json = null;
                    try { json = await res.json(); console.debug('add response json:', json); } catch(e){}
                    const title = form.querySelector("input[name='title']")?.value || (json && json.title) || 'Movie';
                    const posterFromResponse = json?.poster_path || '';
                    if (posterFromResponse) {
                        // refresh list then show toast with known poster
                        try {
                            const mod = await import('./movies.js');
                            await mod.loadMovies(1, '', localStorage.getItem('movieSort') || 'alpha', '', localStorage.getItem('movieStatus') || '');
                        } catch(e){}
                        showToast(title, 'Added', posterFromResponse);
                    } else {
                        // fallback: refresh and try to find poster in DOM
                        try {
                            const mod = await import('./movies.js');
                            await mod.loadMovies(1, '', localStorage.getItem('movieSort') || 'alpha', '', localStorage.getItem('movieStatus') || '');
                            let posterUrl = '';
                            const cards = DOM.posterGrid.querySelectorAll('.poster-card');
                            for (const c of cards) {
                                const t = c.querySelector('.poster-title')?.textContent?.trim();
                                if (t && t === title) {
                                    posterUrl = c.querySelector('img')?.src || c.querySelector('.edit-btn')?.dataset.poster || '';
                                    break;
                                }
                            }
                            showToast(title, 'Added', posterUrl);
                        } catch (e) {
                            showToast(title, 'Added', '');
                        }
                    }
                        // clear form (keep minimal inputs intact)
                        form.reset();
                } else {
                    // fallback to standard submit
                    form.submit();
                }
            } catch (err) {
                console.error(err);
                form.submit();
            }
        });
    }
}

 