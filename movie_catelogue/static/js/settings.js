// settings.js
import { DOM } from './main.js';

export function initSettings() {
    // Dropdown toggle
    if(DOM.settingsBtn && DOM.settingsDropdown){
        DOM.settingsBtn.addEventListener("click", e => {
            e.stopPropagation();
            DOM.settingsDropdown.classList.toggle("hidden");
        });

        // Prevent clicks inside the dropdown from closing it (e.g., interacting with selects)
        DOM.settingsDropdown.addEventListener('click', (e) => { e.stopPropagation(); });

        document.addEventListener("click", () => {
            DOM.settingsDropdown.classList.add("hidden");
        });
    }

    // Toggle poster titles
    if(DOM.toggleTitlesCheckbox){
        DOM.toggleTitlesCheckbox.addEventListener("change", () => {
            localStorage.setItem("showPosterTitles", DOM.toggleTitlesCheckbox.checked);
            document.body.classList.toggle("show-poster-titles", DOM.toggleTitlesCheckbox.checked);
        });
    }

    // Toggle version badges
    if(DOM.toggleVersionBadges){
        DOM.toggleVersionBadges.addEventListener('change', () => {
            localStorage.setItem('showVersionBadge', DOM.toggleVersionBadges.checked);
            document.body.classList.toggle('hide-version-badges', !DOM.toggleVersionBadges.checked);
        });
    }

    // Toggle format badges
    if(DOM.toggleFormatBadges){
        DOM.toggleFormatBadges.addEventListener('change', () => {
            localStorage.setItem('showFormatBadge', DOM.toggleFormatBadges.checked);
            document.body.classList.toggle('hide-format-badges', !DOM.toggleFormatBadges.checked);
        });
    }

    // Toggle hide edit buttons until hover
    if(DOM.toggleHideEditUntilHover){
        DOM.toggleHideEditUntilHover.addEventListener('change', () => {
            localStorage.setItem('hideEditUnlessHover', DOM.toggleHideEditUntilHover.checked);
            document.body.classList.toggle('hide-edit-unless-hover', DOM.toggleHideEditUntilHover.checked);
        });
    }

}
 