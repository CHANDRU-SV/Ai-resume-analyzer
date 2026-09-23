async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    if (email === "" || password === "") {
        message.innerText = "Please enter email and password.";
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            message.innerText = error.message;
            return;
        }

        const profileError = await createProfileIfNeeded(data.user);

        if (profileError) {
            message.innerText = "Login succeeded, but your profile could not be saved: " + profileError.message;
            return;
        }

        message.innerText = "Login successful!";
        window.location.href = "dashboard.html";
    } catch (error) {
        message.innerText = "Unable to log in. Please try again.";
    }
}

async function register() {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const college = document.getElementById("college").value.trim();
    const department = document.getElementById("department").value.trim();
    const graduationYear = document.getElementById("graduation_year").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    if (
        name === "" ||
        email === "" ||
        phone === "" ||
        college === "" ||
        department === "" ||
        graduationYear === "" ||
        password === ""
    ) {
        message.innerText = "Please fill all fields.";
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    phone: phone,
                    college: college,
                    department: department,
                    graduation_year: Number(graduationYear)
                }
            }
        });

        if (error) {
            message.innerText = error.message;
            return;
        }

        const user = data.user;

        if (!user || !data.session) {
            message.innerText = "Account created. Please confirm your email, then log in to complete your profile.";
            return;
        }

        const profileError = await createProfileIfNeeded(user);

        if (profileError) {
            message.innerText = "Account created, but the profile could not be saved: " + profileError.message;
            return;
        }

        message.innerText = "Registration successful! Please log in.";

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);
    } catch (error) {
        message.innerText = "Unable to register. Please try again.";
    }
}

async function createProfileIfNeeded(user) {
    const { data: existingProfile, error: selectError } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (selectError || existingProfile) {
        return selectError;
    }

    const details = user.user_metadata;

    const { error: insertError } = await supabaseClient
        .from("profiles")
        .insert({
            id: user.id,
            name: details.name,
            email: user.email,
            phone: details.phone,
            college: details.college,
            department: details.department,
            graduation_year: details.graduation_year
        });

    return insertError;
}
