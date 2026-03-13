/* -----------------------------
CHECK IF USER IS ALREADY LOGGED IN
----------------------------- */

const user = localStorage.getItem("user")
const currentPage = window.location.pathname

if (user && (currentPage.includes("login.html") || currentPage.includes("register.html"))) {

  history.replaceState(null,"","/pages/dashboard.html")
  window.location.href = "/pages/dashboard.html"

}


/* -----------------------------
SHOW / HIDE PASSWORD
----------------------------- */

function togglePassword(id, btn){

  const field = document.getElementById(id)

  if(field.type === "password"){
    field.type = "text"
    btn.innerText = "Hide"
  }else{
    field.type = "password"
    btn.innerText = "Show"
  }

}


/* -----------------------------
PASSWORD VALIDATION
----------------------------- */

function validateForm(){

  const pass = document.getElementById("password")?.value
  const confirm = document.getElementById("confirmPassword")?.value
  const error = document.getElementById("errorMessage")

  if(pass !== confirm){

    if(error) error.style.display = "block"

    return false
  }

  return true

}


/* -----------------------------
LOGIN
----------------------------- */

const loginForm = document.getElementById("loginForm")

if(loginForm){

  loginForm.addEventListener("submit", async function(e){

    e.preventDefault()

    const username = document.getElementById("username").value.trim()
    const password = document.getElementById("password").value

    if(!username || !password){

      showAlert("Please enter username and password","warning")
      return

    }

    try{

      const response = await fetch("/api/login",{

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({
          username,
          password
        })

      })

      const data = await response.json()

      if(data.success){

        localStorage.setItem("user", JSON.stringify(data.user))

        showAlert("Login successful","success")

        setTimeout(()=>{

          document.getElementById("page-content")?.classList.add("fade-out")
          document.getElementById("loading-screen")?.classList.add("active")

          setTimeout(()=>{

            history.replaceState(null,"","/pages/dashboard.html")
            window.location.href="/pages/dashboard.html"

          },1500)

        },500)

      }
      else{

        showAlert(data.message || "Login failed","danger")

      }

    }
    catch(err){

      console.error("Login error:",err)
      showAlert("Server error. Please try again.","danger")

    }

  })

}


/* -----------------------------
GLOW CURSOR EFFECT
----------------------------- */

const glow = document.getElementById("glow")

if(glow){

  document.addEventListener("mousemove",(e)=>{

    glow.style.left = (e.clientX - 150) + "px"
    glow.style.top = (e.clientY - 150) + "px"

  })

}
