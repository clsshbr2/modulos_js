const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const { loginValido, hashSenha } = require('./util');

function crearteste(username, password, dias, sshlimiter) {
  if (!loginValido(username)) {
    return { icon: 'error', mensagem: 'Login inválido' };
  }
  const minutos = parseInt(dias);
  if (!(minutos > 0)) {
    return { icon: 'error', mensagem: 'Tempo do teste inválido' };
  }

  try {
    // Data de expiração (formato YYYY-MM-DD)
    const finalDate = execSync(`date "+%Y-%m-%d" -d "+2 days"`).toString().trim();

    execFileSync('useradd', ['-e', finalDate, '-M', '-s', '/bin/false', '-p', hashSenha(password), username]);

    // Salvar senha em /etc/SSHPlus/senha/
    const senhaDir = '/etc/SSHPlus/senha';
    if (!fs.existsSync(senhaDir)) fs.mkdirSync(senhaDir, { recursive: true });
    fs.writeFileSync(`${senhaDir}/${username}`, password);

    // Adicionar ao banco de dados (sem duplicar)
    const dbFile = '/root/usuarios.db';
    let linhas = fs.existsSync(dbFile) ? fs.readFileSync(dbFile, 'utf8').split('\n') : [];
    linhas = linhas.filter(l => l.trim() !== '' && l.split(/\s+/)[0] !== username);
    linhas.push(`${username} ${sshlimiter}`);
    fs.writeFileSync(dbFile, linhas.join('\n') + '\n');

    // Script de remoção. "pkill -f username" matava QUALQUER processo cujo comando
    // contivesse o texto; agora mata só os processos do usuário.
    const removerDir = '/etc/SSHPlus/userteste';
    const removerScript = `${removerDir}/${username}.sh`;
    const removerConteudo = `#!/bin/bash
pkill -KILL -u ${username}
userdel --force ${username}
grep -v "^${username}[[:space:]]" /root/usuarios.db > /tmp/ph.${username} ; cat /tmp/ph.${username} > /root/usuarios.db ; rm -f /tmp/ph.${username}
rm -f /etc/SSHPlus/senha/${username} > /dev/null 2>&1
rm -f ${removerScript}
exit 0
`;
    if (!fs.existsSync(removerDir)) fs.mkdirSync(removerDir, { recursive: true });
    fs.writeFileSync(removerScript, removerConteudo);
    execSync(`chmod +x ${removerScript}`);

    // Agendar a remoção
    execSync(`at -f ${removerScript} now + ${minutos} min > /dev/null 2>&1`);

    return { icon: 'success', mensagem: 'Teste criado' };
  } catch (error) {
    return { icon: 'error', mensagem: 'erro ao criar teste', error: error.message };
  }
}

module.exports = { crearteste };
