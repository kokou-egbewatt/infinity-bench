// The workflow the runner class checker opens with: one job of each kind the post describes.
export const SAMPLE_WORKFLOW = `name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make lint

  unit:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - run: make test

  contract:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - "6379:6379"
    steps:
      - uses: actions/checkout@v4
      - run: make contract-tests

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        ports:
          - 5432:5432
      cache:
        image: redis:7
        ports:
          - 6379
    steps:
      - uses: actions/checkout@v4
      - run: make integration-tests

  dockerfile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hadolint/hadolint-action@v3.1.0

  image:
    runs-on: ubuntu-latest
    needs: [lint, unit]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6

  desktop:
    runs-on: windows-latest
    steps:
      - run: ./build.ps1
`;
