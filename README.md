# Nova: asistente virtual de la ETITC

Chatbot con respuestas predefinidas, disponible 24/7, con botón de urgencias y paso a asesor humano solo en horario hábil (lunes a viernes, 8:00 a.m. a 5:00 p.m., hora Colombia).

## Tecnologías
- **Python + Flask**: servidor, respuestas, condición de horario y base de datos SQLite.
- **HTML**: estructura de la página (`templates/`).
- **CSS**: diseño del chat (`static/css/style.css`).
- **JavaScript**: interacción del chat en el navegador (`static/js/chat.js`).

## Cómo ejecutarlo
```bash
pip install -r requirements.txt
python app.py
```
Abre http://127.0.0.1:5000 para el chat y http://127.0.0.1:5000/admin para ver las solicitudes.

## Estructura
```
nova-etitc/
├── app.py               # Servidor Flask y lógica del bot
├── respuestas.json      # Árbol de preguntas y respuestas (editable)
├── requirements.txt
├── render.yaml          # Configuración para publicar en Render
├── solicitudes.db       # Se crea solo al ejecutar
├── templates/
│   ├── index.html       # Página del chat
│   └── admin.html       # Panel de solicitudes
└── static/
    ├── css/style.css
    ├── js/chat.js
    └── img/nova.svg     # Ícono de Nova
```

## Cómo funciona
1. El estudiante elige un tema del menú o escribe su pregunta; Python busca palabras clave.
2. Las respuestas se despliegan por niveles hasta la información concreta.
3. El botón rojo de urgencias funciona en cualquier momento: emergencia de salud o seguridad, crisis emocional, conflicto con un profesor (registro de 3 preguntas con radicado) y violencia o acoso.
4. Si pide asesor: Python revisa la hora de Bogotá. En horario, lo pone en fila; fuera de horario, le muestra un formulario y le entrega un radicado.

## Endpoints (API)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/nodo/<id>` | Devuelve una respuesta y sus opciones |
| POST | `/api/mensaje` | Busca palabras clave en el texto escrito |
| GET | `/api/horario?simular=enHorario\|fueraHorario` | Dice si hay asesores disponibles |
| POST | `/api/solicitud` | Valida y guarda una solicitud, devuelve el radicado |
| GET | `/admin` | Lista de solicitudes (urgentes primero) |

## Personalizar
- Preguntas y respuestas: edita `respuestas.json`.
- Horario y contacto de Bienestar: variables al inicio de `app.py`.
- La información de admisiones, matrícula, certificados, calendario y Bienestar se tomó de la página oficial de la ETITC; las fechas deben actualizarse cada semestre.

## Publicación
El proyecto se publica en Render como servicio web con `render.yaml`: instala `requirements.txt` y arranca con `gunicorn app:app`. En el plan gratuito la base de datos SQLite se reinicia en cada despliegue.
