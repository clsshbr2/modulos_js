const fs = require('fs');
const { execSync } = require('child_process');


function criaruserssh(username, password, dias, sshlimiter) {
  try {
    const userExists = execSync(`grep -q "^${username}:" /etc/passwd`);
    if (userExists) {
      return { icon: 'error', mensagem: 'Usuario já existe' }
    }
  } catch (error) {

    try {
      // Caso o usuário não exista
      const finalDate = execSync(`date "+%Y-%m-%d" -d "+${parseInt(dias) + 1} days"`).toString().trim();
      const guiDate = execSync(`date "+%d/%m/%Y" -d "+${parseInt(dias) + 1} days"`).toString().trim();

      // Criptografa a senha com Perl
      const pass = execSync(`perl -e 'print crypt("${password}", "password")'`).toString().trim();

      // Cria o usuário
      execSync(`useradd -e ${finalDate} -M -s /bin/false -p '${pass}' ${username}`);

      // Salva a senha
      const senhaDir = '/etc/SSHPlus/senha';
      if (!fs.existsSync(senhaDir)) fs.mkdirSync(senhaDir, { recursive: true });
      fs.writeFileSync(`${senhaDir}/${username}`, password);

      // Adiciona ao banco de dados de usuários
      const dbLine = `${username} ${sshlimiter}\n`;
      fs.appendFileSync('/root/usuarios.db', dbLine);

      return { icon: 'success', mensagem: 'Usuario criado com sucesso' }
    } catch (error) {
      return { icon: 'error', mensagem: 'Erro ao criar usuario', error: error }
    }

  }
}
module.exports = { criaruserssh }


