const fs = require('fs');
const { execFile } = require('child_process');

const PROXY_BIN = '/usr/local/bin/proxy-server';
const STATS_JSON = '/etc/proto-server/stats.json';
const STATS_TOLERANCIA_SEG = 180; // quem não aparece no stats.json há mais que isso já saiu

const rodar = (cmd, args) => new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, timeout: 8000 }, (err, stdout) => resolve(err ? '' : String(stdout)));
});

const dois = (n) => String(n).padStart(2, '0');

// segundos -> "HH:MM:SS" ou "D-HH:MM:SS" (mesmo formato do "ps -o etime=" que o painel já recebe)
function formatarSegundos(total) {
    total = Math.max(0, Math.floor(total));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return (d > 0 ? d + '-' : '') + dois(h) + ':' + dois(m) + ':' + dois(s);
}

// "02:04:33", "1d 16:48:38" ou "04:33" -> segundos
function lerDuracao(texto) {
    const m = String(texto).trim().match(/^(?:(\d+)d\s*)?(?:(\d+):)?(\d+):(\d+)$/);
    if (!m) return null;
    return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3]) * 60) + Number(m[4]);
}

// Saída de "proxy-server --onlines":
//   USER                     CONNS    TIME (UPTIME)
//   Jeferson79               2        07:18:12 (total)
//     ├─ tunnel #1 (ssh): 07:18:12 [client]
//   Aline29                  1        02:04:28
// Uma linha por usuário (as linhas "tunnel" começam com espaço e são ignoradas).
function lerProxyOnlines(texto) {
    const lista = [];
    for (const linha of String(texto).split('\n')) {
        const m = linha.match(/^(\S+)\s+(\d+)\s+(.+?)(?:\s+\(total\))?\s*$/);
        if (!m || m[1] === 'USER' || /^-+$/.test(m[1])) continue;
        const segundos = lerDuracao(m[3]);
        if (segundos === null) continue; // não era uma linha de usuário
        lista.push({ user: m[1], uptime: formatarSegundos(segundos), modo: 'ssh', connectionCount: Number(m[2]) });
    }
    return lista;
}

// "2026-10-06 00:10:58" (horário do servidor) -> Date
function lerData(texto) {
    const d = new Date(String(texto || '').replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
}

// Conteúdo de /etc/proto-server/stats.json: { "10.10.0.3": { id, ip, traffic_up, traffic_down, last_seen_at, connected_at }, ... }
function lerStatsOnlines(texto, agora = new Date()) {
    let obj;
    try { obj = JSON.parse(texto); } catch (e) { return []; }
    if (!obj || typeof obj !== 'object') return [];
    const lista = [];
    for (const item of Object.values(obj)) {
        if (!item || !item.id) continue;
        const visto = lerData(item.last_seen_at);
        if (visto && (agora - visto) / 1000 > STATS_TOLERANCIA_SEG) continue;
        const inicio = lerData(item.connected_at);
        lista.push({
            user: String(item.id),
            uptime: formatarSegundos(inicio ? (agora - inicio) / 1000 : 0),
            modo: 'ssh',
            connectionCount: 1,
            uplink: Math.max(0, Number(item.traffic_up) || 0),
            downlink: Math.max(0, Number(item.traffic_down) || 0)
        });
    }
    return lista;
}

async function getOnlinesProxy() {
    if (!fs.existsSync(PROXY_BIN)) return [];
    try { return lerProxyOnlines(await rodar(PROXY_BIN, ['--onlines'])); } catch (e) { return []; }
}

async function getOnlinesStats() {
    try {
        if (!fs.existsSync(STATS_JSON)) return [];
        return lerStatsOnlines(fs.readFileSync(STATS_JSON, 'utf8'));
    } catch (e) { return []; }
}

// Junta tudo numa lista só. Quem já veio do SSH (ps) não entra de novo pelo proxy-server
// (é a mesma sessão); o stats.json traz a banda e entra por conexão.
function mesclarOnlines(ssh, proxy, stats) {
    const jaTem = new Set(ssh.map(u => u.user));
    const extras = [];
    for (const u of proxy) {
        if (jaTem.has(u.user)) continue;
        jaTem.add(u.user);
        extras.push(u);
    }
    for (const u of stats) {
        if (jaTem.has(u.user) && !extras.some(e => e.user === u.user)) continue; // já contado pelo SSH
        const existente = extras.find(e => e.user === u.user);
        if (existente) { // veio do proxy-server: só acrescenta a banda
            existente.uplink = (existente.uplink || 0) + u.uplink;
            existente.downlink = (existente.downlink || 0) + u.downlink;
            continue;
        }
        jaTem.add(u.user);
        extras.push(u);
    }
    return [...ssh, ...extras];
}

module.exports = { getOnlinesProxy, getOnlinesStats, mesclarOnlines, lerProxyOnlines, lerStatsOnlines, formatarSegundos };
