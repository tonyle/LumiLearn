FROM alpine:3.22
RUN apk add --no-cache libreoffice python3 fontconfig ttf-dejavu && adduser -D -u 10001 converter
COPY server.py /opt/server.py
ENV HOME=/tmp
USER converter
EXPOSE 8080
CMD ["python3","-u","/opt/server.py"]
