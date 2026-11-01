#!/bin/sh
# The check every probe container runs: the four preconditions, then the probe. Same as ladder.sh.
echo "dxg=$( [ -e /dev/dxg ] && echo 1 || echo 0 )"
echo "libcuda_file=$( [ -e /usr/lib/wsl/lib/libcuda.so.1 ] && echo 1 || echo 0 )"
echo "drivers_dir=$( [ -d /usr/lib/wsl/drivers ] && echo 1 || echo 0 )"
echo "libcuda_in_ldconfig=$(ldconfig -p | grep -c 'libcuda.so.1 ')"
echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
echo "NVIDIA_VISIBLE_DEVICES=$NVIDIA_VISIBLE_DEVICES"
echo "gpu_mounts=$(grep -cE 'wsl/lib|wsl/drivers|nvidia|dxg' /proc/self/mountinfo)"
grep -E 'wsl/lib|wsl/drivers|nvidia|dxg' /proc/self/mountinfo | awk '{print "  mount " $5}' | sort -u | head -12
/usr/local/bin/gpu_probe "${ALLOC:-2048}" "${HOLD:-0}"
echo "exit=$?"
