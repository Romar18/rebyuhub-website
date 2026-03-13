document.addEventListener("DOMContentLoaded", () => {
  const quizSections = document.getElementById("quizSections");
  const myQuizGrid = document.getElementById("myQuizGrid");
  const takenQuizGrid = document.getElementById("takenQuizGrid");
  const otherQuizGrid = document.getElementById("otherQuizGrid");
  const myQuizEmpty = document.getElementById("myQuizEmpty");
  const takenQuizEmpty = document.getElementById("takenQuizEmpty");
  const otherQuizEmpty = document.getElementById("otherQuizEmpty");
  const quizSearch = document.getElementById("quizSearch");
  const quizFilters = document.querySelector(".quiz-filters");
  const quizEmptyState = document.getElementById("quizEmptyState");
  const quizModal = document.getElementById("quizModal");
  const openQuizModal = document.getElementById("openQuizModal");
  const closeQuizModal = document.getElementById("closeQuizModal");
  const cancelQuizBtn = document.getElementById("cancelQuizBtn");
  const saveQuizBtn = document.getElementById("saveQuizBtn");
  const addQuestionBtn = document.getElementById("addQuestionBtn");
  const quizQuestionsList = document.getElementById("quizQuestionsList");
  const quizCategorySelect = document.getElementById("quizCategory");
  const quizOrderMode = document.getElementById("quizOrderMode");
  const customQuizCategory = document.getElementById("customQuizCategory");

  if (
    !quizSections ||
    !myQuizGrid ||
    !takenQuizGrid ||
    !otherQuizGrid ||
    !quizSearch ||
    !quizFilters ||
    !quizQuestionsList
  ) {
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  let quizzes = [];
  let completedQuizIds = new Set();
  let activeCategory = "all";
  let quizzesLoaded = false;
  const expandedSections = {
    my: false,
    taken: false,
    other: false,
  };

  function capitalize(text) {
    return String(text || "")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "Unknown date";
    }

    return new Date(dateValue).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCategoryFontSize(categoryText) {
    const length = String(categoryText || "").trim().length;

    if (length >= 24) {
      return "0.68rem";
    }

    if (length >= 18) {
      return "0.71rem";
    }

    if (length >= 14) {
      return "0.74rem";
    }

    return "0.78rem";
  }

  function createQuizCard(quiz) {
    const categoryLabel = capitalize(quiz.category || "general");
    const card = document.createElement("article");
    card.className = "quiz-card";
    card.innerHTML = `
      <div class="quiz-card-top">
        <div class="quiz-card-icon-wrap">
          <img src="../icons/kwis-icon.png" alt="quiz icon">
        </div>
        <span
          class="quiz-category-tag"
          style="font-size: ${getCategoryFontSize(categoryLabel)};"
        >${categoryLabel}</span>
      </div>
      <div class="quiz-card-main">
        <h3 class="quiz-card-title">${quiz.title}</h3>
        <p class="quiz-card-description">${quiz.description || "No description provided yet."}</p>
      </div>
      <div class="quiz-meta">
        <span>${formatDate(quiz.created_at)}</span>
        <span>|</span>
        <span>${quiz.question_count || 0} Questions</span>
      </div>
      <div class="quiz-card-actions">
        <a class="quiz-count quiz-user-link" href="profile.html?userId=${quiz.created_by}">
          ${quiz.creator_username || "Unknown"}
        </a>
        <button class="quiz-btn start-quiz-btn" type="button">Start Quiz</button>
      </div>
    `;

    card
      .querySelector(".start-quiz-btn")
      .addEventListener("click", () => {
        window.location.href = `quiz.html?quizId=${quiz.id}`;
      });

    return card;
  }

  function renderQuizGroup({
    sectionId,
    grid,
    emptyState,
    toggleSelector,
    quizzes: items,
    sectionKey,
  }) {
    const section = document.getElementById(sectionId);
    const toggleButton = document.querySelector(toggleSelector);
    const hasItems = items.length > 0;
    const needsToggle = items.length > 3;

    if (section) {
      section.style.display = "flex";
      section.classList.toggle("expanded", expandedSections[sectionKey]);
    }

    grid.innerHTML = "";
    items.forEach((quiz) => {
      grid.appendChild(createQuizCard(quiz));
    });

    if (emptyState) {
      emptyState.style.display = hasItems ? "none" : "block";
    }

    if (toggleButton) {
      toggleButton.style.display = needsToggle ? "inline-flex" : "none";
      toggleButton.textContent = expandedSections[sectionKey] ? "Collapse" : "See All";
    }
  }

  function questionTemplateId() {
    return `q-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  }

  function openModal() {
    quizModal.classList.add("active");
  }

  function closeModal() {
    quizModal.classList.remove("active");
  }

  function isRandomQuizMode() {
    return quizOrderMode?.value === "random";
  }

  function syncQuestionOrderMode() {
    const randomMode = isRandomQuizMode();

    quizQuestionsList.querySelectorAll(".question-builder-card").forEach((card, index) => {
      const orderInput = card.querySelector(".question-order-input");
      const orderRandomValue = card.querySelector(".question-order-random");

      if (!orderInput || !orderRandomValue) {
        return;
      }

      if (randomMode) {
        orderInput.style.display = "none";
        orderInput.disabled = true;
        orderRandomValue.style.display = "flex";
      } else {
        orderInput.style.display = "block";
        orderInput.disabled = false;
        orderRandomValue.style.display = "none";
      }

      if (!randomMode && !orderInput.value) {
        orderInput.value = index + 1;
      }
    });
  }

  function resetQuizForm() {
    document.getElementById("quizTitle").value = "";
    document.getElementById("quizDescription").value = "";
    quizCategorySelect.value = "";
    if (quizOrderMode) {
      quizOrderMode.value = "ordered";
    }
    customQuizCategory.value = "";
    customQuizCategory.style.display = "none";
    quizQuestionsList.innerHTML = "";
    addQuestionCard();
    syncQuestionOrderMode();
  }

  function updateQuestionNumbers() {
    quizQuestionsList.querySelectorAll(".question-builder-card").forEach((card, index) => {
      card.dataset.order = index + 1;
      card.querySelector(".question-builder-index").textContent =
        `Question ${index + 1}`;

      if (!isRandomQuizMode()) {
        card.querySelector(".question-order-input").value = index + 1;
      }
    });

    syncQuestionOrderMode();
  }

  function getQuestionType(card) {
    return card.querySelector(".question-type-select").value;
  }

  function createOptionRow(questionId, type, value = "", isCorrect = false) {
    const optionRow = document.createElement("div");
    optionRow.className = "builder-option-row";

    const selectorType = type === "checkboxes" ? "checkbox" : "radio";
    const checkedAttr = isCorrect ? "checked" : "";

    optionRow.innerHTML = `
      <label class="builder-option-selector">
        <input
          type="${selectorType}"
          class="builder-correct-input"
          name="correct-${questionId}"
          ${checkedAttr}
        >
        <span class="builder-selector-ui"></span>
      </label>
      <input
        type="text"
        class="builder-option-text"
        placeholder="Option"
        value="${value.replace(/"/g, "&quot;")}"
      >
      <button type="button" class="builder-option-delete">Delete</button>
    `;

    optionRow
      .querySelector(".builder-option-delete")
      .addEventListener("click", () => {
        const optionsList = optionRow.parentElement;

        if (optionsList.children.length <= 2) {
          showAlert("Each question needs at least two options.", "warning");
          return;
        }

        optionRow.remove();
      });

    return optionRow;
  }

  function syncOptionInputTypes(questionCard) {
    const type = getQuestionType(questionCard);
    const questionId = questionCard.dataset.questionId;
    const selectors = questionCard.querySelectorAll(".builder-correct-input");

    selectors.forEach((input) => {
      input.type = type === "checkboxes" ? "checkbox" : "radio";
      input.name = type === "checkboxes" ? "" : `correct-${questionId}`;
    });
  }

  function renderQuestionAnswerArea(questionCard, seed = null) {
    const type = getQuestionType(questionCard);
    const answerArea = questionCard.querySelector(".question-answer-area");
    const questionId = questionCard.dataset.questionId;

    if (type === "short_answer") {
      answerArea.innerHTML = `
        <div class="short-answer-builder">
          <label class="modal-label" for="short-answer-${questionId}">Accepted Answer</label>
          <input
            type="text"
            id="short-answer-${questionId}"
            class="short-answer-input"
            placeholder="Enter the correct short answer"
            value="${seed?.shortAnswer?.replace(/"/g, "&quot;") || ""}"
          >
        </div>
      `;
      return;
    }

    answerArea.innerHTML = `
      <div class="question-answer-head">
        <span class="modal-label">Answer Options</span>
        <button type="button" class="quiz-btn secondary add-option-btn">Add Option</button>
      </div>
      <div class="builder-option-list"></div>
    `;

    const optionList = answerArea.querySelector(".builder-option-list");
    const initialOptions =
      seed?.options?.length >= 2
        ? seed.options
        : [
            { optionText: "", isCorrect: true },
            { optionText: "", isCorrect: false },
          ];

    initialOptions.forEach((option) => {
      optionList.appendChild(
        createOptionRow(questionId, type, option.optionText || "", !!option.isCorrect),
      );
    });

    answerArea
      .querySelector(".add-option-btn")
      .addEventListener("click", () => {
        optionList.appendChild(createOptionRow(questionId, type));
      });

    syncOptionInputTypes(questionCard);
  }

  function addQuestionCard(seed = null) {
    const questionCard = document.createElement("article");
    questionCard.className = "question-builder-card";
    questionCard.dataset.questionId = questionTemplateId();

    const questionType = seed?.questionType || "multiple_choice";

    questionCard.innerHTML = `
      <div class="question-card-accent"></div>
      <div class="question-builder-header">
        <div>
          <span class="question-builder-index">Question</span>
        </div>
        <div class="question-card-actions">
          <button type="button" class="question-duplicate-btn">Duplicate</button>
          <button type="button" class="question-remove-btn">Delete</button>
        </div>
      </div>

      <div class="question-builder-main">
        <div class="question-title-row">
          <label class="modal-label" for="question-text-${questionCard.dataset.questionId}">Question</label>
          <input
            type="text"
            id="question-text-${questionCard.dataset.questionId}"
            class="question-text-input"
            placeholder="Type your question here"
            value="${seed?.questionText?.replace(/"/g, "&quot;") || ""}"
          >
        </div>

        <div class="question-settings-grid">
          <div class="question-setting-field">
            <label class="modal-label">Points</label>
            <input
              type="number"
              min="1"
              class="question-points-input"
              value="${seed?.points || 1}"
            >
          </div>

          <div class="question-setting-field">
            <label class="modal-label">Question Type</label>
            <select class="question-type-select">
              <option value="multiple_choice" ${questionType === "multiple_choice" ? "selected" : ""}>Multiple Choice</option>
              <option value="checkboxes" ${questionType === "checkboxes" ? "selected" : ""}>Checkboxes</option>
              <option value="short_answer" ${questionType === "short_answer" ? "selected" : ""}>Short Answer</option>
            </select>
          </div>

          <div class="question-setting-field question-order-field">
            <label class="modal-label">Order</label>
            <input type="number" min="1" class="question-order-input" value="${seed?.questionOrder || 1}">
            <div class="question-order-random">Random</div>
          </div>
        </div>

        <div class="question-answer-area"></div>
      </div>
    `;

    questionCard
      .querySelector(".question-type-select")
      .addEventListener("change", () => renderQuestionAnswerArea(questionCard));

    questionCard
      .querySelector(".question-remove-btn")
      .addEventListener("click", () => {
        if (quizQuestionsList.children.length <= 1) {
          showAlert("Your quiz needs at least one question.", "warning");
          return;
        }

        questionCard.remove();
        updateQuestionNumbers();
      });

    questionCard
      .querySelector(".question-duplicate-btn")
      .addEventListener("click", () => {
        const duplicated = extractQuestionData(questionCard, true);

        if (!duplicated) {
          return;
        }

        addQuestionCard(duplicated);
        showAlert("Question duplicated.", "info");
      });

    renderQuestionAnswerArea(questionCard, seed);
    quizQuestionsList.appendChild(questionCard);
    questionCard.classList.add("question-builder-card-enter");
    updateQuestionNumbers();
  }

  function extractQuestionData(questionCard, forDuplicate = false) {
    const questionType = getQuestionType(questionCard);
    const questionText = questionCard.querySelector(".question-text-input").value.trim();
    const points = Number(questionCard.querySelector(".question-points-input").value) || 1;
    const questionOrder = isRandomQuizMode()
      ? Number(questionCard.dataset.order) || 1
      : Number(questionCard.querySelector(".question-order-input").value) ||
        Number(questionCard.dataset.order) ||
        1;
    const required = false;

    if (!questionText && !forDuplicate) {
      showAlert("Every question needs text before saving.", "warning");
      return null;
    }

    if (questionType === "short_answer") {
      const shortAnswer = questionCard
        .querySelector(".short-answer-input")
        ?.value.trim();

      if (!shortAnswer && !forDuplicate) {
        showAlert("Short answer questions need an accepted answer.", "warning");
        return null;
      }

      return {
        questionText,
        questionType,
        points,
        questionOrder,
        required,
        shortAnswer: shortAnswer || "",
      };
    }

    const optionRows = questionCard.querySelectorAll(".builder-option-row");
    const options = [];

    optionRows.forEach((row) => {
      const optionText = row.querySelector(".builder-option-text").value.trim();
      const isCorrect = row.querySelector(".builder-correct-input").checked;

      if (optionText) {
        options.push({
          optionText,
          isCorrect,
        });
      }
    });

    if (options.length < 2 && !forDuplicate) {
      showAlert("Choice questions need at least two options.", "warning");
      return null;
    }

    const correctCount = options.filter((option) => option.isCorrect).length;

    if (questionType === "multiple_choice" && correctCount !== 1 && !forDuplicate) {
      showAlert(
        "Multiple choice questions need exactly one correct answer.",
        "warning",
      );
      return null;
    }

    if (questionType === "checkboxes" && correctCount < 1 && !forDuplicate) {
      showAlert(
        "Checkbox questions need at least one correct answer.",
        "warning",
      );
      return null;
    }

    return {
      questionText,
      questionType,
      points,
      questionOrder,
      required,
      options,
    };
  }

  function collectQuizPayload() {
    const title = document.getElementById("quizTitle").value.trim();
    const description = document.getElementById("quizDescription").value.trim();
    let category = quizCategorySelect.value.trim();

    if (!currentUser) {
      showAlert("You must be logged in to create a quiz.", "danger");
      return null;
    }

    if (category === "other") {
      category = customQuizCategory.value.trim();
    }

    if (!title || !category) {
      showAlert("Please complete the quiz title and category.", "warning");
      return null;
    }

    const questions = [];
    const usedOrders = new Set();
    const randomMode = isRandomQuizMode();
    const questionCards = quizQuestionsList.querySelectorAll(".question-builder-card");

    for (const [index, card] of questionCards.entries()) {
      const question = extractQuestionData(card);

      if (!question || !question.questionText) {
        showAlert(`Question ${index + 1} is incomplete.`, "warning");
        return null;
      }

      if (!randomMode && usedOrders.has(question.questionOrder)) {
        showAlert(
          `Duplicate question order found: ${question.questionOrder}. Each question order must be unique.`,
          "warning",
        );
        return null;
      }

      if (!randomMode) {
        usedOrders.add(question.questionOrder);
      }

      if (question.questionType === "short_answer") {
        questions.push({
          questionText: question.questionText,
          questionType: question.questionType,
          points: question.points,
          required: question.required,
          questionOrder: randomMode ? index + 1 : question.questionOrder || index + 1,
          options: [
            {
              optionText: question.shortAnswer,
              isCorrect: true,
            },
          ],
        });
        continue;
      }

      questions.push({
        questionText: question.questionText,
        questionType: question.questionType,
        points: question.points,
        required: question.required,
        questionOrder: randomMode ? index + 1 : question.questionOrder || index + 1,
        options: question.options,
      });
    }

    return {
      title,
      description,
      category,
      orderMode: quizOrderMode?.value === "random" ? "random" : "ordered",
      createdBy: currentUser.id,
      questions,
    };
  }

  function renderQuizFilters(categories) {
    quizFilters.innerHTML = "";

    const allButton = document.createElement("button");
    allButton.className = "filter-btn active";
    allButton.dataset.filter = "all";
    allButton.textContent = "All";
    quizFilters.appendChild(allButton);

    categories.forEach((category) => {
      const button = document.createElement("button");
      button.className = "filter-btn";
      button.dataset.filter = category.category;
      button.textContent = capitalize(category.category);
      quizFilters.appendChild(button);
    });

    quizFilters.querySelectorAll(".filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        quizFilters
          .querySelectorAll(".filter-btn")
          .forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        activeCategory = button.dataset.filter;
        renderQuizzes();
      });
    });
  }

  function renderQuizzes() {
    const searchText = quizSearch.value.trim().toLowerCase();

    const filteredQuizzes = quizzes.filter((quiz) => {
      const titleMatch = (quiz.title || "").toLowerCase().includes(searchText);
      const categoryMatch =
        activeCategory === "all" || quiz.category === activeCategory;
      return titleMatch && categoryMatch;
    });

    const myQuizzes = filteredQuizzes.filter(
      (quiz) => Number(quiz.created_by) === Number(currentUser?.id),
    );
    const takenQuizzes = filteredQuizzes.filter((quiz) =>
      completedQuizIds.has(Number(quiz.id)),
    );
    const otherQuizzes = filteredQuizzes.filter(
      (quiz) =>
        Number(quiz.created_by) !== Number(currentUser?.id) &&
        !completedQuizIds.has(Number(quiz.id)),
    );

    renderQuizGroup({
      sectionId: "myQuizzesSection",
      grid: myQuizGrid,
      emptyState: myQuizEmpty,
      toggleSelector: '[data-group-toggle="my"]',
      quizzes: myQuizzes,
      sectionKey: "my",
    });
    renderQuizGroup({
      sectionId: "takenQuizzesSection",
      grid: takenQuizGrid,
      emptyState: takenQuizEmpty,
      toggleSelector: '[data-group-toggle="taken"]',
      quizzes: takenQuizzes,
      sectionKey: "taken",
    });
    renderQuizGroup({
      sectionId: "otherQuizzesSection",
      grid: otherQuizGrid,
      emptyState: otherQuizEmpty,
      toggleSelector: '[data-group-toggle="other"]',
      quizzes: otherQuizzes,
      sectionKey: "other",
    });

    quizSections.style.display = "flex";
    quizEmptyState.classList.remove("show");
  }

  async function loadQuizCategories() {
    const response = await fetch("/api/quiz-categories");
    const data = await response.json();

    if (!data.success) {
      return;
    }

    renderQuizFilters(data.categories);
  }

  async function loadQuizzes() {
    try {
      const [quizResponse, attemptsResponse] = await Promise.all([
        fetch("/api/quizzes"),
        currentUser
          ? fetch(`/api/users/${currentUser.id}/completed-quizzes`)
          : Promise.resolve({
              json: async () => ({ success: true, quizIds: [] }),
            }),
      ]);
      const data = await quizResponse.json();
      const attemptsData = await attemptsResponse.json();

      if (!data.success) {
        showAlert("Unable to load quizzes right now.", "danger");
        return;
      }

      completedQuizIds = new Set(
        attemptsData.success
          ? (attemptsData.quizIds || []).map((id) => Number(id))
          : [],
      );

      quizzes = data.quizzes || [];
      renderQuizzes();
      await loadQuizCategories();
    } catch (error) {
      console.error(error);
      showAlert("Unable to load quizzes right now.", "danger");
    }
  }

  quizSearch.addEventListener("input", renderQuizzes);

  document.querySelectorAll("[data-group-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.groupToggle;
      const section = button.closest(".quiz-group");

      if (!sectionKey) {
        return;
      }

      if (section) {
        section.classList.add("quiz-group-animating");
        section.classList.remove("quiz-group-expand-enter", "quiz-group-collapse-enter");
      }

      const isExpanding = !expandedSections[sectionKey];
      expandedSections[sectionKey] = isExpanding;
      renderQuizzes();

      if (section) {
        section.classList.add(
          isExpanding ? "quiz-group-expand-enter" : "quiz-group-collapse-enter",
        );
        window.setTimeout(() => {
          section.classList.remove(
            "quiz-group-animating",
            "quiz-group-expand-enter",
            "quiz-group-collapse-enter",
          );
        }, 360);
      }
    });
  });

  document.querySelectorAll(".quiz-group-grid").forEach((grid) => {
    grid.addEventListener(
      "wheel",
      (event) => {
        if (grid.closest(".quiz-group")?.classList.contains("expanded")) {
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

  quizFilters.addEventListener("wheel", (event) => {
    event.preventDefault();
    quizFilters.scrollLeft += event.deltaY;
  });

  if (!quizzesLoaded) {
    loadQuizzes();
    quizzesLoaded = true;
  }

  document.addEventListener("dashboard:sectionchange", (event) => {
    if (event.detail?.section === "quizzes-section") {
      loadQuizzes();
      quizzesLoaded = true;
    }
  });

  openQuizModal?.addEventListener("click", () => {
    resetQuizForm();
    openModal();
  });

  quizCategorySelect?.addEventListener("change", () => {
    const isOtherCategory = quizCategorySelect.value === "other";
    customQuizCategory.style.display = isOtherCategory ? "block" : "none";

    if (!isOtherCategory) {
      customQuizCategory.value = "";
    }
  });

  quizOrderMode?.addEventListener("change", () => {
    syncQuestionOrderMode();
  });

  closeQuizModal?.addEventListener("click", closeModal);
  cancelQuizBtn?.addEventListener("click", closeModal);
  addQuestionBtn?.addEventListener("click", () => addQuestionCard());

  saveQuizBtn?.addEventListener("click", async () => {
    const payload = collectQuizPayload();

    if (!payload) {
      return;
    }

    saveQuizBtn.disabled = true;
    showAlert("Creating quiz...", "info");

    try {
      const response = await fetch("/api/create-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!data.success) {
        showAlert(data.message || "Failed to create quiz.", "danger");
        return;
      }

      closeModal();
      resetQuizForm();
      await loadQuizzes();
      quizzesLoaded = true;
      showAlert("Quiz created successfully.", "success");
    } catch (error) {
      console.error(error);
      showAlert("Failed to create quiz.", "danger");
    } finally {
      saveQuizBtn.disabled = false;
    }
  });

  resetQuizForm();
});
