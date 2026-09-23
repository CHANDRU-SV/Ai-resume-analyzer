const MAX_FILE_SIZE = 5 * 1024 * 1024;
const resumeForm = document.getElementById("resume-form");
const resumeFileInput = document.getElementById("resume-file");
const uploadButton = document.getElementById("upload-button");
const uploadStatus = document.getElementById("upload-status");
const selectedFile = document.getElementById("selected-file");
const analysisCard = document.getElementById("analysis-card");
const uploadedResumeName = document.getElementById("uploaded-resume-name");
const analyzeButton = document.getElementById("analyze-button");
const analysisStatus = document.getElementById("analysis-status");
const analysisResults = document.getElementById("analysis-results");

let currentUser;
let currentResume;

document.addEventListener("DOMContentLoaded", initializeResumePage);
resumeFileInput.addEventListener("change", showSelectedFile);
resumeForm.addEventListener("submit", uploadResume);
analyzeButton.addEventListener("click", analyzeResume);

async function initializeResumePage() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.replace("login.html");
        return;
    }

    currentUser = user;
    await loadLatestResume();
}

function showSelectedFile() {
    const file = resumeFileInput.files[0];
    selectedFile.textContent = file
        ? `${file.name} (${formatFileSize(file.size)})`
        : "No file selected";
    setStatus("");
}

async function uploadResume(event) {
    event.preventDefault();

    const file = resumeFileInput.files[0];
    const validationError = validatePdf(file);

    if (validationError) {
        setStatus(validationError, true);
        return;
    }

    uploadButton.disabled = true;

    try {
        setStatus("Checking your account...");
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            window.location.replace("login.html");
            return;
        }

        currentUser = user;

        const filePath = createFilePath(user.id, file.name);

        setStatus("Uploading your resume...");
        const { error: uploadError } = await supabaseClient.storage
            .from("resumes")
            .upload(filePath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        setStatus("Saving your resume information...");
        const { data: savedResume, error: resumeError } = await supabaseClient
            .from("resumes")
            .insert({
                user_id: user.id,
                resume_name: file.name,
                resume_url: filePath
            })
            .select("id, user_id, resume_name, resume_url, resume_score, missing_skills, suggestions")
            .single();

        if (resumeError) {
            await supabaseClient.storage.from("resumes").remove([filePath]);
            throw new Error(`Could not save resume information: ${resumeError.message}`);
        }

        currentResume = savedResume;
        setStatus("Resume uploaded successfully. Taking you to your dashboard...");
        window.setTimeout(() => {
            window.location.replace("dashboard.html");
        }, 1000);
    } catch (error) {
        setStatus(error.message || "Unable to upload your resume. Please try again.", true);
        uploadButton.disabled = false;
    }
}

async function loadLatestResume() {
    const { data, error } = await supabaseClient
        .from("resumes")
        .select("id, user_id, resume_name, resume_url, resume_score, missing_skills, suggestions")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        setAnalysisStatus("Unable to load your uploaded resume. Please refresh and try again.", true);
        return;
    }

    if (data) {
        currentResume = data;
        showResumeForAnalysis(data);
        showSavedAnalysis(data);
    }
}

function showResumeForAnalysis(resume) {
    analysisCard.hidden = false;
    uploadedResumeName.textContent = `Uploaded resume: ${resume.resume_name}`;
}

