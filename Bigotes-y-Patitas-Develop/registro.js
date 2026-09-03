document.getElementById("registerForm").addEventListener("submit", function (e) {
  e.preventDefault(); // evita que recargue la página

  const mensaje = document.getElementById("registerMessage");
  mensaje.style.display = "block";

  // redirige al login después de 2 segundos
  setTimeout(() => {
    window.location.href = "login.html";
  }, 2000);
});
