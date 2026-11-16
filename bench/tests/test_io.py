import csv
import json

import pytest

from _lib import io


def test_round_trip(tmp_path):
    rows = [{"a": "x", "b": 1.25, "c": None}, {"a": "y, z", "b": 2.0, "c": 3}]
    path = io.write_results("r.csv", rows, ["a", "b", "c"], precision={"b": 2}, base=tmp_path)
    raw = path.read_bytes()
    assert b"\r\n" not in raw
    back = list(csv.DictReader(path.open(encoding="utf-8")))
    assert back == [{"a": "x", "b": "1.25", "c": ""}, {"a": "y, z", "b": "2.00", "c": "3"}]


def test_default_precision_is_one_place(tmp_path):
    path = io.write_results("r.csv", [{"v": 3.14159}], ["v"], base=tmp_path)
    assert path.read_text().splitlines()[1] == "3.1"


def test_nested_path_is_created(tmp_path):
    path = io.write_results("2026-11-14/raw/s.csv", [{"v": 1}], ["v"], base=tmp_path)
    assert path.exists()


@pytest.mark.parametrize("name", ["../escape.csv", "a/../../escape.csv"])
def test_refuses_to_write_outside(tmp_path, name):
    with pytest.raises(ValueError):
        io.write_results(name, [], ["v"], base=tmp_path / "out")


def test_unknown_column_is_an_error(tmp_path):
    with pytest.raises(ValueError):
        io.write_results("r.csv", [{"v": 1, "w": 2}], ["v"], base=tmp_path)


def test_env(tmp_path):
    path = io.write_env({"schema": 1}, base=tmp_path)
    assert json.loads(path.read_text()) == {"schema": 1}
    assert path.read_bytes().endswith(b"}\n")
