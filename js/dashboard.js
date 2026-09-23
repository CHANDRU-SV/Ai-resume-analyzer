const dashboardMessage = document.getElementById("dashboard-message");

document.addEventListener("DOMContentLoaded", loadDashboard);
document.getElementById("logout-button").addEventListener("click", logout);

async function loadDashboard() {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        window.location.replace("login.html");
        return;
    }

    try {
        const [profileResult, resumeResult, applicationsResult] = await Promise.all([
            supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle(),
            supabaseClient.from("resumes").select("resume_name, resume_score, missing_skills").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
            supabaseClient.from("applications").select("job_id, status, applied_at").eq("user_id", user.id).order("applied_at", { ascending: false }).limit(5)
        ]);

        const applications = applicationsResult.data || [];
        const jobIds = [...new Set(applications.map((application) => application.job_id).filter(Boolean))];
        const jobsResult = jobIds.length
            ? await supabaseClient.from("jobs").select("id, title, company").in("id", jobIds)
            : { data: [], error: null };
        const jobsById = new Map((jobsResult.data || []).map((job) => [job.id, job]));

        renderProfile(profileResult.data, user);
        renderResume(resumeResult.data && resumeResult.data[0]);
        renderApplications(applications, jobsById);

        const errors = [profileResult.error, resumeResult.error, applicationsResult.error, jobsResult.error].filter(Boolean);
        dashboardMessage.textContent = errors.length
            ? "Some dashboard information could not be loaded. Please try again later."
            : "";
    } catch (error) {
        dashboardMessage.textContent = "We could not load your dashboard. Please refresh and try again.";
    }
}

function renderProfile(profile, user) {
    const details = profile || {};
    const name = details.name || user.user_metadata?.name || "Student";
    const fields = [
        ["Email", details.email || user.email],
        ["Phone", details.phone],
        ["College", details.college],
        ["Department", details.department],
        ["Graduation year", details.graduation_year]
    ].filter(([, value]) => value);

    document.getElementById("student-name").textContent = name;
    document.getElementById("profile-details").innerHTML = fields.length
        ? fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")
        : '<p class="empty-state">No profile information available yet.</p>';
}

function renderResume(resume) {
    const container = document.getElementById("resume-details");
    const analyzeLink = document.getElementById("analyze-resume-link");

    if (!resume) {
        analyzeLink.hidden = true;
        container.innerHTML = '<p>No data yet. Upload your resume to see its status and score here.</p>';
        return;
    }

    analyzeLink.hidden = false;
    const score = resume.resume_score;
    container.innerHTML = `
        <p><strong>Status:</strong> Uploaded</p>
        <p><strong>Resume score:</strong> ${score === undefined || score === null ? "Not available yet" : `${escapeHtml(score)}/100`}</p>
        <p><strong>Recommended skills:</strong> ${resume.missing_skills ? escapeHtml(resume.missing_skills) : "Analyze your resume to see recommendations."}</p>
    `;
}

function renderApplications(applications, jobsById) {
    const container = document.getElementById("applications-list");

    if (!applications.length) {
        container.innerHTML = '<p>No data yet. Applications you submit will appear here.</p>';
        return;
    }

    container.innerHTML = `<ul class="applications-list">${applications.map((application) => {
        const job = jobsById.get(application.job_id);
        const title = job?.title || "Job application";
        const company = job?.company || "Job details unavailable";
        const status = application.status || "Submitted";
        return `<li><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(company)}</span></div><span class="status-badge">${escapeHtml(status)}</span></li>`;
    }).join("")}</ul>`;
}

async function logout() {
    const button = document.getElementById("logout-button");
    button.disabled = true;
    button.textContent = "Logging out...";

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        dashboardMessage.textContent = "Unable to log out. Please try again.";
        button.disabled = false;
        button.textContent = "Logout";
        return;
    }

    window.location.replace("login.html");
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value);
    return element.innerHTML;
}
