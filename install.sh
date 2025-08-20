#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
if [ $# -lt 3 ]; then
    echo "Uso: $0 <senha_autenticacao> <url_api> <url_api2>"
    exit 1
fi

#args nessesario
senha_autenticacao="$1"
urlonlines="$2"
porta2="$3"

#remover registros da instalação antiga
pm2 delele servidor
sudo rm -f "/usr/local/install*"
rm -r /usr/local/modulos_js

#fechar porta caso esteja aberta
sudo fuser -k $porta2/tcp

#Instalar wget e outros
apt-get install -y git zip unzip nload snapd curl wget sudo
apt-get install -y at 
pkill node

#definir horario de são paulo
sudo timedatectl set-timezone America/Sao_Paulo

#Baixar modulos
cd /usr/local
git clone https://github.com/clsshbr2/modulos_js.git
cd modulos_js

#Dar permissão para os modulos
find /usr/local/modulos_js/ -type f -exec chmod +x {} \;

#Criar arquivo config.json
cat <<EOF > /usr/local/modulos_js/config.json
{
    "authToken": "$senha_autenticacao",
    "url": "$urlonlines",
    "porta": $porta2
}
EOF

# Atualiza a lista de pacotes
sudo apt-get update

# Instalar gerenciado nodejs
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 22
nvm use 22
npm install -g pm2@latest
nvm ls
nvm alias default v22
nvm alias
ln -s $(which node) /usr/local/bin/node_global
nvm use 22


cd /usr/local/modulos_js/
npm install --force

# Da permissão e executar servidor
pm2 start /usr/local/modulos_js/index.js --name "servidor"
pm2 save
pm2 startup

# Configura firewall
sudo apt-get install firewalld -y
sudo systemctl enable firewalld -y
sudo systemctl start firewalld
sudo firewall-cmd --zone=public --add-port=1-$porta2/tcp --permanent
sudo firewall-cmd --permanent --add-port=$porta2/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8989/tcp
sudo firewall-cmd --permanent --add-port=9999/tcp
sudo firewall-cmd --permanent --add-port=7979/tcp
sudo firewall-cmd --permanent --add-port=6969/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --permanent --add-port=8002/tcp
sudo firewall-cmd --permanent --add-port=8003/tcp
sudo firewall-cmd --permanent --add-port=8004/tcp
sudo firewall-cmd --permanent --add-port=8005/tcp
sudo firewall-cmd --permanent --add-port=8006/tcp
sudo firewall-cmd --permanent --add-port=8007/tcp
sudo firewall-cmd --permanent --add-port=8008/tcp
sudo firewall-cmd --permanent --add-port=8009/tcp
sudo firewall-cmd --zone=public --add-port=1-65535/tcp --permanent
sudo firewall-cmd --zone=public --add-port=1-65535/udp --permanent
sudo firewall-cmd --reload
pm2 restart all

# Remove o script de instalação
sudo rm -f /usr/local/install.sh
find /usr/local -type f -name "install.sh*" -exec rm -f {} \;
find /usr/local -type f -name "uninstall.sh*" -exec rm -f {} \;

echo "Instalação concluida."

