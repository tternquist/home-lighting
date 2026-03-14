# Deployment

## Requirements

- Docker + Docker Compose on a Linux host (arm64 or amd64)
- Host must be on the same LAN as the WEC3 controller and any iOS/macOS devices using HomeKit
- Ports `4001` (HTTP) and `47129` (HomeKit) must be free on the host

## Quick start

```bash
# 1. Clone and enter the repo
git clone <repo-url> home-lighting && cd home-lighting

# 2. Edit WEC_URL in docker-compose.yml to point at your controller
#    (default: http://192.168.7.6)

# 3. Build and start
docker compose up -d --build

# 4. Tail logs to confirm startup
docker compose logs -f
```

The web UI is available at `http://<host-ip>:4001`.

## Configuration

All configuration is via environment variables in `docker-compose.yml`:

| Variable  | Default             | Description                            |
|-----------|---------------------|----------------------------------------|
| `PORT`    | `4001`              | HTTP server port                       |
| `WEC_URL` | `http://192.168.7.6`| URL of the WEC3 LED controller         |
| `HAP_PIN` | `031-45-154`        | HomeKit pairing code (digits only)     |
| `HAP_PORT`| `47129`             | HomeKit accessory protocol (HAP) port  |

Change `HAP_PIN` before first launch if you want a custom code. After changing it you must re-pair (see below).

## Data persistence

The `./server/data` directory on the host is bind-mounted into the container at `/app/server/data`. It contains:

| Path                        | Contents                                  |
|-----------------------------|-------------------------------------------|
| `presets.json`              | User-saved lighting presets               |
| `schedules.json`            | Scheduled automations                     |
| `location.json`             | Lat/lon + timezone for sunrise/sunset     |
| `hap-persist/`              | HomeKit pairing keys (do not delete unless re-pairing) |

Back this directory up before rebuilding if you want to retain presets and pairings.

## HomeKit pairing

1. Start the container (`docker compose up -d`)
2. Open the **Home** app on iPhone/iPad
3. Tap **+** → **Add Accessory** → **More options…**
4. Select **Home Lighting** from the list (discovered via mDNS on your LAN)
5. Enter the pairing code shown in `HAP_PIN` (default `031-45-154`)
6. Accept both **Channel 1** and **Channel 2** into your home

Pairing is stored in `server/data/hap-persist/` and survives container restarts and rebuilds.

### Re-pairing

Remove the accessory in the Home app first, then:

```bash
docker compose down
rm -rf server/data/hap-persist/
docker compose up -d
```

### Why `network_mode: host`?

HomeKit discovery uses mDNS (Bonjour), which relies on multicast packets. Docker's default bridge network does not forward multicast traffic between the container and the host LAN, so the accessory would never appear in the Home app. `network_mode: host` gives the container direct access to the host's network stack, solving this without any additional configuration.

This means the container's ports are bound directly on the host — no `ports:` mapping is needed or used.

## Updating

```bash
docker compose down
git pull
docker compose up -d --build
```

Persistent data in `./server/data` is untouched by rebuilds.

## Useful commands

```bash
# View live logs
docker compose logs -f

# Restart without rebuilding
docker compose restart

# Open a shell inside the running container
docker compose exec home-lighting sh

# Check health
curl http://localhost:4001/api/health
```
