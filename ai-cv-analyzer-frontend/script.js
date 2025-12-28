document.addEventListener("DOMContentLoaded", () => {
    //  === Get DOM Elements ===
    const cvForm = document.getElementById("cv-form");
    const cvFileInput = document.getElementById("cv-file");
    const fileNameDisplay = document.getElementById("file-name");
    const analyzeBtn = document.getElementById("analyze-btn");
    const loader = document.getElementById("loader");
    const errorMessage = document.getElementById("error-message");
    const resultsContainer = document.getElementById("results-container");
    const cancelFileBtn = document.getElementById("cancel-file");
    const resetBtn = document.getElementById("reset-btn");
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const currentTheme = localStorage.getItem('theme');   
    const fileUploadWrapper = document.querySelector(".file-upload-wrapper");

    // Ambil elemen select
    const jobTitleSelect = document.getElementById("job-title");
    const positions = [
        "AI Engineer",
        "AR/VR Developer",
        "Backend Developer",
        "Blockchain Developer",
        "Business Analyst",
        "Business Intelligence Developer",
        "Cloud Engineer",
        "Cloud Security Engineer",
        "Computer Vision Engineer",
        "Cybersecurity Analyst",
        "Data Engineer",
        "Data Scientist",
        "Database Administrator (DBA)",
        "DevOps Engineer",
        "Digital Forensics Analyst",
        "Embedded Systems Engineer",
        "Firmware Engineer",
        "Frontend Developer",
        "Fullstack Developer",
        "Game Developer",
        "IT Consultant",
        "IT Manager",
        "IT Support Specialist",
        "Interaction Designer",
        "Machine Learning Engineer",
        "Mobile Developer",
        "Network Engineer",
        "NLP Engineer",
        "Penetration Tester (Ethical Hacker)",
        "Product Manager",
        "QA Engineer",
        "Quantum Engineer",
        "Robotics Engineer",
        "Scrum Master",
        "Security Architect",
        "Site Reliability Engineer (SRE)",
        "Software Engineer",
        "Solutions Architect",
        "System Administrator",
        "Technical Lead",
        "Technical Project Manager",
        "Technical Writer",
        "UI/UX Designer",
        "UX Researcher",
        "Data Analyst"
    ];
    positions.sort();

    jobTitleSelect.innerHTML = `<option value="">--Pilih Posisi--</option>` ;
    positions.forEach(position => {
        const option = document.createElement("option");
        option.value = position;
        option.textContent = position;
        jobTitleSelect.appendChild(option);
    });

    $(document).ready(function() {
        $('#job-title').select2({
            placeholder: "--Pilih Posisi--", allowClear: true 
        }); 
    });

    // Result display elements
    const scoreValue = document.getElementById("score-value");
    const scoreCircle = document.querySelector(".score-circle");
    const matchedSkillsList = document.getElementById("matched-skills-list");
    const missingSkillsList = document.getElementById("missing-skills-list");
    const suggestionsText = document.getElementById("suggestions-text");

    // Backend API URL
    const API_URL = "https://ippl-production.up.railway.app/api/analyze-cv";

    // Event Listeners
    cvFileInput.addEventListener("change", () => {  
    if (cvFileInput.files.length > 0) {  
        const file = cvFileInput.files[0];
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        if (fileExtension !== 'pdf' && fileExtension !== 'docx') {
            showError("Format file tidak didukung! Mohon unggah file dalam format PDF atau DOCX.");
            cvFileInput.value = "";
            fileNameDisplay.textContent = "";
            cancelFileBtn?.classList.add("hidden");
            return;
        }

        fileNameDisplay.textContent = fileName;  
        cancelFileBtn?.classList.remove("hidden"); 
        errorMessage.classList.add("hidden");
    } else {  
        fileNameDisplay.textContent = "";  
        cancelFileBtn?.classList.add("hidden");  
    }  
    });

    fileUploadWrapper.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileUploadWrapper.classList.add("dragover");
    });

    fileUploadWrapper.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileUploadWrapper.classList.remove("dragover");
    });

    fileUploadWrapper.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadWrapper.classList.remove("dragover");

    const droppedFiles = e.dataTransfer.files;

    if (droppedFiles.length > 0) {
        const file = droppedFiles[0];
        const fileExtension = file.name.split('.').pop().toLowerCase();

        // Validate dropped file extension
        if (fileExtension !== 'pdf' && fileExtension !== 'docx') {
            showError("Format file tidak didukung! Mohon unggah file dalam format PDF atau DOCX.");
            return;
        }

        cvFileInput.files = droppedFiles;
        const event = new Event('change');
        cvFileInput.dispatchEvent(event);
    }
    });     

    if (cancelFileBtn) {
        cancelFileBtn.addEventListener("click", () => {
            cvFileInput.value = "";
            fileNameDisplay.textContent = "";
            cancelFileBtn.classList.add("hidden");
        });
    }

    cvForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const file = cvFileInput.files[0];
        const jobTitle = $('#job-title').val();

        if (!jobTitle) {
            showError("Silakan pilih posisi pekerjaan terlebih dahulu.");
            return;
        }
        if (!file) {
            showError("Silakan pilih file CV terlebih dahulu.");
            return;
        }

        const formData = new FormData();
        formData.append("CV", file);
        formData.append("jobTitle", jobTitle);

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
    // Animasi skor
    let currentScore = 0;
    const targetScore = data.score;
    const duration = 1000;
    const startTime = performance.now();

    function animateScore(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        currentScore = Math.floor(progress * targetScore);
        scoreValue.textContent = `${currentScore}%`;
        scoreCircle.style.setProperty('--p', currentScore);
        if (progress < 1) {
            requestAnimationFrame(animateScore);
        }
    }
    requestAnimationFrame(animateScore);

    // Ubah warna lingkaran
    let scoreColor = '#dc3545';
    if (data.score >= 75) scoreColor = '#28a745';
    else if (data.score >= 50) scoreColor = '#ffc107';
    scoreCircle.style.setProperty('--c', scoreColor);

    updateSkillList(matchedSkillsList, data.matchedSkills, "Semua skill yang di butuhkan tidak ditemukan!");
    updateSkillList(missingSkillsList, data.missingSkills, "Tidak ada skill yang kurang.");

    // Format dan tampilkan saran perbaikan dengan tampilan list rapi
        const suggestionsContainer = document.querySelector(".suggestions-card");
        const suggestionsText = document.getElementById("suggestions-text");
        suggestionsText.innerHTML = ""; 

        // Pastikan kita punya teks saran
        const raw = (data.suggestions || "").toString();
        if (!raw.trim()) {
            suggestionsText.textContent = "Tidak ada saran khusus yang perlu diperbaiki.";
        } else {
            // Split berdasarkan baris, atau pisah jika ada tanda bullet/nomor
            let lines = raw.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
            if (lines.length === 1) {
                // kalau hanya satu baris, coba split berdasarkan tanda '-', '*' atau nomor
                lines = raw.split(/\s*-\s+|\*|\d+\./).map(s => s.trim()).filter(s => s.length > 0);
            }

            const ul = document.createElement("ul");
            ul.classList.add("suggestions-list");

            lines.forEach(point => {
            // Hapus semua karakter bullet 
                const cleaned = point
                .replace(/^[\s\*\uFF0A\u2217\-\u2022\u2013\u2014\d\.\)]+/, '') // hapus simbol bullet di awal
                .replace(/\*\*/g, '') // hapus bintang ganda markdown
                .replace(/\*/g, '')   // hapus bintang tunggal sisa
                .trim();

                const li = document.createElement("li");
                li.textContent = cleaned;
                li.classList.add("suggestion-item");
                ul.appendChild(li);
            });


            suggestionsText.appendChild(ul);
        }

    resultsContainer.classList.remove("hidden");

    // Tampilkan animasi fade-in
    document.querySelectorAll(".fade-in").forEach((el, i) => {
        setTimeout(() => el.classList.add("visible"), i * 250);
    });

    // Tampilkan tombol reset
    resetBtn.classList.remove("hidden");
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
    // Tombol Reset
    resetBtn.addEventListener("click", () => {
        // Reset form
        cvForm.reset();

        // Reset upload file
        fileNameDisplay.textContent = "";
        cvFileInput.value = "";
        cancelFileBtn.classList.add("hidden");

        // Reset select2
        $("#job-title").val(null).trigger("change");

        // Sembunyikan hasil & error
        resultsContainer.classList.add("hidden");
        errorMessage.classList.add("hidden");

        // Reset score
        scoreValue.textContent = "0%";
        scoreCircle.style.setProperty("--p", 0);

        // Kosongkan list skill & saran
        matchedSkillsList.innerHTML = "";
        missingSkillsList.innerHTML = "";
        suggestionsText.innerHTML = "";

        // Sembunyikan tombol reset kembali
        resetBtn.classList.add("hidden");

        console.log("Form berhasil direset lengkap.");
    });

// Interaksi Modal Panduan Pengguna
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
    // 1. Cek local storage saat load
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
        toggleSwitch.checked = true;
    }
}

// 2. Event Listener untuk Switch
function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}
toggleSwitch.addEventListener('change', switchTheme);
});