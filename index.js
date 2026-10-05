#!/usr/local/bin/node

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const { execSync } = require('child_process');
const cron = require('node-cron');

//Modulos
const { crearteste } = require('./modulos/addteste');
const { criaruserssh } = require('./modulos/addlogin');
const { criarUserv2 } = require('./modulos/addV2');
const { criarUserxray } = require('./modulos/addxray');
const { deletexray_v2ray } = require('./modulos/deletexrayV2ray');
const { deleteUser } = require('./modulos/deleteUser');
const { getOnlineUsers } = require('./modulos/onlinesssh');
const { getonlinesV2 } = require('./modulos/onlinesV2');

const configpasta = 'config.json'
if (!fs.existsSync(configpasta)) {
    console.error('Arquivo config.json não encontrado');
    process.exit(1);
}

let config = JSON.parse(fs.readFileSync(configpasta, 'utf8'));

const port = config.porta;
const authToken = config.authToken;
const urlpainel = config.url
const urlonline = `${urlpainel}/onlines.php`;
const urlbk = `${urlpainel}/bk.php`;
const caminhoDelete = './usersToDelete.json';
const caminhoaddssh = './usersToaddssh.json';

// ---- Filas em arquivo (userDeleteALL / userSinc) ----
// Chave do item: o painel nem sempre manda "id"; sem isso a 2ª leva era descartada
// enquanto a 1ª ainda estava na fila ("Nenhum novo usuario adicionado").
const chaveItem = (u) => u.id !== undefined ? `id:${u.id}` : `${u.type}:${u.username}`;
function lerFila(caminho) {
    try {
        if (!fs.existsSync(caminho)) return [];
        const d = JSON.parse(fs.readFileSync(caminho, 'utf8'));
        return Array.isArray(d) ? d : [];
    } catch (e) {
        console.error('Fila corrompida, recomeçando:', caminho, e.message);
        return [];
    }
}
function gravarFila(caminho, lista) {
    fs.writeFileSync(caminho, JSON.stringify(lista, null, 2), 'utf8');
}
// Remove da fila (relendo o arquivo) só os itens processados; assim o que chegou
// durante o processamento não é apagado.
function removerDaFila(caminho, processados) {
    const chaves = new Set(processados.map(chaveItem));
    gravarFila(caminho, lerFila(caminho).filter(u => !chaves.has(chaveItem(u))));
}


const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));



// Função para verificar o token de autenticação
async function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    // console.log(req.headers)
    if (authHeader && authHeader.split(' ')[1] === authToken) {
        next();
    } else {
        res.status(401).json({ error: 'Autenticação necessária' });
    }
}


