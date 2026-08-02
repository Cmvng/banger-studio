FROM busybox:1.36
COPY banger-studio-app.html /www/index.html
CMD ["sh","-c","httpd -f -p ${PORT:-8080} -h /www"]
