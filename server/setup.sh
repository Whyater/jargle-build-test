#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Only list services that need a restart.
export NEEDRESTART_MODE=l

CONFIG_FILE=/etc/jargle/jargle.env

load_config() {
    if [ ! -r "$CONFIG_FILE" ]; then
        echo "setup: create $CONFIG_FILE from jargle.env.example first" >&2
        exit 1
    fi
    # The file is also read by systemd for Caddy.
    set -a
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
    set +a
    if [ -z "${JARGLE_HOST:-}" ] || [ -z "${JARGLE_BIND_IP:-}" ]; then
        echo "setup: JARGLE_HOST and JARGLE_BIND_IP are required in $CONFIG_FILE" >&2
        exit 1
    fi
}

say() {
    echo "setup: $*"
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "setup: run this script as root, for example: sudo bash setup.sh" >&2
        exit 1
    fi
}

setup_swap() {
    if swapon --show --noheadings | grep . >/dev/null; then
        say "swap already active"
    elif [ -e /swapfile ]; then
        swapon /swapfile
        say "activated existing /swapfile"
    else
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
        swapon /swapfile
        say "created and activated 2G /swapfile"
    fi

    if [ -e /swapfile ] && ! grep -Fqx -- '/swapfile none swap sw 0 0' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        say "added /swapfile to /etc/fstab"
    elif [ -e /swapfile ] && grep -Fqx -- '/swapfile none swap sw 0 0' /etc/fstab; then
        say "/swapfile is already in /etc/fstab"
    else
        say "no /swapfile needed because another swap device is active"
    fi
}

