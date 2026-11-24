const registro = document.getElementById("log");
const selectorHora = document.getElementById("clock");
const campoMensaje = document.getElementById("q");

const PATRON_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PREGUNTAS_CONFLICTO = [
  {
    campo: "correo",
    texto: "1 de 3: ¿Cuál es tu correo institucional? Ahí te responderán.",
    validar: (valor) => PATRON_CORREO.test(valor) || "Revisa el correo: debe tener el formato nombre@dominio.com.",
  },
  {
    campo: "asignatura",
    texto: "2 de 3: ¿En qué asignatura y con qué profesor ocurrió?",
    validar: (valor) => valor.length >= 3 || "Escribe la asignatura y el nombre del profesor.",
  },
  {
    campo: "descripcion",
    texto: "3 de 3: Cuéntame brevemente qué pasó.",
    validar: (valor) => valor.length >= 10 || "Cuéntame un poco más, al menos en una frase.",
  },
];

let registroConflicto = null;

const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));
const bajarAlFinal = () => { registro.scrollTop = registro.scrollHeight; };
const escaparHtml = (texto) => String(texto).replace(/[&<>"]/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[caracter]));

async function llamarApi(url, opciones = {}) {
  const respuesta = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || "Error de conexión con el servidor.");
  return datos;
}

function parametroSimulacion() {
  return selectorHora.value ? `?simular=${selectorHora.value}` : "";
}

function agregarBurbuja(html, autor = "bot", clase = "") {
  const burbuja = document.createElement("div");
  burbuja.className = `msg ${autor} ${clase}`.trim();
  burbuja.innerHTML = html;
  registro.appendChild(burbuja);
  bajarAlFinal();
  return burbuja;
}

function quitarOpciones() {
  registro.querySelectorAll(".opts").forEach((opciones) => opciones.remove());
}

async function mostrarEscribiendo(milisegundos = 550) {
  const indicador = document.createElement("div");
  indicador.className = "typing";
  indicador.innerHTML = "<span></span><span></span><span></span>";
  registro.appendChild(indicador);
  bajarAlFinal();
  await esperar(milisegundos);
  indicador.remove();
}

function mostrarOpciones(listaOpciones) {
  const contenedor = document.createElement("div");
  contenedor.className = "opts";
  listaOpciones.forEach(([texto, destino, estilo]) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "opt" + (estilo ? " " + estilo : "");
    boton.textContent = texto;
    boton.addEventListener("click", () => {
      quitarOpciones();
      agregarBurbuja(escaparHtml(texto), "user");
      irA(destino);
    });
    contenedor.appendChild(boton);
  });
  registro.appendChild(contenedor);
  bajarAlFinal();
}

function mostrarEnlaces(listaEnlaces) {
  const contenedor = document.createElement("div");
  contenedor.className = "enlaces";
  listaEnlaces.forEach(([texto, url]) => {
    const enlace = document.createElement("a");
    enlace.className = "enlace";
    enlace.href = url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.textContent = texto;
    const etiquetaAbrir = document.createElement("span");
    etiquetaAbrir.textContent = "Abrir ↗";
    enlace.appendChild(etiquetaAbrir);
    contenedor.appendChild(enlace);
  });
  registro.appendChild(contenedor);
  bajarAlFinal();
}

function mostrarNodo(nodo) {
  agregarBurbuja(escaparHtml(nodo.texto), "bot", nodo.tipo === "alerta" ? "alerta" : "");
  if (nodo.enlaces?.length) mostrarEnlaces(nodo.enlaces);
  if (nodo.opciones?.length) mostrarOpciones(nodo.opciones);
}

async function irA(destino) {
  if (destino === "asesor") return pedirAsesor();
  if (destino === "formUrgente") return mostrarFormulario(true);
  if (destino === "formNormal") return mostrarFormulario(false);
  if (destino === "formConflicto") return iniciarConflicto();
  if (destino === "cancelarConflicto") return cancelarConflicto();

  await mostrarEscribiendo();
  try {
    mostrarNodo(await llamarApi(`/api/nodo/${destino}`));
  } catch (error) {
    agregarBurbuja(escaparHtml(error.message), "bot", "alerta");
    mostrarOpciones([["Volver al menú", "inicio"]]);
  }
}

