document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const closeModal = document.querySelector(".close");
  const userInfo = document.getElementById("user-info");
  const loginSection = document.getElementById("login-section");
  const teacherOnlySection = document.getElementById("teacher-only-section");
  const studentMessage = document.getElementById("student-message");
  const userNameSpan = document.getElementById("user-name");

  // Authentication state
  let authToken = localStorage.getItem("authToken");
  let currentUser = null;

  // Check authentication status on load
  checkAuthStatus();

  // Authentication functions
  async function checkAuthStatus() {
    if (!authToken) {
      updateUIForLoggedOut();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        currentUser = await response.json();
        updateUIForLoggedIn();
      } else {
        // Token is invalid
        localStorage.removeItem("authToken");
        authToken = null;
        updateUIForLoggedOut();
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      updateUIForLoggedOut();
    }
  }

  function updateUIForLoggedIn() {
    userInfo.classList.remove("hidden");
    loginSection.classList.add("hidden");
    teacherOnlySection.classList.remove("hidden");
    studentMessage.classList.add("hidden");
    userNameSpan.textContent = currentUser.name;
    
    // Show delete buttons for teachers
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.classList.remove("hidden");
    });
  }

  function updateUIForLoggedOut() {
    userInfo.classList.add("hidden");
    loginSection.classList.remove("hidden");
    teacherOnlySection.classList.add("hidden");
    studentMessage.classList.remove("hidden");
    
    // Hide delete buttons for students
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.classList.add("hidden");
    });
  }

  // Login modal handlers
  loginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    loginModal.classList.add("show");
  });

  closeModal.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginModal.classList.remove("show");
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginModal.classList.remove("show");
    }
  });

  // Login form handler
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        authToken = result.token;
        localStorage.setItem("authToken", authToken);
        currentUser = result.user;
        
        loginModal.classList.add("hidden");
        loginModal.classList.remove("show");
        loginForm.reset();
        
        updateUIForLoggedIn();
        showMessage("Logged in successfully!", "success");
      } else {
        showLoginMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showLoginMessage("Login failed. Please try again.", "error");
    }
  });

  // Logout handler
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    // Clear local state
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    
    updateUIForLoggedOut();
    showMessage("Logged out successfully!", "info");
  });

  function showLoginMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = `message ${type}`;
    loginMessage.classList.remove("hidden");
    
    setTimeout(() => {
      loginMessage.classList.add("hidden");
    }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${!currentUser ? 'hidden' : ''}" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
