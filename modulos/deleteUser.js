const fs = require('fs');
const { execSync } = require('child_process');

function deleteUser(username) {
  try {
    if (username === 'root') {
      return { icon: 'error', mensagem: 'Não é possível remover o usuário root' };
    }

    // Verifica se o usuário existe
    try {
      execSync(`id ${username}`);
    } catch {
      // Se não existir, apenas retorna sucesso sem fazer nada
      return { icon: 'success', mensagem: `Usuário '${username}' não existe. Nada a deletar.` };
    }

    // Obtém os PIDs dos processos do usuário
    const pidList = execSync(`ps -fu ${username} | awk '{print $2}' | grep -v PID | tr -s '\n' ' '`).toString().trim();

    if (pidList) {
      // Mata os processos do usuário
      execSync(`kill -9 ${pidList}`);
    }

    // Remove o usuário do sistema
    execSync(`userdel ${username}`);

    // Remove o usuário do banco de dados
    execSync(`grep -v "^${username}[[:space:]]" /root/usuarios.db > /tmp/ph`);
    execSync(`cat /tmp/ph > /root/usuarios.db`);

    // Remove arquivos relacionados ao usuário
    execSync(`rm -f /etc/SSHPlus/senha/${username}`);
    execSync(`rm -f /etc/usuarios/${username}`);

    return { icon: 'success', mensagem: 'Usuário SSH deletado com sucesso' };

  } catch (error) {
    return { icon: 'error', mensagem: 'Erro ao deletar usuário SSH', error: error.message };
  }
}

module.exports = { deleteUser };
