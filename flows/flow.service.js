const Flow = require("../models/Flow");
const FlowNode = require("../models/FlowNode");
const sequelize = require("../db");

class FlowService {
  async createFlow(userNumber, flowData) {
    const transaction = await sequelize.transaction();
    try {
      const { name, trigger, nodes } = flowData;

      const flow = await Flow.create({
        name,
        trigger: trigger.toLowerCase().trim(),
        userNumber
      }, { transaction });

      if (nodes && Array.isArray(nodes)) {
        const nodeRecords = nodes.map(node => ({
          flowId: flow.id,
          nodeId: String(node.id),
          type: node.type,
          data: node.data || {},
          next: node.next ? String(node.next) : null
        }));
        await FlowNode.bulkCreate(nodeRecords, { transaction });
      }

      await transaction.commit();
      return this.getFlowById(userNumber, flow.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listFlows(userNumber) {
    return await Flow.findAll({
      where: { userNumber },
      include: [{ model: FlowNode, as: 'nodes' }]
    });
  }

  async getFlowById(userNumber, id) {
    return await Flow.findOne({
      where: { id, userNumber },
      include: [{ model: FlowNode, as: 'nodes' }]
    });
  }

  async updateFlow(userNumber, id, updateData) {
    const transaction = await sequelize.transaction();
    try {
      const flow = await Flow.findOne({ where: { id, userNumber } });
      if (!flow) throw new Error("Flow not found");

      const { name, trigger, nodes } = updateData;
      if (name) flow.name = name;
      if (trigger) flow.trigger = trigger.toLowerCase().trim();
      await flow.save({ transaction });

      if (nodes) {
        await FlowNode.destroy({ where: { flowId: id }, transaction });
        const nodeRecords = nodes.map(node => ({
          flowId: flow.id,
          nodeId: String(node.id),
          type: node.type,
          data: node.data || {},
          next: node.next ? String(node.next) : null
        }));
        await FlowNode.bulkCreate(nodeRecords, { transaction });
      }

      await transaction.commit();
      return this.getFlowById(userNumber, id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteFlow(userNumber, id) {
    return await Flow.destroy({ where: { id, userNumber } });
  }
}

// Define associations
Flow.hasMany(FlowNode, { foreignKey: 'flowId', as: 'nodes', onDelete: 'CASCADE' });
FlowNode.belongsTo(Flow, { foreignKey: 'flowId' });

module.exports = new FlowService();
