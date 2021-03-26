const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const { join, resolve } = require('path');
// const { parseKTHEmail, readFile } = require('./parser');
const parser = {
  readFile(file) {
    return fs.readFileSync(file, 'utf8');
  },
  parseKTHEmail(file) {
    // TODO: FIXA FELHANTERING
    const data = this.readFile(file);
    const ma = data.match(/-----[^-----]+-----/)[0];
    const res = ma.match(/(([\w\d\._%+-]+)@kth.se)/g);
    return res;
  },
};
const actionDirectory = resolve(__dirname);
const root = join(actionDirectory, '..', '..', '..');

// Felhantering...
const kthIDs = parser.readFile(join(actionDirectory, 'kth-ids.txt')).split(/\n/);
console.log('KTH id', kthIDs);

try {
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context, undefined, 2)

  // const client = new GitHub(core.getInput('token', {required: true}))
  const client = github.getOctokit(core.getInput('token'));

  const base = github.context.payload.pull_request.base.sha;
  const head = github.context.payload.pull_request.head.sha;

  if (!base || !head) {
    core.setFailed(
      `The base and head commits are missing from the payload for this ${github.context.eventName} event. ` +
        "Please submit an issue on this action's GitHub repo."
    );
  }

  // Use compareCommits in order to find where README file is located, want to check members in readme in case a non-kths github is used
  client.repos.compareCommits({
    base,
    head,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
  }).then(response => {
    if (response.status !== 200) throw Error('Could not fetch changed files!');
    const files = response.data.files;

    // Find path to README file
    const filteredFiles = files
      .map(file => file.filename.split('/'))
      .filter(file => file.length > 3 && file[0] === 'contributions' );
    if (filteredFiles.length < 1) throw Error('Could not find path to README.md');
    const readme = join([...filteredFiles[0].splice(0,3), 'README.md']);
    console.log('File', readme);
    const ids = parser.parseKTHEmail(readme);
    console.log('In parse...', ids);
    const correctIDs = ids.filter(id => kthIDs.includes(id));
    console.log(correctIDs, ids);
    if(correctIDs.length === 0){
      core.setFailed("Invalid KTHids in README file");
    }

  }).catch(error => {
    core.setFailed(error.message);
  });

} catch (error) {
  core.setFailed(error.message);
}