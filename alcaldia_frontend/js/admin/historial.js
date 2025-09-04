document.addEventListener("DOMContentLoaded", function () {
    const tablaCuerpo = document.querySelector(".archivos");
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Token no encontrado. El usuario no está autenticado.");
      tablaCuerpo.innerHTML = "<tr><td colspan='2'>Debes iniciar sesión para ver los archivos.</td></tr>";
      return;
    }

    fetch("http://localhost:8000/api/archivos/archivos/", {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    })
    .then(response => response.json())
    .then(data => {
      console.log("Respuesta recibida:", data);

      const archivos = data.results;

      if (!Array.isArray(archivos)) {
        console.error("No es una lista válida de archivos:", data);
        tablaCuerpo.innerHTML = "<tr><td colspan='2'>No se pudieron cargar los archivos.</td></tr>";
        return;
      }

      tablaCuerpo.innerHTML = "";

      archivos.forEach(archivo => {
        const fila = document.createElement("tr");
        fila.classList.add("fila-archivo");
        fila.dataset.archivoId = archivo.id;

        const nombreTd = document.createElement("td");
        nombreTd.textContent = archivo.nombre_archivo;

        const fechaTd = document.createElement("td");
        fechaTd.textContent = new Date(archivo.fecha_subida).toLocaleString();

        fila.appendChild(nombreTd);
        fila.appendChild(fechaTd);

        fila.addEventListener("click", () => {
          window.location.href = `reporte.html?archivo=${archivo.id}`;
        });

        tablaCuerpo.appendChild(fila);
      });

      if (archivos.length === 0) {
        tablaCuerpo.innerHTML = "<tr><td colspan='2'>No hay archivos subidos.</td></tr>";
      }
    })
    .catch(error => {
      console.error("Error al cargar archivos:", error);
      tablaCuerpo.innerHTML = "<tr><td colspan='2'>Ocurrió un error al obtener los archivos.</td></tr>";
    });
  });