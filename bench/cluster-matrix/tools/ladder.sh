#!/usr/bin/env bash
# Step 02: the nesting ladder in plain Docker (Docker Desktop). Run from Git Bash.
#   usage: ladder.sh <out dir> [rung ...]     rungs: L1none L1 L1m L2 L2none L2m-gpus L2m-mounts
export MSYS_NO_PATHCONV=1
OUT="$1"; shift
RUNGS="${*:-L1none L1 L1m L2none L2 L2m-gpus L2m-mounts}"
IMG=cluster-matrix-probe:01
DIND=docker:28-dind
mkdir -p "$OUT"

# Same check in every container: the three preconditions, then the probe.
INNER='
echo "dxg=$( [ -e /dev/dxg ] && echo 1 || echo 0 )"
echo "libcuda_file=$( [ -e /usr/lib/wsl/lib/libcuda.so.1 ] && echo 1 || echo 0 )"
echo "libcuda_in_ldconfig=$(ldconfig -p | grep -c "libcuda.so.1 ")"
echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
echo "NVIDIA_VISIBLE_DEVICES=$NVIDIA_VISIBLE_DEVICES"
echo "gpu_mounts=$(grep -cE "wsl/lib|nvidia|dxg" /proc/self/mountinfo)"
grep -E "wsl/lib|nvidia|dxg" /proc/self/mountinfo | awk "{print \"  mount \" \$5}" | sort -u | head -12
/usr/local/bin/gpu_probe 2048 0
echo "exit=$?"
'
MOUNTS=(--device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib)
# tuned: the driver store too, where the /usr/lib/wsl/lib stubs load the real libraries from
MOUNTSD=(--device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro -v /usr/lib/wsl/drivers:/usr/lib/wsl/drivers:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib)

# Start a dind daemon with the given outer flags, load the probe image into it.
dind_up() {
  docker rm -f -v cm-dind >/dev/null 2>&1
  docker run -d --privileged --name cm-dind "$@" "$DIND" >/dev/null || return 1
  for _ in $(seq 1 60); do docker exec cm-dind docker info >/dev/null 2>&1 && break; sleep 1; done
  docker save "$IMG" | docker exec -i cm-dind docker load >/dev/null
}
dind_down() { docker rm -f -v cm-dind >/dev/null 2>&1; }

for r in $RUNGS; do
  f="$OUT/$r.txt"
  start=$(date +%s)
  {
    echo "## rung $r  $(date -u +%FT%TZ)"
    case "$r" in
      L1none)   # negative control: nothing asked for. Override the image's NVIDIA_* env so nothing injects.
        echo '$ docker run --rm -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh IMG -c INNER'
        docker run --rm -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER" ;;
      L1)
        echo '$ docker run --rm --gpus all --entrypoint sh IMG -c INNER'
        docker run --rm --gpus all --entrypoint sh "$IMG" -c "$INNER" ;;
      L1m)      # device + libs + loader path, no --gpus, no toolkit
        echo '$ docker run --rm --device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh IMG -c INNER'
        docker run --rm "${MOUNTS[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER" ;;
      L2none)   # dind with --gpus outside, nothing asked for inside
        echo '$ docker run -d --privileged --gpus all docker:28-dind; inner: docker run --rm -e NVIDIA_VISIBLE_DEVICES=void IMG'
        dind_up --gpus all && docker exec cm-dind docker run --rm -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
      L2)       # --gpus at both depths
        echo '$ docker run -d --privileged --gpus all docker:28-dind; inner: docker run --rm --gpus all IMG'
        dind_up --gpus all && docker exec cm-dind docker run --rm --gpus all --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
      L2m-gpus) # --gpus outside, device + libs + loader path inside
        echo '$ docker run -d --privileged --gpus all docker:28-dind; inner: docker run --rm --device /dev/dxg -v /usr/lib/wsl/lib:... -e LD_LIBRARY_PATH=... IMG'
        dind_up --gpus all && docker exec cm-dind docker run --rm "${MOUNTS[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
      L2m-mounts) # no toolkit at either depth: device + libs passed down by hand twice
        echo '$ docker run -d --privileged --device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro docker:28-dind; inner: same mounts + LD_LIBRARY_PATH'
        dind_up --device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro && docker exec cm-dind docker run --rm "${MOUNTS[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
      # tuned rungs: the same, plus the driver store at /usr/lib/wsl/drivers
      L1md)
        echo '$ docker run --rm --device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro -v /usr/lib/wsl/drivers:/usr/lib/wsl/drivers:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh IMG -c INNER'
        docker run --rm "${MOUNTSD[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER" ;;
      L2md-mounts)
        echo '$ docker run -d --privileged --device /dev/dxg -v /usr/lib/wsl/lib:...:ro -v /usr/lib/wsl/drivers:...:ro docker:28-dind; inner: same mounts + LD_LIBRARY_PATH'
        dind_up --device /dev/dxg -v /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro -v /usr/lib/wsl/drivers:/usr/lib/wsl/drivers:ro && docker exec cm-dind docker run --rm "${MOUNTSD[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
      L2md-gpus) # --gpus outside, driver-store mounts inside: does the outer hook pass down enough?
        echo '$ docker run -d --privileged --gpus all docker:28-dind; inner: device + lib + drivers mounts + LD_LIBRARY_PATH'
        dind_up --gpus all && docker exec cm-dind docker run --rm "${MOUNTSD[@]}" -e NVIDIA_VISIBLE_DEVICES=void --entrypoint sh "$IMG" -c "$INNER"; dind_down ;;
    esac
    echo "## docker exit=$?  seconds=$(( $(date +%s) - start ))"
  } > "$f" 2>&1
  lvl=$(grep -o '"level": [0-9]*' "$f" | grep -o '[0-9]*$'); [ -z "$lvl" ] && lvl=none
  printf '%-11s level=%-4s %s\n' "$r" "$lvl" "$(grep -oE '^(dxg|libcuda_file|libcuda_in_ldconfig|gpu_mounts)=[0-9]+' "$f" | tr '\n' ' ')"
done
