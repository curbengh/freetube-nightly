import { Readable } from 'node:stream'
import { request } from '@octokit/request'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'stream/promises'
import { writeFile } from 'node:fs/promises'
const { env } = process

const requestWithAuth = request.defaults({
  headers: {
    authorization: `token ${env.github_token}`
  },
  owner: 'FreeTubeApp',
  repo: 'FreeTube'
})

const workflowRuns = await requestWithAuth('GET /repos/{owner}/{repo}/actions/runs', {
  branch: 'development',
  status: 'success',
  per_page: 20
})

let runId = ''
for (const run of workflowRuns.data.workflow_runs) {
  if (run.name === 'Build') {
    runId = run.id
    break
  }
}

const artifacts = await requestWithAuth('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
  run_id: runId,
})

let artifactId = ''
for (const artifact of artifacts.data.artifacts) {
  // nightly build: freetube-0.25.3-nightly-7822-amd64.pacman
  // release build: freetube-0.25.2-amd64.pacman
  if (artifact.name.endsWith('.pacman')) {
    artifactId = artifact.id
    const name = artifact.name
    const headSha = artifact.workflow_run.head_sha
    const workflowId = artifact.workflow_run.id
    // 7822
    const build = name.split('-')[3] ? `.build${name.split('-')[3]}` : ""
    // 0.25.3
    const tag = name.split('-')[1]
    const releaseTag = `${tag}${build}.${headSha.substring(0, 7)}`
    await writeFile('setenv.txt', `release_tag=${releaseTag}\nworkflow_id=${workflowId}\n`)
    break
  }
}

const dl = await requestWithAuth('GET /repos/{owner}/{repo}/actions/artifacts/{artifactId}/zip', { artifactId })

await pipeline(
  Readable.fromWeb((await fetch(dl.url)).body),
  createWriteStream('artifact.zip')
)
