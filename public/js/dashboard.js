/* CHECK IF USER IS LOGGED IN */
const user = localStorage.getItem("user");

if (!user) {
  // User not logged in, redirect to login
  history.replaceState(null, "", "login.html");
  window.location.href = "login.html";
}

const navList = document.querySelector(".nav-list");
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".page-section");
const ACTIVE_DASHBOARD_SECTION_KEY = "activeDashboardSection";
const parsedUser = JSON.parse(user);

function formatDashboardDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function setActiveSection(targetSection) {
  if (!targetSection || !document.getElementById(targetSection)) {
    return;
  }

  document.documentElement.dataset.dashboardSection = targetSection;

  navItems.forEach((item) => {
    const itemSection = item.querySelector("a")?.dataset.section;
    item.classList.toggle("active", itemSection === targetSection);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === targetSection);
  });

  localStorage.setItem(ACTIVE_DASHBOARD_SECTION_KEY, targetSection);
  document.dispatchEvent(
    new CustomEvent("dashboard:sectionchange", {
      detail: { section: targetSection },
    }),
  );
}

const savedSection = localStorage.getItem(ACTIVE_DASHBOARD_SECTION_KEY);

if (savedSection && document.getElementById(savedSection)) {
  setActiveSection(savedSection);
}

navList.addEventListener("click", (e) => {
  const clickedItem = e.target.closest(".nav-item");
  if (!clickedItem) return;

  e.preventDefault();

  const targetSection = clickedItem.querySelector("a").dataset.section;
  setActiveSection(targetSection);
});

const profileMenu = document.querySelector(".profile-menu");

profileMenu.addEventListener("click", () => {
  profileMenu.classList.toggle("active");
});

/*--typing-text--*/
const element = document.getElementById("typing-text");
const text = "Continue your learning journey with RebyuHub...";

let index = 0;
let isDeleting = false;

function typeAnimation() {
  if (!isDeleting) {
    element.textContent = text.substring(0, index++);
  } else {
    element.textContent = text.substring(0, index--);
  }

  if (index === text.length + 1) {
    isDeleting = true;
    setTimeout(typeAnimation, 10000);
    return;
  }

  if (index === 0) {
    isDeleting = false;
  }

  setTimeout(typeAnimation, isDeleting ? 60 : 100);
}

element.textContent = "";
typeAnimation();

function renderHomeRecentActivity(items) {
  const recentList = document.getElementById("homeRecentList");
  const recentEmpty = document.getElementById("homeRecentEmpty");

  if (!recentList || !recentEmpty) {
    return;
  }

  recentList.innerHTML = "";

  if (!items.length) {
    recentEmpty.classList.add("show");
    return;
  }

  recentEmpty.classList.remove("show");

  items.slice(0, 5).forEach((item) => {
    const card = document.createElement("article");
    card.className = "home-recent-item";
    card.innerHTML = `
      <div class="home-recent-icon">
        <img src="${item.icon}" alt="${item.type} icon">
      </div>
      <div>
        <strong>${item.title}</strong>
        <span>${item.meta}</span>
      </div>
    `;
    recentList.appendChild(card);
  });
}