async function analyzeResume() {
    if (!currentUser || !currentResume) {
        setAnalysisStatus("Please upload a resume before running analysis.", true);
        return;
    }

    analyzeButton.disabled = true;
    analysisResults.hidden = true;

    try {
        setAnalysisStatus("Downloading your private resume...");

        const { data: file, error: downloadError } = await supabaseClient.storage
            .from("resumes")
            .download(currentResume.resume_url);

        if (downloadError) {
            throw new Error(`Unable to read your resume: ${downloadError.message}`);
        }

        setAnalysisStatus("Reading your resume text...");

        const text = await extractPdfText(file);

        setAnalysisStatus("AI is analyzing your resume... \u{1F916}");

        const { data: analysis, error: aiError } =
            await supabaseClient.functions.invoke("analyze-resume", {
                body: {
                    resumeText: text
                }
            });

        if (aiError) {
            console.error("analyze-resume Edge Function error:", aiError);
            await logEdgeFunctionError(aiError);
            throw new Error("AI analysis is temporarily unavailable. Please try again.");
        }

        if (!analysis || analysis.error) {
            throw new Error("AI analysis is temporarily unavailable. Please try again.");
        }

        const formattedAnalysis = {
            score: normalizeScore(analysis.score),
            foundSkills: normalizeStringArray(analysis.skills_found),
            missingSkills: normalizeStringArray(analysis.missing_skills),
            suggestions: normalizeStringArray(analysis.suggestions)
        };

        setAnalysisStatus("Saving your AI analysis...");

        const { error: updateError } = await supabaseClient
            .from("resumes")
            .update({
                resume_score: formattedAnalysis.score,
                missing_skills: formattedAnalysis.missingSkills.join(", "),
                suggestions: formattedAnalysis.suggestions.join(" | ")
            })
            .eq("id", currentResume.id)
            .eq("user_id", currentUser.id);

        if (updateError) {
            throw new Error(
                `AI analysis completed but could not be saved: ${updateError.message}`
            );
        }

        currentResume.resume_score = formattedAnalysis.score;
        currentResume.missing_skills =
            formattedAnalysis.missingSkills.join(", ");
        currentResume.suggestions =
            formattedAnalysis.suggestions.join(" | ");

        renderAnalysis(formattedAnalysis);

        setAnalysisStatus(
            "AI analysis complete! Your resume has been analyzed successfully. \u{1F916}"
        );

    } catch (error) {
        console.error("Resume AI analysis error:", error);

        setAnalysisStatus(
            error.message || "Unable to analyze your resume. Please try again.",
            true
        );
    } finally {
        analyzeButton.disabled = false;
    }
}

async function logEdgeFunctionError(error) {
    if (error.context instanceof Response) {
        try {
            const responseBody = await error.context.clone().json();
            console.error("analyze-resume response status:", error.context.status, responseBody?.error || "Unknown error");
        } catch (responseError) {
            console.error("Could not read Edge Function error response:", responseError);
        }
    }
}

async function extractPdfText(file) {
    if (!window.pdfjsLib) {
        throw new Error("The PDF reader could not be loaded. Please refresh and try again.");
    }

    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
    }

    const text = pages.join(" ").trim();
    if (!text) {
        throw new Error("No readable text was found in this PDF. Please upload a text-based PDF resume.");
    }

    return text;
}

function renderAnalysis(analysis) {
    document.getElementById("analysis-score").textContent = `${analysis.score}/100`;
    document.getElementById("skills-found").textContent = analysis.foundSkills.length
        ? analysis.foundSkills.join(", ")
        : "No listed skills were detected.";
    document.getElementById("missing-skills").textContent = analysis.missingSkills.length
        ? analysis.missingSkills.join(", ")
        : "No missing skills were returned.";
    document.getElementById("suggestions-list").innerHTML = analysis.suggestions
        .map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`)
        .join("");
    analysisResults.hidden = false;
}

function showSavedAnalysis(resume) {
    if (resume.resume_score === null || resume.resume_score === undefined) {
        return;
    }

    document.getElementById("analysis-score").textContent = `${resume.resume_score}/100`;
    document.getElementById("skills-found").textContent = "Run the analysis again to see the currently detected skills.";
    document.getElementById("missing-skills").textContent = resume.missing_skills || "No saved recommendations.";
    document.getElementById("suggestions-list").innerHTML = splitSavedSuggestions(resume.suggestions)
        .map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`)
        .join("");
    analysisResults.hidden = false;
}

function splitSavedSuggestions(suggestions) {
    return suggestions ? String(suggestions).split(" | ") : ["No saved suggestions."];
}

function normalizeScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function normalizeStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30)
        : [];
}

function validatePdf(file) {
    if (!file) {
        return "Please choose a PDF resume to upload.";
    }

    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    const hasPdfType = file.type === "application/pdf" || file.type === "";

    if (!hasPdfExtension || !hasPdfType) {
        return "Only PDF files are allowed.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "Your resume must be 5 MB or smaller.";
    }

    return "";
}

function createFilePath(userId, fileName) {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${userId}/${Date.now()}-${safeFileName}`;
}

function setStatus(message, isError = false) {
    uploadStatus.textContent = message;
    uploadStatus.classList.toggle("error-message", isError);
}

function setAnalysisStatus(message, isError = false) {
    analysisStatus.textContent = message;
    analysisStatus.classList.toggle("error-message", isError);
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value);
    return element.innerHTML;
}

function formatFileSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
