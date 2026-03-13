let activeReviewerCategory = "all";
let allReviewers = [];
const expandedReviewerSections = {
  my: false,
  other: false,
};

document.addEventListener("DOMContentLoaded", () => {
  const uploadModal = document.getElementById("uploadModal");
  const uploadBtn = document.querySelector(".upload-btn");
  const closeUploadBtn = document.getElementById("closeUploadModal");

  const user = JSON.parse(localStorage.getItem("user"));

  /* NAV PROFILE */

  if (user && user.profile_picture) {
    const navProfile = document.getElementById("navProfile");
    if (navProfile) navProfile.src = user.profile_picture;
  }

  /* PRELOAD REVIEWERS ON DASHBOARD LOAD */

  let reviewersLoaded = false;
  const reviewerSearch = document.getElementById("reviewerSearch");
  const reviewerFilters = document.querySelector(".reviewer-filters");

  if (!reviewersLoaded) {
    loadReviewers();
    reviewersLoaded = true;
  }

  document.addEventListener("dashboard:sectionchange", (event) => {
    if (event.detail?.section === "reviewers-section") {
      loadReviewers();
      loadReviewerCategories();
      reviewersLoaded = true;
    }
  });

  /* CLOSE PREVIEW */

  const closePreview = document.getElementById("closePreview");

  if (closePreview) {
    closePreview.onclick = () => {
      document.getElementById("reviewerPreview").style.display = "none";
      document.getElementById("previewFrame").src = "";
    };
  }

  /* OPEN UPLOAD MODAL */

  if (uploadBtn) {
    uploadBtn.onclick = () => uploadModal.classList.add("active");
  }

  /* CLOSE UPLOAD MODAL */

  if (closeUploadBtn) {
    closeUploadBtn.onclick = () => uploadModal.classList.remove("active");
  }

  /* CATEGORY OTHER FIELD */

  const categorySelect = document.getElementById("reviewerCategory");
  const customCategoryInput = document.getElementById("customCategory");

  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      if (categorySelect.value === "other") {
        customCategoryInput.style.display = "block";
      } else {
        customCategoryInput.style.display = "none";
      }
    });
  }

  /* UPLOAD REVIEWER */

  const uploadConfirmBtn = document.getElementById("uploadReviewerConfirm");

  if (uploadConfirmBtn) {
    uploadConfirmBtn.onclick = async () => {
      let title = document.getElementById("reviewerTitle").value.trim();
      let category = categorySelect.value;

      const file = document.getElementById("reviewerFile").files[0];
      const user = JSON.parse(localStorage.getItem("user"));

      if (!file) {
        showAlert("Please select a file.", "warning");
        return;
      }

      if (!title) {
        title = file.name.replace(".pdf", "");
      }

      if (category === "other") {
        category = customCategoryInput.value.trim();
      }

      if (!category) {
        showAlert("Please enter a category.", "warning");
        return;
      }

      if (!user) {
        showAlert("User not found.", "danger");
        return;
      }

      /* VALIDATE PDF */

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        showAlert("Only PDF files are allowed.", "warning");
        return;
      }

      uploadConfirmBtn.disabled = true;

      const formData = new FormData();

      formData.append("title", title);
      formData.append("category", category);
      formData.append("userId", user.id);
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload-reviewer", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          loadReviewers();
          loadReviewerCategories();

          uploadModal.classList.remove("active");

          document.getElementById("reviewerTitle").value = "";
          document.getElementById("reviewerFile").value = "";

          showAlert("Upload successful.", "success");
        } else {
          showAlert("Upload failed.", "danger");
        }
      } catch (err) {
        console.error(err);
        showAlert("Upload failed.", "danger");
      }

      uploadConfirmBtn.disabled = false;
    };
  }

  /* RENAME REVIEWER */

  const confirmRenameBtn = document.getElementById("confirmRename");

  if (confirmRenameBtn) {
    confirmRenameBtn.onclick = async () => {
      const title = document.getElementById("renameInput").value.trim();

      if (!title) {
        showAlert("Enter a title.", "warning");
        return;
      }

      try {
        const res = await fetch("/api/rename-reviewer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: renameId,
            title: title,
          }),
        });

        const data = await res.json();

        if (data.success) {
          showAlert("Reviewer renamed.", "success");

          document.getElementById("renameModal").classList.remove("active");

          renameId = null;
          loadReviewers();
        } else {
          showAlert("Rename failed.", "danger");
        }
      } catch (err) {
        console.error(err);
        showAlert("Rename failed.", "danger");
      }
    };
  }

  /* CANCEL RENAME */

  const cancelRename = document.getElementById("cancelRename");

  if (cancelRename) {
    cancelRename.onclick = () => {
      document.getElementById("renameModal").classList.remove("active");
      document.getElementById("renameInput").value = "";
      renameId = null;
    };
  }

  reviewerSearch?.addEventListener("input", () => {
    renderReviewers();
  });

  reviewerFilters?.addEventListener("wheel", (e) => {
    e.preventDefault();
    reviewerFilters.scrollLeft += e.deltaY;
  });

  document.querySelectorAll("[data-reviewer-group-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.reviewerGroupToggle;
      const section = button.closest(".reviewer-group");

      if (!sectionKey) {
        return;
      }

      if (section) {
        section.classList.add("reviewer-group-animating");
        section.classList.remove(
          "reviewer-group-expand-enter",
          "reviewer-group-collapse-enter",
        );
      }

      const isExpanding = !expandedReviewerSections[sectionKey];
      expandedReviewerSections[sectionKey] = isExpanding;
      renderReviewers();

      if (section) {
        section.classList.add(
          isExpanding
            ? "reviewer-group-expand-enter"
            : "reviewer-group-collapse-enter",
        );

        window.setTimeout(() => {
          section.classList.remove(
            "reviewer-group-animating",
            "reviewer-group-expand-enter",
            "reviewer-group-collapse-enter",
          );
        }, 360);
      }
    });
  });

  document.querySelectorAll(".reviewers-grid").forEach((grid) => {
    grid.addEventListener(
      "wheel",
      (event) => {
        if (grid.closest(".reviewer-group")?.classList.contains("expanded")) {
          return;
        }

        const isHorizontalSwipe = Math.abs(event.deltaX) > Math.abs(event.deltaY);

        if (isHorizontalSwipe || event.deltaY === 0) {
          return;
        }

        event.preventDefault();
        const maxScrollLeft = Math.max(0, grid.scrollWidth - grid.clientWidth);
        const nextScrollLeft = Math.max(
          0,
          Math.min(maxScrollLeft, grid.scrollLeft + event.deltaY * 1.8),
        );

        grid.scrollLeft = nextScrollLeft;
      },
      { passive: false },
    );
  });

});

