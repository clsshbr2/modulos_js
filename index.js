#!/usr/local/bin/node

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const { execSync } = require('child_process');
const cron = require('node-cron');

//Modulos
const { crearteste } = require('modulos/addteste');
const { criaruserssh } = require('modulos/addlogin');
const { criarUserv2 } = require('modulos/addV2');
const { criarUserxray } = require('modulos/addxray');
const { deletexray_v2ray } = require('modulos/deletexrayV2ray');
const { deleteUser } = require('modulos/deleteUser');
const { getOnlineUsers } = require('modulos/onlinesssh');
const { getonlinesV2 } = require('modulos/onlinesV2');

const configpasta = 'config.json'
if (!fs.existsSync(configpasta)) {
    process.exit('Arquivo json não encontrado');
}

let config = JSON.parse(fs.readFileSync(configpasta, 'utf8'));

const port = config.porta;
const authToken = config.authToken;
const urlpainel = config.url
const urlonline = `${urlpainel}/onlines.php`;
const urlbk = `${urlpainel}/bk.php`;
const caminhoDelete = './usersToDelete.json';
const caminhoaddssh = './usersToaddssh.json';


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
            if (!dados.uuid || !dados.username) {
                return res.status(200).json({ icon: "error", mensagem: `Campos obrigatório ausente` });
            }

            const deleta_xray = await deletexray_v2ray([dados.uuid]);
            console.log('Resposta Delete xray: ', deleta_xray)

            const deleta_v2ray = await deletexray_v2ray([dados.uuid]);
            console.log('Resposta Delete xray: ', deleta_v2ray)

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

            // Se o arquivo existir, carrega os dados existentes
            if (fs.existsSync(caminhoDelete)) {
                dadosAtuais = JSON.parse(fs.readFileSync(caminhoDelete, 'utf8'));
            }

            // Cria um Set com os IDs já existentes
            const idsExistentes = new Set(dadosAtuais.map(u => u.id));

            // Filtra os novos usuários para adicionar somente os que não estão no arquivo
            const novosUsuarios = dados.filter(u => !idsExistentes.has(u.id));

            if (novosUsuarios.length > 0) {
                // Adiciona os novos usuários ao array e salva novamente
                const dadosAtualizados = [...dadosAtuais, ...novosUsuarios];
                fs.writeFileSync(caminhoDelete, JSON.stringify(dadosAtualizados, null, 2), 'utf8');
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

            if (fs.existsSync(caminhoaddssh)) {
                dadosAtuais = JSON.parse(fs.readFileSync(caminhoaddssh, 'utf8'));
            }
            const idsExistentes = new Set(dadosAtuais.map(u => u.id));

            const novosUsuarios = dados.filter(u => !idsExistentes.has(u.id));

            if (novosUsuarios.length > 0) {
                // Adiciona os novos usuários ao array e salva novamente
                const dadosAtualizados = [...dadosAtuais, ...novosUsuarios];
                fs.writeFileSync(caminhoaddssh, JSON.stringify(dadosAtualizados, null, 2), 'utf8');
                return res.status(200).json({ icon: "success", mensagem: `Usuarios sendo sincronizados` });
            } else {
                return res.status(200).json({ icon: "error", mensagem: `Nenhum novo usuario adicionado` });
            }
        }

        if (comando === 'get_online') {
            try {
                const [rawV2, rawSSH] = await Promise.all([
                    getonlinesV2().catch(err => {
                        console.error('⚠️ Erro em getonlinesV2:', err.message);
                        return [];
                    }),
                    getOnlineUsers().catch(err => {
                        console.error('⚠️ Erro em getOnlineUsers:', err.message);
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

                return res.status(200).json({ icon: "success", mensagem: data });

            } catch (err) {
              return res.status(200).json({ icon: "error", mensagem: `Erro ao buscar onlines` });
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
                console.error('⚠️ Erro em getonlinesV2:', err.message);
                return [];
            }),
            getOnlineUsers().catch(err => {
                console.error('⚠️ Erro em getOnlineUsers:', err.message);
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

        await axios.post(urlonline, data).then((resposta) => {
            console.log('✅ Usuários online enviados com sucesso Resposta: ', resposta?.data);
        });

    } catch (err) {
        console.error('❌ Erro no cron:', err);
    }
});

//Deletar usuarios
cron.schedule('*/3 * * * * *', async () => {
    if (!fs.existsSync(caminhoDelete)) return;

    let dadosAtuais = JSON.parse(fs.readFileSync(caminhoDelete, 'utf8'));
    if (dadosAtuais.length === 0) return;

    // Filtra por tipo
    const xray = dadosAtuais.filter(u => u.type === 'xray' || u.type === 'ssh_xray').map(u => u.uuid);
    const v2ray = dadosAtuais.filter(u => u.type === 'v2ray' || u.type === 'ssh_v2ray').map(u => u.uuid);
    const sshUser = dadosAtuais.find(u => u.type === 'ssh'); // apenas 1 ssh por vez
    // Deleta lotes
    if (xray.length > 0) await deletexray_v2ray(xray);
    if (v2ray.length > 0) await deletexray_v2ray(v2ray);
    if (sshUser) await deleteUser(sshUser.username);

    // Atualiza os tipos deletados (xray e v2ray) para 'ssh'
    dadosAtuais = dadosAtuais.map(u => {
        if (
            (u.type === 'xray' || u.type === 'ssh_xray') ||
            (u.type === 'v2ray' || u.type === 'ssh_v2ray')
        ) {
            return { ...u, type: 'ssh' };
        }
        return u;
    });

    // Remove o ssh que foi realmente deletado
    if (sshUser) {
        dadosAtuais = dadosAtuais.filter(u => u.username !== sshUser.username);
    }

    // Salva o JSON atualizado
    fs.writeFileSync(caminhoDelete, JSON.stringify(dadosAtuais, null, 2), 'utf8');
});

//add usuarios ssh
cron.schedule('*/3 * * * * *', async () => {
    if (fs.existsSync(caminhoaddssh)) {
        let dadosAtuais = JSON.parse(fs.readFileSync(caminhoaddssh, 'utf8'));

        if (dadosAtuais.length > 0) {
            const processados = [];
            let dadosv2 = []
            let dadosxray = []
            for (const usuarioParaadd of dadosAtuais) {
                try {
                    processados.push(usuarioParaadd);
                    console.log(`Adicionando: ${usuarioParaadd.username}`);

                    if (usuarioParaadd.type === 'ssh') {
                        if (usuarioParaadd.username && usuarioParaadd.password && usuarioParaadd.dias && usuarioParaadd.sshlimiter) {
                            await criaruserssh(usuarioParaadd.username, usuarioParaadd.password, usuarioParaadd.dias, usuarioParaadd.sshlimiter);
                        } else {
                            console.log(`Dados faltando para criar usuário SSH:`, usuarioParaadd);
                        }
                    }

                    if (usuarioParaadd.type === 'v2ray') {
                        if (usuarioParaadd.uuid && usuarioParaadd.username) {
                            dadosv2.push({ email: usuarioParaadd.username, uuid: usuarioParaadd.uuid })

                        } else {
                            console.log(`Dados faltando para criar usuário V2Ray:`, usuarioParaadd);
                        }
                    }

                    if (usuarioParaadd.type === 'xray') {
                        if (usuarioParaadd.uuid && usuarioParaadd.username) {
                            dadosxray.push({ email: usuarioParaadd.username, uuid: usuarioParaadd.uuid })
                        } else {
                            console.log(`Dados faltando para criar usuário XRay:`, usuarioParaadd);

                        }
                    }

                    if (usuarioParaadd.type === 'ssh_v2ray') {
                        if (usuarioParaadd.username && usuarioParaadd.password && usuarioParaadd.dias && usuarioParaadd.sshlimiter) {
                            await criaruserssh(usuarioParaadd.username, usuarioParaadd.password, usuarioParaadd.dias, usuarioParaadd.sshlimiter);
                        } else {
                            console.log(`Dados faltando para criar usuário SSH:`, usuarioParaadd);
                        }
                        if (usuarioParaadd.uuid && usuarioParaadd.username) {
                            dadosv2.push({ email: usuarioParaadd.username, uuid: usuarioParaadd.uuid })

                        } else {
                            console.log(`Dados faltando para criar usuário V2Ray:`, usuarioParaadd);
                        }
                    }

                    if (usuarioParaadd.type === 'ssh_xray') {
                        if (usuarioParaadd.username && usuarioParaadd.password && usuarioParaadd.dias && usuarioParaadd.sshlimiter) {
                            await criaruserssh(usuarioParaadd.username, usuarioParaadd.password, usuarioParaadd.dias, usuarioParaadd.sshlimiter);
                        } else {
                            console.log(`Dados faltando para criar usuário SSH:`, usuarioParaadd);
                        }
                        if (usuarioParaadd.uuid && usuarioParaadd.username) {
                            dadosxray.push({ email: usuarioParaadd.username, uuid: usuarioParaadd.uuid })
                        } else {
                            console.log(`Dados faltando para criar usuário XRay:`, usuarioParaadd);

                        }
                    }
                } catch (error) {

                }

            }

            if (dadosv2.length > 0) {
                await criarUserv2(dadosv2)
            }

            if (dadosxray.length > 0) {
                await criarUserxray(dadosxray);
            }

            // Remove os usuários processados da lista
            const dadosRestantes = dadosAtuais.filter(u => !processados.includes(u));
            fs.writeFileSync(caminhoaddssh, JSON.stringify(dadosRestantes, null, 2), 'utf8');
        }
    }
});

//fazer backup do painel
cron.schedule('*/15 * * * *', async () => {
    await axios.get(urlbk);
});


async function getPublicIP() {
    const response = await axios.get('https://api.ipify.org?format=json');
    const ip = response.data.ip;
    return ip;
}
