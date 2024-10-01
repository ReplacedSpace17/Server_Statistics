const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os-utils');
const si = require('systeminformation');

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
    this.diskUsed = diskInfo.used; // Agrega el espacio utilizado
    this.networkSpeed = await this.getNetworkSpeed();
    this.gpuInfo = await this.getGpuInfo(); // Agregamos estadísticas de GPU
    this.topProcesses = await this.getTopProcesses(); // Obtener procesos con mayor uso de CPU
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
    const disk = data[1]; // Cambia el índice si es necesario
    const free = disk.available / (1024 * 1024 * 1024); // Convertir a GB
    const total = disk.size / (1024 * 1024 * 1024); // Convertir a GB
    const used = disk.used / (1024 * 1024 * 1024); // Convertir a GB
    return { free, total, used }; // Retornar el espacio utilizado también
  }

  async getNetworkSpeed() {
    const networkStats = await si.networkStats();
    return {
      rx: networkStats[0].rx_sec,  // Bytes recibidos por segundo
      tx: networkStats[0].tx_sec   // Bytes transmitidos por segundo
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
        cpu: proc.cpu.toFixed(2), // Porcentaje de uso de CPU
        mem: (proc.memRss / (1024 * 1024)).toFixed(2) // Memoria utilizada en MB
      }));
  }
}

// Inicializar el servidor Express y Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const serverStats = new Server();

app.use(express.static('public')); // Para servir archivos estáticos

// Endpoint para servir la página web
app.get('/server1/stats', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Enviar estadísticas al cliente cada 2 segundos
setInterval(async () => {
  await serverStats.updateStats();
  io.emit('serverStats', serverStats); // Emitir las estadísticas al cliente
}, 2000); // Actualizar cada 2 segundos

// Iniciar el servidor
const PORT = 9000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
