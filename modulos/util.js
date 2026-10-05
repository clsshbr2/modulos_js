const { execFileSync } = require('child_process');
const crypto = require('crypto');

// Login permitido (o painel já exige só letras/números; aqui é a 2ª barreira,
// pois o nome vai para comandos do sistema)
function loginValido(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{1,32}$/.test(username) && username !== 'root';
}

// Senha SHA-512 ($6$). A antiga (perl crypt com salt "password") era DES: só os 8
// primeiros caracteres da senha valiam, e aspas/$/@ na senha quebravam o comando.
function hashSenha(password) {
  const salt = '$6$' + crypto.randomBytes(6).toString('hex') + '$';
  return execFileSync('perl', ['-e', 'print crypt($ARGV[0], $ARGV[1])', String(password), salt]).toString().trim();
}

module.exports = { loginValido, hashSenha };
