document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const response = await fetch('http://localhost:8000/api/auth/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const data = await response.json();
    console.log(data); //
    const token = data.access;
    const rol = data.user.role;

    localStorage.setItem('token', token);
    localStorage.setItem('rol', rol);

    // Redirige según el rol
    if (rol === 'admin') {
      window.location.href = 'admin/reporte.html';
    } else if (rol === 'funcionario') {
      window.location.href = 'funcionario/reporte.html';
    }
  } else {
    alert("Credenciales inválidas");
  }
});