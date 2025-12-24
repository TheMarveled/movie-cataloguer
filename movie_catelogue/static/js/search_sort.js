// search_sort.js
import { state, DOM } from './main.js';
import { loadMovies } from './movies.js';
import { debounce } from "./helpers.js";

export function initSearchSort() {
    // Search input
    DOM.searchInput.addEventListener("input", debounce(e => {
        state.currentLetter = "";
        localStorage.setItem("movieLetter", "");
        // persist search query
        localStorage.setItem('movieSearch', e.target.value);
        state.currentQuery = e.target.value;
        loadMovies(1, e.target.value, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
    }));

    // Sort options (dropdown)
    if (DOM.sortOptions) {
        DOM.sortOptions.forEach(btn => btn.addEventListener("click", () => {
            const s = btn.dataset.sort;
            if (!s) return;
            state.currentSort = s;
            localStorage.setItem("movieSort", state.currentSort);
            if (DOM.sortDropdown) DOM.sortDropdown.classList.add("hidden");
            loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        }));
    }

    // Status/Format filters (dropdown)
    if (DOM.filterStatusInputs) {
        DOM.filterStatusInputs.forEach(inp => inp.addEventListener("change", () => {
            // build status - send first checked status if only one, otherwise empty to mean both
            const checked = Array.from(DOM.filterStatusInputs).filter(i => i.checked).map(i => i.value);
            state.currentStatus = checked.length === 1 ? checked[0] : "";
            localStorage.setItem("movieStatus", state.currentStatus);
            loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        }));
    }

    if (DOM.filterFormatInputs) {
        DOM.filterFormatInputs.forEach(inp => inp.addEventListener("change", () => {
            const formats = Array.from(DOM.filterFormatInputs).filter(i => i.checked).map(i => i.value);
            state.currentFormats = formats;
            localStorage.setItem("movieFormats", JSON.stringify(state.currentFormats));
            loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        }));

        const clearBtn = document.getElementById("filter-clear");
        if (clearBtn) clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            DOM.filterFormatInputs.forEach(i => i.checked = false);
            DOM.filterStatusInputs.forEach(i => i.checked = false);
            state.currentFormats = [];
            state.currentStatus = "";
            localStorage.removeItem("movieFormats");
            localStorage.removeItem("movieStatus");
            loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        });
    }

    // Alphabet buttons
    DOM.alphaButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            state.currentLetter = btn.dataset.letter;
            localStorage.setItem("movieLetter", state.currentLetter);
            loadMovies(1, state.currentQuery, state.currentSort, state.currentLetter, state.currentStatus, state.currentFormats);
        });
    });

    // Skin/theme selector
    DOM.skinSelect.addEventListener("change", () => {
        const theme = DOM.skinSelect.value;
        localStorage.setItem("movieSkin", theme);
        if(theme === "dark") DOM.themeLink.href = "/static/css/dark.css";
        else if(theme === "light") DOM.themeLink.href = "/static/css/light.css";
        else if(theme === "classic") DOM.themeLink.href = "/static/css/classic.css";
        // add theme class to body for CSS specificity
        document.body.classList.remove("theme-dark", "theme-light", "theme-classic");
        if (theme === "dark") document.body.classList.add("theme-dark");
        else if (theme === "light") document.body.classList.add("theme-light");
        else if (theme === "classic") document.body.classList.add("theme-classic");
    });
}
