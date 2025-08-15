#!/usr/local/bin/node
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');


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

        const lines = stdout.split('\n');
        const sshLines = lines.filter(line => line.includes('sshd') && line.includes('[priv]'));

        const userList = [];

        // Para cada linha do processo SSH, obter o tempo de execução
        for (let line of sshLines) {
            const user = line.split('sshd:')[1].split('[priv]')[0].trim();
            const pidMatch = line.match(/\d+/); // Captura o PID do processo
            let uptime = '00:00:00';

            if (pidMatch) {
                const pid = pidMatch[0];
                try {
                    uptime = await getProcessUptime(pid); // Obtém o tempo de execução
                } catch (error) {
                    console.error(error);
                }
            }

            userList.push({ user, uptime, modo: 'ssh' });
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

module.exports = { getOnlineUsers }
