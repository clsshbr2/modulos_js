const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function crearteste(username, password, dias, sshlimiter) {
  try {
    // Criptografar senha com Perl
    const pass = execSync(`perl -e 'print crypt("${password}", "password")'`).toString().trim();

    // Data de expiração (formato YYYY-MM-DD)
    const finalDate = execSync(`date "+%Y-%m-%d" -d "+2 days"`).toString().trim();

    // Criar usuário
    execSync(`useradd -e ${finalDate} -M -s /bin/false -p '${pass}' ${username}`);

    // Salvar senha em /etc/SSHPlus/senha/
    const senhaDir = '/etc/SSHPlus/senha';
    if (!fs.existsSync(senhaDir)) fs.mkdirSync(senhaDir, { recursive: true });
    fs.writeFileSync(`${senhaDir}/${username}`, password);

    // Adicionar ao banco de dados
    const dbLine = `${username} ${sshlimiter}\n`;
    fs.appendFileSync('/root/usuarios.db', dbLine);

    // Criar script de remoção
    const removerScript = `/etc/SSHPlus/userteste/${username}.sh`;
    const removerConteudo = `#!/bin/bash
      pkill -f "${username}"
      userdel --force ${username}
      grep -v ^${username}[[:space:]] /root/usuarios.db > /tmp/ph ; cat /tmp/ph > /root/usuarios.db
      rm /etc/SSHPlus/senha/${username} > /dev/null 2>&1
      rm -rf /etc/SSHPlus/userteste/${username}.sh
      exit
    `;

    const removerDir = '/etc/SSHPlus/userteste';
    if (!fs.existsSync(removerDir)) fs.mkdirSync(removerDir, { recursive: true });
    fs.writeFileSync(removerScript, removerConteudo);
    execSync(`chmod +x ${removerScript}`);

    // Agendar a remoção
    execSync(`at -f ${removerScript} now + ${dias} min > /dev/null 2>&1`);

    return { icon: 'success', mensagem: 'Teste criado' }
  } catch (error) {
    return { icon: 'error', mensagem: 'erro ao criar teste', error:  error.message}
  }

}

module.exports = { crearteste }