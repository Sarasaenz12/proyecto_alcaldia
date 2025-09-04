document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");
  const modal = document.getElementById("formulario-funcionario");
  const btnCrear = document.querySelector(".btn-crear-fun");
  const modalTitle = modal.querySelector("h2");
  const correoInput = document.getElementById("correo");
  const passwordInput = document.getElementById("password");

  btnCrear.addEventListener("click", () => {
    modalTitle.innerText = "Crear nuevo funcionario";
    document.getElementById("crearFuncionarioForm").reset();
    correoInput.disabled = false;
    passwordInput.disabled = false;
    delete document.getElementById("crearFuncionarioForm").dataset.id;
    modal.style.display = "block";
  });

  window.addEventListener("click", function (e) {
    if (e.target === modal) {
      cerrarModal();
    }
  });

  document.getElementById("crearFuncionarioForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const correo = correoInput.value;
    const password = passwordInput.value;
    const telefono = document.getElementById("telefono").value;

    const form = document.getElementById("crearFuncionarioForm");
    const editandoId = form.dataset.id;

    const payload = {
      email: correo,
      username: correo,
      first_name: nombre,
      last_name: "",
      role: "funcionario",
      dependencia: "",
      telefono: telefono
    };

    if (!editandoId && password) {
      payload.password = password;
      payload.password_confirm = password;
    } else if (editandoId && password) {
      payload.password = password;
      payload.password_confirm = password;
    }

    const url = editandoId
      ? `http://localhost:8000/api/auth/users/${editandoId}/`
      : "http://localhost:8000/api/auth/users/create/";

    const method = editandoId ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(editandoId ? "Funcionario actualizado" : "Funcionario creado con éxito");
      form.reset();
      modal.style.display = "none";
      correoInput.disabled = false;
      passwordInput.disabled = false;
      form.removeAttribute("data-id");

      // SweetAlert para éxito
      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: editandoId ? 'Funcionario actualizado correctamente' : 'Funcionario creado con éxito',
        timer: 2000,
        showConfirmButton: false
      });

      cargarFuncionarios();
    } else {
      const errorData = await response.json();
      console.error("Error al guardar funcionario", errorData);

      // SweetAlert para error
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al guardar funcionario',
        confirmButtonText: 'Aceptar'
      });
    }
  });

  async function cargarFuncionarios() {
    const res = await fetch("http://localhost:8000/api/auth/users/", {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });

    const data = await res.json();
    if (!res.ok) {
      // SweetAlert para error al cargar
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al cargar funcionarios',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const funcionarios = data.results;
    const searchInput = document.getElementById("searchInput").value.toLowerCase();
    const sortBy = document.getElementById("sortBy").value;

    let filtrados = funcionarios.filter(f => {
      return (
        f.first_name.toLowerCase().includes(searchInput) ||
        f.email.toLowerCase().includes(searchInput)
      );
    });

    if (sortBy === "name_asc") filtrados.sort((a, b) => a.first_name.localeCompare(b.first_name));
    else if (sortBy === "name_desc") filtrados.sort((a, b) => b.first_name.localeCompare(a.first_name));
    else if (sortBy === "date_asc") filtrados.sort((a, b) => new Date(a.date_joined) - new Date(b.date_joined));
    else if (sortBy === "date_desc") filtrados.sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined));

    const tbody = document.querySelector("#tabla-funcionarios tbody");
    tbody.innerHTML = "";

    filtrados.forEach(funcionario => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${funcionario.first_name} ${funcionario.last_name}</td>
        <td>${funcionario.email}</td>
        <td class="bton-edit">
          <button class="editar-btn" data-id="${funcionario.id}">Editar</button>
          <button class="eliminar-btn" onclick="eliminarFuncionario(${funcionario.id})">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Agregar listeners después de cargar la tabla
    document.querySelectorAll(".editar-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        editarFuncionario(btn.dataset.id);
      });
    });
  }

  document.getElementById("searchInput").addEventListener("input", cargarFuncionarios);
  document.getElementById("sortBy").addEventListener("change", cargarFuncionarios);
  document.querySelector(".clean-filter").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    document.getElementById("sortBy").selectedIndex = 0;
    cargarFuncionarios();
  });

  window.eliminarFuncionario = async function (id) {
    // SweetAlert para confirmación de eliminación
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Eliminar este funcionario?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const res = await fetch(`http://localhost:8000/api/auth/users/${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      // SweetAlert para éxito en eliminación
      Swal.fire({
        icon: 'success',
        title: '¡Eliminado!',
        text: 'Funcionario eliminado correctamente',
        timer: 2000,
        showConfirmButton: false
      });
      cargarFuncionarios();
    } else {
      // SweetAlert para error en eliminación
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al eliminar funcionario',
        confirmButtonText: 'Aceptar'
      });
    }
  };

  window.editarFuncionario = async function (id) {
    const res = await fetch(`http://localhost:8000/api/auth/users/${id}/`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      // SweetAlert para error al cargar funcionario
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el funcionario',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const data = await res.json();

    document.getElementById("nombre").value = data.first_name;
    correoInput.value = data.email;
    correoInput.disabled = true;
    passwordInput.disabled = true;
    document.getElementById("telefono").value = data.telefono || "";
    passwordInput.value = "";
    document.getElementById("crearFuncionarioForm").dataset.id = id;
    modalTitle.innerText = "Editar funcionario";
    modal.style.display = "block";
  };

  function cerrarModal() {
    modal.style.display = "none";
    document.getElementById("crearFuncionarioForm").reset();
    correoInput.disabled = false;
    passwordInput.disabled = false;
    modalTitle.innerText = "Crear nuevo funcionario";
  }

  cargarFuncionarios();
});