async function pedirAsesor() {
  await mostrarEscribiendo();
  let horario;
  try {
    horario = await llamarApi(`/api/horario${parametroSimulacion()}`);
  } catch (error) {
    agregarBurbuja(escaparHtml(error.message), "bot", "alerta");
    return;
  }

  if (horario.disponible) {
    agregarBurbuja("Estamos en horario de atención (lunes a viernes, 8:00 a.m. a 5:00 p.m.). Te estoy conectando con un asesor…");
    await mostrarEscribiendo(1400);
    agregarBurbuja(`Estás en la posición <span class="code">${horario.posicion}</span> de la fila. Tiempo estimado: ${horario.esperaMin} minutos.\nMientras esperas, cuéntame brevemente tu caso.`);
    mostrarOpciones([["Prefiero dejar la solicitud", "formNormal"], ["Volver al menú", "inicio", "suave"]]);
  } else {
    agregarBurbuja("En este momento no hay asesores conectados. El horario administrativo es de lunes a viernes, de 8:00 a.m. a 5:00 p.m.\n\nDeja tu solicitud y te responderemos al correo en el siguiente día hábil. Si es una urgencia, usa el botón rojo de arriba.");
    mostrarFormulario(false);
  }
}

function mostrarFormulario(esUrgente) {
  const formulario = document.createElement("form");
  formulario.className = "f";
  formulario.noValidate = true;
  const sufijo = Date.now();
  formulario.innerHTML = `
    <label for="n${sufijo}">Nombre completo</label><input id="n${sufijo}" name="nombre">
    <label for="c${sufijo}">Correo (institucional o personal)</label><input id="c${sufijo}" name="correo" type="email">
    <label for="d${sufijo}">Documento o código estudiantil</label><input id="d${sufijo}" name="documento">
    ${esUrgente ? "" : `<label for="t${sufijo}">Tema</label>
      <select id="t${sufijo}" name="tema"><option>Pagos y matrícula</option><option>Certificados</option><option>Plataformas</option><option>Admisiones</option><option>Otro</option></select>`}
    <label for="m${sufijo}">${esUrgente ? "Describe la urgencia" : "Tu solicitud"}</label><textarea id="m${sufijo}" name="mensaje"></textarea>
    <div class="err" role="alert"></div>
    <button type="submit">${esUrgente ? "Enviar con prioridad alta" : "Radicar solicitud"}</button>`;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(formulario));
    datos.urgente = esUrgente;
    const botonEnviar = formulario.querySelector("button");
    const mensajeError = formulario.querySelector(".err");
    botonEnviar.disabled = true;
    mensajeError.textContent = "";

    try {
      const solicitud = await llamarApi("/api/solicitud", { method: "POST", body: JSON.stringify(datos) });
      formulario.remove();
      agregarBurbuja(escaparHtml(datos.mensaje), "user");
      await mostrarEscribiendo(800);
      agregarBurbuja(
        solicitud.urgente
          ? `Solicitud urgente registrada.\nRadicado: <span class="code">${solicitud.radicado}</span>\n\nSe notificó al equipo con prioridad alta. Te contactarán a ${escaparHtml(solicitud.correo)} lo antes posible.`
          : `Solicitud radicada.\nRadicado: <span class="code">${solicitud.radicado}</span>\n\nRecibirás la respuesta en ${escaparHtml(solicitud.correo)}. Guarda el número para hacer seguimiento.`,
        "bot", "ticket"
      );
      mostrarOpciones([["Volver al menú", "inicio"]]);
    } catch (error) {
      mensajeError.textContent = error.message;
      botonEnviar.disabled = false;
    }
  });

  registro.appendChild(formulario);
  bajarAlFinal();
}

async function iniciarConflicto() {
  registroConflicto = { paso: 0, respuestas: {} };
  await mostrarEscribiendo();
  agregarBurbuja("Te haré 3 preguntas cortas. Escribe cada respuesta en la caja de abajo.");
  hacerPreguntaConflicto();
}

