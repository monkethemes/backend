const { client } = require('./middlewares/meilisearch');
const Metadata = require('./models/metadata');

async function setup() {
  try {
    const setupDone = await Metadata.findOne({ key: 'setupDone' });
    if (setupDone && setupDone.value === 'true') {
      console.log('Setup has been done before. Skipping...');
      return;
    }

    const indexName = 'themes';
    const index = await client.index(indexName, { primaryKey: 'id' });

    await index.updateSettings({
      displayedAttributes: ['id', 'userId', 'title', 'description', 'url', 'themeData', 'brightness', 'likes', 'likesDay', 'likesWeek', 'createdAt'],
      filterableAttributes: ['brightness', 'hasImage', 'likesList', 'userId'],
      sortableAttributes: ['likes', 'likesDay', 'likesWeek', `createdAt`],
      searchableAttributes: ['title', 'description']
    });

    const metadata = new Metadata({
        key: 'setupDone',
        value: 'true'
    });
    await metadata.save();

    console.log('Setup done!');
  } catch (error) {
    console.error(`Error during setup: ${error}`);
  }
}

module.exports = { setup };
