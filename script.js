import { Readable } from 'node:stream'
import { request } from '@octokit/request'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'stream/promises'
import { ParseOne as unzipOne } from 'unzipper'
import { writeFile } from 'node:fs/promises'
const { env } = process

const requestWithAuth = request.defaults({
  headers: {
    authorization: `token ${env.github_token}`
  },
  owner: 'FreeTubeApp',
  repo: 'FreeTube'
})

let artifactId = ''
const res = await requestWithAuth('GET /repos/{owner}/{repo}/actions/artifacts')

for (const artifact of res.data.artifacts) {
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
  unzipOne(),
  createWriteStream('freetube.pacman.tar.xz')
)
