"""
Nova, asistente virtual de la ETITC: chatbot con respuestas predefinidas 24/7.

Ejecutar:
    pip install -r requirements.txt
    python app.py
    Abrir http://127.0.0.1:5000
"""

import json
import random
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request

ZONA_HORARIA = ZoneInfo("America/Bogota")
DIAS_HABILES = [0, 1, 2, 3, 4]  # 0 = lunes, 4 = viernes
HORA_INICIO = 8
HORA_FIN = 17
CONTACTO_BIENESTAR = "Bienestar Universitario: bienestar@itc.edu.co, PBX 601 344 3000 ext. 283"

RUTA_BASE = Path(__file__).parent
RUTA_BASE_DATOS = RUTA_BASE / "solicitudes.db"
PATRON_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__)

with open(RUTA_BASE / "respuestas.json", encoding="utf-8") as archivo:
    datosChatbot = json.load(archivo)

nodos = datosChatbot["nodos"]
palabrasClave = [(re.compile(patron), idNodo) for patron, idNodo in datosChatbot["palabrasClave"]]


def conectar():
    conexion = sqlite3.connect(RUTA_BASE_DATOS)
    conexion.row_factory = sqlite3.Row
    return conexion


def crearTabla():
    with conectar() as conexion:
        conexion.execute("""
            CREATE TABLE IF NOT EXISTS solicitudes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                radicado TEXT UNIQUE,
                urgente INTEGER,
                nombre TEXT,
                correo TEXT,
                documento TEXT,
                tema TEXT,
                mensaje TEXT,
                fecha TEXT,
                estado TEXT DEFAULT 'Pendiente'
            )
        """)


def horaActual(simular=None):
    """'simular' permite mostrar las dos ramas de la condición de horario en la sustentación."""
    if simular == "enHorario":
        return datetime(2026, 10, 13, 10, 0, tzinfo=ZONA_HORARIA)
    if simular == "fueraHorario":
        return datetime(2026, 10, 17, 21, 30, tzinfo=ZONA_HORARIA)
    return datetime.now(ZONA_HORARIA)


def hayAsesores(fechaHora):
    return fechaHora.weekday() in DIAS_HABILES and HORA_INICIO <= fechaHora.hour < HORA_FIN


def generarRadicado(urgente):
    prefijo = "URG" if urgente else "SOL"
    return f"{prefijo}-{datetime.now(ZONA_HORARIA):%Y%m%d}-{random.randint(1000, 9999)}"


def armarNodo(idNodo):
    nodo = nodos[idNodo]
    return {
        "id": idNodo,
        "texto": nodo["texto"].replace("{BIENESTAR}", CONTACTO_BIENESTAR),
        "tipo": nodo.get("tipo", "normal"),
        "opciones": nodo.get("opciones", []),
        "enlaces": nodo.get("enlaces", []),
    }


@app.route("/")
def inicio():
    return render_template("index.html")


@app.get("/api/nodo/<idNodo>")
def obtenerNodo(idNodo):
    if idNodo not in nodos:
        return jsonify({"error": "Esa opción no existe."}), 404
    return jsonify(armarNodo(idNodo))


@app.post("/api/mensaje")
def responderMensaje():
    texto = (request.get_json(silent=True) or {}).get("texto", "").lower()
    for patron, idNodo in palabrasClave:
        if patron.search(texto):
            if idNodo == "asesor":
                return jsonify({"accion": "asesor"})
            return jsonify({"accion": "nodo", "nodo": armarNodo(idNodo)})
    return jsonify({
        "accion": "nodo",
        "nodo": {
            "id": "sinRespuesta",
            "texto": "No encontré una respuesta exacta para eso. Elige un tema o habla con un asesor:",
            "tipo": "normal",
            "opciones": nodos["inicio"]["opciones"],
        },
    })


@app.get("/api/horario")
def consultarHorario():
    fechaHora = horaActual(request.args.get("simular"))
    disponible = hayAsesores(fechaHora)
    respuesta = {"disponible": disponible, "hora": fechaHora.strftime("%A %H:%M")}
    if disponible:
        posicion = random.randint(1, 4)
        respuesta["posicion"] = posicion
        respuesta["esperaMin"] = posicion * 3
    return jsonify(respuesta)


@app.post("/api/solicitud")
def crearSolicitud():
    datos = request.get_json(silent=True) or {}
    campos = {clave: str(datos.get(clave, "")).strip() for clave in ("nombre", "correo", "documento", "tema", "mensaje")}
    esUrgente = bool(datos.get("urgente"))
    esConflicto = datos.get("tipo") == "conflicto"

    if esConflicto:
        if not campos["mensaje"]:
            return jsonify({"error": "Cuéntanos qué pasó para poder registrar el caso."}), 400
    elif not campos["nombre"] or not campos["documento"] or not campos["mensaje"]:
        return jsonify({"error": "Completa todos los campos para poder radicar."}), 400
    if not PATRON_CORREO.match(campos["correo"]):
        return jsonify({"error": "Revisa el correo: debe tener el formato nombre@dominio.com."}), 400

    if esConflicto:
        tema = "Conflicto con profesor"
    elif esUrgente:
        tema = "Urgencia"
    else:
        tema = campos["tema"] or "Otro"

    radicado = generarRadicado(esUrgente)
    with conectar() as conexion:
        conexion.execute(
            """INSERT INTO solicitudes (radicado, urgente, nombre, correo, documento, tema, mensaje, fecha)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (radicado, int(esUrgente), campos["nombre"], campos["correo"], campos["documento"],
             tema, campos["mensaje"], datetime.now(ZONA_HORARIA).isoformat(timespec="seconds")),
        )
    return jsonify({"radicado": radicado, "correo": campos["correo"], "urgente": esUrgente}), 201


@app.get("/admin")
def verSolicitudes():
    with conectar() as conexion:
        solicitudes = conexion.execute("SELECT * FROM solicitudes ORDER BY urgente DESC, id DESC").fetchall()
    return render_template("admin.html", solicitudes=solicitudes)


crearTabla()

if __name__ == "__main__":
    app.run(debug=True)