// Rota POST
app.post('/', (authenticate), async (req, res) => {
    const { comando, exec: execCmd, dados } = req.body;

    try {

        const comandosValidos = ['exec', 'criarTestssh', 'criaruserSsh', 'criarUserv2', 'criarUserxray', 'deleteUsers', 'userDeleteALL', 'userSinc', 'getOn'];
        if (!comandosValidos.includes(comando)) {
            return res.status(200).json({ icon: 'error', mensagem: `Comando desconhecido: ${comando}` });
        }

        //Executar comando no terminal
        if (comando === 'exec') {
            exec(execCmd, (error, stdout, stderr) => {
                if (error) {
                    res.status(200).json({ icon: 'error', mensagem: "Erro ao executar comando" });
                } else {
                    res.status(200).json({ icon: "success", mensagem: "comando executado", saida: stdout });
                }
            });
        }

        //Criar teste ssh
        if (comando === 'criarTestssh') {
            if (!dados) {
                return res.status(200).json({ icon: "error", mensagem: "Dados não fornecidos" });
            }
            console.log('Dados recebidos de criarTestssh: ', dados)
            const camposObrigatorios = ["username", "password", "dias", "sshlimiter"];
            for (const campo of camposObrigatorios) {
                if (!dados[campo]) {
                    return res.status(200).json({ icon: "error", mensagem: `Campo obrigatório ausente: ${campo}` });
                }
            }
            await deleteUser(dados.username);
            const criarteste = await crearteste(dados.username, dados.password, dados.dias, dados.sshlimiter);
            console.log('Resposta de criar teste: ', criarteste)

            res.status(200).json(criarteste);
        }

        //Criar usuario ssh
        if (comando === 'criaruserSsh') {
            if (!dados) {
                return res.status(200).json({ icon: "error", mensagem: "Dados não fornecidos" });
            }
            console.log('Dados recebidos de criaruserSsh: ', dados)
            const camposObrigatorios = ["username", "password", "dias", "sshlimiter"];
            for (const campo of camposObrigatorios) {
                if (!dados[campo]) {
                    return res.status(200).json({ icon: "error", mensagem: `Campo obrigatório ausente: ${campo}` });
                }
            }
            await deleteUser(dados.username);
            const criarUser = await criaruserssh(dados.username, dados.password, dados.dias, dados.sshlimiter);
            console.log('Resposta de criar UserSSH: ', criarUser)
            res.status(200).json(criarUser);
        }

        //Criar usuario V2ray
        if (comando === 'criarUserv2') {
            if (!dados) {
                return res.status(200).json({ icon: "error", mensagem: "Dados não fornecidos" });
            }
            console.log('Dados recebidos de criarUserv2: ', dados)
            const camposObrigatorios = ["uuid", "username"];
            for (const campo of camposObrigatorios) {
                if (!dados[campo]) {
                    return res.status(200).json({ icon: "error", mensagem: `Campo obrigatório ausente: ${campo}` });
                }
            }
            const dados2 = [
                { uuid: dados.uuid, email: dados.username },
            ]
            const criarUserv2ray = await criarUserv2(dados2);
            console.log('Resposta de criarUserv2ray: ', criarUserv2ray)
            res.status(200).json(criarUserv2ray);
            setTimeout(() => {
                try {
                    execSync(`systemctl restart v2ray`);
                } catch (error) {
                    console.log('erro ao reniciar v2ray')
                }
            }, 2000);

        }

        //Criar usuario Xray
        if (comando === 'criarUserxray') {
            if (!dados) {
                return res.status(200).json({ icon: "error", mensagem: "Dados não fornecidos" });
            }

            const camposObrigatorios = ["uuid", "username"];
            for (const campo of camposObrigatorios) {
                if (!dados[campo]) {
                    return res.status(200).json({ icon: "error", mensagem: `Campo obrigatório ausente: ${campo}` });
                }
            }
            const dados2 = [
                { uuid: dados.uuid, email: dados.username },
            ]
            const criarUserXray = await criarUserxray(dados2);
            res.status(200).json(criarUserXray);
            setTimeout(() => {
                try {
                    execSync(`systemctl restart xray`);
                } catch (error) {
                    console.log('erro ao reniciar xray')
                }
            }, 2000);
        }

        //Deletar usuario
        if (comando === 'deleteUsers') {
            if (!dados) {
                return res.status(200).json({ icon: "error", mensagem: "Dados não fornecidos" });
            }
            console.log('Dados recebidos de deleteUsers: ', dados)
            if (!dados.username) {
                return res.status(200).json({ icon: "error", mensagem: `Campos obrigatório ausente` });
            }

            // O painel manda o uuid como lista; aceita string também. (Já remove de xray e v2ray.)
            const uuids = (Array.isArray(dados.uuid) ? dados.uuid : [dados.uuid]).filter(u => u && u !== '0');
            if (uuids.length > 0) {
                const deleta_xray = await deletexray_v2ray(uuids);
                console.log('Resposta Delete xray/v2ray: ', deleta_xray)
            }

            const Deleteuser = await deleteUser(dados.username);
            console.log('Resposta Delete User: ', Deleteuser)

            res.status(200).json(Deleteuser);
        }

        //salvar usuarios para ser deletados
        if (comando === 'userDeleteALL') {
            let dadosAtuais = [];

            // Garante que "dados" seja um array
            if (!Array.isArray(dados)) {
                return res.status(200).json({ icon: "error", mensagem: `os dados recebidos não são um array.` });
            }

            const dadosValidos = dados.every(item => item && item.type && item.username);

            if (!dadosValidos) {
                return res.status(200).json({
                    icon: "error",
                    mensagem: `Dados faltando em um ou mais itens. Exemplo correto:\n[{type: 'ssh', username: 'teste123'}]`
                });
            }

            dadosAtuais = lerFila(caminhoDelete);
            const idsExistentes = new Set(dadosAtuais.map(chaveItem));
            const novosUsuarios = dados.filter(u => !idsExistentes.has(chaveItem(u)));

            if (novosUsuarios.length > 0) {
                gravarFila(caminhoDelete, [...dadosAtuais, ...novosUsuarios]);
                return res.status(200).json({ icon: "success", mensagem: `Usuarios adicionado e seram removidos em breve` });
            } else {
                return res.status(200).json({ icon: "error", mensagem: `Nenhum novo usuario adicionado` });
            }
        }

        //salvar usuarios ssh para ser adicionado
        if (comando === 'userSinc') {
            let dadosAtuais = [];

            // Garante que "dados" seja um array
            if (!Array.isArray(dados)) {
                return res.status(200).json({ icon: "error", mensagem: `os dados recebidos não são um array.` });
            }

            const typevalido = dados.every(item => item && item.type);

            if (!typevalido) {
                return res.status(200).json({
                    icon: "error",
                    mensagem: `Dados type faltando`
                });
            }

            dadosAtuais = lerFila(caminhoaddssh);
            const idsExistentes = new Set(dadosAtuais.map(chaveItem));
            const novosUsuarios = dados.filter(u => !idsExistentes.has(chaveItem(u)));

            if (novosUsuarios.length > 0) {
                gravarFila(caminhoaddssh, [...dadosAtuais, ...novosUsuarios]);
                return res.status(200).json({ icon: "success", mensagem: `Usuarios sendo sincronizados` });
            } else {
                return res.status(200).json({ icon: "error", mensagem: `Nenhum novo usuario adicionado` });
            }
        }

        //Buscar onlines
        if (comando === 'getOn') {
            try {
                const [rawV2, rawSSH] = await Promise.all([
                    getonlinesV2().catch(err => {
                        console.error('⚠️ Erro em getonlinesV2:', err);
                        return [];
                    }),
                    getOnlineUsers().catch(err => {
                        console.error('⚠️ Erro em getOnlineUsers:', err);
                        return [];
                    })
                ]);

                const onlinesV2 = Array.isArray(rawV2) ? rawV2 : [];
                const onlinesSSH = Array.isArray(rawSSH) ? rawSSH : [];

                const todosOnline = [
                    ...onlinesV2.map(user => ({ ...user, tipo: 'xray' })),
                    ...onlinesSSH.map(user => ({ ...user, tipo: 'ssh' }))
                ];

                const IP = await getPublicIP();
                const data = {
                    ip: IP,
                    onlines: todosOnline
                };

               return res.status(200).json({ icon: 'success', ...data});

            } catch (err) {
                console.error('❌ Erro no cron:', err);
            }
        }
    } catch (error) {
        console.log(error)
        res.status(200).json({ icon: 'error', mensagem: 'Erro ao processar', error: error });
    }

});

