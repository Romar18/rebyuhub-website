function showAlert(message, type = "info") {
  const container = document.getElementById("alert-container");

  if (!container) {
    console.error("Alert container not found");
    return;
  }

  const alert = document.createElement("div");
  alert.className = `custom-alert alert-${type}`;
  alert.textContent = message;

  container.appendChild(alert);

  // Auto remove after 3 seconds
  setTimeout(() => {
    alert.remove();
  }, 3000);
}