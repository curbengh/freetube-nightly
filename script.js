const { request } = require('@octokit/request')
const { stream: gotStream } = require('got')
const { createWriteStream } = require('fs')
const { pipeline } = require('stream/promises')
const { ParseOne: unzipOne } = require('unzipper')
const { writeFile } = require('fs/promises')
const { env } = process

const requestWithAuth = request.defaults({
  headers: {
    authorization: `token ${env.github_token}`
  },
  owner: 'FreeTubeApp',
  repo: 'FreeTube'
})

const f = async () => {
  let artifact_id = ''
  let name = 'freetube-0.23.2-nightly-5718-amd64.pacman'
  let headSha = ''
  let build = ''
  let tag = ''
  let releaseTag = ''
  let workflowId = ''
  const res = await requestWithAuth('GET /repos/{owner}/{repo}/actions/artifacts')

  for (const artifact of res.data.artifacts) {
    if (artifact.name.endsWith('.pacman')) {
      artifact_id = artifact.id
      name = artifact.name
      headSha = artifact.workflow_run.head_sha
      workflowId = artifact.workflow_run.id
      // 5718
      build = name.split('-')[3]
      // 0.23.2
      tag = name.split('-')[1]
      releaseTag = `${tag}.build${build}.${headSha.substring(0, 7)}`
      await writeFile('setenv.txt', `release_tag=${releaseTag}\nworkflow_id=${workflowId}\n`)
      break
    }
  }

  const dl = await requestWithAuth('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip', { artifact_id })

  await pipeline(
    gotStream(dl.url),
    unzipOne(),
    createWriteStream('freetube.pacman.tar.xz')
  )
}

f()
