document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const archivoId = new URLSearchParams(window.location.search).get("archivo");

  const form = document.getElementById("formularioExcel");
  const agruparPor = document.getElementById("tipoGrafico");
  const tipoGrafico = document.getElementById("tipoGrafic");
  const searchInput = document.getElementById("searchInput");
  const graficosDiv = document.querySelector(".graficos");

    if (archivoId) {
    form.style.display = "none"; // Oculta el formulario si hay archivo seleccionado
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const archivo = document.getElementById("archivo_excel").files[0];
    if (!archivo) {
      Swal.fire({
        icon: 'warning',
        title: '¡Atención!',
        text: 'Selecciona un archivo Excel para continuar',
        confirmButtonColor: '#f39c12'
      });
      return;
    }

    const formData = new FormData();
    formData.append("archivos", archivo);

    try {
      const response = await fetch("http://localhost:8000/api/archivos/carga-masiva/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Archivo procesado con éxito',
          confirmButtonColor: '#3085d6'
        });

        limpiarEstadoCompleto();
        await cargarColumnas();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al procesar tu archivo',
          confirmButtonColor: '#d33'
        });
        console.error(data);
      }
    } catch (error) {
      alert("Error inesperado");
      console.error(error);
    }
  });

  function limpiarEstadoCompleto() {
    if (window.currentChart) {
      try {
        window.currentChart.destroy();
        window.currentChart = null;
      } catch (e) {
        console.warn("Error al destruir gráfico:", e);
        window.currentChart = null;
      }
    }

    agruparPor.innerHTML = '<option value="">Seleccione columna</option>';
    tipoGrafico.selectedIndex = 0;
    searchInput.value = "";

    graficosDiv.innerHTML = '<div class="title-graficos"><h2>Gráficos</h2></div>';
    setTimeout(() => {
      graficosDiv.offsetHeight;
    }, 100);
  }

  async function cargarColumnas() {
    try {
      let url = "http://localhost:8000/api/archivos/columnas-disponibles/";
      if (archivoId) {
        url += `?archivo_id=${archivoId}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (res.ok && Array.isArray(data.columnas)) {
        agruparPor.innerHTML = '<option value="">Seleccione columna</option>';
        data.columnas.forEach(col => {
          const opt = document.createElement("option");
          opt.value = col;
          opt.textContent = col;
          agruparPor.appendChild(opt);
        });
        console.log("Columnas cargadas:", data.columnas);
      } else {
        console.warn("No se pudieron cargar las columnas disponibles");
      }
    } catch (error) {
      console.error("Error al obtener columnas:", error);
    }
  }

  async function mostrarGraficos() {
    const columna = agruparPor.value;
    const valorBuscado = searchInput.value.trim();
    const tipo = tipoGrafico.value;

    if (!columna) {
      graficosDiv.innerHTML = '<div class="title-graficos"><h2>Gráficos</h2></div>';
      return;
    }

    const filtros = {};

    if (archivoId) {
      filtros.archivo_id = parseInt(archivoId);
    }

    if (valorBuscado) {
      filtros.busqueda_texto = {
        campo: columna,
        valor: valorBuscado
      };
    }

    const payload = {
      tipo_grafico: `por_${columna.toLowerCase().replace(/\s+/g, "_")}`,
      filtros
    };

    console.log("Payload enviado:", payload);

    try {
      const res = await fetch("http://localhost:8000/api/archivos/generar-grafico/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log("Datos recibidos:", data);

      graficosDiv.innerHTML = '<div class="title-graficos"><h2>Gráficos</h2></div>';

      if (data.labels?.length > 0 && data.values?.length > 0) {
        const chartContainer = document.createElement("div");
        chartContainer.style.cssText = `
          width: 100%;
          max-width: 800px;
          height: 400px;
          margin: 20px auto;
          padding: 10px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          position: relative;
        `;

        const canvas = document.createElement("canvas");
        canvas.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          max-width: 780px;
          max-height: 380px;
        `;

        chartContainer.appendChild(canvas);
        graficosDiv.appendChild(chartContainer);

        if (window.currentChart) {
          window.currentChart.destroy();
        }

        window.currentChart = new Chart(canvas.getContext("2d"), {
          type: tipo,
          data: {
            labels: data.labels,
            datasets: [{
              label: data.title || "Registros",
              data: data.values,
              backgroundColor: generarColores(data.labels.length),
              borderColor: generarColores(data.labels.length, 0.8),
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false },
            plugins: {
              legend: {
                display: tipo !== "bar",
                position: 'top',
                labels: { boxWidth: 12, padding: 15 }
              },
              title: {
                display: true,
                text: data.title || `Registros por ${columna}`,
                font: { size: 16 },
                padding: 20
              }
            },
            scales: tipo === "bar" ? {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              },
              x: {
                ticks: { maxRotation: 45, minRotation: 0 }
              }
            } : {},
            animation: { duration: 750 }
          }
        });
      } else {
        graficosDiv.innerHTML += `
          <div style="padding: 2rem; text-align: center; color: #666;">
            <p>No hay datos para graficar con los filtros seleccionados.</p>
            <small>Columna: ${columna}${valorBuscado ? `, Búsqueda: "${valorBuscado}"` : ''}</small>
          </div>
        `;
      }
    } catch (error) {
      console.error("Error al generar gráfico:", error);
      graficosDiv.innerHTML += `
        <div style="padding: 2rem; text-align: center; color: #e74c3c;">
          <p>Error al generar el gráfico. Inténtalo de nuevo.</p>
        </div>
      `;
    }
  }

  function generarColores(n, alpha = 0.7) {
    const baseColors = [
      'rgba(52, 152, 219, ALPHA)',
      'rgba(231, 76, 60, ALPHA)',
      'rgba(46, 204, 113, ALPHA)',
      'rgba(243, 156, 18, ALPHA)',
      'rgba(155, 89, 182, ALPHA)',
      'rgba(26, 188, 156, ALPHA)',
      'rgba(52, 73, 94, ALPHA)',
      'rgba(230, 126, 34, ALPHA)',
      'rgba(149, 165, 166, ALPHA)',
      'rgba(22, 160, 133, ALPHA)'
    ];

    return Array.from({ length: n }, (_, i) => {
      const color = baseColors[i % baseColors.length];
      return color.replace("ALPHA", alpha);
    });
  }

  // Eventos de filtros
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (agruparPor.value) mostrarGraficos();
    }, 300);
  });

  agruparPor.addEventListener("change", () => {
    if (agruparPor.value) {
      mostrarGraficos();
    } else {
      graficosDiv.innerHTML = '<div class="title-graficos"><h2>Gráficos</h2></div>';
    }
  });

  tipoGrafico.addEventListener("change", () => {
    if (agruparPor.value) mostrarGraficos();
  });

  document.querySelector(".clean-filter").addEventListener("click", () => {
    searchInput.value = "";
    agruparPor.selectedIndex = 0;
    tipoGrafico.selectedIndex = 0;

    if (window.currentChart) {
      try {
        window.currentChart.destroy();
        window.currentChart = null;
      } catch (e) {
        console.warn("Error al destruir gráfico:", e);
        window.currentChart = null;
      }
    }

    graficosDiv.innerHTML = '<div class="title-graficos"><h2>Gráficos</h2></div>';
    graficosDiv.offsetHeight;
  });

  cargarColumnas(); // Inicializar carga dinámica
});
