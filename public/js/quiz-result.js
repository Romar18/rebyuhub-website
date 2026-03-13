const resultElements = {
  title: document.getElementById("resultQuizTitle"),
  category: document.getElementById("resultCategory"),
  summary: document.getElementById("resultSummary"),
  score: document.getElementById("resultScore"),
  percentage: document.getElementById("resultPercentage"),
  timeTaken: document.getElementById("resultTimeTaken"),
  leaderboard: document.getElementById("leaderboardList"),
  retry: document.getElementById("retryQuizBtn"),
  viewLeaderboard: document.getElementById("viewLeaderboardBtn"),
  leaderboardCard: document.getElementById("leaderboardCard"),
};

const resultParams = new URLSearchParams(window.location.search);
const attemptId = Number(resultParams.get("attemptId"));
const quizId = Number(resultParams.get("quizId"));

function renderResult(resultData) {
  const quizTitle =
    resultData?.quiz?.title ||
    resultData?.attempt?.quiz_title ||
    "Quiz Result";
  const quizCategory =
    resultData?.quiz?.category ||
    resultData?.attempt?.quiz_category ||
    "Result";
  const score = resultData?.result?.score ?? resultData?.attempt?.score ?? 0;
  const totalQuestions =
    resultData?.result?.totalQuestions ?? resultData?.attempt?.total_questions ?? 0;
  const percentage =
    resultData?.result?.percentage ??
    (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0);
  const timeTaken =
    resultData?.result?.timeTaken ||
    formatTimeTaken(
      resultData?.attempt?.started_at,
      resultData?.attempt?.finished_at || resultData?.attempt?.completed_at,
    );

  resultElements.title.textContent = quizTitle;
  resultElements.category.textContent = quizCategory;
  resultElements.summary.textContent = `You answered ${score} out of ${totalQuestions} correctly.`;
  resultElements.score.textContent = `${score} / ${totalQuestions}`;
  resultElements.percentage.textContent = `${percentage}%`;
  resultElements.timeTaken.textContent = timeTaken;
}

function formatTimeTaken(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "0s";
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(finishedAt).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return "0s";
  }

  const totalSeconds = Math.round((endTime - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function renderLeaderboard(rows) {
  resultElements.leaderboard.innerHTML = "";

  if (!rows.length) {
    resultElements.leaderboard.innerHTML = `
      <div class="leaderboard-row">
        <div class="leaderboard-rank">-</div>
        <div class="leaderboard-meta">
          <strong>No attempts yet</strong>
          <span>Be the first to complete this quiz.</span>
        </div>
        <div class="leaderboard-score">0%</div>
      </div>
    `;
    return;
  }

  rows.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    row.innerHTML = `
      <div class="leaderboard-rank">${entry.rank}</div>
      <div class="leaderboard-meta">
        <strong>${entry.username || "Unknown"}</strong>
        <span>${entry.score} / ${entry.total_questions} correct</span>
      </div>
      <div class="leaderboard-score">${entry.percentage}%</div>
    `;
    resultElements.leaderboard.appendChild(row);
  });
}

function setLeaderboardVisibility(isVisible) {
  if (!resultElements.leaderboardCard || !resultElements.viewLeaderboard) {
    return;
  }

  resultElements.leaderboardCard.classList.toggle(
    "leaderboard-collapsed",
    !isVisible,
  );
  resultElements.viewLeaderboard.setAttribute("aria-expanded", String(isVisible));
  resultElements.viewLeaderboard.textContent = isVisible
    ? "Hide Leaderboard"
    : "View Leaderboard";
}

async function loadResultFallback() {
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    return null;
  }

  const response = await fetch(`/api/quiz-attempts/${attemptId}`);
  const data = await response.json();

  if (!data.success) {
    return null;
  }

  return data;
}

async function loadLeaderboard() {
  if (!Number.isInteger(quizId) || quizId <= 0) {
    return;
  }

  try {
    const response = await fetch(`/api/quiz-leaderboard/${quizId}`);
    const data = await response.json();

    if (!data.success) {
      return;
    }

    renderLeaderboard(data.leaderboard || []);
  } catch (error) {
    console.error(error);
  }
}

async function initializeResultPage() {
  let resultData = null;

  try {
    const cached = sessionStorage.getItem("latestQuizResult");

    if (cached) {
      const parsed = JSON.parse(cached);

      if (Number(parsed?.attemptId) === attemptId) {
        resultData = parsed;
      }
    }
  } catch (error) {
    console.error(error);
  }

  if (!resultData) {
    resultData = await loadResultFallback();
  }

  if (!resultData) {
    resultElements.summary.textContent =
      "We couldn’t load this quiz result. Please try another attempt.";
    return;
  }

  renderResult(resultData);
  await loadLeaderboard();
}

resultElements.retry?.addEventListener("click", () => {
  if (!Number.isInteger(quizId) || quizId <= 0) {
    showAlert("Quiz information is missing.", "warning");
    return;
  }

  window.location.href = `quiz.html?quizId=${quizId}`;
});

resultElements.viewLeaderboard?.addEventListener("click", () => {
  const shouldShow = resultElements.leaderboardCard?.classList.contains(
    "leaderboard-collapsed",
  );
  setLeaderboardVisibility(shouldShow);

  if (shouldShow) {
    resultElements.leaderboardCard?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
});

setLeaderboardVisibility(false);
initializeResultPage();
