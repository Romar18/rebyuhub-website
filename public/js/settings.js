const storedUser = localStorage.getItem("user");

if (!storedUser) {
  window.location.href = "login.html";
}

const user = JSON.parse(storedUser);
const links = document.querySelectorAll(".settings-link");
const panels = document.querySelectorAll(".settings-panel");

const fullnameInput = document.getElementById("settingsFullname");
const usernameInput = document.getElementById("settingsUsername");
const emailInput = document.getElementById("settingsEmail");
const currentPasswordInput = document.getElementById("settingsCurrentPassword");
const newPasswordInput = document.getElementById("settingsNewPassword");
const confirmPasswordInput = document.getElementById("settingsConfirmPassword");
const themeSelect = document.getElementById("settingsTheme");
const settingsMenuBtn = document.getElementById("settingsMenuBtn");
const settingsSidebarOverlay = document.getElementById("settingsSidebarOverlay");
const settingsSidebarClose = document.getElementById("settingsSidebarClose");

function getThemeStorageKey() {
  return user?.id ? `theme_user_${user.id}` : "theme";
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle("settings-sidebar-open", isOpen);
}

function isMobileViewport() {
  return window.innerWidth <= 920;
}

function toggleSidebarMode() {
  if (isMobileViewport()) {
    setSidebarOpen(true);
    return;
  }

  document.body.classList.toggle("settings-sidebar-collapsed");
}

function setActivePanel(panelId) {
  links.forEach((link) => {
    link.classList.toggle("active", link.dataset.panel === panelId);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function loadUserData() {
  if (fullnameInput) {
    fullnameInput.value = user.fullname || "";
  }

  if (usernameInput) {
    usernameInput.value = user.username || "";
  }

  if (emailInput) {
    emailInput.value = user.email || "";
  }
}

async function refreshUserData() {
  try {
    const response = await fetch(`/api/users/${user.id}/settings`);
    const data = await response.json();

    if (!data.success || !data.user) {
      return;
    }

    user.fullname = data.user.fullname || user.fullname || "";
    user.username = data.user.username || user.username || "";
    user.email = data.user.email || user.email || "";
    syncStoredUser();
    loadUserData();
  } catch (error) {
    console.error(error);
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle(
    "light-theme",
    normalizedTheme === "light",
  );
  document.body.classList.toggle("light-theme", normalizedTheme === "light");
  localStorage.setItem(getThemeStorageKey(), normalizedTheme);

  if (themeSelect) {
    themeSelect.value = normalizedTheme;
  }
}

function syncStoredUser() {
  localStorage.setItem("user", JSON.stringify(user));
}

function notify(message, type = "info") {
  if (typeof showAlert === "function") {
    showAlert(message, type);
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

async function handleSave(button, action) {
  button.disabled = true;

  try {
    await action();
  } catch (error) {
    console.error(error);
    notify("Something went wrong. Please try again.", "danger");
  } finally {
    button.disabled = false;
  }
}

links.forEach((link) => {
  link.addEventListener("click", () => {
    setActivePanel(link.dataset.panel);

    if (isMobileViewport()) {
      setSidebarOpen(false);
    }
  });
});

settingsMenuBtn?.addEventListener("click", () => {
  toggleSidebarMode();
});

settingsSidebarClose?.addEventListener("click", () => {
  setSidebarOpen(false);
});

settingsSidebarOverlay?.addEventListener("click", () => {
  setSidebarOpen(false);
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const inputId = button.dataset.passwordToggle;
    const targetInput = document.getElementById(inputId);

    if (!targetInput) {
      return;
    }

    const shouldShow = targetInput.type === "password";
    targetInput.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "Hide" : "Show";
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSidebarOpen(false);
  }
});

window.addEventListener("resize", () => {
  if (!isMobileViewport()) {
    setSidebarOpen(false);
  }
});

document.getElementById("saveFullnameBtn")?.addEventListener("click", async (event) => {
  await handleSave(event.currentTarget, async () => {
    const fullname = fullnameInput.value.trim();

    if (!fullname) {
      notify("Full name cannot be empty.", "warning");
      return;
    }

    if (fullname === (user.fullname || "").trim()) {
      notify("That is already your current full name.", "info");
      return;
    }

    const data = await postJson("/api/update-fullname", {
      id: user.id,
      fullname,
    });

    if (!data.success) {
      notify(data.message || "Failed to update full name.", "danger");
      return;
    }

    user.fullname = fullname;
    syncStoredUser();
    notify("Full name updated.", "success");
  });
});

document.getElementById("saveUsernameBtn")?.addEventListener("click", async (event) => {
  await handleSave(event.currentTarget, async () => {
    const username = usernameInput.value.trim();

    if (!username) {
      notify("Username cannot be empty.", "warning");
      return;
    }

    if (username.length < 3) {
      notify("Username must be at least 3 characters.", "warning");
      return;
    }

    if (username === (user.username || "").trim()) {
      notify("That is already your current username.", "info");
      return;
    }

    const data = await postJson("/api/update-username", {
      id: user.id,
      username,
    });

    if (!data.success) {
      notify(data.message || "Failed to update username.", "danger");
      return;
    }

    user.username = username;
    syncStoredUser();
    notify("Username updated.", "success");
  });
});

document.getElementById("saveEmailBtn")?.addEventListener("click", async (event) => {
  await handleSave(event.currentTarget, async () => {
    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      notify("Email address cannot be empty.", "warning");
      return;
    }

    if (!emailRegex.test(email)) {
      notify("Enter a valid email address.", "warning");
      return;
    }

    if (email.toLowerCase() === String(user.email || "").trim().toLowerCase()) {
      notify("That is already your current email address.", "info");
      return;
    }

    const data = await postJson("/api/update-email", {
      id: user.id,
      email,
    });

    if (!data.success) {
      notify(data.message || "Failed to update email.", "danger");
      return;
    }

    user.email = email;
    syncStoredUser();
    notify("Email updated.", "success");
  });
});

document.getElementById("savePasswordBtn")?.addEventListener("click", async (event) => {
  await handleSave(event.currentTarget, async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      notify("Fill in all password fields.", "warning");
      return;
    }

    if (newPassword.length < 6) {
      notify("New password must be at least 6 characters.", "warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify("New password and confirmation do not match.", "danger");
      return;
    }

    if (currentPassword === newPassword) {
      notify("Your new password must be different from the current password.", "warning");
      return;
    }

    const data = await postJson("/api/update-password", {
      id: user.id,
      currentPassword,
      newPassword,
    });

    if (!data.success) {
      notify(data.message || "Failed to update password.", "danger");
      return;
    }

    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    notify("Password updated.", "success");
  });
});

document.getElementById("saveThemeBtn")?.addEventListener("click", () => {
  applyTheme(themeSelect?.value || "dark");
  notify("Theme updated.", "success");
});

const savedTheme = localStorage.getItem(getThemeStorageKey()) || "dark";
applyTheme(savedTheme);
loadUserData();
refreshUserData();
