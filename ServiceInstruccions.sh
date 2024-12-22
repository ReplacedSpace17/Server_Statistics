sudo nano /etc/systemd/system/serverStatistics.service
_______________________________________________________

[Unit]
Description=Server statistics service
After=network.target

[Service]
ExecStart=/usr/bin/node /home/sermex-segu/Server_Statistics/index.js
WorkingDirectory=/home/sermex-segu/Server_Statistics
Restart=always
User=sermex-segu2
Group=segucom
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
# Si estás usando pm2, el comando sería algo como:
# ExecStart=/usr/bin/pm2 start /home/sermex-segu/BackendSegucom/index.js --name backendsegucom

[Install]
WantedBy=multi-user.target

_______________________________________________________

/home/sermex-segu/Server_Statistics


sudo systemctl daemon-reload
sudo systemctl enable serverStatistics
sudo systemctl start serverStatistics
sudo systemctl stop serverStatistics
sudo systemctl restart serverStatistics
sudo systemctl status serverStatistics





sudo visudo
sermex-segu ALL=(ALL) NOPASSWD: /sbin/reboot
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl restart backendsegucom.service
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl restart segucomunication
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl restart nginx
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl restart mysqld.service
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl status backendsegucom.service
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl status segucomunication
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl status nginx
sermex-segu ALL=(ALL) NOPASSWD: /bin/systemctl status mysqld.service

//gets
http://localhost:9000/service/confirm/status/segucom-backend
http://localhost:9000/service/confirm/status/segucomunications
http://localhost:9000/service/confirm/status/nginx
http://localhost:9000/service/confirm/status/database

//post
http://localhost:9000/service/confirm/restart/segucom-backend
http://localhost:9000/service/confirm/restart/segucomunications
http://localhost:9000/service/confirm/restart/nginx
http://localhost:9000/service/confirm/restart/database