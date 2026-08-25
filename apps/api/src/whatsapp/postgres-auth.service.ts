import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { proto, BufferJSON, initAuthCreds, AuthenticationState } from '@whiskeysockets/baileys';
import { Session } from '../database/models/Session';

@Injectable()
export class PostgresAuthService {
  private writeQueues = new Map<string, Promise<void>>();

  constructor(
    @InjectModel(Session)
    private sessionModel: typeof Session,
  ) {}

  async getAuthState(phone: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const writeData = async (data: any, type: string, id: string) => {
      const queueKey = `${phone}:${type}:${id}`;
      const previousTask = this.writeQueues.get(queueKey) || Promise.resolve();

      const newTask = (async () => {
        try {
          await previousTask;
          const sData = JSON.stringify(data, BufferJSON.replacer);

          const [session, created] = await this.sessionModel.findOrCreate({
            where: { phone, dataType: type, dataId: id },
            defaults: { data: sData }
          });

          if (!created && session.data !== sData) {
            await session.update({ data: sData });
          }
        } catch (err) {
          console.error(`Error writing auth data (${type}/${id}):`, err.message);
        }
      })();

      this.writeQueues.set(queueKey, newTask);
      await newTask;
    };

    const readData = async (type: string, id: string) => {
      try {
        const session = await this.sessionModel.findOne({
          where: { phone, dataType: type, dataId: id },
        });
        if (!session || !session.data) return null;
        return JSON.parse(session.data, BufferJSON.reviver);
      } catch (error) {
        console.error(`Error reading auth data (${type}/${id}):`, error.message);
        return null;
      }
    };

    const removeData = async (type: string, id: string) => {
      try {
        await this.sessionModel.destroy({
          where: { phone, dataType: type, dataId: id },
        });
      } catch (err) {
        console.error(`Error removing auth data (${type}/${id}):`, err.message);
      }
    };

    // Load initial creds
    let creds = await readData('creds', 'base');
    if (!creds) {
      creds = initAuthCreds();
      await writeData(creds, 'creds', 'base');
    }

    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const data = {};
            await Promise.all(
              ids.map(async (id) => {
                let value = await readData(type, id);
                if (type === 'app-state-sync-key' && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              }),
            );
            return data;
          },
          set: async (data) => {
            const tasks = [];
            for (const type in data) {
              for (const id in data[type]) {
                const value = data[type][id];
                if (value) {
                  tasks.push(writeData(value, type, id));
                } else {
                  tasks.push(removeData(type, id));
                }
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: async () => {
        // Ensure we save the latest creds state
        await writeData(creds, 'creds', 'base');
      },
    };
  }
}
