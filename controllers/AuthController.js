import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    const reqHeader = req.headers.authorization || '';
    const encodeCred = reqHeader.split(' ')[1] || '';
    const decodeCred = Buffer.from(encodeCred, 'base64').toString('ascii');
    const [email, password] = decodeCred.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hashedPassword = sha1(password);
    const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;

    // set the key token and expiration time
    await redisClient.set(key, user._id.toString(), 86400);

    return res.status(200).json({
      token: token,
    });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['X-Token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await redisClient.del(key);
    return res.status(200).send();
  }
}

export default AuthController;
