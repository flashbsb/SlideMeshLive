FROM nginx:alpine

# Configuração customizada do Nginx com headers de desenvolvimento e no-cache
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;\n\
        add_header Access-Control-Allow-Origin "*" always;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
