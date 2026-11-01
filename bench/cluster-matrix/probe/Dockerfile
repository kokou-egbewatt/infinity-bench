# Built once, pinned by digest, reused for every rung and every candidate.
# The runtime stage is -base, not -devel: the probe must rely on the driver
# libraries the host injects, which is exactly what is under test.
ARG CUDA=12.8.0
FROM nvidia/cuda:${CUDA}-devel-ubuntu24.04 AS build
COPY gpu_probe.cu /tmp/
# sm_120 is the RTX 5060; the PTX entry lets the same binary run on newer cards.
RUN nvcc -O2 -o /tmp/gpu_probe /tmp/gpu_probe.cu \
      -gencode arch=compute_120,code=sm_120 \
      -gencode arch=compute_120,code=compute_120 \
      -lnvidia-ml

FROM nvidia/cuda:${CUDA}-base-ubuntu24.04
# Set explicitly rather than inherited: a plain image does not get these, and a
# compute probe without them fails for a reason unrelated to the cluster.
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility
COPY --from=build /tmp/gpu_probe /usr/local/bin/gpu_probe
ENTRYPOINT ["/usr/local/bin/gpu_probe"]
