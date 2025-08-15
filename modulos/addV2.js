const fs = require('fs');
const { execSync } = require('child_process');

function criarUserv2(users) {
    const configPaths = [
        '/usr/local/etc/v2ray/config.json',
        '/etc/v2ray/config.json',
        'teste.json'
    ];

    let configPath = configPaths.find(p => fs.existsSync(p));

    if (!configPath) {
        return { icon: 'error', mensagem: 'Arquivo json não encontrado o v2ray não instalado' };
    }

    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const inbound = config.inbounds.find(i => i?.settings?.clients);
    if (!inbound) {
        return { icon: 'error', mensagem: 'Erro ao processar arquivo json' };
    }

    users.forEach(({ uuid, email }) => {
        const index = inbound.settings.clients.findIndex(c => c.id === uuid || c.email === email);

        if (index !== -1) {
            // Atualiza cliente existente
            inbound.settings.clients[index] = {
                email,
                id: uuid,
                level: 0
            };
        } else {
            // Adiciona novo cliente
            inbound.settings.clients.push({
                email,
                id: uuid,
                level: 0
            });
        }
    });

    // Salva alterações
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    try {
        execSync(`systemctl restart v2ray`);  
    } catch (error) {
        console.log('erro ao reniciar v2ray')
    }

    try {
        return { icon: 'success', mensagem: 'Usuários criados/atualizados com sucesso' };
    } catch (err) {
        return { icon: 'error', mensagem: 'Erro ao criar Usuários V2' };
    }
}
const novosUsuarios = [
    { uuid: 'uuid-1', email: 'email1@example.com' },
    { uuid: 'uuid-2', email: 'email2@example.com' },
    { uuid: 'uuid-3', email: 'email3@example.com' }
];

module.exports = { criarUserv2 }