function hacerPreguntaConflicto() {
  agregarBurbuja(escaparHtml(PREGUNTAS_CONFLICTO[registroConflicto.paso].texto));
  mostrarOpciones([["Cancelar registro", "cancelarConflicto", "suave"]]);
  campoMensaje.focus();
}

async function cancelarConflicto() {
  registroConflicto = null;
  await mostrarEscribiendo();
  agregarBurbuja("Listo, cancelé el registro. No se guardó nada.");
  mostrarOpciones([["Volver al menú", "inicio"]]);
}

async function responderConflicto(texto) {
  const pregunta = PREGUNTAS_CONFLICTO[registroConflicto.paso];
  const resultadoValidacion = pregunta.validar(texto);
  if (resultadoValidacion !== true) {
    await mostrarEscribiendo(300);
    agregarBurbuja(escaparHtml(resultadoValidacion), "bot", "alerta");
    mostrarOpciones([["Cancelar registro", "cancelarConflicto", "suave"]]);
    return;
  }
  registroConflicto.respuestas[pregunta.campo] = texto;
  registroConflicto.paso++;
  if (registroConflicto.paso < PREGUNTAS_CONFLICTO.length) {
    await mostrarEscribiendo(400);
    hacerPreguntaConflicto();
    return;
  }

  const respuestas = registroConflicto.respuestas;
  registroConflicto = null;
  try {
    const solicitud = await llamarApi("/api/solicitud", {
      method: "POST",
      body: JSON.stringify({
        tipo: "conflicto",
        urgente: true,
        correo: respuestas.correo,
        mensaje: `Asignatura y profesor: ${respuestas.asignatura}\n\n${respuestas.descripcion}`,
      }),
    });
    await mostrarEscribiendo(800);
    agregarBurbuja(
      `Caso registrado.\nRadicado: <span class="code">${solicitud.radicado}</span>\n\nLa Facultad revisará tu caso y te contactará en ${escaparHtml(solicitud.correo)}. Guarda este número para hacer seguimiento.`,
      "bot", "ticket"
    );
    mostrarOpciones([["Cómo reclamar una nota", "confNota"], ["Volver al menú", "inicio"]]);
  } catch (error) {
    agregarBurbuja(escaparHtml(error.message), "bot", "alerta");
    mostrarOpciones([["Volver al menú", "inicio"]]);
  }
}

async function actualizarEstadoHorario() {
  const estado = document.getElementById("clockStatus");
  try {
    const horario = await llamarApi(`/api/horario${parametroSimulacion()}`);
    estado.textContent = horario.disponible ? "Asesores disponibles" : "Fuera de horario";
    estado.className = "status " + (horario.disponible ? "on" : "off");
  } catch {
    estado.textContent = "Sin conexión";
    estado.className = "status off";
  }
}

document.getElementById("inputForm").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const texto = campoMensaje.value.trim();
  if (!texto) return;
  campoMensaje.value = "";
  quitarOpciones();
  agregarBurbuja(escaparHtml(texto), "user");

  if (registroConflicto) return responderConflicto(texto);

  try {
    const respuesta = await llamarApi("/api/mensaje", { method: "POST", body: JSON.stringify({ texto }) });
    if (respuesta.accion === "asesor") return pedirAsesor();
    await mostrarEscribiendo();
    mostrarNodo(respuesta.nodo);
  } catch (error) {
    agregarBurbuja(escaparHtml(error.message), "bot", "alerta");
  }
});

document.getElementById("sosBtn").addEventListener("click", () => {
  registroConflicto = null;
  quitarOpciones();
  agregarBurbuja("Tengo una urgencia", "user");
  irA("urgencias");
});

document.getElementById("homeBtn").addEventListener("click", () => {
  registroConflicto = null;
  quitarOpciones();
  irA("inicio");
});

selectorHora.addEventListener("change", actualizarEstadoHorario);
setInterval(actualizarEstadoHorario, 60000);

actualizarEstadoHorario();
irA("inicio");
