const fs = require('fs');
const { execSync, execFileSync } = require('child_process');
const { loginValido, hashSenha } = require('./util');

function criaruserssh(username, password, dias, sshlimiter) {
  if (!loginValido(username)) {
    return { icon: 'error', mensagem: 'Login inválido' };
  }

  let existe = true;
  try {
    execFileSync('getent', ['passwd', username], { stdio: 'ignore' });
  } catch (error) {
    existe = false;
  }
  if (existe) {
    return { icon: 'error', mensagem: 'Usuario já existe' };
  }

  try {
    const d = parseInt(dias) + 1;
    const finalDate = execSync(`date "+%Y-%m-%d" -d "+${d} days"`).toString().trim();

    // Cria o usuário (sem shell: nada da senha/login passa por interpretador)
    execFileSync('useradd', ['-e', finalDate, '-M', '-s', '/bin/false', '-p', hashSenha(password), username]);

    // Salva a senha
    const senhaDir = '/etc/SSHPlus/senha';
    if (!fs.existsSync(senhaDir)) fs.mkdirSync(senhaDir, { recursive: true });
    fs.writeFileSync(`${senhaDir}/${username}`, password);

    // Adiciona ao banco de dados de usuários (sem duplicar a linha)
    const dbFile = '/root/usuarios.db';
    let linhas = fs.existsSync(dbFile) ? fs.readFileSync(dbFile, 'utf8').split('\n') : [];
    linhas = linhas.filter(l => l.trim() !== '' && l.split(/\s+/)[0] !== username);
    linhas.push(`${username} ${sshlimiter}`);
    fs.writeFileSync(dbFile, linhas.join('\n') + '\n');

    return { icon: 'success', mensagem: 'Usuario criado com sucesso' };
  } catch (error) {
    return { icon: 'error', mensagem: 'Erro ao criar usuario', error: error.message };
  }
}
module.exports = { criaruserssh };
