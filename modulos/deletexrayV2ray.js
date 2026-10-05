const fs = require('fs');
const { execSync } = require('child_process'); // faltava: o restart abaixo nunca rodava

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

  // Só reinicia se algo foi removido (o restart derruba as conexões de todos os clientes)
  const algumRemovido = results.some(r => r.removidos > 0);
  if (algumRemovido) {
    for (const servico of ['xray', 'v2ray']) {
      try {
        execSync(`systemctl is-active --quiet ${servico} && systemctl restart ${servico}`);
      } catch (error) {
        // serviço não instalado/parado: normal
      }
    }
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