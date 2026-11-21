# The Jaari image (ADR-056, ADR-122): the npm tarball of this release on Node, and nothing else. Build it after
# `node scripts/pack-release.mjs <version>`. The base image is pinned by digest; Dependabot moves it.
FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
LABEL org.opencontainers.image.source="https://github.com/jaari-ai/jaari" \
      org.opencontainers.image.description="Jaari, a self-hosted, single-owner personal AI agent" \
      org.opencontainers.image.licenses="MIT"
# git for the memory repo (ADR-132), from the base image's own Debian release; the lists are removed in the same layer.
RUN apt-get update \
 && apt-get install --yes --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
COPY dist/npm/jaari-*.tgz /tmp/
RUN npm install --global --ignore-scripts --no-audit --no-fund /tmp/jaari-*.tgz \
 && rm /tmp/jaari-*.tgz \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm \
 && mkdir -p /home/jaari/.jaari/data && chmod -R 0777 /home/jaari
ENV HOME=/home/jaari
WORKDIR /home/jaari
USER 10001:10001
CMD ["jaari-daemon"]
