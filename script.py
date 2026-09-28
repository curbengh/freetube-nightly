from json import loads
from os import environ
from platform import python_version
from sys import exit as sys_exit
from urllib.request import (
    HTTPError,
    HTTPRedirectHandler,
    build_opener,
)
from zipfile import ZipFile


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        pass


opener = build_opener(NoRedirect())
opener.addheaders = [
    (
        "User-Agent",
        f"Python-urllib/{python_version()} {environ.get('GITHUB_REPOSITORY', '')}",
    ),
    ("Accept", "application/vnd.github+json"),
    (
        "Authorization",
        f"Bearer {environ.get('github_token', '')}",
    ),
    ("X-GitHub-Api-Version", "2026-03-10"),
]
artifacts = []
ARTIFACTS_URL = "https://api.github.com/repos/FreeTubeApp/FreeTube/actions/artifacts"
try:
    with opener.open(ARTIFACTS_URL) as res_artifacts:
        artifacts = loads(res_artifacts.read().decode("utf-8"))["artifacts"]
except HTTPError as e:
    print(f"'{e.url}' returned HTTP {e.status} {e.reason}")
    sys_exit()


artifact_id = ""
for artifact in artifacts:
    # nightly build: freetube-0.25.3-nightly-7822-amd64.pacman
    # release build: freetube-0.25.2-amd64.pacman
    if artifact["name"].endswith(".pacman"):
        artifact_id = artifact["id"]
        name = artifact["name"]
        head_sha = artifact["workflow_run"]["head_sha"]
        workflow_id = artifact["workflow_run"]["id"]
        # 7796
        build = f".build{name.split('-')[3]}" if len(name.split("-")) >= 4 else ""
        # 0.25.3
        tag = name.split("-")[1]
        release_tag = f"{tag}{build}.{head_sha[:7]}"
        with open("setenv.txt", "w") as setenv:
            setenv.write(f"release_tag={release_tag}\nworkflow_id={workflow_id}\n")
        break


zip_url = ""
try:
    res_zip = opener.open(f"{ARTIFACTS_URL}/{artifact_id}/zip")
except HTTPError as e:
    if e.status == 302:
        zip_url = e.headers.get("Location", "")
    else:
        print(f"'{e.url}' returned HTTP {e.status} {e.reason}")

opener.addheaders = [("Accept", "application/octet-stream")]
with opener.open(zip_url) as zip_res, open("artifact.zip", "wb") as f:
    f.write(zip_res.read())

with ZipFile("artifact.zip") as myzip:
    print(myzip.namelist())
    with open("freetube.pacman.tar.xz", mode="wb") as f:
        f.write(myzip.read(myzip.namelist()[0]))
