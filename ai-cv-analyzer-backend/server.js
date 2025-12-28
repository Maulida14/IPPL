const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const pdfparse = require("pdf-parse");
const docx = require("docx-parser");
const { HfInference } = require("@huggingface/inference");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf" || 
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            cb(null, true);
        } else {
            cb(new Error("Format file tidak didukung! Hanya PDF dan DOCX."), false);
        }
    }
});
const PORT = process.env.PORT || 3000;

// API Keys & Config
const Hf = new HfInference(process.env.HF_API_KEY);
const jobRequirement = require("./jobRequirement.json");


// STEP 1: PARSING CV 
async function parseCV(filepath, mimetype) {
     try {
        const FormData = require("form-data");
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filepath));

        const response = await axios.post("https://api.affinda.com/v1/resumes", formData, {
        headers: {
        Authorization: `Bearer ${process.env.AFFINDA_API_KEY}`,
        ...formData.getHeaders(),
    }
});

    if (response.data) return response.data;
    } catch (err) {
    console.warn("Affinda gagal, fallback ke parser lokal...");
    }

    if (mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(filepath);
        const parsed = await pdfparse(dataBuffer);
        return { text: parsed.text };
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return new Promise((resolve) => {
            docx.parseDocx(filepath, (data) => resolve({ text: data }));
        });
    } else {
        throw new Error("Format file tidak didukung");
    }
}

// STEP 2: JOB MATCHING 
async function jobMatching(cvSkills, jobSkills) {
    try {
        const text1 = cvSkills.join(", ");
        const text2 = jobSkills.join(", ");
        const embedding1 = await Hf.featureExtraction({ model: "sentence-transformers/all-miniLM-L6-v2", inputs: text1 });
        const embedding2 = await Hf.featureExtraction({ model: "sentence-transformers/all-miniLM-L6-v2", inputs: text2 });

        function cosine(a, b) {
            const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
            const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
            const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
            return dot / (normA * normB);
        }
        return Math.round(cosine(embedding1[0], embedding2[0]) * 100);
    } catch {
        console.warn("Hugging Face gagal, fallback rule-based...");
        const matched = cvSkills.filter((s) => jobSkills.includes(s));
        return Math.round((matched.length / jobSkills.length) * 100);
    }
}

// STEP 3 - Menganalisis Format CV dengan Gemini
async function analyzeCVFormat(parsedCV) {
    const cvText = parsedCV.data?.text || parsedCV.text || "";
    if (!cvText) {
        return { style: "Tidak Diketahui", reason: "Tidak ada teks yang dapat dianalisis." };
    }

    try {
        const prompt = `Analisis teks CV berikut dan klasifikasikan formatnya ke dalam salah satu kategori ini: Amerika, Eropa, atau Jepang. Berikan jawaban HANYA dalam format JSON string: {"style": "...", "reason": "..."}.
        - Gaya Amerika: Biasanya 1 halaman, fokus pada pencapaian, tidak mencantumkan foto, usia, atau status pernikahan.
        - Gaya Eropa (Europass): Bisa lebih dari 1 halaman, seringkali menyertakan foto, tanggal lahir, dan kebangsaan.
        - Gaya Jepang (Rirekisho): Sangat formal, template standar, wajib menyertakan foto dan data personal lengkap.

        Teks CV: """${cvText.substring(0, 3000)}"""
        `;

        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();
        // Membersihkan dan mem-parsing JSON dari output model
        const jsonString = responseText.replace(/```json|```/g, "").trim();
        const parsedJson = JSON.parse(jsonString);
        return parsedJson;

    } catch (err) {
        console.warn("Gemini gagal untuk analisis format, fallback rule-based...", err);
        const textLower = cvText.toLowerCase();
        if (textLower.includes("履歴書") || textLower.includes("rirekisho")) {
             return { style: "Jepang", reason: "Fallback: Terdeteksi kata kunci 'Rirekisho'." };
        }
        if (textLower.includes("date of birth") || textLower.includes("nationality") || textLower.includes("marital status")) {
             return { style: "Eropa", reason: "Fallback: Terdeteksi informasi personal (tanggal lahir/kebangsaan)." };
        }
        return { style: "Amerika", reason: "Fallback: Tidak terdeteksi informasi personal sensitif." };
    }
}

