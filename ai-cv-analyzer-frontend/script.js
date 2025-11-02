document.addEventListener("DOMContentLoaded", () => {
    // === Get DOM Elements ===
    const cvForm = document.getElementById("cv-form");
    const cvFileInput = document.getElementById("cv-file");
    const fileNameDisplay = document.getElementById("file-name");
    const analyzeBtn = document.getElementById("analyze-btn");
    const loader = document.getElementById("loader");
    const errorMessage = document.getElementById("error-message");
    const resultsContainer = document.getElementById("results-container");

    // BARU: Ambil elemen select
    const jobTitleSelect = document.getElementById("job-title");

    // Result display elements
    const scoreValue = document.getElementById("score-value");
    const scoreCircle = document.querySelector(".score-circle");
    const matchedSkillsList = document.getElementById("matched-skills-list");
    const missingSkillsList = document.getElementById("missing-skills-list");
    const suggestionsText = document.getElementById("suggestions-text");

    // Backend API URL
    const API_URL = "http://localhost:3000/api/analyze-cv";

    // === Event Listeners ===
    cvFileInput.addEventListener("change", () => {
        fileNameDisplay.textContent = cvFileInput.files.length > 0 ? cvFileInput.files[0].name : "";
    });

    cvForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const file = cvFileInput.files[0];
        // MODIFIKASI: Ambil juga nilai dari job title
        const jobTitle = jobTitleSelect.value;

        if (!jobTitle) {
            showError("Silakan pilih posisi pekerjaan terlebih dahulu.");
            return;
        }
        if (!file) {
            showError("Silakan pilih file CV terlebih dahulu.");
            return;
        }

        const formData = new FormData();
        // MODIFIKASI: Tambahkan kedua data ke FormData
        formData.append("CV", file);
        formData.append("jobTitle", jobTitle); // Kunci 'jobTitle' harus sesuai dengan backend

        setLoadingState(true);

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error("Analysis failed:", error);
            showError(`Gagal menganalisis CV. ${error.message}`);
        } finally {
            setLoadingState(false);
        }
    });
    
    function setLoadingState(isLoading) {
        if (isLoading) {
            loader.classList.remove("hidden");
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = "Menganalisis...";
            resultsContainer.classList.add("hidden");
            errorMessage.classList.add("hidden");
        } else {
            loader.classList.add("hidden");
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = "Analisis CV Saya";
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove("hidden");
        resultsContainer.classList.add("hidden");
    }

    function displayResults(data) {
        scoreValue.textContent = `${data.score}%`;
        scoreCircle.style.setProperty('--p', data.score);
        scoreCircle.setAttribute('aria-valuenow', data.score);

        let scoreColor = '#dc3545';
        if (data.score >= 75) scoreColor = '#28a745';
        else if (data.score >= 50) scoreColor = '#ffc107';
        scoreCircle.style.setProperty('--c', scoreColor);

        updateSkillList(matchedSkillsList, data.matchedSkills, "Semua skill yang dibutuhkan cocok!");
        updateSkillList(missingSkillsList, data.missingSkills, "Tidak ada skill yang kurang.");

        suggestionsText.textContent = data.suggestions;

        resultsContainer.classList.remove("hidden");
    }

    function updateSkillList(listElement, skills, emptyMessage) {
        listElement.innerHTML = "";
        if (skills.length > 0) {
            skills.forEach(skill => {
                const li = document.createElement("li");
                li.textContent = skill;
                listElement.appendChild(li);
            });
        } else {
            const li = document.createElement("li");
            li.textContent = emptyMessage;
            li.style.backgroundColor = 'transparent';
            listElement.appendChild(li);
        }
    }
});

// === Interaksi Modal Panduan Pengguna ===
const btnPanduan = document.getElementById("btn-panduan");
const modalPanduan = document.getElementById("modal-panduan");
const closeBtn = document.querySelector(".close");

btnPanduan.addEventListener("click", () => {
    modalPanduan.classList.remove("hidden");
});

closeBtn.addEventListener("click", () => {
    modalPanduan.classList.add("hidden");
});

window.addEventListener("click", (event) => {
    if (event.target === modalPanduan) {
        modalPanduan.classList.add("hidden");
    }
});
