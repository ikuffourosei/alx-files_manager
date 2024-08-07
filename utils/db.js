import MongoClient from 'mongodb/lib/mongo_client';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';

    this.isConnected = false;
    const url = `mongodb://${host}:${port}/`;
    this.client = new MongoClient(url, {
      // userNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.client
      .connect()
      .then(() => {
        console.log('MongoDB client connected');
        this.isConnected = true;
        this.db = this.client.db(this.database);
      })
      .catch((err) => {
        console.error('MongoDB client error:', err);
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    try {
      await this.client.connect();
      return this.db.collection('users').countDocuments();
    } catch (err) {
      console.error('Error counting users:', err);
      throw err;
    }
  }

  async nbFiles() {
    try {
      await this.client.connect();
      return this.db.collection('files').countDocuments();
    } catch (err) {
      console.error('Error counting files:', err);
      throw err;
    }
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