// Inicializa o servidor
app.listen(port, () => {
    console.log('Servidor iniciado');
});

//Manda onlines
cron.schedule('* * * * *', async () => {
    console.log('⏰ Cron onlines rodando');

    try {
        const [rawV2, rawSSH] = await Promise.all([
            getonlinesV2().catch(err => {
                console.error('⚠️ Erro em getonlinesV2:', err);
                return [];
            }),
            getOnlineUsers().catch(err => {
                console.error('⚠️ Erro em getOnlineUsers:', err);
                return [];
            })
        ]);

        const onlinesV2 = Array.isArray(rawV2) ? rawV2 : [];
        const onlinesSSH = Array.isArray(rawSSH) ? rawSSH : [];

        const todosOnline = [
            ...onlinesV2.map(user => ({ ...user, tipo: 'xray' })),
            ...onlinesSSH.map(user => ({ ...user, tipo: 'ssh' }))
        ];

        const IP = await getPublicIP();
        const data = {
            ip: IP,
            onlines: todosOnline
        };

        await axios.post(urlonline, data, { timeout: 30000 }).then((resposta) => {
            console.log('✅ Usuários online enviados com sucesso Resposta: ', resposta?.data);
        });

    } catch (err) {
        console.error('❌ Erro no cron:', err);
    }
});

