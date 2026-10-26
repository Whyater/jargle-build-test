# Jargle server

This folder installs the always-on Jargle web server on an Oracle Cloud VM. GitHub Pages remains the main public site at https://whyater.github.io/Jargle/.

## What runs where

| URL | What it is | Status |
| --- | --- | --- |
| https://whyater.github.io/Jargle/ | Main public site | Works without the VM |
| https://jargle.161-153-13-14.sslip.io/ | Caddy HTTPS site on the VM | Works after Oracle ports 80 and 443 are open |
| `/downloads/` | Download mirror | Copies installers from the newest GitHub release |

The VM uses Ubuntu 24.04 arm64 on Oracle Cloud Always Free. The setup uses an external configuration file at `/etc/jargle/jargle.env`, so machine-specific values stay out of this repository.

## Configure the VM

Copy `server/jargle.env.example` to `/etc/jargle/jargle.env` on the VM and set the site hostname and the VM address Caddy should bind to:

```sh
sudo install -d -m 755 /etc/jargle
sudo cp jargle.env.example /etc/jargle/jargle.env
sudo editor /etc/jargle/jargle.env
```

`JARGLE_HOST` is the HTTPS hostname. `JARGLE_BIND_IP` is the VM address for Caddy. Caddy reads both values through its systemd environment drop-in.

## Open ports 80 and 443 in the Oracle console

The VM firewall is opened by `setup.sh`, but Oracle has a second firewall outside the VM.

1. Sign in at https://cloud.oracle.com/.
2. Open **Menu > Networking > Virtual cloud networks**.
3. Click the VCN, then **Security** (or the **Security Lists** tab).
4. Open **Default Security List**, then click **Add Ingress Rules**.
5. Add a rule with source CIDR `0.0.0.0/0`, IP Protocol `TCP`, and Destination Port Range `80`.
6. Add a second rule with the same source and protocol, with Destination Port Range `443`.
7. Save the rules.

After the ports are open, run `sudo systemctl restart caddy` so Caddy requests the certificate right away. If certificate requests were rate limited, wait before trying again.

## Install or reapply the server setup

From the repository root, copy this folder and run the setup script:

```sh
rsync -a server/ <your-server>:/tmp/jargle-server/
ssh <your-server> 'sudo bash /tmp/jargle-server/setup.sh'
```

It is safe to run again. Re-running applies changed Caddy, service, timer, or updater files. Setup creates the `jargle` system user, the web directories, a 2 GB swapfile when needed, Caddy, the update timer, and the downloads mirror timer. It installs a Caddy override that waits for the network and restarts Caddy after a failed start.

The firewall step schedules an automatic rollback after five minutes. Open a **new** SSH session and confirm it works, then cancel the rollback:

```sh
sudo systemctl stop jargle-fw-rollback.timer
```

If the VM's ports are closed, you can expose the local listener with a tunnel such as Tailscale Funnel:

```sh
sudo tailscale funnel --bg --set-path /jargle http://127.0.0.1:8080
```

Check it with `tailscale funnel status`. To remove only this path, use:

```sh
sudo tailscale funnel --bg --set-path /jargle off
```

## Check status and logs

Run these on the VM:

```sh
systemctl status caddy
journalctl -u caddy -n 50
sudo tail -n 50 /var/log/caddy/jargle.log
systemctl list-timers jargle-update.timer
systemctl list-timers jargle-mirror.timer
journalctl -u jargle-update -n 20
readlink /var/www/jargle/current
curl -s http://127.0.0.1:8080/healthz.txt
```

A healthy response from `/healthz.txt` has these lines: `ok`, `version=...`, `sha256=...`, and `installed=...`.

## Updates and local builds

`jargle-update.timer` runs every five minutes. It downloads `https://github.com/Whyater/Jargle/releases/download/web-latest/jargle-web.tar.gz`, skips unchanged content using ETag and SHA-256 checks, installs releases under `/var/www/jargle/releases/<time>-<sha>`, points `/var/www/jargle/current` to the new release, and keeps the last three releases.

Run the updater immediately:

```sh
sudo systemctl start jargle-update
```

To install a local build, create the archive from `web/dist`, copy it to the VM, then install it:

```sh
tar --no-mac-metadata --no-xattrs -czf jargle-web.tar.gz -C web/dist .
scp jargle-web.tar.gz <your-server>:/tmp/jargle-web.tar.gz
ssh <your-server> 'sudo jargle-update /tmp/jargle-web.tar.gz'
```

The archive must have `index.html` at the top level or inside one top folder, and may not contain links.

## Downloads mirror

The mirror copies desktop and Android installers from the newest GitHub release whose tag starts with `v`. It checks for a new release every hour and removes old installer files.

```sh
sudo systemctl start jargle-mirror
journalctl -u jargle-mirror -n 20
cat /var/www/jargle/downloads/release.txt
```

## Roll back

List installed releases:

```sh
ls /var/www/jargle/releases
```

Point `current` at an older release, replacing `<older>` with its directory name:

```sh
sudo -u jargle ln -sfn /var/www/jargle/releases/<older> /var/www/jargle/current.tmp
sudo -u jargle mv -Tf /var/www/jargle/current.tmp /var/www/jargle/current
```

Pause and resume the update timer with:

```sh
sudo systemctl stop jargle-update.timer
sudo systemctl start jargle-update.timer
```

If the firewall change needs to be undone, restore the setup backups:

```sh
sudo sh -c 'iptables-restore < /root/jargle-setup/iptables.before'
sudo cp /root/jargle-setup/rules.v4.before /etc/iptables/rules.v4
```

To remove Jargle, stop and disable the timers, remove the optional tunnel path, then disable Caddy:

```sh
sudo systemctl disable --now jargle-update.timer
sudo systemctl disable --now jargle-mirror.timer
sudo tailscale funnel --bg --set-path /jargle off
sudo systemctl disable --now caddy
```

## Uptime monitoring

A free external monitor such as UptimeRobot can check every five minutes. Add an HTTPS monitor for `https://jargle.161-153-13-14.sslip.io/healthz.txt` and use a keyword check for `ok`.

## Things to know

- Oracle may reclaim an idle Always Free VM when, over 7 days, the 95th percentile CPU use is under 20% and network and memory use are also low. GitHub Pages keeps the app available if the VM is reclaimed.
- Ubuntu security updates use `unattended-upgrades`. Caddy comes from its own apt repository.
- Setup adds a 2 GB swapfile because this VM had no swap.
