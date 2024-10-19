// Server.js
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
        mem: (proc.memRss / (1024 * 1024)).toFixed(2),
        memPercent: proc.mem / (os.totalmem() * 1024 * 1024) * 100, // Porcentaje de memoria utilizada
        uptime: proc.uptime, // Tiempo de actividad en segundos
        user: proc.user, // Usuario que ejecuta el proceso
        command: proc.cmd // Comando que inició el proceso
      }));
  }
  
}

module.exports = Server; // Exportar la clase para que pueda ser utilizada en otros archivos
