#!/usr/local/bin/node
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');


const { execFile } = require('child_process');

// Roda um comando e devolve o texto (vazio se falhar: a banda é "extra", nunca pode derrubar a lista)
const rodar = (cmd, args) => new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, timeout: 8000 }, (err, stdout) => resolve(err ? '' : String(stdout)));
});

// Lê a saída de "ss -tinp": para cada conexão TCP, quem a segura (pids) e os bytes
// enviados/recebidos (contador do próprio TCP, sem iptables).
function lerSockets(texto) {
    const linhas = [];
    for (const l of texto.split('\n')) {
        if (!l.trim()) continue;
        if (/^\s/.test(l) && linhas.length) linhas[linhas.length - 1] += ' ' + l.trim(); // detalhes vêm na linha de baixo
        else linhas.push(l);
    }
    const sockets = [];
    for (const l of linhas) {
        const pids = [...l.matchAll(/pid=(\d+)/g)].map(m => Number(m[1]));
        const enviados = l.match(/bytes_sent:(\d+)/) || l.match(/bytes_acked:(\d+)/);
        const recebidos = l.match(/bytes_received:(\d+)/);
        if (!pids.length || (!enviados && !recebidos)) continue;
        sockets.push({ pids, enviados: enviados ? Number(enviados[1]) : 0, recebidos: recebidos ? Number(recebidos[1]) : 0 });
    }
    return sockets;
}

// Lê "ps -eo pid=,ppid=,user=,args=" e devolve { privPid: [pids da sessão] } para cada "sshd: user [priv]"
function lerSessoes(texto) {
    const procs = [];
    for (const l of texto.split('\n')) {
        const m = l.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
        if (m) procs.push({ pid: Number(m[1]), ppid: Number(m[2]), args: m[4] });
    }
    const sessoes = new Map();
    for (const pr of procs) {
        if (/^sshd:\s.*\[priv\]/.test(pr.args)) {
            sessoes.set(pr.pid, [pr.pid, ...procs.filter(c => c.ppid === pr.pid).map(c => c.pid)]);
        }
    }
    return sessoes;
}

// Banda de cada sessão SSH: Map(pid do "[priv]" -> { subida, descida }) em bytes.
// subida = o que o cliente enviou; descida = o que o cliente baixou.
async function coletarBandaPorSessao() {
    const resultado = new Map();
    try {
        const [ss, ps] = await Promise.all([rodar('ss', ['-tinp', 'state', 'established']), rodar('ps', ['-eo', 'pid=,ppid=,user=,args='])]);
        const sockets = lerSockets(ss);
        for (const [privPid, pids] of lerSessoes(ps)) {
            const conj = new Set(pids);
            let subida = 0, descida = 0, achou = false;
            for (const sk of sockets) {
                if (sk.pids.some(p => conj.has(p))) { subida += sk.recebidos; descida += sk.enviados; achou = true; }
            }
            if (achou) resultado.set(privPid, { subida, descida });
        }
    } catch (e) {
        console.error('Erro ao medir banda:', e.message);
    }
    return resultado;
}

// Função para remover duplicatas do array
const removeDuplicates = (array) => Array.from(new Set(array));

// Função para obter usuários online através do comando "ps aux"
const getOnlineUsers = () => new Promise(async (resolve, reject) => {
    const psAux = spawn('ps', ['aux']);

    let stdout = '';
    let stderr = '';

    psAux.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });

    psAux.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    psAux.on('close', async (code) => {
        if (code !== 0) {
            return reject();
        }

        const bandaPorPid = await coletarBandaPorSessao();
        const lines = stdout.split('\n');
        const sshLines = lines.filter(line => line.includes('sshd') && line.includes('[priv]'));

        const userList = [];

        // Para cada linha do processo SSH, obter o tempo de execução
        for (let line of sshLines) {
            const user = line.split('sshd:')[1].split('[priv]')[0].trim();
            const pidMatch = line.match(/\d+/); // Captura o PID do processo
            let uptime = '00:00:00';
            let banda = null;

            if (pidMatch) {
                const pid = pidMatch[0];
                banda = bandaPorPid.get(Number(pid)) || null;
                try {
                    uptime = await getProcessUptime(pid); // Obtém o tempo de execução
                } catch (error) {
                    console.error(error);
                }
            }

            const item = { user, uptime, modo: 'ssh' };
            if (banda) { item.uplink = banda.subida; item.downlink = banda.descida; }   // bytes desta sessão
            userList.push(item);
        }

        try {
            const userWithDetails = userList.map(user => ({
                ...user,
                connectionCount: user.modo == 'ssh' ? userList.filter(u => u.user === user.user).length : 1
            }));

            // Remove duplicatas com base na combinação de user e uptime
            const uniqueUsers = removeDuplicates(userWithDetails.map(u => JSON.stringify(u))).map(u => JSON.parse(u));

            resolve(uniqueUsers);
        } catch (error) {
            console.error('Error reading file:', error);
            resolve(userList);
        }
    });

    psAux.on('error', (error) => {
        reject();
    });
});

const getProcessUptime = (pid) => new Promise((resolve, reject) => {
    const ps = spawn('ps', ['-p', pid, '-o', 'etime=']);

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (chunk) => {
        stdout += chunk.toString().trim();
    });

    ps.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    ps.on('close', (code) => {
        if (code !== 0) {
            return reject();
        }
        resolve(stdout);
    });

    ps.on('error', (error) => {
        reject();
    });
});

module.exports = { getOnlineUsers, lerSockets, lerSessoes }
