import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import mime from 'mime-types';

const FilesController = {
  postUpload: async (req, res) => {
    const token = req.headers['X-Token'];
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!name) return res.status(400).json({ error: 'Missing name' });

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const parent = parentId !== 0 ? await dbClient.db
      .collection('files')
      .findOne({ _id: parentId }) : null;

    if (parentId !== 0 && !parent) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    if (parent && parent.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type !== 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);

      return res.status(201).json({ id: result.insertedId, ...fileDocument });
    }

    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.mkdir(FOLDER_PATH, { recursive: true });

    const localPath = path.join(FOLDER_PATH, uuidv4());
    await fs.writeFile(localPath, Buffer.from(data, 'base64'));

    fileDocument.localPath = localPath;

    const result = await dbClient
      .collection('files').insertOne(fileDocument);

    return res.status(201).json({ id: result.insertedId, ...fileDocument });
  },

  getShow: async (req, res) => {
    const token = req.headers['X-Token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const docId = req.params.id;
    if (!ObjectId.isValid(docId)) {
      return req.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(docId) });
    if (!file) {
      return req.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  },

  getIndex: async (req, res) => {
    const token = req.headers['X-Token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;

    const query = {
      userId: new ObjectId(userId),
      parentId: parentId === 0 ? 0 : new ObjectId(parentId),
    };

    const file = await dbClient.db.collection('files')
      .find(query)
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    return res.status(200).json(file);
  },

  putPublish: async (req, res) => {
    const token = req.headers['X-Token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id

    const file = await dbClient.db.collection('files').fineOne({ _id: new ObjectId(fileId) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: true } },
    )

    const fileUpdate = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
    return res.status(200).json({ fileUpdate });
  },

  putUnpublish: async (req, res) => {
      const token = req.headers['X-Token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id

      const file = await dbClient.db.collection('files').fineOne({ _id: new ObjectId(fileId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      await dbClient.db.collection('files').updateOne(
        { _id: new ObjectId(fileId) },
        { $set: { isPublic: false } },
      )

      const fileUpdate = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
      return res.status(200).json({ fileUpdate });
  },

  getFile: async (req, res) => {
    const fileId = req.params.id;
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      if (!userId || !file.userId.equals(new ObjectId(userId))) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(file.localPath);
    fileStream.pipe(res);
  },
};

export default FilesController;
