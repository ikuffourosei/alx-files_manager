import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const AppController = {
  async getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();

    res.status(200).send({ redis: redisStatus, db: dbStatus });
  },

  async getStats(req, res) {
    const userCounts = await dbClient.nbUsers();
    const fileCounts = await dbClient.nbFiles();

    res.status(200).send({ users: userCounts, files: fileCounts });
  },
};

export default AppController;
