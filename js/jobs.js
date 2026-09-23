const jobsList = document.getElementById("jobs-list");
const jobsMessage = document.getElementById("jobs-message");
const jobSearch = document.getElementById("job-search");
let jobs = [];

document.addEventListener("DOMContentLoaded", loadJobs);
jobSearch.addEventListener("input", filterJobs);
jobsList.addEventListener("click", handleJobAction);

async function loadJobs() {
    try {
        const { data, error } = await supabaseClient
            .from("jobs")
            .select("id, title, company, location, description, required_skills, salary, created_at")
            .order("created_at", { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        jobs = data || [];
        renderJobs(jobs);
        jobsMessage.textContent = jobs.length ? "" : "No jobs are available yet. Please check back soon.";
    } catch (error) {
        jobsMessage.textContent = `Unable to load jobs: ${error.message || "Please try again later."}`;
    }
}

function filterJobs() {
    const searchTerm = jobSearch.value.trim().toLowerCase();
    const filteredJobs = jobs.filter((job) => {
        const searchableText = [job.title, job.company, job.location, formatList(job.required_skills)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return searchableText.includes(searchTerm);
    });

    renderJobs(filteredJobs);
    jobsMessage.textContent = filteredJobs.length || !jobs.length
        ? ""
        : "No jobs match your search.";
}

function renderJobs(jobsToRender) {
    if (!jobsToRender.length) {
        jobsList.innerHTML = "";
        return;
    }

    jobsList.innerHTML = jobsToRender.map((job) => `
        <article class="job-card">
            <div class="job-card-heading">
                <div>
                    <h2>${escapeHtml(job.title || "Untitled role")}</h2>
                    <p class="job-company">${escapeHtml(job.company || "Company not specified")}</p>
                </div>
                <p class="job-location">${escapeHtml(job.location || "Location not specified")}</p>
            </div>
            <p class="job-description">${escapeHtml(job.description || "No job description provided.")}</p>
            <dl class="job-details">
                <div>
                    <dt>Required skills</dt>
                    <dd>${escapeHtml(formatList(job.required_skills) || "Not specified")}</dd>
                </div>
                <div>
                    <dt>Salary</dt>
                    <dd>${escapeHtml(job.salary || "Not specified")}</dd>
                </div>
            </dl>
            <div class="job-action-row">
                <button class="button" type="button" data-job-id="${escapeHtml(job.id)}">Apply Now</button>
                <span id="application-message-${escapeHtml(job.id)}" class="application-message" role="status"></span>
            </div>
        </article>
    `).join("");
}

async function handleJobAction(event) {
    const button = event.target.closest("button[data-job-id]");
    if (!button) {
        return;
    }

    const jobId = button.dataset.jobId;
    const message = document.getElementById(`application-message-${jobId}`);
    button.disabled = true;
    message.textContent = "Checking your account...";
    message.classList.remove("error-message");

    try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            window.location.replace("login.html");
            return;
        }

        const { data: existingApplication, error: checkError } = await supabaseClient
            .from("applications")
            .select("id")
            .eq("user_id", user.id)
            .eq("job_id", jobId)
            .limit(1)
            .maybeSingle();

        if (checkError) {
            throw new Error(checkError.message);
        }

        if (existingApplication) {
            message.textContent = "You have already applied for this job.";
            button.textContent = "Already Applied";
            return;
        }

        message.textContent = "Submitting your application...";
        const { error: insertError } = await supabaseClient
            .from("applications")
            .insert({
                user_id: user.id,
                job_id: jobId,
                status: "Applied"
            });

        if (insertError) {
            throw new Error(insertError.message);
        }

        message.textContent = "Application submitted successfully.";
        button.textContent = "Applied";
    } catch (error) {
        message.textContent = `Unable to apply: ${error.message || "Please try again."}`;
        message.classList.add("error-message");
        button.disabled = false;
    }
}

function formatList(value) {
    if (Array.isArray(value)) {
        return value.join(", ");
    }

    return value ? String(value) : "";
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value);
    return element.innerHTML;
}