//STEP 4 - Memberikan Saran dengan Gemini
async function getSuggestions(cvSkills, jobSkills, jobTitle, formatAnalysis) {
    try {
        const prompt = `Analisis CV untuk posisi "${jobTitle}".
        - Skills kandidat: ${cvSkills.join(", ")}.
        - Skills dibutuhkan: ${jobSkills.join(", ")}.
        - Format CV: gaya ${formatAnalysis.style}, karena ${formatAnalysis.reason}.

        Berikan saran perbaikan yang:
        - sangat singkat (maks 1-2 kalimat), langsung ke poin, dan actionable, tanpa penjelasan panjang lebar,
        - jika format cv tidak cocok dengan standar industri/negara, beri 1poin khudus tentang itu.

        Gunakan kalimat yang mudah dipahami dan jawab dalam Bahasa Indonesia.
        `;
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            return response.text();

    } catch (err) {
        console.warn("Gemini gagal untuk saran, fallback rule-based...", err);
        let missingSkills = jobSkills.filter((s) => !cvSkills.includes(s));
        let suggestions = [];
        if (missingSkills.length > 0) {
            suggestions.push(`- Tambahkan skill yang dibutuhkan: ${missingSkills.join(", ")}.`);
        } 
        if (cvSkills.length < 3) {
            suggestions.push("- Perbanyak lagi daftar skill yang relevan dengan pekerjaan.");
        } 
        suggestions.push("- Gunakan bullet point untuk menjelaskan pencapaian di setiap pengalaman kerja agar mudah dibaca.");
        return suggestions.join("\n");
    }
}

// Fungsi untuk memvalidasi apakah teks yang diekstrak adalah CV
async function validateIsCV(text) {
    try {
        const prompt = `Periksa teks berikut secara ketat. Apakah ini merupakan isi dari sebuah Curriculum Vitae (CV) atau Resume profesional? 
        Jawab HANYA dengan satu kata: "YA" (jika benar CV) atau "TIDAK" (jika bukan CV/file sembarang).
        
        Teks: """${text.substring(0, 1000)}"""`;

        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text().trim().toUpperCase();
        
        return responseText.includes("YA");
    } catch (err) {
        // Fallback sederhana jika AI gagal: cek kata kunci wajib CV
        const keywords = ["pendidikan", "pengalaman", "keahlian", "education", "experience", "skills", "riwayat"];
        return keywords.some(word => text.toLowerCase().includes(word));
    }
}
        
// STEP 5: API ENDPOINT 
app.post("/api/analyze-cv", (req, res) => {
    upload.single("CV")(req, res, async (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ 
                    error: "File terlalu besar! Maksimal ukuran file adalah 10MB." 
                });
            }
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: "Mohon unggah file CV Anda." });
        }

        const filePath = req.file.path; 

        try {
            const { jobTitle } = req.body;
            if (!jobTitle || !jobRequirement[jobTitle]) {
                return res.status(400).json({ error: "Posisi tidak dipilih atau tidak valid." });
            }

            const selectedJob = jobRequirement[jobTitle];
            const jobSkills = selectedJob.skills;

            const parsed = await parseCV(req.file.path, req.file.mimetype);
            const cvText = parsed.text || (parsed.data ? parsed.data.text : "");

            const isCV = await validateIsCV(cvText);
            if (!isCV) {
                return res.status(400).json({ 
                    error: "File yang Anda unggah tidak terdeteksi sebagai CV. Mohon unggah dokumen resume yang valid." 
                });
            }  

            let cvSkills = [];
            if (parsed.data && parsed.data.skills) {
                cvSkills = parsed.data.skills.map((s) => s.name);
            } else if (parsed.text) {
                const allPossibleSkills = [...new Set(Object.values(jobRequirement).flatMap(j => j.skills))];
                const cvTextLower = parsed.text.toLowerCase();
                cvSkills = allPossibleSkills.filter(skill => cvTextLower.includes(skill.toLowerCase()));
            }

            if (cvSkills.length === 0) {
                return res.status(400).json({ error: "Tidak ada skill yang terdeteksi di dalam CV. Mohon perbarui CV Anda." });
            }

            const formatAnalysis = await analyzeCVFormat(parsed);
            const score = await jobMatching(cvSkills, jobSkills);
            const suggestions = await getSuggestions(cvSkills, jobSkills, selectedJob.title, formatAnalysis);

            res.json({
                score,
                formatAnalysis,
                matchedSkills: cvSkills.filter((s) => jobSkills.includes(s)),
                missingSkills: jobSkills.filter((s) => !cvSkills.includes(s)),
                suggestions,
            });

        } catch (error) {
            console.error("Terjadi error pada proses analisis:", error);
            res.status(500).json({ error: "Terjadi kesalahan internal pada server." });
        } finally {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error("Gagal menghapus file sementara:", unlinkErr);
                });
            }
        }
    });
});

// STEP 6: SERVER STATUS
app.get("/", (req, res) => {
    res.send("Server CV Analyzer berjalan dengan Gemini, Hugging Face, dan Affinda!");
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server aktif di port ${PORT}`);
});