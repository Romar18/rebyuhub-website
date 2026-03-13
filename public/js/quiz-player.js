const playerUser = JSON.parse(localStorage.getItem("user") || "null");

if (!playerUser) {
  history.replaceState(null, "", "login.html");
  window.location.href = "login.html";
}

const playerState = {
  attemptId: null,
  quiz: null,
  questions: [],
  currentIndex: 0,
  selectedAnswers: new Map(),
};

const params = new URLSearchParams(window.location.search);
const quizId = Number(params.get("quizId"));

const quizPlayerState = document.getElementById("quizPlayerState");
const quizPrevBtn = document.getElementById("quizPrevBtn");
const quizNextBtn = document.getElementById("quizNextBtn");
const quizPlayerCategory = document.getElementById("quizPlayerCategory");
const quizQuestionCounter = document.getElementById("quizQuestionCounter");
const quizProgressFill = document.getElementById("quizProgressFill");
const quizProgressPercent = document.getElementById("quizProgressPercent");
const quizNextBtnLabel = quizNextBtn?.querySelector("span");

function updateProgress() {
  const total = playerState.questions.length || 1;
  const answeredCount = playerState.selectedAnswers.size;
  const progress = Math.round((answeredCount / total) * 100);

  quizQuestionCounter.textContent = `${playerState.currentIndex + 1} / ${playerState.questions.length}`;
  quizProgressFill.style.width = `${progress}%`;
  quizProgressPercent.textContent = `${progress}%`;
}

function setLoadingState(title, message) {
  quizPlayerState.innerHTML = `
    <div class="quiz-loading-state">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  `;
}

function renderQuestion() {
  const question = playerState.questions[playerState.currentIndex];

  if (!question) {
    return;
  }

  const selectedOptionId = playerState.selectedAnswers.get(question.id);

  quizPlayerCategory.textContent = playerState.quiz.category || "Quiz";
  quizPlayerState.innerHTML = `
    <div class="quiz-question-body">
      <span class="quiz-category-pill">Question ${playerState.currentIndex + 1}</span>
      <h1>${question.question_text}</h1>
      <p class="quiz-question-subtitle">
        ${playerState.quiz.title} • ${playerState.questions.length} total questions
      </p>
      <div class="quiz-options-grid">
        ${question.options
          .map(
            (option, index) => `
            <button
              type="button"
              class="quiz-option-card ${Number(selectedOptionId) === Number(option.id) ? "selected" : ""}"
              data-option-id="${option.id}"
            >
              <span class="quiz-option-label">Option ${index + 1}</span>
              <strong>${option.option_text}</strong>
            </button>
          `,
          )
          .join("")}
      </div>
    </div>
  `;

  quizPlayerState.querySelectorAll(".quiz-option-card").forEach((button) => {
    button.addEventListener("click", () => {
      const optionId = Number(button.dataset.optionId);
      playerState.selectedAnswers.set(question.id, optionId);
      renderQuestion();
      updateProgress();
    });
  });

  quizPrevBtn.disabled = playerState.currentIndex === 0;
  if (quizNextBtnLabel) {
    quizNextBtnLabel.textContent =
      playerState.currentIndex === playerState.questions.length - 1
        ? "Finish Quiz"
        : "Next Question";
  }

  updateProgress();
}

async function saveCurrentAnswer() {
  const question = playerState.questions[playerState.currentIndex];
  const selectedOptionId = playerState.selectedAnswers.get(question.id);

  if (!selectedOptionId) {
    showAlert("Please select an answer before continuing.", "warning");
    return false;
  }

  const response = await fetch("/api/submit-answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attemptId: playerState.attemptId,
      questionId: question.id,
      selectedOptionId,
    }),
  });
  const data = await response.json();

  if (!data.success) {
    showAlert(data.message || "Failed to save answer.", "danger");
    return false;
  }

  return true;
}

async function finishQuiz() {
  setLoadingState("Finishing quiz...", "We’re calculating your final score.");

  const response = await fetch("/api/finish-quiz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attemptId: playerState.attemptId,
    }),
  });
  const data = await response.json();

  if (!data.success) {
    showAlert(data.message || "Failed to finish quiz.", "danger");
    renderQuestion();
    return;
  }

  sessionStorage.setItem(
    "latestQuizResult",
    JSON.stringify({
      attemptId: playerState.attemptId,
      quizId: playerState.quiz.id,
      quiz: playerState.quiz,
      result: data.result,
      attempt: data.attempt,
    }),
  );

  window.location.href = `result.html?attemptId=${playerState.attemptId}&quizId=${playerState.quiz.id}`;
}

quizPrevBtn?.addEventListener("click", () => {
  if (playerState.currentIndex === 0) {
    return;
  }

  playerState.currentIndex -= 1;
  renderQuestion();
});

quizNextBtn?.addEventListener("click", async () => {
  if (!playerState.questions.length) {
    return;
  }

  quizNextBtn.disabled = true;

  try {
    const saved = await saveCurrentAnswer();

    if (!saved) {
      return;
    }

    if (playerState.currentIndex === playerState.questions.length - 1) {
      await finishQuiz();
      return;
    }

    playerState.currentIndex += 1;
    renderQuestion();
  } catch (error) {
    console.error(error);
    showAlert("Something went wrong while saving your answer.", "danger");
  } finally {
    quizNextBtn.disabled = false;
  }
});

async function initializeQuizPlayer() {
  if (!Number.isInteger(quizId) || quizId <= 0) {
    setLoadingState("Quiz not found", "The quiz you selected is missing.");
    return;
  }

  try {
    const response = await fetch("/api/start-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quizId,
        userId: playerUser.id,
      }),
    });
    const data = await response.json();

    if (!data.success) {
      setLoadingState("Unable to start quiz", data.message || "Please try again.");
      return;
    }

    playerState.attemptId = data.attempt.id;
    playerState.quiz = data.quiz;
    playerState.questions = data.questions || [];
    playerState.currentIndex = 0;
    playerState.selectedAnswers.clear();

    renderQuestion();
  } catch (error) {
    console.error(error);
    setLoadingState(
      "Unable to start quiz",
      "We couldn’t load the quiz right now. Please try again later.",
    );
  }
}

initializeQuizPlayer();
