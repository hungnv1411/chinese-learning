FROM postgres:16-alpine
RUN apk add --no-cache aws-cli bash
COPY backup.sh /usr/local/bin/backup.sh
# 02:30 UTC mỗi đêm
RUN echo '30 2 * * * /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1' > /etc/crontabs/root
CMD ["crond", "-f", "-l", "8"]
