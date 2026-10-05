const fs = require('fs');
const { execFileSync } = require('child_process');
const { loginValido } = require('./util');

function sh(cmd, args) {
  try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

function deleteUser(username) {
  try {
    if (username === 'root') {
      return { icon: 'error', mensagem: 'Não é possível remover o usuário root' };
    }
    if (!loginValido(username)) {
      return { icon: 'error', mensagem: 'Login inválido' };
    }

    // Se o usuário não existe no sistema, só limpa os restos (db/senha) e retorna sucesso
    const existe = sh('id', [username]);

    if (existe) {
      // Derruba as sessões e remove o usuário. Antes, se o "kill" falhasse (processo
      // já tinha saído) ou o userdel rodasse antes dos processos morrerem, a remoção
      // dava erro e o usuário ficava na VPS -> depois "Usuario já existe" ao editar/renovar.
      for (let i = 0; i < 5; i++) {
        sh('pkill', ['-KILL', '-u', username]);
        if (sh('userdel', ['-f', username])) break;
        execFileSync('sleep', ['0.5']);
      }
      if (sh('id', [username])) {
        return { icon: 'error', mensagem: 'Não foi possível remover o usuário (processos ainda ativos)' };
      }
    }

    // Remove do banco de dados. Antes usava "grep -v", que retorna erro quando sobra 0 linhas
    // (apagar o último usuário) e abortava a limpeza, devolvendo erro ao painel.
    const dbFile = '/root/usuarios.db';
    if (fs.existsSync(dbFile)) {
      const linhas = fs.readFileSync(dbFile, 'utf8').split('\n')
        .filter(l => l.trim() !== '' && l.split(/\s+/)[0] !== username);
      fs.writeFileSync(dbFile, linhas.length ? linhas.join('\n') + '\n' : '');
    }
    try { fs.rmSync(`/etc/SSHPlus/senha/${username}`, { force: true }); } catch (e) { }
    try { fs.rmSync(`/etc/usuarios/${username}`, { force: true }); } catch (e) { }

    return { icon: 'success', mensagem: existe ? 'Usuário SSH deletado com sucesso' : `Usuário '${username}' não existe. Nada a deletar.` };

  } catch (error) {
    return { icon: 'error', mensagem: 'Erro ao deletar usuário SSH', error: error.message };
  }
}

module.exports = { deleteUser };