/* FORMAT FILE SIZE */

function formatFileSize(bytes) {
  const kb = bytes / 1024;
  const mb = kb / 1024;

  if (mb >= 1) {
    return mb.toFixed(1) + " MB";
  }

  return Math.round(kb) + " KB";
}

/* FORMAT DATE */

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* LOAD REVIEWERS */

async function loadReviewers() {
  const res = await fetch("/api/reviewers");
  const data = await res.json();

  allReviewers = data.reviewers || [];
  renderReviewers();
}

function capitalize(text) {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function createReviewerCard(r, currentUser) {
  const isOwner = currentUser && Number(currentUser.id) === Number(r.uploaded_by);
  const title =
    r.title ||
    r.file_path
      .split("/")
      .pop()
      .replace(/\.[^/.]+$/, "");
  const safeTitle = title.replace(/'/g, "\\'");
  const size = r.file_size ? formatFileSize(r.file_size) : "";

  const card = document.createElement("div");
  card.className = "reviewer-card";
  card.dataset.category = r.category || "general";

  card.innerHTML = `
    <img src="../icons/pdf-icon.png" class="card-icon">
    <p class="reviewer-title">${title}</p>
    <a class="reviewer-uploader reviewer-user-link" href="profile.html?userId=${r.uploaded_by}">
      @${r.uploader || "unknown"}
    </a>

    <div class="reviewer-meta">
      <span class="reviewer-date">${formatDate(r.created_at)}</span>
      <span class="reviewer-size">${size || "Unknown size"}</span>
    </div>

    <div class="reviewer-actions">
      <button class="open-btn" onclick="previewReviewer('${r.file_path}')">
        Open
      </button>

      ${
        isOwner
          ? `
        <button class="rename-btn" onclick="renameReviewer(${r.id}, '${safeTitle}')">
          Rename
        </button>
        <button class="delete-btn" onclick="confirmDelete(${r.id})">
          Delete
        </button>
        `
          : ""
      }
    </div>
  `;

  return card;
}

function renderReviewerGroup(
  reviewers,
  gridId,
  emptyId,
  currentUser,
  sectionId,
  toggleSelector,
  sectionKey,
) {
  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  const section = document.getElementById(sectionId);
  const toggleButton = document.querySelector(toggleSelector);

  if (!grid || !empty) {
    return;
  }

  if (section) {
    section.classList.toggle("expanded", expandedReviewerSections[sectionKey]);
  }

  grid.innerHTML = "";

  reviewers.forEach((reviewer) => {
    grid.appendChild(createReviewerCard(reviewer, currentUser));
  });

  empty.style.display = reviewers.length > 0 ? "none" : "block";

  if (toggleButton) {
    toggleButton.style.display = reviewers.length > 3 ? "inline-flex" : "none";
    toggleButton.textContent = expandedReviewerSections[sectionKey]
      ? "Collapse"
      : "See All";
  }
}

function renderReviewers() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const searchText = document.getElementById("reviewerSearch")?.value.trim().toLowerCase() || "";

  const filteredReviewers = allReviewers.filter((reviewer) => {
    const title = String(reviewer.title || "").toLowerCase();
    const category = String(reviewer.category || "").toLowerCase();
    const uploader = String(reviewer.uploader || "").toLowerCase();
    const matchesSearch =
      title.includes(searchText) ||
      category.includes(searchText) ||
      uploader.includes(searchText);
    const matchesCategory =
      activeReviewerCategory === "all" || category === activeReviewerCategory;

    return matchesSearch && matchesCategory;
  });

  const myReviewers = filteredReviewers.filter(
    (reviewer) => Number(reviewer.uploaded_by) === Number(currentUser?.id),
  );
  const otherReviewers = filteredReviewers.filter(
    (reviewer) => Number(reviewer.uploaded_by) !== Number(currentUser?.id),
  );

  renderReviewerGroup(
    myReviewers,
    "myReviewersGrid",
    "myReviewersEmpty",
    currentUser,
    "myReviewersSection",
    '[data-reviewer-group-toggle="my"]',
    "my",
  );
  renderReviewerGroup(
    otherReviewers,
    "otherReviewersGrid",
    "otherReviewersEmpty",
    currentUser,
    "otherReviewersSection",
    '[data-reviewer-group-toggle="other"]',
    "other",
  );
}
/* PREVIEW */

function previewReviewer(path) {
  const preview = document.getElementById("reviewerPreview");
  const frame = document.getElementById("previewFrame");

  if (!frame) return;

  frame.src = path;
  preview.style.display = "block";
}

/* DELETE */

async function deleteReviewer(id) {
  await fetch(`/api/reviewer/${id}`, {
    method: "DELETE",
  });

  showAlert("Reviewer deleted.", "success");

  loadReviewers();
  loadReviewerCategories();
}

/* RENAME */

let renameId = null;

function renameReviewer(id, currentTitle) {
  renameId = id;

  const modal = document.getElementById("renameModal");
  const input = document.getElementById("renameInput");

  input.value = currentTitle;

  modal.classList.add("active");

  input.focus();
  input.select();
}

/* LOAD PROFILE IMAGE */

async function loadNavProfile() {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return;

  const res = await fetch(`/api/user/${user.id}`);
  const data = await res.json();

  if (data.success && data.profile) {
    document.getElementById("navProfile").src = data.profile;
  }
}

loadNavProfile();
loadReviewerCategories();

async function loadReviewerCategories() {
  const res = await fetch("/api/reviewer-categories");
  const data = await res.json();
  const container = document.querySelector(".reviewer-filters");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "filter-btn active";
  allBtn.dataset.filter = "all";
  allBtn.textContent = "All";
  container.appendChild(allBtn);

  (data.categories || []).forEach((category) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.dataset.filter = category.category;
    btn.textContent = capitalize(category.category);
    container.appendChild(btn);
  });

  container.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      container
        .querySelectorAll(".filter-btn")
        .forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      activeReviewerCategory = button.dataset.filter;
      renderReviewers();
    });
  });
}


