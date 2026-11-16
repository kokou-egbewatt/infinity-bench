from _lib import capture_env


def test_env_vars_fill_git_host_and_cluster(monkeypatch):
    monkeypatch.setattr(capture_env, "gpu_nvml", lambda: None)
    monkeypatch.setattr(capture_env, "gpu_smi", lambda: None)
    for k, v in {
        "GIT_SHA": "abc1234",
        "GIT_DIRTY": "false",
        "GIT_BRANCH": "main",
        "HOST_RAM_GB": "63.6",
        "CLUSTER_TIME_SLICING": "1",
        "CLUSTER_OTHER_GPU_PODS": "neuromesh/vllm-0, ",
    }.items():
        monkeypatch.setenv(k, v)
    env = capture_env.capture("vram-accounting", "config.yaml")
    assert env["git"] == {
        "repo": "infinity-bench",
        "sha": "abc1234",
        "dirty": False,
        "branch": "main",
    }
    assert env["host"]["ram_gb"] == 63.6
    assert env["cluster"]["time_slicing_replicas"] == 1
    assert env["cluster"]["other_gpu_pods"] == ["neuromesh/vllm-0"]
    assert env["gpu"] is None
    assert env["harness"]["name"] == "vram-accounting"
    assert env["captured_at"][-6] in "+-"  # local time with an offset


def test_unset_and_bad_values_are_null(monkeypatch):
    monkeypatch.setattr(capture_env, "gpu_nvml", lambda: None)
    monkeypatch.setattr(capture_env, "gpu_smi", lambda: None)
    monkeypatch.delenv("GIT_SHA", raising=False)
    monkeypatch.setenv("HOST_RAM_GB", "lots")
    env = capture_env.capture()
    assert env["git"]["sha"] is None
    assert env["host"]["ram_gb"] is None
    assert env["cluster"]["other_gpu_pods"] == []


def test_utc_offset_from_windows(monkeypatch):
    monkeypatch.setenv("UTC_OFFSET", "-0500")
    assert capture_env.now().isoformat().endswith("-05:00")
    monkeypatch.setenv("UTC_OFFSET", "+05:30")
    assert capture_env.now().isoformat().endswith("+05:30")
