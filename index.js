// index.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const { expressCspHeader, NONE, SELF } = require('express-csp-header');
const { exec } = require('child_process');

const Server = require('./Server'); // Importar la clase Server

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const serverStats = new Server();

// Middleware para sesiones
app.use(session({
  secret: 'mySecretKey',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 300000 }
}));

// Middleware para parsear body de requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración de encabezados CSP
app.use(expressCspHeader({ 
  policies: { 
    'default-src': [NONE], 
    'img-src': [SELF], 
    'script-src': [SELF],
    'style-src': [SELF],
    'object-src': [NONE],
    'frame-src': [NONE],
    'base-uri': [NONE],
    'form-action': [NONE],
    'frame-ancestors': [NONE],
    'manifest-src': [NONE],
    'media-src': [NONE],
    'worker-src': [NONE]
  } 
}));

// Configuración de CORS
const corsOptions = {
  origin: ['https://segucom.mx', 'http://localhost:3001', 'http://localhost:5500', 'http://127.0.0.1:5500', '*', 'http://192.168.1.68/', 'https://localhost:3000',
    'https://:192.168.1.90/', 'https://segubackend.com:3000', 'https://segubackend.com', 'https://segubackend.com/monitoring/'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });

  // Enviar estadísticas al cliente cada 2 segundos
  setInterval(async () => {
    await serverStats.updateStats();
    io.emit('serverStats', serverStats);
   // console.log(serverStats);
  }, 2000);
});

// Página de login
app.get('/', (req, res) => {
  res.send('Hola, bienvenido a la página de login');
});

// Endpoint para manejar login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUsername = 'rs17';
  const validPassword = 'Javier117';

  if (username === validUsername && password === validPassword) {
    req.session.loggedIn = true;
    res.redirect('/stats');
  } else {
    res.send('Credenciales incorrectas. <a href="/">Inténtalo de nuevo</a>');
  }
});

// Endpoint protegido que muestra las estadísticas
app.get('/stats', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

//reinicio de servidor
app.post('/reboot/confirm/server', (req, res) => {
  // Envía una respuesta inmediata
  res.status(200).send('Servidor reiniciándose...');
  // Luego ejecuta el comando de reinicio
  exec('sudo reboot', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al ejecutar reboot: ${error.message}`);
      // Aquí podrías hacer un logging adicional si es necesario
      return; // No enviamos una respuesta aquí, ya que ya se envió
    }

    if (stderr) {
      console.error(`stderr: ${stderr}`);
      // Similarmente, puedes hacer logging, pero no enviamos respuesta
      return;
    }

    console.log(`stdout: ${stdout}`);
    // No se puede enviar una respuesta porque el servidor ya ha comenzado a reiniciarse
  });
});

// endpointd para reiniciar service:
// Función para manejar la ejecución de comandos de reinicio
function executeCommand(command, res) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al ejecutar el comando: ${error.message}`);
      res.status(500).send(`Error al ejecutar el comando: ${error.message}`);
      return;
    }

    if (stderr) {
      console.error(`stderr: ${stderr}`);
      res.status(500).send(`Error: ${stderr}`);
      return;
    }

    console.log(`stdout: ${stdout}`);
    res.status(200).send(`Comando ejecutado con éxito: ${stdout}`);
  });
}

// Endpoint genérico para reiniciar servicios
app.post('/service/confirm/restart/:NAME', (req, res) => {
  const serviceName = req.params.NAME;

  let command = '';
  switch (serviceName) {
    case 'segucom-backend':
      command = 'sudo systemctl restart backendsegucom.service';
      break;
    case 'segucomunications':
      command = 'sudo systemctl restart segucomunication';
      break;
    case 'nginx':
      command = 'sudo systemctl restart nginx';
      break;
    case 'database':
      command = 'sudo systemctl restart mysqld.service';
      break;
    default:
      res.status(400).send('Servicio no válido');
      return;
  }

  // Ejecuta el comando correspondiente
  executeCommand(command, res);
});

// Función para manejar la ejecución de comandos de estado
function getServiceStatus(service, res) {
  const command = `sudo systemctl status ${service}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      // Si el servicio está detenido, `systemctl` genera un error, pero verificamos si es "inactive" para devolver 503
      if (stdout.includes('Active: inactive') || stderr.includes('inactive (dead)')) {
        console.log(`El servicio ${service} está detenido`);
        res.status(503).send(`El servicio ${service} está detenido.`);
      } else if (stderr.includes('Loaded: not-found')) {
        console.log(`El servicio ${service} no existe`);
        res.status(404).send(`El servicio ${service} no existe.`);
      } else {
        // Si es otro tipo de error no relacionado con el estado del servicio
        console.error(`Error al ejecutar el comando: ${error.message}`);
        res.status(500).send(`Error al ejecutar el comando: ${error.message}`);
      }
      return;
    }

    // Si no hay error, verificamos si el servicio está corriendo
    if (stdout.includes('Active: active (running)')) {
      console.log(`El servicio ${service} está en ejecución`);
      res.status(200).send(`El servicio ${service} está en ejecución.`);
    } else {
      console.log(`Estado desconocido del servicio ${service}`);
      res.status(500).send(`Estado desconocido del servicio ${service}.`);
    }
  });
}

// Endpoint para obtener el estado de un servicio
app.get('/service/confirm/status/:NAME', (req, res) => {
  const serviceName = req.params.NAME;

  let service = '';
  switch (serviceName) {
    case 'segucom-backend':
      service = 'backendsegucom.service';
      break;
    case 'segucomunications':
      service = 'segucomunication';
      break;
    case 'nginx':
      service = 'nginx';
      break;
    case 'database':
      service = 'mysqld.service';
      break;
    default:
      res.status(400).send('Servicio no válido');
      return;
  }

  // Obtiene el estado del servicio correspondiente
  getServiceStatus(service, res);
});

const PORT = 9000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
