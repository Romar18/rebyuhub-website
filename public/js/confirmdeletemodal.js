let reviewerToDelete = null;

function confirmDelete(id) {
  reviewerToDelete = id;

  showAlert("You are about to delete a reviewer.", "warning");

  const modal = document.getElementById("deleteModal");
  modal.classList.add("active");
}

document.getElementById("cancelDeleteBtn").onclick = () => {
  const modal = document.getElementById("deleteModal");

  modal.classList.remove("active");

  reviewerToDelete = null;
};

document.getElementById("confirmDeleteBtn").onclick = async () => {
  if (!reviewerToDelete) return;

  try {
    const res = await fetch(`/api/reviewer/${reviewerToDelete}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (data.success) {
      showAlert("Reviewer deleted successfully.", "success");

      loadReviewers();
    } else {
      showAlert("Delete failed.", "danger");
    }
  } catch (err) {
    console.error(err);

    showAlert("Delete failed. Server error.", "danger");
  }

  reviewerToDelete = null;

  document.getElementById("deleteModal").classList.remove("active");
};
