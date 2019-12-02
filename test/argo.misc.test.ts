import * as sinon from "sinon"
import nock = require("nock")
import { Probot } from "probot"

const ArgocdBot = require("..")

// test fixtures
const payloadPr1 = require("./fixtures/issue_comment.created.pr1.json")
const payloadPr1Closed = require("./fixtures/pull_request.closed.pr1.json")
const payloadPr1UnlockComment = require("./fixtures/issue_comment.created.unlock.pr1.json")
const payloadPr2 = require("./fixtures/issue_comment.created.pr2.json")

nock.disableNetConnect()

describe("argo-cd-bot", () => {
    let probot
    let sandbox
    // constants
    const argoCDToken = "token"
    const argoCDServer = "1.2.3.4"

    beforeEach(() => {
        probot = new Probot({
            id: 123,
            cert: `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQC2RTg7dNjQMwPzFwF0gXFRCcRHha4H24PeK7ey6Ij39ay1hy2o
H9NEZOxrmAb0bEBDuECImTsJdpgI6F3OwkJGsOkIH09xTk5tC4fkfY8N7LklK+uM
ndN4+VUXTPSj/U8lQtCd9JnnUL/wXDc46wRJ0AAKsQtUw5n4e44f+aYggwIDAQAB
AoGAW2/cJs+WWNPO3msjGrw5CYtZwPuJ830m6RSLYiAPXj0LuEEpIVdd18i9Zbht
fL61eoN7NEuSd0vcN1PCg4+mSRAb/LoauSO3HXote+6Lhg+y5mVYTNkE0ZAW1zUb
HOelQp9M6Ia/iQFIMykhrNLqMG9xQIdLH8BDGuqTE+Eh8jkCQQDyR6qfowD64H09
oYJI+QbsE7yDOnG68tG7g9h68Mp089YuQ43lktz0q3fhC7BhBuSnfkBHwMztABuA
Ow1+dP9FAkEAwJeYJYxJN9ron24IePDoZkL0T0faIWIX2htZH7kJODs14OP+YMVO
1CPShdTIgFeVp/HlAY2Qqk/do2fzyueZJwJBAN5GvdUjmRyRpJVMfdkxDxa7rLHA
huL7L0wX1B5Gl5fgtVlQhPhgWvLl9V+0d6csyc6Y16R80AWHmbN1ehXQhPkCQGfF
RsV0gT8HRLAiqY4AwDfZe6n8HRw/rnpmoe7l1IHn5W/3aOjbZ04Gvzg9HouIpaqI
O8xKathZkCKrsEBz6aECQQCLgqOCJz4MGIVHP4vQHgYp8YNZ+RMSfJfZA9AyAsgP
Pc6zWtW2XuNIGHw9pDj7v1yDolm7feBXLg8/u9APwHDy
-----END RSA PRIVATE KEY-----`,
        })
        probot.load(ArgocdBot)
        sandbox = sinon.createSandbox();

        // few tests take longer to finish than the default time out of 5000
        jest.setTimeout(10000)

        // node env variables
        process.env.ARGOCD_AUTH_TOKEN = argoCDToken
        process.env.ARGOCD_SERVER = argoCDServer
    })

    afterEach(() => {
        sandbox.restore()
        nock.cleanAll()
    })

    test("help comment posted on PR", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, { token: "test" })

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch } } })

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /I'm a bot that helps with Kubernetes deployments/).reply(200)

        let helpPayload = JSON.parse(JSON.stringify(payloadPr1))
        helpPayload["comment"]["body"] = "argo help"
        await probot.receive({ name: "issue_comment", payload: helpPayload })
    })

    test("app rollback comment posted on PR", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, { token: "test" })

        const branch = "newBranch"
        const appName = "my_app"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch } } })

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        execStub.withArgs("./src/sh/rollback_latest_deployment.sh view " + appName).yields(false, "rollback success!")

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /rollback success!/).reply(200)

        let payload = JSON.parse(JSON.stringify(payloadPr1))
        payload["comment"]["body"] = "argo rollback view " + appName
        await probot.receive({ name: "issue_comment", payload: payload })
    })

    test("app info comment posted on PR", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, { token: "test" })

        const branch = "newBranch"
        const appName = "my_app"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch } } })

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        execStub.withArgs("./src/sh/view_app_info.sh " + appName).yields(false, "random info")

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /random info/).reply(200)

        let syncPayload = JSON.parse(JSON.stringify(payloadPr1))
        syncPayload["comment"]["body"] = "argo info " + appName
        await probot.receive({ name: "issue_comment", payload: syncPayload })
    })

    test("app sync comment posted on PR", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, { token: "test" })

        const branch = "newBranch"
        const appName = "my_app"


        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        execStub.withArgs("./src/sh/sync_current_branch.sh " + appName + " " + branch).yields(false, "sync success!")

        // bot should get sha for commit and post status check on PR with sync pending and sync success
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch, "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "repo": { "id": 1296269, "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", "name": "Hello-World", "full_name": "octocat/Hello-World", "owner": { "login": "octocat" } } } } });
        // first status check posted is a pending
        nock("https://api.github.com").post("/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e", /pending/).reply(200)

        // this API is used to get the current branch name
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch } } })

        // get sha commit on PR and post a sync success status check
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, { "data": { "number": 109, "head": { "ref": branch, "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "repo": { "id": 1296269, "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", "name": "Hello-World", "full_name": "octocat/Hello-World", "owner": { "login": "octocat" } } } } });
        nock("https://api.github.com").post("/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e", /success/).reply(200)

        // lastly, bot posts a comment on PR with sync success
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /sync success!/).reply(200)


        let syncPayload = JSON.parse(JSON.stringify(payloadPr1))
        syncPayload["comment"]["body"] = "argo sync " + appName
        await probot.receive({ name: "issue_comment", payload: syncPayload })
    })
})