setup_caddy() {
    if command -v caddy >/dev/null 2>&1; then
        say "caddy already installed"
        return
    fi

    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg

    if [ ! -e /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
            | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    else
        say "caddy repository key already exists"
    fi
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        > /etc/apt/sources.list.d/caddy-stable.list
    chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
    say "installed caddy"
}

setup_user_and_dirs() {
    if id jargle >/dev/null 2>&1; then
        say "user jargle already exists"
    else
        useradd --system --no-create-home --shell /usr/sbin/nologin jargle
        say "created user jargle"
    fi

    install -d -o jargle -g jargle -m 755 /var/www/jargle /var/www/jargle/releases /var/www/jargle/downloads
    install -d -o jargle -g jargle -m 750 /var/lib/jargle
    install -d -o caddy -g caddy -m 755 /var/log/caddy
    say "created Jargle directories"

    if [ ! -e /var/www/jargle/current ]; then
        install -d -o jargle -g jargle -m 755 /var/www/jargle/releases/00000000-000000-placeholder
        printf '%s\n' 'Jargle is being set up.' > /var/www/jargle/releases/00000000-000000-placeholder/index.html
        printf '%s\n' 'ok' 'version=00000000-000000-placeholder' > /var/www/jargle/releases/00000000-000000-placeholder/healthz.txt
        chown jargle:jargle /var/www/jargle/releases/00000000-000000-placeholder/index.html /var/www/jargle/releases/00000000-000000-placeholder/healthz.txt
        ln -s /var/www/jargle/releases/00000000-000000-placeholder /var/www/jargle/current
        chown -h jargle:jargle /var/www/jargle/current
        say "created placeholder release"
    else
        say "current release already exists"
    fi
}

install_configs() {
    local old_file="/etc/caddy/Caddyfile.orig"

    install -d -m 755 /etc/jargle
    local had_old=0

    if [ -e /etc/caddy/Caddyfile ] && [ ! -e "$old_file" ]; then
        cp /etc/caddy/Caddyfile "$old_file"
        say "backed up the existing Caddyfile"
    fi
    if [ -e "$old_file" ]; then
        had_old=1
    fi

    install -m 644 "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile
    if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
        if [ "$had_old" -eq 1 ]; then
            cp "$old_file" /etc/caddy/Caddyfile
        else
            rm -f /etc/caddy/Caddyfile
        fi
        echo "setup: Caddyfile validation failed" >&2
        exit 1
    fi
    chown -R caddy:caddy /var/log/caddy

    mkdir -p /etc/systemd/system/caddy.service.d
    install -m 644 "$SCRIPT_DIR/caddy-override.conf" /etc/systemd/system/caddy.service.d/jargle.conf
    systemctl daemon-reload
    systemctl enable caddy
    systemctl reload caddy || systemctl restart caddy
    install -m 755 "$SCRIPT_DIR/jargle-update.sh" /usr/local/bin/jargle-update
    install -m 644 "$SCRIPT_DIR/jargle-update.service" /etc/systemd/system/jargle-update.service
    install -m 644 "$SCRIPT_DIR/jargle-update.timer" /etc/systemd/system/jargle-update.timer
    install -m 755 "$SCRIPT_DIR/jargle-mirror.sh" /usr/local/bin/jargle-mirror
    install -m 644 "$SCRIPT_DIR/jargle-mirror.service" /etc/systemd/system/jargle-mirror.service
    install -m 644 "$SCRIPT_DIR/jargle-mirror.timer" /etc/systemd/system/jargle-mirror.timer
    systemctl daemon-reload
    systemctl enable --now jargle-update.timer
    systemctl enable --now jargle-mirror.timer
    say "installed and enabled Caddy and the Jargle update timer"
}

persist_rule() {
    local port="$1"
    local rule="-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT"
    local rules_file=/etc/iptables/rules.v4
    local temp_file

    if grep -Fqx -- "$rule" "$rules_file"; then
        return
    fi
    if ! grep -Fqx -- '-A INPUT -j REJECT --reject-with icmp-host-prohibited' "$rules_file"; then
        echo "setup: INPUT REJECT line was not found in $rules_file" >&2
        return 1
    fi
    temp_file=$(mktemp)
    awk -v rule="$rule" '
        $0 == "-A INPUT -j REJECT --reject-with icmp-host-prohibited" { print rule }
        { print }
    ' "$rules_file" > "$temp_file"
    cat "$temp_file" > "$rules_file"
    rm -f "$temp_file"
}

open_firewall() {
    local ports_open=1
    local port line
    local rules_file=/etc/iptables/rules.v4

    for port in 80 443; do
        if ! iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT >/dev/null 2>&1 \
            || ! grep -Fqx -- "-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT" "$rules_file"; then
            ports_open=0
        fi
    done
    if [ "$ports_open" -eq 1 ]; then
        say "firewall already allows TCP 80 and 443"
        return
    fi

    mkdir -p /root/jargle-setup
    if [ ! -e /root/jargle-setup/iptables.before ]; then
        iptables-save > /root/jargle-setup/iptables.before
    fi
    if [ ! -e /root/jargle-setup/rules.v4.before ]; then
        cp "$rules_file" /root/jargle-setup/rules.v4.before
    fi
    if ! grep -Fqx -- '-A INPUT -j REJECT --reject-with icmp-host-prohibited' "$rules_file"; then
        echo "setup: INPUT REJECT line was not found in $rules_file" >&2
        exit 1
    fi
    systemctl stop jargle-fw-rollback.timer 2>/dev/null || true
    systemctl reset-failed jargle-fw-rollback.service 2>/dev/null || true
    systemd-run --unit=jargle-fw-rollback --on-active=300 /bin/sh -c \
        'iptables-restore < /root/jargle-setup/iptables.before && cp /root/jargle-setup/rules.v4.before /etc/iptables/rules.v4'

    for port in 80 443; do
        if ! iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT >/dev/null 2>&1; then
            line=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { last = $1 } END { if (last) print last }')
            if [ -z "$line" ]; then
                echo "setup: INPUT REJECT rule was not found in live iptables" >&2
                exit 1
            fi
            iptables -I INPUT "$line" -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT
        fi
        persist_rule "$port"
    done

    if ! iptables-restore --test < "$rules_file"; then
        cp /root/jargle-setup/rules.v4.before "$rules_file"
        echo "setup: edited iptables rules failed validation, restored the backup" >&2
        exit 1
    fi

    cat <<'EOF'
+------------------------------------------------------------+
| Firewall changed. A rollback will run in 5 minutes.        |
| From your Mac, open a NEW ssh session to confirm it still   |
| works, then cancel the rollback with:                       |
| sudo systemctl stop jargle-fw-rollback.timer               |
+------------------------------------------------------------+
EOF
}

show_status() {
    echo "setup: status"
    systemctl is-active caddy || true
    systemctl list-timers jargle-update.timer --no-pager || true
    systemctl list-timers jargle-mirror.timer --no-pager || true
    readlink /var/www/jargle/current || true
    swapon --show || true
}

main() {
    require_root
    load_config
    setup_swap
    setup_caddy
    setup_user_and_dirs
    install_configs
    open_firewall
    show_status
}

main "$@"
