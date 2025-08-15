const fs = require('fs');

function deletexray_v2ray(uuids) {
  const possiblePaths = [
    '/etc/xray/config.json',
    '/usr/local/etc/xray/config.json',
    '/etc/v2ray/config.json',
    '/usr/local/etc/v2ray/config.json',
    'teste.json'
  ];

  let results = [];

  possiblePaths.forEach(path => {
    if (!fs.existsSync(path)) {
      console.log(`❌ Arquivo ${path} não encontrado.`);
      results.push({ path, status: 'Arquivo não encontrado' });
      return;
    }

    try {
      const fileContent = fs.readFileSync(path, 'utf8');
      const config = JSON.parse(fileContent);

      const inbound = config.inbounds?.find(i => i?.settings?.clients);

      if (!inbound) {
        console.log(`⚠️ Nenhum inbound válido encontrado em ${path}`);
        results.push({ path, status: 'Inbound não encontrado' });
        return;
      }

      const originalLength = inbound.settings.clients.length;

      // Remove os usuários com os UUIDs informados
      inbound.settings.clients = inbound.settings.clients.filter(
        client => !uuids.some(u => u == client.id)
      );

      const removed = originalLength - inbound.settings.clients.length;

      // Salva o arquivo atualizado
      fs.writeFileSync(path, JSON.stringify(config, null, 2));

      console.log(`✅ ${removed} usuários removidos de ${path}`);
      results.push({ path, status: 'Sucesso', removidos: removed });

    } catch (error) {
      console.log(`🚫 Erro processando ${path}:`, error.message);
      results.push({ path, status: 'Erro', error: error.message });
    }
  });

  //Reniciar xray
  try {
    execSync(`systemctl restart xray`);
  } catch (error) {
    console.log('erro ao reniciar xray')
  }

  //Reniciar v2ray
  try {
    execSync(`systemctl restart v2ray`);
  } catch (error) {
    console.log('erro ao reniciar v2ray')
  }
  return {
    icon: 'success',
    mensagem: 'Processo concluído.',
    detalhes: results
  };
}
const uuidsParaRemover = [
  'uuid-1',
  'uuid-2',
  'uuid-3'
];

module.exports = { deletexray_v2ray }