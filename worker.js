const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const db = require('./utils/db');

const fileQueue = new Bull('fileQueue', {
  redis: { port: 6379, host: '127.0.0.1' },
});

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await db.nbFiles(fileId, userId);
  if (!file) {
    throw new Error('File not found');
  }

  const filePath = file.path; // Adjust to your actual file path retrieval
  const sizes = [500, 250, 100];

  for (const size of sizes) {
    try {
      const thumbnailPromises = sizes.map(async (size) => {
        const options = { width: size };
        const thumbnail = await imageThumbnail(filePath, options);
        const thumbnailPath = `${filePath}_${size}`;
        fs.writeFileSync(thumbnailPath, thumbnail);
      });
      await Promise.all(thumbnailPromises);
    } catch (error) {
      console.error(`Error generating thumbnail for size ${size}:`, error);
    }
  }
});

console.log('Worker is running...');
