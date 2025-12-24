// identify_modal.js
import { DOM } from './main.js';

export function initIdentifyModal() {
    DOM.identifyBtn.addEventListener("click", async () => {
        const title = document.getElementById("edit-title").value.trim();
        const year = document.getElementById("edit-year").value.trim();
        if (!title) return alert("Enter a title to identify.");

        DOM.identifyTitleDisplay.textContent = title;
        DOM.identifyResults.innerHTML = "<li>Loading...</li>";
        DOM.identifyModal.classList.remove("hidden");

        try {
            const params = new URLSearchParams({ title, year });
            const res = await fetch(`/tmdb_suggestions?${params.toString()}`);
            const data = await res.json();

            if (data.length === 0) {
                DOM.identifyResults.innerHTML = "<li>No results found.</li>";
                return;
            }

            DOM.identifyResults.innerHTML = "";
            data.forEach(movie => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${movie.title}</strong> (${movie.release_date?.slice(0,4)||"N/A"}) <button class="apply-movie">Apply</button>`;
                li.querySelector(".apply-movie").addEventListener("click", () => {
                    document.getElementById("edit-title").value = movie.title;
                    document.getElementById("edit-year").value = movie.release_date?.slice(0,4)||"";
                    // set tmdb id so saving can persist a direct link
                    const editTmdb = document.getElementById("edit-tmdb-id");
                    if (editTmdb) editTmdb.value = movie.id || '';
                    DOM.identifyModal.classList.add("hidden");
                });
                DOM.identifyResults.appendChild(li);
            });
        } catch(err) {
            console.error(err);
            DOM.identifyResults.innerHTML = "<li>Error fetching TMDb data.</li>";
        }
    });

    // Close identify modal
    DOM.identifyModal.querySelector(".identify-close").addEventListener("click", () => DOM.identifyModal.classList.add("hidden"));
    DOM.identifyModal.addEventListener("click", (e) => { if (e.target === DOM.identifyModal) DOM.identifyModal.classList.add("hidden"); });
}
 