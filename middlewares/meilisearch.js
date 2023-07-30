const { MeiliSearch } = require('meilisearch')

const client = new MeiliSearch({
  host: 'http://monkeythemes_search:7700',
  apiKey: process.env.MEILISEARCH_MASTER_KEY
})

module.exports = { client }
