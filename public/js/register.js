const cards = document.querySelectorAll(".form-card");
const navControls = document.querySelectorAll(".next-control, .back-control");
const form = document.getElementById("registerForm");

/* -----------------------------
CARD NAVIGATION
----------------------------- */

function updateStepIndicator(cardId) {
  const steps = document.querySelectorAll(".step");

  let stepIndex = 1;

  if (cardId === "#card1") stepIndex = 1;
  if (cardId === "#card2") stepIndex = 2;
  if (cardId === "#card3") stepIndex = 3;

  steps.forEach((step, i) => {
    step.classList.remove("active");

    if (i + 1 <= stepIndex) {
      step.classList.add("active");
    }
  });
}

function showCard(id, direction) {
  cards.forEach((card) => {
    card.classList.remove("active", "slide-left", "slide-right");
  });

  const target = document.querySelector(id);

  if (direction === "next") {
    target.classList.add("slide-left");
  } else if (direction === "back") {
    target.classList.add("slide-right");
  }

  target.classList.add("active");

  updateStepIndicator(id);
}

function getCurrentCard() {
  return document.querySelector(".form-card.active");
}

/* -----------------------------
CARD VALIDATION
----------------------------- */

function validateCard(card) {
  const inputs = card.querySelectorAll("input, select");

  for (let input of inputs) {
    /* gender radio validation */

    if (input.type === "radio") {
      const checked = card.querySelector("input[name='gender']:checked");

      if (!checked) {
        showAlert("Please select your gender", "warning");
        return false;
      }

      break;
    }

    /* skip file input */

    if (input.type === "file") {
      continue;
    }

    /* empty check */

    if (!input.value.trim()) {
      showAlert("Please complete all fields", "warning");
      return false;
    }

    /* fullname validation */

    if (input.id === "fullname") {
      if (input.value.trim().length < 3) {
        showAlert("Full name must be at least 3 characters", "warning");
        return false;
      }
    }

    /* email validation */

    if (input.type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(input.value)) {
        showAlert("Enter a valid email address", "warning");
        return false;
      }
    }
  }

  /* password validation */

  if (card.id === "card1") {
    const pass = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (pass !== confirm) {
      document.getElementById("errorMessage").style.display = "block";

      showAlert("Passwords do not match", "danger");

      return false;
    }
  }

  return true;
}

/* -----------------------------
NAVIGATION BUTTONS
----------------------------- */

navControls.forEach((btn) => {
  btn.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");

    if (!targetId || !targetId.startsWith("#")) return;

    e.preventDefault();

    const currentCard = getCurrentCard();

    const currentIndex = [...cards].indexOf(currentCard);

    const targetIndex = [...cards].indexOf(document.querySelector(targetId));

    /* validate when going forward */

    if (targetIndex > currentIndex) {
      if (!validateCard(currentCard)) return;
    }

    if (targetIndex > currentIndex) {
      showCard(targetId, "next");
    } else {
      showCard(targetId, "back");
    }
  });
});

/* -----------------------------
REGISTER SUBMIT
----------------------------- */

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const currentCard = getCurrentCard();

  if (!validateCard(currentCard)) return;

  const formData = new FormData();

  formData.append("fullname", document.getElementById("fullname").value.trim());
  formData.append("username", document.getElementById("username").value.trim());
  formData.append("email", document.getElementById("email").value.trim());
  formData.append("password", document.getElementById("password").value);

  formData.append("birthdate", document.getElementById("birthdate").value);

  formData.append(
    "gender",
    document.querySelector("input[name='gender']:checked").value,
  );

  formData.append("program", document.getElementById("program").value.trim());
  formData.append("yearLevel", document.getElementById("yearLevel").value);
  formData.append(
    "university",
    document.getElementById("university").value.trim(),
  );

  /* profile picture optional */

  const profilePictureInput = document.getElementById("profilePicture");

  if (profilePictureInput && profilePictureInput.files.length > 0) {
    formData.append("profilePicture", profilePictureInput.files[0]);
  }

  fetch("/api/register", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showAlert("Account created successfully!", "success");

        setTimeout(() => {
          history.replaceState(null, "", "login.html");
          window.location.href = "login.html";
        }, 1200);
      } else {
        showAlert(data.message, "danger");
      }
    })
    .catch((error) => {
      console.error("Registration error:", error);

      showAlert("An error occurred. Please try again.", "danger");
    });
});

/* -----------------------------
PASSWORD CONFIRM FIX
----------------------------- */

document.getElementById("confirmPassword").addEventListener("input", () => {
  document.getElementById("errorMessage").style.display = "none";
});
