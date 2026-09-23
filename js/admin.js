const adminMessage = document.getElementById("admin-message");
const refreshButton = document.getElementById("refresh-button");
const logoutButton = document.getElementById("logout-button");
const jobsBody = document.getElementById("admin-jobs-body");
const applicationsBody = document.getElementById("admin-applications-body");

document.addEventListener("DOMContentLoaded", initializeAdminDashboard);
refreshButton.addEventListener("click", loadAdminData);
logoutButton.addEventListener("click", logout);

async function initializeAdminDashboard() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.replace("login.html");
        return;
    }

    await loadAdminData();
}

async function loadAdminData() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    adminMessage.textContent = "Loading dashboard data...";

    try {
        const [jobsCountResult, applicationsCountResult, profilesCountResult, jobsResult, applicationsResult] = await Promise.all([
            supabaseClient.from("jobs").select("*", { count: "exact", head: true }),
            supabaseClient.from("applications").select("*", { count: "exact", head: true }),
            supabaseClient.from("profiles").select("*", { count: "exact", head: true }),
            supabaseClient.from("jobs").select("id, title, company, location, salary, created_at").order("created_at", { ascending: false }),
            supabaseClient.from("applications").select("id, user_id, job_id, status, applied_at").order("applied_at", { ascending: false })
        ]);

        renderCount("total-jobs", jobsCountResult);
        renderCount("total-applications", applicationsCountResult);
        renderCount("total-profiles", profilesCountResult);
        renderJobs(jobsResult);
        renderApplications(applicationsResult);

        const errors = [
            jobsCountResult.error,
            applicationsCountResult.error,
            profilesCountResult.error,
            jobsResult.error,
            applicationsResult.error
        ].filter(Boolean);

        adminMessage.textContent = errors.length
            ? "Some admin data could not be loaded. Check that your existing RLS permissions allow this account to read the required records."
            : "Dashboard updated.";
    } catch (error) {
        adminMessage.textContent = "Unable to load admin data. Please try again.";
        jobsBody.innerHTML = '<tr><td colspan="5">Unable to load jobs.</td></tr>';
        applicationsBody.innerHTML = '<tr><td colspan="4">Unable to load applications.</td></tr>';
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
    }
}

function renderCount(elementId, result) {
    const element = document.getElementById(elementId);
    element.textContent = result.error ? "—" : (result.count ?? 0);
}

function renderJobs(result) {
    if (result.error) {
        jobsBody.innerHTML = '<tr><td colspan="5">Unable to load jobs.</td></tr>';
        return;
    }

    if (!result.data || !result.data.length) {
        jobsBody.innerHTML = '<tr><td colspan="5">No jobs found.</td></tr>';
        return;
    }

    jobsBody.innerHTML = result.data.map((job) => `
        <tr>
            <td>${escapeHtml(job.title || "Not specified")}</td>
            <td>${escapeHtml(job.company || "Not specified")}</td>
            <td>${escapeHtml(job.location || "Not specified")}</td>
            <td>${escapeHtml(job.salary || "Not specified")}</td>
            <td>${escapeHtml(formatDate(job.created_at))}</td>
        </tr>
    `).join("");
}

function renderApplications(result) {
    if (result.error) {
        applicationsBody.innerHTML = '<tr><td colspan="4">Unable to load applications.</td></tr>';
        return;
    }

    if (!result.data || !result.data.length) {
        applicationsBody.innerHTML = '<tr><td colspan="4">No applications found.</td></tr>';
        return;
    }

    applicationsBody.innerHTML = result.data.map((application) => `
        <tr>
            <td class="id-cell">${escapeHtml(application.job_id)}</td>
            <td class="id-cell">${escapeHtml(application.user_id)}</td>
            <td><span class="status-badge">${escapeHtml(application.status || "Not specified")}</span></td>
            <td>${escapeHtml(formatDate(application.applied_at))}</td>
        </tr>
    `).join("");
}

async function logout() {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        adminMessage.textContent = "Unable to log out. Please try again.";
        logoutButton.disabled = false;
        logoutButton.textContent = "Logout";
        return;
    }

    window.location.replace("login.html");
}

function formatDate(value) {
    if (!value) {
        return "Not available";
    }

    return new Date(value).toLocaleDateString();
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "Not specified");
    return element.innerHTML;
}
