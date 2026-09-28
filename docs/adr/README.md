# Architecture decision records

Choices that shape this repository, and why the obvious alternatives lost. A record is not edited
once accepted; a later decision that changes it supersedes it in a new record.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-series-plan-in-typescript.md) | The series plan is TypeScript, and posts claim entries by id | Accepted |
| [0002](0002-data-outside-the-site.md) | Harness data lives in `data/`, outside the site, and is read at build time | Accepted |
| [0003](0003-neuromesh-code-there-numbers-here.md) | Posts about NeuroMesh keep their code there and their numbers here | Accepted |

## Format

`NNNN-short-title.md`, numbered in order. A header lists Status (Proposed, Accepted, Superseded by
NNNN), Date and Authors, followed by Context, Decision, Alternatives considered and Consequences.
