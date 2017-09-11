const request = require('superagent')
const parseHeader = require('parse-link-header')
const fs = require('fs')

const API_TOKEN = process.env.GITHUB_API_TOKEN

// define the data you want to save into the repos list
const shrinkRepoInfo = (repo) => ({
  id: repo.id,
  name: repo.name,
  html_url: repo.html_url,
  ssh_url: repo.ssh_url
})

const shrinkOrgInfo = (org) => ({
  id: org.id,
  name: org.login,
  login: org.login,
  url: org.url,
  repos: []
})

const fillLocalArray = (localRepoArr, fetchedRepoArr, mapper) => {
  let shrunkData = fetchedRepoArr.map(mapper)
  console.log(shrunkData)
  console.log('shrunkData.length', shrunkData.length)
  // printDebugInfo(res)
  localRepoArr.push(...shrunkData)
}

const printDebugInfo = (res) => {
  // console.log(res.headers)
  // console.log(res.headers['link'])
  const links = parseHeader(res.headers['link'])
  console.log('Link Header', links)
}

// recursive promise-able fetch for multi-page results
const getGithubList = (localData, accessToken, url, dataMapper, name = 'name not given') => {
  return request
  .get(url)
  .query({
    'type': 'all',
    'per_page': 100,
    'access_token': accessToken
  })
  .then((res) => { // success
    console.log('Fetching:', name)
    // dataMapper(res.body)
    fillLocalArray(localData, res.body, dataMapper)

    const links = parseHeader(res.headers['link'])

    if (links && links.next) {
      return getGithubList(localData, API_TOKEN, links.next.url, dataMapper, name)
    } else {
      return localData
    }
  }, (err) => { // error
    if (err) {
      console.log(err)
    }
  })
}

var user_info = []
// fetch list of all repos under the orgs list
getGithubList(
  user_info,
  API_TOKEN,
  `https://api.github.com/user/orgs`,
  shrinkOrgInfo,
  'My User Account'
)
.then((user_orgs) => (
  // fetch list of all repos under the orgs list
  Promise.all(user_orgs.map((org) => (
    getGithubList(
      org.repos,
      API_TOKEN,
      `https://api.github.com/orgs/${org.name}/repos`,
      shrinkRepoInfo,
      org.name
    )
  )))
  .then(() => {
    console.log('all done')
    var jsonOut = JSON.stringify(user_orgs, undefined, 2)
    // console.log('Github Orgs', jsonOut)
    // console.log('all done')
    fs.writeFile('orgs_with_repos.json', jsonOut, (err) => {
      if (err) throw err
      console.log('The file has been saved!')
    })
  }, (err) => {
    console.error('something failed')
    console.error(err)
  })
))