//Deletar usuarios
let apagandoFila = false; // evita 2 execuções ao mesmo tempo (o cron roda a cada 3s)
cron.schedule('*/3 * * * * *', async () => {
    if (apagandoFila) return;
    apagandoFila = true;
    try {
        const dadosAtuais = lerFila(caminhoDelete);
        if (dadosAtuais.length === 0) return;

        // Pega um lote (SSH é um por vez: é lento porque derruba sessões)
        const lote = dadosAtuais.slice(0, 20);
        const xrayV2 = lote.filter(u => ['xray', 'v2ray', 'ssh_xray', 'ssh_v2ray'].includes(u.type) && u.uuid && u.uuid !== '0').map(u => u.uuid);
        if (xrayV2.length > 0) await deletexray_v2ray(xrayV2);

        const comSsh = lote.filter(u => ['ssh', 'ssh_xray', 'ssh_v2ray'].includes(u.type) && u.username);
        for (const u of comSsh.slice(0, 5)) {
            deleteUser(u.username);
        }

        // Tira da fila o que foi tratado: xray/v2ray puros e até 5 com SSH
        const feitos = lote.filter(u => !comSsh.includes(u) || comSsh.indexOf(u) < 5);
        removerDaFila(caminhoDelete, feitos);
    } catch (err) {
        console.error('❌ Erro ao apagar usuários:', err);
    } finally {
        apagandoFila = false;
    }
});


//add usuarios ssh
let adicionandoFila = false;
cron.schedule('*/3 * * * * *', async () => {
    if (adicionandoFila) return;
    adicionandoFila = true;
    try {
        const lote = lerFila(caminhoaddssh).slice(0, 20);
        if (lote.length === 0) return;

        const dadosv2 = [];
        const dadosxray = [];
        const temSsh = (u) => u.username && u.password && u.dias && u.sshlimiter;
        const temUuid = (u) => u.uuid && u.username;

        for (const u of lote) {
            try {
                console.log(`Adicionando: ${u.username}`);
                const comSsh = ['ssh', 'ssh_v2ray', 'ssh_xray'].includes(u.type);
                if (comSsh) {
                    if (temSsh(u)) {
                        // Usuário que já existe é mantido (a sincronização não derruba quem está online)
                        const r = await criaruserssh(u.username, u.password, u.dias, u.sshlimiter);
                        if (r.icon !== 'success') console.log(`Falha ao criar SSH ${u.username}:`, r);
                    } else {
                        console.log(`Dados faltando para criar usuário SSH:`, u);
                    }
                }
                if (u.type === 'v2ray' || u.type === 'ssh_v2ray') {
                    if (temUuid(u)) dadosv2.push({ email: u.username, uuid: u.uuid });
                    else console.log(`Dados faltando para criar usuário V2Ray:`, u);
                }
                if (u.type === 'xray' || u.type === 'ssh_xray') {
                    if (temUuid(u)) dadosxray.push({ email: u.username, uuid: u.uuid });
                    else console.log(`Dados faltando para criar usuário XRay:`, u);
                }
            } catch (error) {
                console.error(`Erro ao adicionar ${u.username}:`, error);
            }
        }

        if (dadosv2.length > 0) await criarUserv2(dadosv2);
        if (dadosxray.length > 0) await criarUserxray(dadosxray);

        // Remove só o lote processado (o que chegou durante o processamento fica)
        removerDaFila(caminhoaddssh, lote);
    } catch (err) {
        console.error('❌ Erro ao adicionar usuários:', err);
    } finally {
        adicionandoFila = false;
    }
});

//fazer backup do painel
cron.schedule('*/15 * * * *', async () => {
    try {
        await axios.get(urlbk, { timeout: 60000 });
    } catch (err) {
        console.error('❌ Erro no backup do painel:', err.message);
    }
});


async function getPublicIP() {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 10000 });
    const ip = response.data.ip;
    return ip;
}
