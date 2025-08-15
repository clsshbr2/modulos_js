#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

# Parar o PM2 e remover os serviços
pm2 stop servidor2
pm2 delete servidor2
pm2 save
pm2 shutdown

apt-get autoremove --purge -y
apt-get clean

# Remover diretórios e arquivos relacionados
rm -rf /usr/local/modulos_js
rm -rf /usr/local/eclipse
rm -rf /usr/local/modulos.zip
rm -rf /usr/local/install.sh
rm -rf /etc/firewalld

# Remover o script de instalação
rm -f /usr/local/uninstall.sh
find /usr/local -type f -name "install.sh*" -exec rm -f {} \;
find /usr/local -type f -name "uninstall.sh*" -exec rm -f {} \;

echo "Desinstalação concluída com sucesso!"
