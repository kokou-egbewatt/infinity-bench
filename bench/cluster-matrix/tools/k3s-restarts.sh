#!/usr/bin/env bash
K="k3s kubectl"
echo "## k3s service"; systemctl show k3s -p NRestarts -p ActiveEnterTimestamp -p ExecMainStartTimestamp
echo "## last terminations"
$K get pods -A -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].lastState.terminated.reason}{" "}{.status.containerStatuses[0].lastState.terminated.exitCode}{" "}{.status.containerStatuses[0].lastState.terminated.finishedAt}{"\n"}{end}' | grep -v '^probe' | awk 'NF>1'
echo "## sandbox changes"
$K get events -A --sort-by=.lastTimestamp -o custom-columns=TIME:.lastTimestamp,NS:.metadata.namespace,OBJ:.involvedObject.name,REASON:.reason,MSG:.message --no-headers | grep -E 'SandboxChanged|Killing|BackOff|Unhealthy' | tail -20
echo "## k3s journal around it"
journalctl -u k3s --since "-12 min" --no-pager | grep -iE 'sandbox|restart|killing|oom|error' | grep -viE 'level=info.*(Wrote|Running)' | tail -25 | cut -c1-260
