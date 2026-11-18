// The `compose.yaml` that `jaari init` writes on a server (ADR-056, ADR-079, ADR-094, ADR-122). The daemon runs as the
// owner's account, so the owner-only files it reads and writes keep their owner, with the ADR-094 container limits.
// shortcut: Docker's default seccomp profile; the profile for bubblewrap ships with the first sandbox (roadmap 4.7)
export const IMAGE = "ghcr.io/jaari-ai/jaari";

export type ComposeOptions = { version: string; uid: number; gid: number; secrets: { name: string; file: string }[] };

const list = (items: string[], indent: string) => items.map((item) => `${indent}- ${JSON.stringify(item)}\n`).join("");

export function composeFile({ version, uid, gid, secrets }: ComposeOptions): string {
  const names = secrets.map(({ name }) => name);
  const common = `    image: ${JSON.stringify(`${IMAGE}:${version}`)}
    user: "${uid}:${gid}"
    environment:
      HOME: /home/jaari
      CREDENTIALS_DIRECTORY: /run/secrets
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
${names.length > 0 ? "" : `      - /run/secrets:size=1m,mode=0700,uid=${uid},gid=${gid} # no secrets, but the daemon checks that the folder exists\n`}    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    pids_limit: 256
    mem_limit: 2g
${names.length > 0 ? `    secrets:\n${list(names, "      ")}` : ""}`;
  return `# Written by \`jaari init\`. Start: docker compose up -d. Talk: docker compose exec jaari jaari chat
# Admin commands, with the daemon's limits and no network: docker compose run --rm admin doctor
services:
  jaari:
${common}    command: ["jaari-daemon"]
    init: true
    restart: unless-stopped
    volumes:
      - ./config.jsonc:/home/jaari/.jaari/config.jsonc:ro
      - ./data:/home/jaari/.jaari/data

  admin:
    profiles: ["admin"]
${common}    entrypoint: ["jaari"]
    network_mode: none
    volumes:
      - .:/home/jaari/.jaari
${secrets.length > 0 ? `\nsecrets:\n${secrets.map(({ name, file }) => `  ${JSON.stringify(name)}:\n    file: ${JSON.stringify(file)}\n`).join("")}` : ""}`;
}
