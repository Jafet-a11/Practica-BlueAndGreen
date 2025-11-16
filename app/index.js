const express = require('express');
const fs = require('fs'); // Módulo de File System
const path = require('path'); // Módulo Path
const app = express();
const PORT = 3000;

app.use(express.json());

const APP_VERSION = process.env.APP_VERSION || "Desconocido";

// --- Almacenamiento en Archivo (Esto se queda igual) ---
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

const initStorage = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
};
const readTasks = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) { return []; }
};
const writeTasks = (tasks) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
  } catch (e) { console.error("Error al escribir tasks.json", e); }
};
// --- Fin Almacenamiento ---


// --- RUTA PRINCIPAL (LA GRAN ACTUALIZACIÓN) ---
app.get('/', (req, res) => {
  const color = APP_VERSION.includes('Blue') ? '#3490db' : '#2ecc71';

  // Enviamos un HTML completo con un script de cliente
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Despliegue Blue-Green</title>
      <style>
        body { background-color: ${color}; font-family: sans-serif; color: white; padding: 20px; margin: 0; }
        h1, h2 { text-align: center; }
        hr { border: none; border-top: 1px solid rgba(255,255,255,0.3); }
        #app-container { max-width: 600px; margin: 20px auto; background: rgba(0,0,0,0.1); padding: 20px; border-radius: 8px; }
        form { display: flex; flex-direction: column; gap: 10px; }
        input, button { padding: 10px; border: none; border-radius: 4px; font-size: 16px; }
        button { background-color: #fff; color: ${color}; font-weight: bold; cursor: pointer; }
        button:disabled { background-color: #ccc; cursor: not-allowed; }
        #task-list { margin-top: 20px; }
        .task { background: rgba(255,255,255,0.1); padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        .task h4 { margin: 0 0 5px 0; }
        .task p { margin: 0; opacity: 0.8; }
      </style>
    </head>
    <body>
      <h1>¡Despliegue Blue-Green!</h1>
      <h2>Versión Activa: ${APP_VERSION}</h2>

      <div id="app-container">
        <h3>Registrar Tarea (Solo en Blue)</h3>
        <form id="add-task-form">
          <input type="text" id="title" placeholder="Título de la tarea" required>
          <input type="text" id="description" placeholder="Descripción (opcional)">
          <button type="submit" id="submit-btn">Agregar Tarea</button>
        </form>
        <p id="form-message" style="text-align: center; height: 20px;"></p>

        <hr>

        <h3>Lista de Tareas (Solo en Green)</h3>
        <div id="task-list">
          <p id="list-message">Cargando tareas...</p>
        </div>
      </div>

      <script>
        // Pasamos la variable de entorno del servidor al script del cliente
        const CURRENT_VERSION = "${APP_VERSION}";
        const taskForm = document.getElementById('add-task-form');
        const submitBtn = document.getElementById('submit-btn');
        const formMessage = document.getElementById('form-message');
        const taskListDiv = document.getElementById('task-list');
        const listMessage = document.getElementById('list-message');

        // ---- LÓGICA PARA CARGAR TAREAS (GET) ----
        async function loadTasks() {
          if (CURRENT_VERSION.includes('Green')) {
            try {
              const response = await fetch('/tasks'); // Llama a nuestra propia API
              if (!response.ok) throw new Error('Respuesta de red no fue OK');

              const data = await response.json();

              taskListDiv.innerHTML = ''; // Limpiar "Cargando..."
              if (data.tasks.length === 0) {
                taskListDiv.innerHTML = '<p>No hay tareas registradas.</p>';
              } else {
                data.tasks.forEach(task => {
                  const taskEl = document.createElement('div');
                  taskEl.className = 'task';
                  taskEl.innerHTML = \`
                    <h4>\${task.title}</h4>
                    <p>\${task.description || 'Sin descripción'}</p>
                  \`;
                  taskListDiv.appendChild(taskEl);
                });
              }
            } catch (error) {
              taskListDiv.innerHTML = '<p>Error al cargar tareas: ' + error.message + '</p>';
            }
          } else {
            // Si estamos en Blue, no podemos cargar
            taskListDiv.innerHTML = '<p>Solo la versión GREEN puede listar tareas.</p>';
          }
        }

        // ---- LÓGICA PARA ENVIAR TAREAS (POST) ----
        taskForm.addEventListener('submit', async (e) => {
          e.preventDefault(); // Prevenir recarga de página

          if (CURRENT_VERSION.includes('Blue')) {
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;

            submitBtn.disabled = true;
            formMessage.textContent = 'Enviando...';

            try {
              const response = await fetch('/tasks', { // Llama a nuestra API
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description })
              });

              const result = await response.json();
              if (!response.ok) throw new Error(result.message || 'Error desconocido');

              formMessage.textContent = '¡Tarea registrada!';
              taskForm.reset();

            } catch (error) {
              formMessage.textContent = 'Error: ' + error.message;
            } finally {
              submitBtn.disabled = false;
              setTimeout(() => { formMessage.textContent = ''; }, 3000);
            }
          } else {
            // Si estamos en Green, no podemos enviar
            formMessage.textContent = 'Solo la versión BLUE puede registrar tareas.';
            setTimeout(() => { formMessage.textContent = ''; }, 3000);
          }
        });

        // --- INICIAR ---
        document.addEventListener('DOMContentLoaded', () => {
          loadTasks(); // Cargar las tareas

          // Desactivar el formulario si estamos en Green
          if (CURRENT_VERSION.includes('Green')) {
            document.getElementById('title').disabled = true;
            document.getElementById('description').disabled = true;
            submitBtn.disabled = true;
          }
        });

      </script>
    </body>
    </html>
  `);
});


// --- RUTAS DE API (ESTAS NO CAMBIAN) ---

// Registrar una nueva tarea
app.post('/tasks', (req, res) => {
  if (APP_VERSION.includes('Blue')) {
      const { title, description } = req.body;
      if (!title) {
        return res.status(400).json({ error: "El titulo es obligatorio." });
      }
      const newTask = { id: new Date().getTime(), title, description: description || "", createdAt: new Date() };
      const tasks = readTasks();
      tasks.push(newTask);
      writeTasks(tasks);
      res.status(201).json({ message: "Tarea registrada en tasks.json", task: newTask });
  } else {
      return res.status(403).json({ error: "Acción no permitida.", message: "Solo el entorno BLUE puede registrar tareas."});
  }
});

// Listar todas las tareas
app.get('/tasks', (req, res) => {
  if (APP_VERSION.includes('Green')) {
      const tasks = readTasks();
      res.json({ source: "Datos desde tasks.json (Volumen Compartido)", total: tasks.length, tasks: tasks });
  } else {
      return res.status(403).json({ error: "Acción no permitida.", message: "Solo el entorno GREEN puede listar las tareas."});
  }
});

// --- Iniciar servidor (ESTO NO CAMBIA) ---
app.listen(PORT, () => {
  initStorage();
  console.log(`App ${APP_VERSION} corriendo en el puerto ${PORT}`);
  console.log(`Modo VOLUMEN: Almacenamiento en ${DATA_FILE}`);
});
