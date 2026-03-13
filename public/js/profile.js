function getSignedInUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

function getViewedUserId() {
  const params = new URLSearchParams(window.location.search);
  const paramUserId = Number(params.get("userId"));
  const signedInUser = getSignedInUser();

  if (Number.isInteger(paramUserId) && paramUserId > 0) {
    return paramUserId;
  }

  return Number(signedInUser?.id || 0);
}

function formatDate(dateString) {
  if (!dateString) {
    return "Not set";
  }

  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderActivityList(containerId, emptyId, items, type) {
  const container = document.getElementById(containerId);
  const empty = document.getElementById(emptyId);

  if (!container || !empty) {
    return;
  }

  container.innerHTML = "";

  if (!items.length) {
    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "profile-activity-item";
    const meta =
      type === "reviewer"
        ? `${item.category || "General"} • ${formatDate(item.created_at)}`
        : `${item.question_count || 0} questions • ${formatDate(item.created_at)}`;

    article.innerHTML = `
      <div class="profile-activity-icon">
        <img src="${type === "reviewer" ? "../icons/pdf-icon.png" : "../icons/kwis-icon.png"}" alt="${type} icon">
      </div>
      <div>
        <strong>${item.title || (type === "reviewer" ? "Untitled Reviewer" : "Untitled Quiz")}</strong>
        <span>${meta}</span>
      </div>
    `;
    container.appendChild(article);
  });
}

