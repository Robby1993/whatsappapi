const { proto, BufferJSON, initAuthCreds } = require("@whiskeysockets/baileys");
const Session = require("./models/Session");

/**
 * Custom Baileys Auth State Provider for PostgreSQL (Sequelize)
 */
const usePostgresAuthState = async (phone) => {
  const writeData = async (data, type, id) => {
    const sData = JSON.stringify(data, BufferJSON.replacer);
    await Session.upsert({
      phone,
      dataType: type,
      dataId: id,
      data: sData
    });
  };

  const readData = async (type, id) => {
    try {
      const session = await Session.findOne({
        where: { phone, dataType: type, dataId: id }
      });
      if (!session || !session.data) return null;
      return JSON.parse(session.data, BufferJSON.reviver);
    } catch (error) {
      return null;
    }
  };

  const removeData = async (type, id) => {
    await Session.destroy({
      where: { phone, dataType: type, dataId: id }
    });
  };

  // Load initial creds
  let creds = await readData("creds", "base");
  if (!creds) {
    creds = initAuthCreds();
    await writeData(creds, "creds", "base");
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
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
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
        }
      }
    },
    saveCreds: async () => {
      await writeData(creds, "creds", "base");
    }
  };
};

module.exports = usePostgresAuthState;
