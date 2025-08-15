const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = './stats.proto';
const UPTIME_FILE = './uptime.json';

// Função para carregar ou inicializar o arquivo de uptime
function loadUptimeData() {
  if (fs.existsSync(UPTIME_FILE)) {
    return JSON.parse(fs.readFileSync(UPTIME_FILE, 'utf-8'));
  }
  return {};
}

// Função para salvar dados de uptime
function saveUptimeData(data) {
  fs.writeFileSync(UPTIME_FILE, JSON.stringify(data, null, 2));
}

// Função para formatar o uptime em HH:mm:ss
function formatUptime(startTime) {
  try {
    const now = new Date();
    const diffMs = now - new Date(startTime);
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diffSec % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Erro ao formatar uptime:', error.message);
    return '00:00:00';
  }

}

async function getonlinesV2() {
  try {
    const portaapi = await pegarPortaInbound();
    if (!portaapi) {
      console.log('Erro ao buscar porta');
      return false;
    }

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {});
    const proto = grpc.loadPackageDefinition(packageDefinition).v2ray.core.app.stats.command;

    const client = new proto.StatsService(`127.0.0.1:${portaapi}`, grpc.credentials.createInsecure());

    // Carregar dados de uptime
    const uptimeData = loadUptimeData();

    return new Promise((resolve, reject) => {
      client.QueryStats({ pattern: 'user>>>', reset: false }, (err, response) => {
        if (err) {
          console.error('Erro ao consultar stats:', err.message);
          return reject(err);
        }
        if (!response || !Array.isArray(response.stats)) {
          console.warn('Nenhuma estatística retornada ou formato inválido.');
          return resolve([]); // ou resolve(false), se preferir
        }

        const usuariosMap = {};
        const activeUsers = new Set();

        for (const stat of response.stats) {
          const match = stat.name.match(/user>>>(([^>]+))>>>/);
          if (match) {
            const user = match[1];
            activeUsers.add(user);
            if (!usuariosMap[user]) {
              // Registrar o início se o usuário não está no uptimeData
              if (!uptimeData[user]) {
                uptimeData[user] = { startTime: new Date().toISOString() };
              }
              
              usuariosMap[user] = {
                user: user,
                uptime: formatUptime(uptimeData[user].startTime),
                modo: 'xray',
                connectionCount: 1,
                uplink: 0,
                downlink: 0
              };
            }

            if (stat.name.includes('uplink')) usuariosMap[user].uplink = stat.value;
            if (stat.name.includes('downlink')) usuariosMap[user].downlink = stat.value;

            // Se não há tráfego, remover o usuário do uptimeData
            if (usuariosMap[user].uplink == 0 && usuariosMap[user].downlink == 0) {
              delete uptimeData[user];
            }
          }
        }

        // Remover usuários inativos do uptimeData
        for (const user of Object.keys(uptimeData)) {
          if (!activeUsers.has(user) || (usuariosMap[user] && usuariosMap[user].uplink == 0 && usuariosMap[user].downlink == 0)) {
            delete uptimeData[user];
          }
        }

        // Salvar dados de uptime atualizados
        saveUptimeData(uptimeData);

        // Filtrar apenas usuários ativos
        const usuariosAtivos = Object.values(usuariosMap).filter(
          u => u.uplink > 0 || u.downlink > 0
        );
        console.log(usuariosAtivos)
        resolve(usuariosAtivos);
      });
    });

  } catch (error) {
    console.error('Erro ao acessar API do Xray:', error.message);
    return [];
  }
}

function pegarPortaInbound() {

  const v2ray = [
    '/etc/xray/config.json',
    '/usr/local/etc/xray/config.json',
    '../teste.json',
  ]

  let configPath = v2ray.find(p => fs.existsSync(p));
  if (!configPath) {
    console.log('❌ config.json não encontrado nos caminhos padrão.');
    return false
  }
  const configRaw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configRaw);

  // Procurar inbound do protocolo desejado
  const inbound = config.inbounds.find(inb => inb.protocol === 'dokodemo-door');
  if (!inbound) {
    throw new Error(`Inbound com protocolo "dokodemo-door" não encontrado.`);
  }

  return inbound.port;
}

module.exports = { getonlinesV2 }