function renderProgressWeeklyChart(weekly = []) {
  const chart = document.getElementById("progressWeeklyChart");
  const empty = document.getElementById("progressWeeklyEmpty");
  const summary = document.getElementById("progressChartSummary");

  if (!chart || !empty || !summary) {
    return;
  }

  chart.innerHTML = "";

  const hasData = weekly.some((day) => Number(day.attemptCount) > 0);

  if (!hasData) {
    empty.classList.add("show");
    summary.textContent = "No quiz activity recorded in the last 7 days.";
  } else {
    empty.classList.remove("show");
    const activeDays = weekly.filter((day) => Number(day.attemptCount) > 0).length;
    summary.textContent = `${activeDays} active day${activeDays === 1 ? "" : "s"} this week.`;
  }

  weekly.forEach((day) => {
    const bar = document.createElement("article");
    bar.className = "bar";
    const height = Math.max(Number(day.averagePercentage || 0), 8);
    const shortDate = day.dateKey
      ? new Date(`${day.dateKey}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    bar.innerHTML = `
      <span class="bar-score">${Number(day.averagePercentage || 0)}%</span>
      <div class="bar-track" title="${day.label}: ${day.attemptCount} attempt${day.attemptCount === 1 ? "" : "s"}">
        <span class="bar-fill" style="height:${height}%"></span>
      </div>
      <p class="bar-label">${day.label}</p>
      <span class="bar-date">${shortDate}</span>
    `;

    chart.appendChild(bar);
  });
}

function renderProgressCategories(items = []) {
  const list = document.getElementById("progressCategoryList");
  const empty = document.getElementById("progressCategoryEmpty");

  if (!list || !empty) {
    return;
  }

  list.innerHTML = "";

  if (!items.length) {
    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "progress-category-item";
    card.innerHTML = `
      <div>
        <strong>${item.category}</strong>
        <span>${item.attempts} quiz attempt${item.attempts === 1 ? "" : "s"}</span>
      </div>
      <div class="progress-category-score">${item.averagePercentage}%</div>
    `;
    list.appendChild(card);
  });
}

function renderProgressRecentAttempts(items = []) {
  const list = document.getElementById("progressRecentList");
  const empty = document.getElementById("progressRecentEmpty");

  if (!list || !empty) {
    return;
  }

  list.innerHTML = "";

  if (!items.length) {
    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  items.forEach((attempt) => {
    const card = document.createElement("article");
    card.className = "progress-recent-item";
    card.innerHTML = `
      <div>
        <strong>${attempt.quiz_title || "Untitled Quiz"}</strong>
        <span>${attempt.quiz_category || "General"} • ${formatDashboardDate(attempt.finished_at)}</span>
      </div>
      <div class="progress-attempt-score">${Number(attempt.percentage || 0)}% (${attempt.score}/${attempt.total_questions})</div>
    `;
    list.appendChild(card);
  });
}

async function loadProgressOverview() {
  const completedCount = document.getElementById("progressCompletedCount");
  const averageScore = document.getElementById("progressAverageScore");
  const bestScore = document.getElementById("progressBestScore");
  const streak = document.getElementById("progressStreak");

  if (!completedCount || !averageScore || !bestScore || !streak) {
    return;
  }

  try {
    const response = await fetch(`/api/users/${parsedUser.id}/progress-summary`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to load progress");
    }

    completedCount.textContent = String(data.summary?.totalCompleted || 0);
    averageScore.textContent = `${Number(data.summary?.averageScore || 0)}%`;
    bestScore.textContent = `${Number(data.summary?.bestScore || 0)}%`;
    streak.textContent = `${Number(data.summary?.studyStreak || 0)} day${Number(data.summary?.studyStreak || 0) === 1 ? "" : "s"}`;

    renderProgressWeeklyChart(data.weekly || []);
    renderProgressCategories(data.categoryPerformance || []);
    renderProgressRecentAttempts(data.recentAttempts || []);
  } catch (error) {
    console.error(error);
    renderProgressWeeklyChart([]);
    renderProgressCategories([]);
    renderProgressRecentAttempts([]);
  }
}

async function loadHomeOverview() {
  const greeting = document.getElementById("homeGreeting");
  const reviewerCount = document.getElementById("homeReviewerCount");
  const quizTakenCount = document.getElementById("homeQuizTakenCount");
  const createdQuizCount = document.getElementById("homeCreatedQuizCount");
  const availableQuizCount = document.getElementById("homeAvailableQuizCount");
  const focusTitle = document.getElementById("homeFocusTitle");
  const focusText = document.getElementById("homeFocusText");
  const focusMeta = document.getElementById("homeFocusMeta");

  if (greeting) {
    greeting.textContent = `Welcome back, ${parsedUser.username || "Learner"}!`;
  }

  try {
    const [reviewerRes, quizRes, completedQuizRes] = await Promise.all([
      fetch("/api/reviewers"),
      fetch("/api/quizzes"),
      fetch(`/api/users/${parsedUser.id}/completed-quizzes`),
    ]);

    const reviewerData = await reviewerRes.json();
    const quizData = await quizRes.json();
    const completedQuizData = await completedQuizRes.json();

    const reviewers = reviewerData.success ? reviewerData.reviewers || [] : [];
    const quizzes = quizData.success ? quizData.quizzes || [] : [];
    const completedQuizIds = new Set(
      completedQuizData.success
        ? (completedQuizData.quizIds || []).map((id) => Number(id))
        : [],
    );

    const myReviewers = reviewers.filter(
      (reviewer) => Number(reviewer.uploaded_by) === Number(parsedUser.id),
    );
    const myQuizzes = quizzes.filter(
      (quiz) => Number(quiz.created_by) === Number(parsedUser.id),
    );
    const availableQuizzes = quizzes.filter(
      (quiz) =>
        Number(quiz.created_by) !== Number(parsedUser.id) &&
        !completedQuizIds.has(Number(quiz.id)),
    );

    if (reviewerCount) {
      reviewerCount.textContent = String(myReviewers.length);
    }

    if (quizTakenCount) {
      quizTakenCount.textContent = String(completedQuizIds.size);
    }

    if (createdQuizCount) {
      createdQuizCount.textContent = String(myQuizzes.length);
    }

    if (availableQuizCount) {
      availableQuizCount.textContent = String(availableQuizzes.length);
    }

    if (focusTitle && focusText && focusMeta) {
      if (availableQuizzes.length > 0) {
        focusTitle.textContent = "You have quizzes waiting.";
        focusText.textContent =
          "Jump into one of the available quizzes to turn your review time into progress.";
        focusMeta.textContent = `${availableQuizzes.length} quiz${availableQuizzes.length === 1 ? "" : "zes"} ready to take.`;
      } else if (myReviewers.length > 0) {
        focusTitle.textContent = "Your reviewer library is growing.";
        focusText.textContent =
          "You already have materials uploaded. Consider turning one into a quiz next.";
        focusMeta.textContent = `${myReviewers.length} reviewer${myReviewers.length === 1 ? "" : "s"} in your collection.`;
      } else {
        focusTitle.textContent = "Start by uploading your first reviewer.";
        focusText.textContent =
          "Build your study hub with reviewers and quizzes so everything stays organized in one place.";
        focusMeta.textContent = "Your dashboard is ready for its first activity.";
      }
    }

    const recentActivity = [
      ...reviewers.map((reviewer) => ({
        createdAt: reviewer.created_at,
        title: reviewer.title || "Untitled Reviewer",
        type: "reviewer",
        icon: "../icons/pdf-icon.png",
        meta: `${reviewer.uploader || "Unknown"} uploaded a reviewer on ${formatDashboardDate(reviewer.created_at)}`,
      })),
      ...quizzes.map((quiz) => ({
        createdAt: quiz.created_at,
        title: quiz.title || "Untitled Quiz",
        type: "quiz",
        icon: "../icons/kwis-icon.png",
        meta: `${quiz.creator_username || "Unknown"} created a quiz on ${formatDashboardDate(quiz.created_at)}`,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    renderHomeRecentActivity(recentActivity);
  } catch (error) {
    console.error(error);

    if (focusTitle && focusText && focusMeta) {
      focusTitle.textContent = "Your dashboard is loading.";
      focusText.textContent =
        "We could not load your latest stats right now, but your study spaces are still available.";
      focusMeta.textContent = "Try refreshing in a moment.";
    }

    renderHomeRecentActivity([]);
  }
}

document.querySelectorAll("[data-home-target]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSection(button.dataset.homeTarget);
  });
});

document.addEventListener("dashboard:sectionchange", (event) => {
  const section = event.detail?.section;

  if (section === "home-section") {
    loadHomeOverview();
    return;
  }

  if (section === "progress-section") {
    loadProgressOverview();
  }
});

loadHomeOverview();
loadProgressOverview();

/* LOGOUT FUNCTIONALITY */
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Show logout alert
    showAlert("Logging out...", "info");

    // Clear user data from localStorage
    localStorage.removeItem("user");

    setTimeout(() => {
      // Replace history to prevent back button
      history.replaceState(null, "", "login.html");

      // Redirect to login
      window.location.href = "login.html";
    }, 500);
  });
}



