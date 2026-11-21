// The `compose.yaml` that `jaari init` writes on a server (ADR-056, ADR-079, ADR-094, ADR-122). The daemon runs as the
// owner's account, so the owner-only files it reads and writes keep their owner, with the ADR-094 container limits.
// shortcut: Docker's default seccomp profile; the profile for bubblewrap ships with the first sandbox (roadmap 4.7)
export const IMAGE = "ghcr.io/jaari-ai/jaari";

// `dataVolume`: the data in a named volume, for Docker Desktop, whose folders shared from macOS or Windows cannot hold the
// chat socket's mode (ADR-128).
export type ComposeOptions = { version: string; uid: number; gid: number; secrets: { name: string; file: string }[]; dataVolume?: boolean };

const DATA = "/home/jaari/.jaari/data";
// `nocopy`: Docker copies the image folder's owner and mode into a volume each time it is mounted empty, which would
// undo the owner that the `data` service sets.
const dataMount = `      - type: volume\n        source: data\n        target: ${DATA}\n        volume:\n          nocopy: true\n`;

const list = (items: string[], indent: string) => items.map((item) => `${indent}- ${JSON.stringify(item)}\n`).join("");

export function composeFile({ version, uid, gid, secrets: all, dataVolume = false }: ComposeOptions): string {
  const secrets = [...new Map(all.map((secret) => [secret.name, secret])).values()]; // two providers may share a key
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
  return `# Written by \`jaari init\`. Start: docker compose up --wait. Talk: docker compose exec jaari jaari chat
# Admin commands, with the daemon's limits and no network: docker compose run --rm admin doctor
services:
  jaari:
${common}    command: ["jaari-daemon"]
    init: true
${dataVolume ? "    depends_on:\n      data:\n        condition: service_completed_successfully\n" : ""}    restart: unless-stopped
    healthcheck: # ADR-127: \`up --wait\` waits until the daemon answers; a slow start has 2 minutes
      test: ["CMD", "jaari", "doctor"]
      interval: 30s
      timeout: 20s
      retries: 3
      start_period: 120s
      start_interval: 2s
    volumes:
      - ./config.jsonc:/home/jaari/.jaari/config.jsonc:ro
${dataVolume ? dataMount : `      - ./data:${DATA}\n`}
  admin:
    profiles: ["admin"]
${common}    entrypoint: ["jaari"]
    network_mode: none
    volumes:
      - .:/home/jaari/.jaari
${dataVolume ? dataMount : ""}${dataVolume ? `    depends_on:\n      data:\n        condition: service_completed_successfully\n${volumeOwner(version, uid, gid)}` : ""}${secrets.length > 0 ? `\nsecrets:\n${secrets.map(({ name, file }) => `  ${JSON.stringify(name)}:\n    file: ${JSON.stringify(file.replaceAll("$", "$$$$"))}\n`).join("")}` : ""}`;
}

// A new volume belongs to root. This one-off step, root with only the rights to change an owner and a mode, and no network, gives
// the data folder to the owner's account before the daemon or an admin command mounts it. It runs at every start.
const volumeOwner = (version: string, uid: number, gid: number) => `
  data:
    image: ${JSON.stringify(`${IMAGE}:${version}`)}
    user: "0:0"
    entrypoint: ["sh", "-c", "chown ${uid}:${gid} ${DATA} && chmod 700 ${DATA}"]
    network_mode: none
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - FOWNER
    security_opt:
      - no-new-privileges:true
    volumes:
${dataMount}
volumes:
  data: {}
`;
