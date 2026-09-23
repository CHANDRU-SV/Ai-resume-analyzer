document.addEventListener("DOMContentLoaded", async () => {
    const list = document.getElementById("applications-list");

    try {
        const { data: { user }, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !user) {
            window.location.href = "login.html";
            return;
        }

        const { data: applications, error } = await supabaseClient
            .from("applications")
            .select("*")
            .eq("user_id", user.id)
            .order("applied_at", { ascending: false });

        if (error) throw error;

        if (!applications || applications.length === 0) {
            list.innerHTML = "<p class=\"empty-state\">No applications yet. Explore available jobs and apply for a position.</p>";
            return;
        }

        const jobIds = applications.map(app => app.job_id);

        const { data: jobs, error: jobsError } = await supabaseClient
            .from("jobs")
            .select("id, title, company, location")
            .in("id", jobIds);

        if (jobsError) throw jobsError;

        list.innerHTML = applications.map(app => {
            const job = (jobs || []).find(j => j.id === app.job_id);

            return `
                <div class="application-card">
                    <h3>${escapeHtml(job?.title || "Job")}</h3>
                    <p><strong>Company:</strong> ${escapeHtml(job?.company || "N/A")}</p>
                    <p><strong>Location:</strong> ${escapeHtml(job?.location || "N/A")}</p>
                    <p><strong>Status:</strong> ${escapeHtml(app.status || "Applied")}</p>
                    <p><strong>Applied:</strong> ${escapeHtml(formatDate(app.applied_at))}</p>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Could not load applications:", error);
        list.innerHTML = "<p>Could not load your applications.</p>";
    }
});

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}
