const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os-utils');
const si = require('systeminformation');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const { expressCspHeader, INLINE, NONE, SELF } = require('express-csp-header');

class Server {
  constructor() {
    this.cpuUsage = 0;
    this.freeMem = 0;
    this.totalMem = 0;
    this.diskFree = 0;
    this.diskTotal = 0;
    this.diskUsed = 0;
    this.networkSpeed = { rx: 0, tx: 0 };
    this.gpuInfo = [];
    this.topProcesses = [];
  }

  async updateStats() {
    this.cpuUsage = await this.getCpuUsage();
    this.freeMem = os.freemem();
    this.totalMem = os.totalmem();
    const diskInfo = await this.getDiskInfo();
    this.diskFree = diskInfo.free;
    this.diskTotal = diskInfo.total;
    this.diskUsed = diskInfo.used; 
    this.networkSpeed = await this.getNetworkSpeed();
    this.gpuInfo = await this.getGpuInfo(); 
    this.topProcesses = await this.getTopProcesses(); 
  }

  getCpuUsage() {
    return new Promise((resolve) => {
      os.cpuUsage((value) => {
        resolve(value);
      });
    });
  }

  async getDiskInfo() {
    const data = await si.fsSize();
    const disk = data[1];
    const free = disk.available / (1024 * 1024 * 1024); 
    const total = disk.size / (1024 * 1024 * 1024); 
    const used = disk.used / (1024 * 1024 * 1024); 
    return { free, total, used };
  }

  async getNetworkSpeed() {
    const networkStats = await si.networkStats();
    return {
      rx: networkStats[0].rx_sec,
      tx: networkStats[0].tx_sec
    };
  }

  async getGpuInfo() {
    const gpuData = await si.graphics();
    return gpuData.controllers.map(gpu => ({
      model: gpu.model,
      vendor: gpu.vendor,
      memoryTotal: gpu.memoryTotal ? gpu.memoryTotal + ' MB' : 'N/A',
      temperature: gpu.temperatureGpu ? gpu.temperatureGpu + '°C' : 'N/A'
    }));
  }

  async getTopProcesses() {
    const processData = await si.processes();
    return processData.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)
      .map(proc => ({
        name: proc.name,
        pid: proc.pid,
        cpu: proc.cpu.toFixed(2), 
        mem: (proc.memRss / (1024 * 1024)).toFixed(2)
      }));
  }
}

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
  secret: 'mySecretKey', // Clave para firmar la sesión
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 300000 } // Sesión de 5 minutos (300,000 ms)
}));

// Middleware para parsear body de requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración de encabezados CSP
app.use(expressCspHeader({ 
  policies: { 
      'default-src': [expressCspHeader.NONE], 
      'img-src': [expressCspHeader.SELF], 
      'script-src': [expressCspHeader.SELF],
      'style-src': [expressCspHeader.SELF],
      'object-src': [expressCspHeader.NONE],
      'frame-src': [expressCspHeader.NONE],
      'base-uri': [expressCspHeader.NONE],
      'form-action': [expressCspHeader.NONE],
      'frame-ancestors': [expressCspHeader.NONE],
      'manifest-src': [expressCspHeader.NONE],
      'media-src': [expressCspHeader.NONE],
      'worker-src': [expressCspHeader.NONE]
  } 
}));

// Configuración de CORS
const corsOptions = {
  origin: ['https://segucom.mx', 'http://localhost:3001', 'http://localhost:5500', 'http://127.0.0.1:5500', '*', 'http://192.168.1.68/', 'https://localhost:3000',
    'https://:192.168.1.90/', 'https://segubackend.com:3000', 'https://segubackend.com', 'https://segubackend.com/monitoring/'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const monitoringNamespace = io.of('/monitoring');

monitoringNamespace.on('connection', (socket) => {
    console.log('New connection to /monitoring');
      // Enviar estadísticas al cliente cada 2 segundos
setInterval(async () => {
  await serverStats.updateStats();
  monitoringNamespace.emit('serverStats', serverStats);
}, 2000);
    // Maneja eventos aquí
});

io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });



  // Enviar estadísticas al cliente cada 2 segundos
setInterval(async () => {
  await serverStats.updateStats();
  io.emit('serverStats', serverStats);
}, 2000);
});

// Página de login
app.get('/', (req, res) => {
  res.send('Hola, bienvenido a la página de login');
  /*
  if (req.session.loggedIn) {
    res.redirect('/stats');
  } else {
    res.sendFile(__dirname + '/public/login.html');
  }
    */
});

// Endpoint para manejar login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Credenciales estáticas, cámbialas según sea necesario
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



const PORT = 9000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
