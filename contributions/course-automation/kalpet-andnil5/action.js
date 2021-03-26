const core = require('@actions/core');
const { context, getOctokit } = require('@actions/github');
const { join, resolve } = require('path');
const { KTH_IDS_FILE, ROOT } = require('./config');
const Parser = require('./parser');

// Felhantering...
console.log('Retreving valid kthIDs');
const kthIDs = Parser.readFile().split(/\n/);

try {
  console.log("Finding README file location");
  const cont = Parser.parseContext(context);
  if (!cont.base || !cont.head || !cont.owner || !cont.repo) {
    throw Error(`Head, base, owner or repo are missing from the payload for this `+
    `${context.eventName} event. Please submit an issue on this action's GitHub repo.`
    );
  }

  // Use compareCommits in order to find where README file is located, want to check members in readme in case a non-kths github is used
  getOctokit(core.getInput('token')).repos.compareCommits(cont)
    .then(response => {
      if (response.status !== 200) throw Error('Could not fetch changed files!');
      const files = response.data.files;

      // Find path to README file
      const filteredFiles = files
        .map(file => file.filename.split('/'))
        .filter(file => file.length > 3 && file[0] === 'contributions' );
      if (filteredFiles.length < 1) throw Error('Could not find path to README.md');
      const readme = [ROOT, ...filteredFiles[0].splice(0,3), 'README.md'].join('/');
      console.log('README File location:', readme);
      const ids = Parser.parseKTHEmail(readme);
      console.log('KthIDs found in README', ids);
      const correctIDs = ids.filter(id => kthIDs.includes(id));
      console.log('Valid kthIDs found: ',correctIDs);
      if(correctIDs.length === 0){ //Borde vi faila ifall ett av id:na är ogiltiga? Kan testa
        core.setFailed("Invalid KTHids in README file");
      }
  }).catch(error => {
    core.setFailed(error.message);
  });

} catch (error) {
  core.setFailed(error.message);
}