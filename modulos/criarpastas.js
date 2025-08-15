const fs = require('fs');
const path = require('path');

const logDir = '/var/log/v2ray';
const accessLog = path.join(logDir, 'access.log');
const errorLog = path.join(logDir, 'error.log');

function garantirDiretorioELogs() {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        fs.chmodSync(logDir, 0o755);
        console.log(`📁 Diretório ${logDir} criado com permissões 755`);
    }

    // Criar arquivos de log se não existirem
    if (!fs.existsSync(accessLog)) {
        fs.writeFileSync(accessLog, '');
        console.log(`📄 Arquivo ${accessLog} criado`);
    }

    if (!fs.existsSync(errorLog)) {
        fs.writeFileSync(errorLog, '');
        console.log(`📄 Arquivo ${errorLog} criado`);
    }
}

function configurarLogs(configPaths) {
    let configPath = configPaths.find(p => fs.existsSync(p));

    if (!configPath) {
        console.error('❌ config.json não encontrado nos caminhos padrão.');
        process.exit(1);
    }

    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Atualizar logs apenas se não estiverem definidos corretamente
    config.log = config.log || {};
    config.log.access = accessLog;
    config.log.error = errorLog;
    config.log.loglevel = config.log.loglevel || "info";

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Logs configurados em: ${configPath}`);
}

function gerararquivo(method) {
    garantirDiretorioELogs();

    const paths = {
        v2ray: [
            '/etc/v2ray/config.json',
            '/usr/local/etc/v2ray/config.json',
            'teste.json',
        ],
        xray: [
            '/etc/xray/config.json',
            '/usr/local/etc/xray/config.json',
            'teste.json',
        ]
    };

    if (method === 'v2ray') {
        configurarLogs(paths.v2ray);
    } else if (method === 'xray') {
        configurarLogs(paths.xray);
    } else {
        console.error('❌ Método inválido. Use "v2ray" ou "xray".');
    }
}
gerararquivo('xray')
module.exports = { gerararquivo };