async function loadProfile() {
  const signedInUser = getSignedInUser();

  if (!signedInUser) {
    window.location.href = "login.html";
    return;
  }

  const viewedUserId = getViewedUserId();
  const isOwnProfile = Number(viewedUserId) === Number(signedInUser.id);

  const editModeToggle = document.getElementById("editModeToggle");
  const editBioBtn = document.getElementById("editBioBtn");
  const changePictureBtn = document.querySelector(".change-picture-btn");
  const profileModeBadge = document.getElementById("profileModeBadge");

  if (profileModeBadge) {
    profileModeBadge.textContent = isOwnProfile ? "Your Profile" : "User Profile";
  }

  if (!isOwnProfile) {
    editModeToggle.style.display = "none";
    editBioBtn.style.display = "none";
    changePictureBtn.style.display = "none";
    document.getElementById("bioEditForm").style.display = "none";
  }

  try {
    const response = await fetch(`/api/users/${viewedUserId}/profile-summary`);
    const data = await response.json();

    if (!data.success) {
      showAlert(data.message || "Failed to load profile.", "danger");
      return;
    }

    const user = data.user;

    document.getElementById("displayName").textContent =
      user.fullname || user.username;
    document.getElementById("displayUsername").textContent = user.username || "unknown";
    document.getElementById("displayEmail").textContent = user.email || "No email";
    document.getElementById("displayBirthdate").textContent = formatDate(user.birthdate);
    document.getElementById("displayGender").textContent = user.gender || "Not set";
    document.getElementById("displayProgram").textContent = user.program || "Not set";
    document.getElementById("displayYearLevel").textContent = user.yearLevel || "Not set";
    document.getElementById("displayUniversity").textContent = user.university || "Not set";
    document.getElementById("displayJoined").textContent = formatDate(user.createdAt);
    document.getElementById("displayBio").textContent =
      user.bio || "This user has not added a bio yet.";
    document.getElementById("bioInput").value = user.bio || "";

    if (user.profile_picture) {
      document.getElementById("profileImg").src = user.profile_picture;
    }

    document.getElementById("displayReviewerCount").textContent = String(
      data.stats?.reviewerCount || 0,
    );
    document.getElementById("displayCreatedQuizCount").textContent = String(
      data.stats?.createdQuizCount || 0,
    );
    document.getElementById("displayCompletedAttemptCount").textContent = String(
      data.stats?.completedAttemptCount || 0,
    );
    document.getElementById("displayAverageScore").textContent = `${Number(
      data.stats?.averageScore || 0,
    )}%`;

    renderActivityList(
      "profileRecentReviewers",
      "profileRecentReviewersEmpty",
      data.recentReviewers || [],
      "reviewer",
    );
    renderActivityList(
      "profileRecentQuizzes",
      "profileRecentQuizzesEmpty",
      data.recentQuizzes || [],
      "quiz",
    );

    window.currentUserId = Number(signedInUser.id);
    window.isOwnProfilePage = isOwnProfile;
  } catch (error) {
    console.error(error);
    showAlert("Failed to load profile.", "danger");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();

  const editBioBtn = document.getElementById("editBioBtn");
  const bioEditForm = document.getElementById("bioEditForm");
  const bioInput = document.getElementById("bioInput");
  const saveBioBtn = document.getElementById("saveBioBtn");
  const cancelBioBtn = document.getElementById("cancelBioBtn");
  const bioCharCount = document.getElementById("bioCharCount");

  const profilePictureInput = document.getElementById("profilePictureInput");
  const profileImg = document.getElementById("profileImg");
  const editModeToggle = document.getElementById("editModeToggle");

  const profileModal = document.getElementById("profileModal");
  const modalImg = document.getElementById("modalImg");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  let isEditMode = false;

  editBioBtn?.addEventListener("click", () => {
    if (!window.isOwnProfilePage) {
      return;
    }

    bioEditForm.style.display = "block";
    editBioBtn.style.display = "none";
    bioInput.focus();
  });

  cancelBioBtn?.addEventListener("click", () => {
    bioEditForm.style.display = "none";
    if (window.isOwnProfilePage) {
      editBioBtn.style.display = "block";
    }
  });

  bioInput?.addEventListener("input", () => {
    bioCharCount.textContent = `${bioInput.value.length}/200`;
  });

  saveBioBtn?.addEventListener("click", async () => {
    if (!window.isOwnProfilePage) {
      return;
    }

    const newBio = bioInput.value.trim();

    if (newBio.length > 200) {
      showAlert("Bio cannot exceed 200 characters", "warning");
      return;
    }

    saveBioBtn.disabled = true;

    try {
      const response = await fetch("/api/update-bio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: window.currentUserId,
          bio: newBio,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const signedInUser = getSignedInUser();
        signedInUser.bio = newBio;
        localStorage.setItem("user", JSON.stringify(signedInUser));

        document.getElementById("displayBio").textContent =
          newBio || "This user has not added a bio yet.";

        bioEditForm.style.display = "none";
        editBioBtn.style.display = "block";
        showAlert("Bio updated successfully!", "success");
      } else {
        showAlert(data.message || "Failed to update bio", "danger");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error updating bio", "danger");
    }

    saveBioBtn.disabled = false;
  });

  profilePictureInput?.addEventListener("change", async (e) => {
    if (!window.isOwnProfilePage) {
      return;
    }

    const file = e.target.files[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      showAlert("Only JPG, PNG, or WebP images are allowed", "warning");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert("File size must be less than 5MB", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("profilePicture", file);
    formData.append("userId", window.currentUserId);

    try {
      const response = await fetch("/api/upload-profile-picture", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const signedInUser = getSignedInUser();
        signedInUser.profile_picture = data.profilePicture;
        localStorage.setItem("user", JSON.stringify(signedInUser));

        profileImg.src = `${data.profilePicture}?t=${Date.now()}`;
        showAlert("Profile picture updated successfully!", "success");
      } else {
        showAlert(data.message || "Upload failed", "danger");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error uploading image", "danger");
    }

    profilePictureInput.value = "";
  });

  editModeToggle?.addEventListener("click", () => {
    if (!window.isOwnProfilePage) {
      return;
    }

    isEditMode = !isEditMode;

    if (isEditMode) {
      editModeToggle.textContent = "View Profile";
      editModeToggle.classList.add("active");
      bioEditForm.style.display = "block";
      editBioBtn.style.display = "none";
    } else {
      editModeToggle.textContent = "Edit Profile";
      editModeToggle.classList.remove("active");
      bioEditForm.style.display = "none";
      editBioBtn.style.display = "block";
    }
  });

  profileImg?.addEventListener("click", () => {
    modalImg.src = profileImg.src;
    profileModal.classList.add("active");
  });

  modalCloseBtn?.addEventListener("click", () => {
    profileModal.classList.remove("active");
  });

  profileModal?.addEventListener("click", (e) => {
    if (e.target === profileModal) {
      profileModal.classList.remove("active");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && profileModal?.classList.contains("active")) {
      profileModal.classList.remove("active");
    }
  });
});
