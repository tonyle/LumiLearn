FROM caddy:2.10.2-alpine
# The upstream binary carries cap_net_bind_service. Its file capability cannot
# execute with an empty capability bounding set. Our HTTPS port is unprivileged.
RUN apk add --no-cache libcap-utils wget \
    && setcap -r /usr/bin/caddy \
    && apk del libcap-utils
