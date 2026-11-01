// Three-level GPU probe. Exit code is the highest level reached, so a caller can
// tell "no driver" from "driver but no compute" without parsing text.
//   10 = nothing
//   20 = NVML initialised (driver reachable)
//   30 = CUDA context created
//   40 = allocation succeeded
//   50 = GEMM ran and the result verified   <- the only level that means "GPU works"
//
// Built for sm_120 (Blackwell, RTX 5060) plus PTX fallback. A probe built for an
// older arch fails with "no kernel image is available" and looks exactly like a
// passthrough failure, which is the mistake this whole benchmark exists to avoid.
//
// Usage: gpu_probe [alloc_mib=2048] [hold_s=0]
// hold_s keeps the allocation (and the CUDA context) alive after the result is printed, so a
// caller can sample whole-card memory.used while it is there. Without it the probe exits in
// milliseconds and no sampler sees the allocation.
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <unistd.h>
#include <cuda_runtime.h>
#include <nvml.h>

#define JSON(k, v) printf("  \"%s\": %s,\n", k, v)

// Error text is the most useful output, so it must survive as valid JSON.
static void json_str(const char *s) {
  putchar('"');
  for (; *s; ++s) {
    unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') printf("\\%c", c);
    else if (c < 0x20) printf("\\u%04x", c);
    else putchar(c);
  }
  putchar('"');
}

static int fail(int level, const char *stage, const char *err) {
  printf("  \"level\": %d,\n  \"failed_stage\": ", level);
  json_str(stage);
  printf(",\n  \"error\": ");
  json_str(err);
  printf("\n}\n");
  return level;
}

// C = A*B on square matrices, one thread per output element.
__global__ void gemm(const float *a, const float *b, float *c, int n) {
  int row = blockIdx.y * blockDim.y + threadIdx.y;
  int col = blockIdx.x * blockDim.x + threadIdx.x;
  if (row >= n || col >= n) return;
  float sum = 0.0f;
  for (int k = 0; k < n; ++k) sum += a[row * n + k] * b[k * n + col];
  c[row * n + col] = sum;
}

int main(int argc, char **argv) {
  // Megabytes to allocate; the caller cross-checks this against whole-card memory.used.
  long long alloc_mb = (argc > 1) ? atoll(argv[1]) : 2048;
  int hold_s = (argc > 2) ? atoi(argv[2]) : 0;
  printf("{\n");

  // --- level 20: NVML ---
  nvmlReturn_t nv = nvmlInit_v2();
  if (nv != NVML_SUCCESS) return fail(10, "nvml_init", nvmlErrorString(nv));
  unsigned int ndev = 0;
  nvmlDeviceGetCount_v2(&ndev);
  char buf[256];
  snprintf(buf, sizeof buf, "%u", ndev);
  JSON("nvml_device_count", buf);
  nvmlDevice_t nvdev;
  if (nvmlDeviceGetHandleByIndex_v2(0, &nvdev) == NVML_SUCCESS) {
    char name[96] = "";
    nvmlDeviceGetName(nvdev, name, sizeof name);
    printf("  \"nvml_name\": ");
    json_str(name);
    printf(",\n");
    nvmlMemory_t mem;
    if (nvmlDeviceGetMemoryInfo(nvdev, &mem) == NVML_SUCCESS) {
      snprintf(buf, sizeof buf, "%llu", (unsigned long long)(mem.total / (1024 * 1024)));
      JSON("nvml_total_mib", buf);
    }
    // The per-process query that returns nothing on WSL2. Recorded, never relied on.
    unsigned int nproc = 0;
    // unversioned: nvml.h maps it to the newest version (_v3 in CUDA 12.8; _v2 is not declared)
    nvmlDeviceGetComputeRunningProcesses(nvdev, &nproc, NULL);
    snprintf(buf, sizeof buf, "%u", nproc);
    JSON("nvml_compute_procs", buf);
  }

  // --- level 30: CUDA context ---
  int cudadev = 0;
  cudaError_t ce = cudaSetDevice(0);
  if (ce != cudaSuccess) return fail(20, "cuda_set_device", cudaGetErrorString(ce));
  ce = cudaFree(0);  // forces context creation
  if (ce != cudaSuccess) return fail(20, "cuda_context", cudaGetErrorString(ce));
  cudaDeviceProp prop;
  cudaGetDeviceProperties(&prop, cudadev);
  printf("  \"cuda_name\": ");
  json_str(prop.name);
  printf(",\n");
  snprintf(buf, sizeof buf, "\"%d.%d\"", prop.major, prop.minor);
  JSON("compute_capability", buf);

  // --- level 40: allocation ---
  void *big = NULL;
  size_t bytes = (size_t)alloc_mb * 1024 * 1024;
  ce = cudaMalloc(&big, bytes);
  if (ce != cudaSuccess) return fail(30, "cuda_malloc", cudaGetErrorString(ce));
  // Touch every byte so the allocation is resident, not just reserved.
  if (bytes) {
    ce = cudaMemset(big, 0, bytes);
    if (ce == cudaSuccess) ce = cudaDeviceSynchronize();
    if (ce != cudaSuccess) return fail(30, "cuda_memset", cudaGetErrorString(ce));
  }
  snprintf(buf, sizeof buf, "%lld", alloc_mb);
  JSON("allocated_mib", buf);

  // --- level 50: verified GEMM ---
  const int n = 256;
  size_t msz = (size_t)n * n * sizeof(float);
  float *ha = (float *)malloc(msz), *hb = (float *)malloc(msz), *hc = (float *)malloc(msz);
  for (int i = 0; i < n * n; ++i) { ha[i] = 1.0f; hb[i] = 2.0f; }
  float *da, *db, *dc;
  if (cudaMalloc(&da, msz) != cudaSuccess || cudaMalloc(&db, msz) != cudaSuccess ||
      cudaMalloc(&dc, msz) != cudaSuccess)
    return fail(40, "gemm_malloc", "allocation for GEMM operands failed");
  cudaMemcpy(da, ha, msz, cudaMemcpyHostToDevice);
  cudaMemcpy(db, hb, msz, cudaMemcpyHostToDevice);
  dim3 threads(16, 16), blocks((n + 15) / 16, (n + 15) / 16);
  gemm<<<blocks, threads>>>(da, db, dc, n);
  ce = cudaGetLastError();
  if (ce != cudaSuccess) return fail(40, "gemm_launch", cudaGetErrorString(ce));
  ce = cudaDeviceSynchronize();
  if (ce != cudaSuccess) return fail(40, "gemm_sync", cudaGetErrorString(ce));
  cudaMemcpy(hc, dc, msz, cudaMemcpyDeviceToHost);

  // Every element must be n * 1.0 * 2.0. A kernel that silently did nothing fails here.
  float want = 2.0f * n;
  for (int i = 0; i < n * n; ++i) {
    if (fabsf(hc[i] - want) > 1e-3f) {
      snprintf(buf, sizeof buf, "element %d was %.3f, expected %.3f", i, hc[i], want);
      return fail(40, "gemm_verify", buf);
    }
  }
  snprintf(buf, sizeof buf, "%.1f", want);
  JSON("gemm_value", buf);
  snprintf(buf, sizeof buf, "%d", hold_s);
  JSON("hold_s", buf);
  printf("  \"level\": 50,\n  \"failed_stage\": \"\",\n  \"error\": \"\"\n}\n");
  fflush(stdout);
  if (hold_s > 0) sleep(hold_s);  // allocation and context still live
  return 50;
}
