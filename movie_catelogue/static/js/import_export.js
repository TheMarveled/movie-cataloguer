// import_export.js
export function initImportExport() {
    const csvInput = document.getElementById("csv_file");
    if(csvInput){
        csvInput.addEventListener("change", () => {
            if(csvInput.files.length > 0){
                csvInput.closest("form").submit();
            }
        });
    }
}
 