#!/usr/bin/env bash
echo "## boots"; journalctl --list-boots --no-pager | tail -8
echo "## pid 1 started"; ps -o lstart= -p 1
echo "## wsl.conf"; cat /etc/wsl.conf 2>/dev/null
